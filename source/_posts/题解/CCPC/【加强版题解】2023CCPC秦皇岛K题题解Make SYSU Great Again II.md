---
title: 2023 CCPC 秦皇岛 K「贵校是构造王国吗 II」题解
categories:
  - - 题解
    - CCPC
tags:
  - 构造
  - CCPC
  - 随机化
  - 启发式生成
date: 2026-10-11 21:00:00
---

## 题意简述

给定 $n$，构造一个 $n \times n$ 的矩阵 $a$，满足：

- 每个元素都落在 $[0, 4n^2-1]$ 内；
- 每个数值在矩阵中最多出现 $5$ 次；
- 任意两个**共边**的相邻格子，其数值的按位与（$\operatorname{and}$）恰好为 $0$。

其中 $1 \le n \le 2000$。本题保证有解，任意输出一组即可。

## 思路

### 1. 把矩阵拆成两条斜线

观察矩阵中每个位置 $(i,j)$ 的两个「坐标」：

- $i+j$，沿**副对角线**（左下 — 右上）保持不变；
- $i-j$，沿**主对角线**（左上 — 右下）保持不变。

也就是说，$(i,j) \mapsto (i+j,\; i-j)$ 是一一对应的。于是我们可以准备一条长度为 $2n-1$ 的序列

$$s_0, s_1, \dots, s_{2n-2},$$

让副对角线方向取值只依赖 $i+j$，主对角线方向取值只依赖 $i-j$：

$$a_{i,j} = A \cdot s_{i+j-2} + s_{i-j+n-1}.$$

这里 $A$ 是 $2$ 的幂，且严格大于 $\max_k s_k$，作用是把两个数拼到不同的二进制位段上（高位段放第一条序列，低位段放第二条序列）。两条序列共用同一个 $s$，原因见第 3 小节。

### 2. 按位与条件被拆成两半

由于所有 $s_k < A$，高、低位段互不干扰。对任意两格 $(i,j)$ 与 $(i',j')$，令 $t = i+j$、$d = i-j$，有

$$a_{i,j} \operatorname{and} a_{i',j'}
= A \cdot \big( s_{i+j-2} \operatorname{and} s_{i'+j'-2} \big)
+ \big( s_{i-j+n-1} \operatorname{and} s_{i'-j'+n-1} \big).$$

（第一项是 $A$ 的倍数，第二项小于 $A$，二者按位与为 $0$，所以可以这样相加。）右端为 $0$ 当且仅当两项同时为 $0$。因此

$$a_{i,j} \operatorname{and} a_{i',j'} = 0
\iff
\begin{cases}
s_{i+j-2} \operatorname{and} s_{i'+j'-2} = 0, \\
s_{i-j+n-1} \operatorname{and} s_{i'-j'+n-1} = 0.
\end{cases}$$

现在看共边的相邻格。设 $(i',j')$ 与 $(i,j)$ 共边：

- 水平相邻 $(i,j),(i,j+1)$：$i+j$ 增大 $1$，$i-j$ 减小 $1$；
- 竖直相邻 $(i,j),(i+1,j)$：$i+j$ 增大 $1$，$i-j$ 增大 $1$。

两种情况里，第一个下标 $i+j-2$ 都相差 $1$，第二个下标 $i-j+n-1$ 都相差 $\pm 1$。于是要求

$$\forall k,\quad s_k \operatorname{and} s_{k+1} = 0,$$

即**序列中相邻两项按位与为 $0$** 就足够了（无论水平还是竖直都被同一条约束覆盖）。

### 3. 两条序列可以取同一条

上面的约束对两条序列是**完全一样的**（都只要求「相邻两项按位与为 $0$」），所以直接让两条序列都等于 $s$ 即可，问题被压回到一维。

### 4. 把序列做成一个环

如果取一个长度为 $n$ 的**环** $c_0, c_1, \dots, c_{n-1}$，要求**相邻（含首尾 $c_{n-1}, c_0$）**两项按位与为 $0$，再令

