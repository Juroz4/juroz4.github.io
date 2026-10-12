---
title: 快速幂（Fast Exponentiation）题解
categories:
  - - 模板
    - 基础类
tags:
  - 数学
  - 分治
  - 模板
date: 2026-10-11 10:00:00
---

## 题目

给定 $a$、$b$、$p$，求 $a^b \bmod p$。其中 $1 \le a, b < 2^{31}$。

## 思路

朴素做法要乘 $b$ 次，复杂度 $O(b)$，当 $b$ 很大时会超时。

观察指数可以二进制拆分。例如计算 $a^{13}$：

$$
13 = (1101)_2 = 8 + 4 + 1
$$

于是

$$
a^{13} = a^8 \cdot a^4 \cdot a^1
$$

我们从低位往高位枚举，底数不断平方（$a \to a^2 \to a^4 \to a^8 \cdots$），
遇到指数当前位为 $1$ 就把答案乘上当前底数。复杂度降到 $O(\log b)$。

注意取模：每步乘法后都要 $\bmod p$，防止溢出。

## 参考代码

```cpp
#define ll long long 
ll qpow(ll b,ll e){
    ll res=1,b%=MOD;
    while(e){
        if(e&1){
            res*=b;
            res%=MOD;
        }
        e>>=1;
        b*=b,b%=MOD;
    }
    return res;
}
```

## 复杂度

- 时间复杂度：$O(\log b)$
- 空间复杂度：$O(1)$

