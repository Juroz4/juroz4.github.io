---
title: CF2202B ABAB Construction 题解
date: 2026-10-13 12:00:00
categories:
  - - 题解
    - Codeforces
tags:
  - 构造
  - 性质
  - Codeforces
---

[题目链接](https://codeforces.com/problemset/problem/2202/B)

## 思路

从字符串 $S$ 的末尾开始考虑。

若 $S$ 的第 $n$ 位是 `b`，则 $T$ 最后被取走的一位也是 `b`。考虑第 $n-1$ 位：由于 $S$ 的第 $n-1$ 位实际上就是往 $T$ 当前情况的基础上可以增加的字符，所以 $S$ 的第 $n-1$ 位一定是 `a`（`b` 与 `b` 在 $T$ 中不相邻）。

接着考虑第 $n-2$ 位。如果 $S$ 的第 $n-2$ 位为 `b`，则 $T$ 一定为 `bab`（`b` 加在 `ab` 的左侧，或加在 `ba` 的右侧）。再往第 $n-3$ 位考虑，则 $S$ 的第 $n-3$ 位（也就是 $T$ 在 `bab` 的基础上新增加的字符）一定是 `a`。

根据以上过程，我们注意到整个字符串的构造过程就是不断地以两个字符为一组，以 `ab` 或者 `ba` 的形式往 $S$ 里添加，即从末尾开始往前看，$S_n \neq S_{n-1}$ 即满足构造条件。

同时注意 $ab$ 的个数限制。注意到每两个位置都有一个 `a` 和一个 `b`，所以在偶数情况下满足 $cnt_a = cnt_b$；奇数情况需要特判 $S$ 的开头 $\neq$ `b`。

## 代码

```cpp
#include <bits/stdc++.h>
using namespace std;
#define endl '\n'
#define ll long long
#define ld long double
#define INF 1e18
#define MOD 10007
const int N=1e3+10;
int main(){
    ios::sync_with_stdio(0);
    cin.tie(0);
    ll t,n;
    string s;
    cin>>t;
    while(t--){
        cin>>n>>s;
        bool ok=1;
        if(s[0]=='b'&&n%2)ok=0;
        for(ll i=n-1;i>=1;i-=2){
            if(s[i-1]!='?'&&s[i-1]==s[i])ok=0;
        }
        cout<<(ok?"YES\n":"NO\n");
    }
    return 0;
}
```

时间复杂度 $O(n)$，可以通过。