$$s_k = c_{k \bmod n} \qquad (0 \le k \le 2n-2),$$

那么 $s$ 的每一项都满足相邻约束（这里用到了 $c$ 的循环性，把 $c_{n-1}$ 和 $c_0$ 接起来）。注意 $c$ 里的 $n$ 个数要求**两两不同**，这一点下面证明出现次数时会用到。

### 5. 每个数最多出现 $4$ 次（$< 5$）

固定一个数值 $v$，把它在上式里唯一地写成 $v = A\alpha + \beta$，其中 $0 \le \alpha, \beta < A$。

**为什么唯一**：低位段 $\beta < A$，高位段是 $A$ 的倍数，二者拼位不重叠，所以 $\alpha = \lfloor v/A \rfloor$、$\beta = v \bmod A$ 被唯一确定。

于是 $\alpha$ 必是某个 $c_p$（记 $c_p = \alpha$），$\beta$ 必是某个 $c_q$（记 $c_q = \beta$）。由于 $c$ 内元素两两不同，$p, q$ 都由 $v$ 唯一确定。

- 序列中取值为 $c_p$ 的位置只有 $k \equiv p \pmod n$，而 $0 \le k \le 2n-2$，即 $k \in \{p,\ p+n\}$，**至多 $2$ 个**。对应 $i+j-2 = k$，故 $i+j$ 至多 $2$ 种取值。
- 同理 $i-j+n-1 \equiv q \pmod n$ 且范围是 $[0, 2n-2]$，故 $i-j+n-1 \in \{q,\ q+n\}$，**至多 $2$ 个**，即 $i-j$ 至多 $2$ 种取值。

而一对 $(i+j,\; i-j)$ 至多确定一个格子。所以数值 $v$ 最多出现

$$2 \times 2 = 4 < 5$$

次，满足「每个数最多出现 $5$ 次」的限制（实际上约束更强）。

### 6. 元素上界 $4n^2-1$

设 $V$ 为构造时使用的值域大小，即所有 $c_k < V$，并令 $A$ 为大于 $\max_k s_k$ 的最小 $2$ 的幂。则 $A \le 2 \max_k s_k \le 2(V-1)$，于是

$$a_{i,j} = A \cdot s_{i+j-2} + s_{i-j+n-1}
\le (A+1)(V-1) < 2V \cdot V = 2V^2.$$

只要取 $V = 1.3n$，就有

$$2V^2 = 2 \times 1.69\,n^2 = 3.38\,n^2 < 4n^2,$$

即所有元素都落在 $[0, 4n^2-1]$ 内。

> 小结一下 $V$ 的取值：环需要 $n$ 个**不同**的数，所以必须 $V > n$；而值域上界要求 $V \le \sqrt 2\,n \approx 1.414n$。取 $V = 1.3n$ 正好在中间，还留出约 $30\%$ 的冗余，让第 7 小节的随机搜索非常容易成功。

另外，若 $V$ 恰为 $2$ 的幂，则 $V-1$ 是全 $1$（形如 $2^k-1$），它只能与 $0$ 相邻、几乎无法进入环，故将 $V$ 加一避开这种退化情形。

### 7. 随机化 + Warnsdorff 启发式求环

现在的问题变得非常干净：

> 在 $V$ 个点 $\{0, 1, \dots, V-1\}$ 构成的图上（$x$ 与 $y$ 连边当且仅当 $x \operatorname{and} y = 0$），找一条**长度为 $n$ 的简单环**。

不是哈密顿环（可以有 $V-n$ 个点不用），所以存在性很宽松：实测合法环所需的最大值大约就是 $n$，而这里给了 $V = 1.3n$ 的冗余。又因为 $0 \operatorname{and} x = 0$ 恒成立，$0$ 和谁都相邻，把 $0$ 作为环的起点后，**收尾一定能接回 $0$**，无需额外判断。

