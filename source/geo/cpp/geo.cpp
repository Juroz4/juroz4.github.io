// ============================================================
// 凸包 / 重心 —— 用 C++ 写，编译成 WebAssembly 给网页调用
// 编译见同目录 build.sh（用 Zig 自带的 clang，freestanding，不依赖标准库）
// ============================================================
#define MAXN 50000

extern "C" {

static double g_pts[MAXN * 2];   // 输入点：x0,y0,x1,y1,...
static int    g_idx[MAXN];       // 排序用下标
static int    g_hull[MAXN * 2];  // 凸包结果（输入下标）
static double g_cen[2];          // 重心结果

// 给 JS 取缓冲区地址用
double* geo_pts() { return g_pts; }
int*    geo_hull() { return g_hull; }
double* geo_cen() { return g_cen; }

static double cross(double ox, double oy, double ax, double ay, double bx, double by) {
    return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}
static int cmpIdx(int a, int b) {                 // 按 (x, y) 排序
    if (g_pts[2 * a] != g_pts[2 * b]) return g_pts[2 * a] < g_pts[2 * b] ? -1 : 1;
    if (g_pts[2 * a + 1] != g_pts[2 * b + 1]) return g_pts[2 * a + 1] < g_pts[2 * b + 1] ? -1 : 1;
    return 0;
}

// Andrew 单调链凸包。输入 g_pts 里前 n 个点，结果写进 g_hull，返回个数（逆时针）
int convex_hull(int n) {
    if (n <= 0) return 0;
    if (n <= 2) { for (int i = 0; i < n; i++) g_hull[i] = i; return n; }
    for (int i = 0; i < n; i++) g_idx[i] = i;

    // Shell 排序（不依赖 STL）
    for (int gap = n / 2; gap > 0; gap /= 2) {
        for (int i = gap; i < n; i++) {
            int v = g_idx[i], j = i;
            while (j >= gap && cmpIdx(g_idx[j - gap], v) > 0) { g_idx[j] = g_idx[j - gap]; j -= gap; }
            g_idx[j] = v;
        }
    }

    int k = 0;
    for (int i = 0; i < n; i++) {                       // 下凸壳
        int c = g_idx[i];
        while (k >= 2 && cross(g_pts[2 * g_hull[k - 2]], g_pts[2 * g_hull[k - 2] + 1],
                               g_pts[2 * g_hull[k - 1]], g_pts[2 * g_hull[k - 1] + 1],
                               g_pts[2 * c], g_pts[2 * c + 1]) <= 0) k--;
        g_hull[k++] = c;
    }
    int lower = k + 1;
    for (int i = n - 2; i >= 0; i--) {                  // 上凸壳
        int c = g_idx[i];
        while (k >= lower && cross(g_pts[2 * g_hull[k - 2]], g_pts[2 * g_hull[k - 2] + 1],
                                   g_pts[2 * g_hull[k - 1]], g_pts[2 * g_hull[k - 1] + 1],
                                   g_pts[2 * c], g_pts[2 * c + 1]) <= 0) k--;
        g_hull[k++] = c;
    }
    return k - 1;                                        // 去掉重复的起点
}

// 重心（所有点算术平均），结果写进 g_cen
void centroid(int n) {
    double sx = 0, sy = 0;
    for (int i = 0; i < n; i++) { sx += g_pts[2 * i]; sy += g_pts[2 * i + 1]; }
    g_cen[0] = n ? sx / n : 0.0;
    g_cen[1] = n ? sy / n : 0.0;
}

}
