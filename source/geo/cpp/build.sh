#!/usr/bin/env bash
# ============================================================
# 把 geo.cpp 编译成 WebAssembly（输出 source/geo/geo.wasm）
# 用 Zig 自带的 clang（freestanding），不需要 Emscripten、不依赖标准库。
#
# 用法：
#   ZIG=/c/Users/JHR/zig/zig-x86_64-windows-0.17.0/zig.exe bash build.sh
# ============================================================
set -e
cd "$(dirname "$0")"
ZIG="${ZIG:-zig}"

"$ZIG" c++ -target wasm32-freestanding -O2 \
  -Wl,--no-entry \
  -Wl,--export=convex_hull -Wl,--export=centroid \
  -Wl,--export=geo_pts -Wl,--export=geo_hull -Wl,--export=geo_cen \
  -o ../geo.wasm geo.cpp

echo "编译完成：../geo.wasm"
