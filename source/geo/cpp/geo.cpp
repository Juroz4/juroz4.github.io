// ============================================================
// 凸包 / 重心 / 最大流 —— 用 C++ 写，编译成 WebAssembly 给网页调用
// 编译见同目录 build.sh（Zig 自带 clang，freestanding，不依赖标准库）
// ============================================================
#define MAXN 50000            // 凸包/重心的最大点数
#define MAXV 10000            // 最大流的最大点数
#define MAXE 100000           // 最大流的最大边数
#define EPSF 1e-9

extern "C" {

// ================= 凸包 / 重心 =================
static double g_pts[MAXN * 2];   // 输入点：x0,y0,x1,y1,...
static int    g_idx[MAXN];       // 排序用下标
static int    g_hull[MAXN * 2];  // 凸包结果（输入下标）
static double g_cen[2];          // 重心结果

double* geo_pts() { return g_pts; }
int*    geo_hull() { return g_hull; }
double* geo_cen() { return g_cen; }

static double cross(double ox, double oy, double ax, double ay, double bx, double by) {
    return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}
static int cmpIdx(int a, int b) {
    if (g_pts[2 * a] != g_pts[2 * b]) return g_pts[2 * a] < g_pts[2 * b] ? -1 : 1;
    if (g_pts[2 * a + 1] != g_pts[2 * b + 1]) return g_pts[2 * a + 1] < g_pts[2 * b + 1] ? -1 : 1;
    return 0;
}

int convex_hull(int n) {
    if (n <= 0) return 0;
    if (n <= 2) { for (int i = 0; i < n; i++) g_hull[i] = i; return n; }
    for (int i = 0; i < n; i++) g_idx[i] = i;
    for (int gap = n / 2; gap > 0; gap /= 2) {
        for (int i = gap; i < n; i++) {
            int v = g_idx[i], j = i;
            while (j >= gap && cmpIdx(g_idx[j - gap], v) > 0) { g_idx[j] = g_idx[j - gap]; j -= gap; }
            g_idx[j] = v;
        }
    }
    int k = 0;
    for (int i = 0; i < n; i++) {
        int c = g_idx[i];
        while (k >= 2 && cross(g_pts[2 * g_hull[k - 2]], g_pts[2 * g_hull[k - 2] + 1],
                               g_pts[2 * g_hull[k - 1]], g_pts[2 * g_hull[k - 1] + 1],
                               g_pts[2 * c], g_pts[2 * c + 1]) <= 0) k--;
        g_hull[k++] = c;
    }
    int lower = k + 1;
    for (int i = n - 2; i >= 0; i--) {
        int c = g_idx[i];
        while (k >= lower && cross(g_pts[2 * g_hull[k - 2]], g_pts[2 * g_hull[k - 2] + 1],
                                   g_pts[2 * g_hull[k - 1]], g_pts[2 * g_hull[k - 1] + 1],
                                   g_pts[2 * c], g_pts[2 * c + 1]) <= 0) k--;
        g_hull[k++] = c;
    }
    return k - 1;
}

void centroid(int n) {
    double sx = 0, sy = 0;
    for (int i = 0; i < n; i++) { sx += g_pts[2 * i]; sy += g_pts[2 * i + 1]; }
    g_cen[0] = n ? sx / n : 0.0;
    g_cen[1] = n ? sy / n : 0.0;
}

// ================= 最大流（Dinic，单源单汇） =================
static int    g_from[MAXE], g_to[MAXE];
static double g_ecap[MAXE];             // 输入边容量
static double g_flow[MAXE];             // 输出：每条输入边上的实际流量
static int    g_n, g_m, g_src, g_snk;

static int    g_head[MAXV];
static int    g_next[2 * MAXE];
static int    g_eTo[2 * MAXE];
static double g_rcap[2 * MAXE];         // 残量
static int    g_ecnt;

static int    g_level[MAXV];
static int    g_it[MAXV];
static int    g_q[MAXV];
static int    g_sv[MAXV], g_se[MAXV];   // 迭代式 DFS 的栈

void    geo_set(int n, int m, int src, int snk) { g_n = n; g_m = m; g_src = src; g_snk = snk; }
int*    geo_efrom() { return g_from; }
int*    geo_eto()   { return g_to; }
double* geo_ecap()  { return g_ecap; }
double* geo_flow()  { return g_flow; }

static int bfs() {
    for (int i = 0; i < g_n; i++) g_level[i] = -1;
    int h = 0, t = 0;
    g_q[t++] = g_src; g_level[g_src] = 0;
    while (h < t) {
        int u = g_q[h++];
        for (int e = g_head[u]; e != -1; e = g_next[e]) {
            int v = g_eTo[e];
            if (g_rcap[e] > EPSF && g_level[v] < 0) { g_level[v] = g_level[u] + 1; g_q[t++] = v; }
        }
    }
    return g_level[g_snk] >= 0;
}

// 迭代式 Dinic 阻塞流（避免递归爆栈）
static double blocking() {
    double total = 0;
    for (int i = 0; i < g_n; i++) g_it[i] = g_head[i];
    int sp = 0;
    g_sv[0] = g_src; g_se[0] = -1;
    while (sp >= 0) {
        int u = g_sv[sp];
        if (u == g_snk) {
            double f = 1e18;
            for (int i = 1; i <= sp; i++) { if (g_rcap[g_se[i]] < f) f = g_rcap[g_se[i]]; }
            for (int i = 1; i <= sp; i++) { g_rcap[g_se[i]] -= f; g_rcap[g_se[i] ^ 1] += f; }
            total += f;
            int back = sp;
            for (int i = 1; i <= sp; i++) { if (g_rcap[g_se[i]] <= EPSF) { back = i; break; } }
            sp = back - 1;
            continue;
        }
        int e = g_it[u];
        while (e != -1 && !(g_rcap[e] > EPSF && g_level[g_eTo[e]] == g_level[u] + 1)) {
            e = g_next[e]; g_it[u] = e;
        }
        if (e == -1) { g_level[u] = -1; sp--; continue; }
        g_it[u] = g_next[e];
        sp++;
        g_sv[sp] = g_eTo[e];
        g_se[sp] = e;
    }
    return total;
}

// 返回最大流；每条输入边的流量写进 g_flow
double max_flow() {
    g_ecnt = 0;
    for (int i = 0; i < g_n; i++) g_head[i] = -1;
    for (int i = 0; i < g_m; i++) {
        int u = g_from[i], v = g_to[i];
        // 正向弧（下标 2i）
        g_eTo[g_ecnt] = v; g_rcap[g_ecnt] = g_ecap[i]; g_next[g_ecnt] = g_head[u]; g_head[u] = g_ecnt++;
        // 反向弧（下标 2i+1）
        g_eTo[g_ecnt] = u; g_rcap[g_ecnt] = 0;          g_next[g_ecnt] = g_head[v]; g_head[v] = g_ecnt++;
    }
    double flow = 0;
    while (bfs()) { flow += blocking(); }
    for (int i = 0; i < g_m; i++) { g_flow[i] = g_ecap[i] - g_rcap[2 * i]; }
    return flow;
}

}