采用 **Warnsdorff 启发式**（优先走「后续选择最少」的点，常用于骑士巡游）：

1. 把 $0$ 作为环的起点，维护每个数的「可扩展度」$\deg$，即当前**未使用**且与其按位与为 $0$ 的数的个数；
2. 每一步，在未使用、且与当前末尾 $last$ 兼容（按位与为 $0$）的数里，选 $\deg$ 最小的那个进入（相同则随机决胜，用 `mt19937`）；这就是「优先找后续可能性最小的节点」；
3. 剪枝：若某点的 $\deg = 0$（没有后续），除非它是最后一步，否则不选它，避免走进死胡同；
4. 如果当前所有候选都不满足，说明这一局卡住了，**整局推倒重来**（换新的随机数重新跑）。

由于约束很稀疏、候选很多，通常一次尝试就能成功；极端情况下重来几次即可。

## 复杂度

设值域 $V = \Theta(n)$。

- 预计算 $\deg$：$O(V^2) = O(n^2)$；
- 每轮搜索：每一步扫描 $V$ 个点，共 $n$ 步，$O(nV) = O(n^2)$。

期望尝试轮数为常数（实测几乎总是一轮成功），故总复杂度 $O(n^2)$，空间复杂度 $O(n)$。对 $n = 2000$ 而言 $O(n^2)$ 的常数很小，轻松通过。

## 代码

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    int L = 2 * n - 1;                   // 两条斜序列的长度
    int V = (int)(1.3 * n);              // 值域为 [0, V)
    if ((V & (V - 1)) == 0) V++;         // 避免 V-1 恰为全 1

    // deg0[i] = 与 i 按位与为 0 的数的个数
    vector<int> deg0(V, 0), deg(V), used(V);
    for (int i = 0; i < V; i++)
        for (int j = 0; j < V; j++)
            if ((i & j) == 0) deg0[i]++;

    mt19937 rng(chrono::steady_clock::now().time_since_epoch().count());

    // 用 Warnsdorff 启发式随机找一个长度为 n 的环 cyc，
    // 环上相邻（含首尾）的两数按位与为 0。
    vector<int> cyc;
    while (true) {
        fill(used.begin(), used.end(), 0);
        deg = deg0;
        cyc.assign(1, 0);
        used[0] = 1;
        for (int y = 0; y < V; y++) deg[y]--;   // 0 已使用

        bool ok = true;
        while ((int)cyc.size() < n) {
            int last = cyc.back();
            int best = -1;
            long long best_key = LLONG_MAX;
            for (int v = 0; v < V; v++) {
                if (used[v] || (last & v) != 0) continue;
                // 剪枝：非最后一步时不进入死路（无可用后继）
                if (deg[v] == 0 && (int)cyc.size() != n - 1) continue;
                long long key = (long long)deg[v] * 1000 + rng() % 1000;
                if (key < best_key) { best_key = key; best = v; }
            }
            if (best < 0) { ok = false; break; }    // 本局失败，重开
            cyc.push_back(best);
            used[best] = 1;
            for (int y = 0; y < V; y++)
                if ((best & y) == 0) deg[y]--;
        }
        if (ok) break;
    }

    // 把环按周期 n 展开成长度 L 的序列 s
    vector<int> s(L);
    for (int p = 0; p < L; p++) s[p] = cyc[p % n];

    int mx = *max_element(s.begin(), s.end());
    long long A = 1;                     // A = 2^k > mx，用于高低位拼接
    while (A <= mx) A <<= 1;

    // 答案：ans[i][j] = A * s[i+j-2] + s[i-j+n-1]
    cout << "Yes\n";
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= n; j++) {
            long long val = A * s[i + j - 2] + s[i - j + n - 1];
            cout << val << " \n"[j == n];
        }
    }
    return 0;
}
```


能通过每个数出现次数不超过四次的加强版题干