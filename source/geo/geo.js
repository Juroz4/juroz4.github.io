/* ============================================================
 * 凸包画板 · 逻辑（2D）
 * ------------------------------------------------------------
 * 节点/边可拖动、连线、删除、框选批量改样式；
 * 原点(0,0)标记；点带编号；左侧信息窗；右下导入。
 * 外观与参数都在 config.js，本文件只写逻辑。
 * ============================================================ */
(function () {
  'use strict';

  var cfg = window.GEO.config;
  var T = cfg.theme;
  var B = cfg.behavior;
  var SVGNS = 'http://www.w3.org/2000/svg';

  var stage       = document.getElementById('stage');
  var svg         = document.getElementById('canvas');
  var viewport    = document.getElementById('viewport');
  var layerGrid   = document.getElementById('layer-grid');
  var layerEdges  = document.getElementById('layer-edges');
  var layerHull   = document.getElementById('layer-hull');
  var layerOrigin = document.getElementById('layer-origin');
  var layerPoints = document.getElementById('layer-points');
  var layerArrows = document.getElementById('layer-arrows');
  var layerLabels = document.getElementById('layer-labels');
  var layerUI     = document.getElementById('layer-ui');
  var menu        = document.getElementById('menu');
  var menu2       = document.getElementById('menu2');
  var btnClear    = document.getElementById('btn-clear');
  var panel       = document.getElementById('panel');
  var segDrag     = document.getElementById('seg-dragmode');
  var colPoint    = document.getElementById('col-point');
  var numPointSize = document.getElementById('num-pointsize');
  var colEdge     = document.getElementById('col-edge');
  var numEdgeWidth = document.getElementById('num-edgewidth');
  var ctlTarget   = document.getElementById('ctl-target');
  var info        = document.getElementById('info');
  var infoBody    = document.getElementById('info-body');
  var btnHelp     = document.getElementById('btn-help');
  var btnImport   = document.getElementById('btn-import');
  var impMask     = document.getElementById('import-mask');
  var impPoints   = document.getElementById('imp-points');
  var impEdges    = document.getElementById('imp-edges');

  // ---------------- 状态 ----------------
  var S = {
    points: [],            // { id, x, y, label, side, color, size }
    edges: [],             // { id, from, to, cap, flow, color, width }
    sel: { points: [], edges: [] },
    nextPointId: 1,
    nextEdgeId: 1,
    nextLabel: 1,          // 下一个自动编号
    view: { scale: 1, rot: 0, panX: 0, panY: 0 },
    dragMode: B.dragMode || 'select',
    style: { pointColor: T.point.fill, pointSize: T.point.radius, edgeColor: T.edge.stroke, edgeWidth: T.edge.width },
    hull: [],              // 凸包顶点（point id，有序）
    centroid: null,        // 重心 { x, y }（世界坐标）
    showAngles: false,     // 是否显示角度
    angleItems: []         // 角度标签 [{ el, px, py, dir }]
  };

  // ---------------- C++ 算法（WebAssembly） ----------------
  //   geo.wasm 由 cpp/geo.cpp 编译而来（见 cpp/build.sh）。
  //   没加载到就退回 JS 实现，功能一样。
  var ALGO = null;
  if (window.fetch) {
    fetch('geo.wasm').then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function (buf) { return buf ? WebAssembly.instantiate(buf, {}) : null; })
      .then(function (res) { if (res) { ALGO = res.instance.exports; } })
      .catch(function () { ALGO = null; });
  }

  function callHull(pts) {
    var n = pts.length, i, k;
    if (ALGO && n) {
      var f64 = new Float64Array(ALGO.memory.buffer), i32 = new Int32Array(ALGO.memory.buffer);
      var pb = ALGO.geo_pts(), hb = ALGO.geo_hull();
      for (i = 0; i < n; i++) { f64[(pb >> 3) + 2 * i] = pts[i].x; f64[(pb >> 3) + 2 * i + 1] = pts[i].y; }
      var cnt = ALGO.convex_hull(n);
      var out = [];
      for (k = 0; k < cnt; k++) { out.push(i32[(hb >> 2) + k]); }
      return out;
    }
    return jsHull(pts);
  }
  function callCentroid(pts) {
    var n = pts.length, i;
    if (ALGO && n) {
      var f64 = new Float64Array(ALGO.memory.buffer);
      var pb = ALGO.geo_pts();
      for (i = 0; i < n; i++) { f64[(pb >> 3) + 2 * i] = pts[i].x; f64[(pb >> 3) + 2 * i + 1] = pts[i].y; }
      ALGO.centroid(n);
      var cb = ALGO.geo_cen();
      return { x: f64[cb >> 3], y: f64[(cb >> 3) + 1] };
    }
    var sx = 0, sy = 0;
    for (i = 0; i < n; i++) { sx += pts[i].x; sy += pts[i].y; }
    return { x: n ? sx / n : 0, y: n ? sy / n : 0 };
  }
  function jsHull(pts) {                      // Andrew 单调链（JS 版）
    var n = pts.length;
    if (n <= 1) { var a = []; for (var i = 0; i < n; i++) { a.push(i); } return a; }
    var idx = pts.map(function (_, i) { return i; }).sort(function (x, y) {
      return pts[x].x !== pts[y].x ? pts[x].x - pts[y].x : pts[x].y - pts[y].y;
    });
    function cr(o, a, b) { return (pts[a].x - pts[o].x) * (pts[b].y - pts[o].y) - (pts[a].y - pts[o].y) * (pts[b].x - pts[o].x); }
    var st = [], i2, i3;
    for (i2 = 0; i2 < n; i2++) { while (st.length >= 2 && cr(st[st.length - 2], st[st.length - 1], idx[i2]) <= 0) { st.pop(); } st.push(idx[i2]); }
    var lower = st.length + 1;
    for (i3 = n - 2; i3 >= 0; i3--) { while (st.length >= lower && cr(st[st.length - 2], st[st.length - 1], idx[i3]) <= 0) { st.pop(); } st.push(idx[i3]); }
    st.pop();
    return st;
  }
  // 菜单里所有操作的对象 = 「选中的」目标
  function targetPoints() { return S.sel.points.map(getPoint).filter(function (p) { return !!p; }); }
  function targetEdges() { return S.sel.edges.map(getEdge).filter(function (e) { return !!e; }); }
  // 有源点/汇点时，边显示方向箭头
  function arrowsOn() {
    for (var i = 0; i < S.points.length; i++) { if (S.points[i].role) { return true; } }
    return false;
  }
  // 设源点/汇点（各自只有一个）
  function setRole(id, role) {
    if (role) { S.points.forEach(function (p) { if (p.role === role) { p.role = ''; } }); }
    var p = getPoint(id);
    if (p) { p.role = role; }
    render();
  }
  // 单源单汇最大流（C++/Dinic）
  function runMaxFlow() {
    var si = -1, ti = -1;
    S.points.forEach(function (p, i) { if (p.role === 's') { si = i; } if (p.role === 't') { ti = i; } });
    if (si < 0 || ti < 0) { toast('请先指定源点和汇点'); return; }
    if (!ALGO) { toast('WASM 未加载，无法计算'); return; }
    var idx = {};
    S.points.forEach(function (p, i) { idx[p.id] = i; });
    var eds = S.edges.filter(function (e) { return idx[e.from] != null && idx[e.to] != null; });
    var m = eds.length, i;
    var i32 = new Int32Array(ALGO.memory.buffer), f64 = new Float64Array(ALGO.memory.buffer);
    var pf = ALGO.geo_efrom(), pt = ALGO.geo_eto(), pc = ALGO.geo_ecap(), pfl = ALGO.geo_flow();
    for (i = 0; i < m; i++) {
      i32[(pf >> 2) + i] = idx[eds[i].from];
      i32[(pt >> 2) + i] = idx[eds[i].to];
      f64[(pc >> 3) + i] = +eds[i].cap || 0;
    }
    ALGO.geo_set(S.points.length, m, si, ti);
    var mf = ALGO.max_flow();
    for (i = 0; i < m; i++) {
      eds[i].flow = Math.round(f64[(pfl >> 3) + i] * 1e6) / 1e6;
    }
    render();
    toast('最大流 = ' + (Math.round(mf * 1e6) / 1e6));
  }
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('geo-toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3200);
  }
  function runHull() {
    var pts = targetPoints();
    if (pts.length < 2) { return; }
    var ids = callHull(pts).map(function (i) { return pts[i].id; });
    if (ids.length < 2) { return; }
    // 把凸包相邻顶点连成【真实的边】（颜色用凸包色；已存在的不会重复加）
    for (var i = 0; i < ids.length; i++) {
      var e = pushEdge(ids[i], ids[(i + 1) % ids.length]);
      if (e) { e.color = T.hull.stroke; }
    }
    render();
  }
  function runCentroid() {
    var pts = targetPoints();
    if (!pts.length) { return; }
    var c = callCentroid(pts);                 // C++ 算重心
    var np = addPoint(c.x, c.y);               // 直接生成一个新点
    if (np) { np.color = T.centroid.color; }   // 用重心色，便于分辨
    render();
  }
  function runClearEdges() {                     // 删除【选中的】边
    var eds = targetEdges();
    if (!eds.length) { return; }
    var set = {};
    eds.forEach(function (e) { set[e.id] = 1; });
    S.edges = S.edges.filter(function (e) { return !set[e.id]; });
    S.sel.edges = [];
    render();
  }
  function runDeleteSelected() {                 // 删除【选中的】点 + 边
    if (!S.sel.points.length && !S.sel.edges.length) { return; }
    var pset = {}, eset = {};
    S.sel.points.forEach(function (id) { pset[id] = 1; });
    S.sel.edges.forEach(function (id) { eset[id] = 1; });
    S.points = S.points.filter(function (p) { return !pset[p.id]; });
    S.edges = S.edges.filter(function (e) { return !eset[e.id] && !pset[e.from] && !pset[e.to]; });
    S.sel.points = []; S.sel.edges = [];
    S.hull = []; S.centroid = null;
    render();
  }
  function toggleAngles() { S.showAngles = !S.showAngles; render(); }

  // 计算每个点处、相邻两条边之间的夹角（只算"选中的"点/边；没选中就全部）
  function computeAngles() {
    var dirs = {};
    var pts = targetPoints();
    pts.forEach(function (p) { dirs[p.id] = []; });
    targetEdges().forEach(function (e) {
      var a = getPoint(e.from), b = getPoint(e.to);
      if (!a || !b) { return; }
      if (dirs[e.from]) { dirs[e.from].push(Math.atan2(b.y - a.y, b.x - a.x)); }
      if (dirs[e.to]) { dirs[e.to].push(Math.atan2(a.y - b.y, a.x - b.x)); }
    });
    var out = [];
    pts.forEach(function (p) {
      var d = dirs[p.id];
      if (!d || d.length < 2) { return; }
      d.sort(function (x, y) { return x - y; });
      if (d.length === 2) {
        var gap = d[1] - d[0];
        if (gap > Math.PI) { gap = Math.PI * 2 - gap; }
        out.push({ px: p.x, py: p.y, ang: gap, dir: d[0] + gap / 2 });
      } else {
        for (var i = 0; i < d.length; i++) {
          var j = (i + 1) % d.length;
          var g = d[j] - d[i]; if (g < 0) { g += Math.PI * 2; }
          out.push({ px: p.x, py: p.y, ang: g, dir: d[i] + g / 2 });
        }
      }
    });
    return out;
  }

  // ---------------- 小工具 ----------------
  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) { for (var k in attrs) { e.setAttribute(k, attrs[k]); } }
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fmt(n) { return (Math.round(n * 100) / 100); }
  function rnd4(n) { return Math.round(n * 10000) / 10000; }

  // 两条线段是否相交（屏幕坐标）
  function segSeg(p1, p2, p3, p4) {
    function d(px, py, qx, qy, rx, ry) { return (qx - px) * (ry - py) - (qy - py) * (rx - px); }
    var d1 = d(p3.x, p3.y, p4.x, p4.y, p1.x, p1.y);
    var d2 = d(p3.x, p3.y, p4.x, p4.y, p2.x, p2.y);
    var d3 = d(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    var d4 = d(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  // 线段是否与矩形相交（端点在内，或穿过任一条边）
  function segRectHit(a, b, x0, y0, x1, y1) {
    var ain = a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1;
    var bin = b.x >= x0 && b.x <= x1 && b.y >= y0 && b.y <= y1;
    if (ain || bin) { return true; }
    return segSeg(a, b, { x: x0, y: y0 }, { x: x1, y: y0 }) ||
           segSeg(a, b, { x: x1, y: y0 }, { x: x1, y: y1 }) ||
           segSeg(a, b, { x: x1, y: y1 }, { x: x0, y: y1 }) ||
           segSeg(a, b, { x: x0, y: y1 }, { x: x0, y: y0 });
  }
  function center() { return { x: stage.clientWidth / 2, y: stage.clientHeight / 2 }; }
  function getPoint(id) {
    for (var i = 0; i < S.points.length; i++) { if (S.points[i].id === id) { return S.points[i]; } }
    return null;
  }
  function getEdge(id) {
    for (var i = 0; i < S.edges.length; i++) { if (S.edges[i].id === id) { return S.edges[i]; } }
    return null;
  }
  function isSelPoint(id) { return S.sel.points.indexOf(id) >= 0; }
  function isSelEdge(id) { return S.sel.edges.indexOf(id) >= 0; }

  // ---------------- 坐标 ----------------
  function rotScale(x, y, s, rot) {
    var c = Math.cos(rot), n = Math.sin(rot);
    return { x: (x * c - y * n) * s, y: (x * n + y * c) * s };
  }
  // 世界坐标 y 向上、屏幕 y 向下，所以映射里把 y 翻一下
  function worldToScreen(x, y) {
    var v = S.view, k = center(), r = rotScale(x, y, v.scale, v.rot);
    return { x: k.x + v.panX + r.x, y: k.y + v.panY - r.y };
  }
  function screenToWorld(sx, sy) {
    var v = S.view, k = center();
    var dx = sx - k.x - v.panX, dy = -(sy - k.y - v.panY);
    var c = Math.cos(-v.rot), n = Math.sin(-v.rot);
    return { x: (dx * c - dy * n) / v.scale, y: (dx * n + dy * c) / v.scale };
  }

  // ---------------- 主题 -> CSS 变量 ----------------
  function applyTheme() {
    var r = document.documentElement.style;
    r.setProperty('--geo-bg', T.bg);
    r.setProperty('--geo-text', T.text);
    r.setProperty('--geo-point', T.point.fill);
    r.setProperty('--geo-point-stroke', T.point.stroke);
    r.setProperty('--geo-point-hover', T.point.hoverFill);
    r.setProperty('--geo-point-sel', T.point.selFill);
    r.setProperty('--geo-edge', T.edge.stroke);
    r.setProperty('--geo-edge-hover', T.edge.hoverStroke);
    r.setProperty('--geo-grid', T.grid);
    r.setProperty('--geo-menu-bg', T.menu.bg);
    r.setProperty('--geo-menu-text', T.menu.text);
    r.setProperty('--geo-menu-border', T.menu.border);
    r.setProperty('--geo-menu-shadow', T.menu.shadow);
    r.setProperty('--geo-menu-hover', T.menu.hoverBg);
    r.setProperty('--geo-panel-bg', T.panel.bg);
    r.setProperty('--geo-panel-border', T.panel.border);
    r.setProperty('--geo-panel-text', T.panel.text);
    r.setProperty('--geo-panel-label', T.panel.label);
    r.setProperty('--geo-panel-btn-bg', T.panel.btnBg);
    r.setProperty('--geo-panel-btn-text', T.panel.btnText);
    r.setProperty('--geo-panel-btn-active-bg', T.panel.btnActiveBg);
    r.setProperty('--geo-panel-btn-active-text', T.panel.btnActiveText);
    r.setProperty('--geo-panel-width', T.panel.width + 'px');
    r.setProperty('--geo-label', T.label.fill);
    r.setProperty('--geo-origin', T.origin.color);
    r.setProperty('--geo-hull-stroke', T.hull.stroke);
    r.setProperty('--geo-hull-fill', T.hull.fill);
    r.setProperty('--geo-centroid', T.centroid.color);
    r.setProperty('--geo-angle', T.angle.color);
    r.setProperty('--geo-src', T.src.color);
    r.setProperty('--geo-snk', T.snk.color);
    r.setProperty('--geo-arrow', T.arrow.fill);
    r.setProperty('--geo-axis-x', T.axis.x);
    r.setProperty('--geo-axis-y', T.axis.y);
  }

  // ---------------- 原点 (0,0) ----------------
  var originMark = el('g', { 'class': 'geo-origin' });
  originMark.appendChild(el('line', { x1: -13, y1: 0, x2: -5, y2: 0 }));
  originMark.appendChild(el('line', { x1: 5, y1: 0, x2: 13, y2: 0 }));
  originMark.appendChild(el('line', { x1: 0, y1: -13, x2: 0, y2: -5 }));
  originMark.appendChild(el('line', { x1: 0, y1: 5, x2: 0, y2: 13 }));
  originMark.appendChild(el('circle', { cx: 0, cy: 0, r: 1.6, fill: 'currentColor' }));
  var originText = el('text', { x: 8, y: 16 });
  originText.textContent = '0';
  originMark.appendChild(originText);
  layerOrigin.appendChild(originMark);

  // 初始 x/y 坐标轴：长度 = T.axis.len（世界单位），在屏幕层画，粗细/箭头大小恒定
  var AX = T.axis;
  var axisXL = el('line', { 'class': 'geo-axis geo-axis-x' });
  var axisXA = el('polygon', { 'class': 'geo-axis-head-x' });
  var axisXT = el('text', { 'class': 'geo-axis-label geo-axis-label-x' }); axisXT.textContent = 'x';
  var axisYL = el('line', { 'class': 'geo-axis geo-axis-y' });
  var axisYA = el('polygon', { 'class': 'geo-axis-head-y' });
  var axisYT = el('text', { 'class': 'geo-axis-label geo-axis-label-y' }); axisYT.textContent = 'y';
  layerOrigin.appendChild(axisXL); layerOrigin.appendChild(axisXA); layerOrigin.appendChild(axisXT);
  layerOrigin.appendChild(axisYL); layerOrigin.appendChild(axisYA); layerOrigin.appendChild(axisYT);

  function drawAxis(o, e, line, arrow, label) {
    line.setAttribute('x1', o.x); line.setAttribute('y1', o.y);
    line.setAttribute('x2', e.x); line.setAttribute('y2', e.y);
    var dx = e.x - o.x, dy = e.y - o.y, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 3) { arrow.setAttribute('points', ''); label.setAttribute('x', e.x); label.setAttribute('y', e.y); return; }
    var ux = dx / len, uy = dy / len;
    var t = Math.min(10, len * 0.4), w = t * 0.5;
    var bx = e.x - ux * t, by = e.y - uy * t, px = -uy * w, py = ux * w;
    arrow.setAttribute('points', e.x + ',' + e.y + ' ' + (bx + px) + ',' + (by + py) + ' ' + (bx - px) + ',' + (by - py));
    label.setAttribute('x', e.x + ux * 13);
    label.setAttribute('y', e.y + uy * 13 + 4);
  }

  // 凸包不再单独画轮廓，改成生成真实的边（见 runHull）

  // 重心现在直接生成一个"点"（见 runCentroid）

  // ---------------- 视图 ----------------
  function applyView() {
    var v = S.view, k = center();
    var deg = v.rot * 180 / Math.PI;
    viewport.setAttribute('transform',
      'translate(' + (k.x + v.panX) + ' ' + (k.y + v.panY) + ') scale(1 -1) rotate(' + deg + ') scale(' + v.scale + ')');

    var o = worldToScreen(0, 0);
    originMark.setAttribute('transform', 'translate(' + o.x + ' ' + o.y + ')');
    if (B.showAxes) {
      drawAxis(o, worldToScreen(AX.len, 0), axisXL, axisXA, axisXT);
      drawAxis(o, worldToScreen(0, AX.len), axisYL, axisYA, axisYT);
    } else {
      axisXA.setAttribute('points', ''); axisYA.setAttribute('points', '');
      axisXT.textContent = ''; axisYT.textContent = '';
      axisXL.setAttribute('x2', o.x); axisXL.setAttribute('y2', o.y);
      axisYL.setAttribute('x2', o.x); axisYL.setAttribute('y2', o.y);
    }

    // 点、编号放在不缩放的层：位置世界->屏幕，大小恒定
    S.points.forEach(function (p) {
      var c = p._el, s = worldToScreen(p.x, p.y);
      if (c) {
        c.setAttribute('cx', s.x);
        c.setAttribute('cy', s.y);
        c.setAttribute('r', p.size);
        c.setAttribute('stroke-width', isSelPoint(p.id) ? 4 : T.point.strokeWidth);
      }
      if (p._label) {
        p._label.setAttribute('x', s.x + 9);
        p._label.setAttribute('y', s.y - 9);
      }
      if (p._role) {
        p._role.setAttribute('cx', s.x);
        p._role.setAttribute('cy', s.y);
        p._role.setAttribute('r', p.size + 5);
      }
    });
    // 边在缩放层：粗细除以缩放保持恒定；方向箭头在屏幕层，大小恒定
    S.edges.forEach(function (e) {
      if (e._el) {
        e._el.setAttribute('stroke-width', (isSelEdge(e.id) ? e.width * 2 : e.width) / v.scale);
      }
      if (e._arrow) {
        var a = getPoint(e.from), b = getPoint(e.to);
        if (!a || !b) { e._arrow.setAttribute('points', ''); return; }
        var sa = worldToScreen(a.x, a.y), sb = worldToScreen(b.x, b.y);
        var dx = sb.x - sa.x, dy = sb.y - sa.y, len = Math.sqrt(dx * dx + dy * dy);
        var back = (b.size || 6) + 4;
        if (len - back < 5) { e._arrow.setAttribute('points', ''); return; }
        var ux = dx / len, uy = dy / len;
        var tx = sb.x - ux * back, ty = sb.y - uy * back;
        var tl = 9, tw = 4.5;
        var bx = tx - ux * tl, by = ty - uy * tl, px = -uy * tw, py = ux * tw;
        e._arrow.setAttribute('points',
          tx + ',' + ty + ' ' + (bx + px) + ',' + (by + py) + ' ' + (bx - px) + ',' + (by - py));
      }
    });

    // 角度标签（屏幕层，沿角平分线方向偏移固定像素）
    S.angleItems.forEach(function (it) {
      var s = worldToScreen(it.px, it.py);
      var d = -it.dir - v.rot;             // 屏幕 y 翻转，方向也翻
      it.el.setAttribute('x', s.x + Math.cos(d) * 30);
      it.el.setAttribute('y', s.y + Math.sin(d) * 30);
    });

    updateGrid();
  }

  // ---------------- 网格（自适应 1 / 10 / 100 …，逐级加粗） ----------------
  var gridPaths = [];
  for (var _gi = 0; _gi < 3; _gi++) {
    var _gp = el('path', { 'class': 'geo-grid-line geo-grid-' + (_gi + 1) });
    layerGrid.appendChild(_gp);
    gridPaths.push(_gp);
  }
  function updateGrid() {
    if (!B.showGrid) { gridPaths.forEach(function (p) { p.setAttribute('d', ''); }); return; }
    var w = stage.clientWidth, h = stage.clientHeight;
    var cs = [screenToWorld(0, 0), screenToWorld(w, 0), screenToWorld(0, h), screenToWorld(w, h)];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cs.forEach(function (c) {
      if (c.x < minX) { minX = c.x; } if (c.x > maxX) { maxX = c.x; }
      if (c.y < minY) { minY = c.y; } if (c.y > maxY) { maxY = c.y; }
    });
    // 只保留屏幕间距够大的层级（太密的自动不显示）
    var levels = [], step = B.grid.base;
    for (var i = 0; i < 12 && levels.length < B.grid.maxLevels; i++, step *= 10) {
      if (step * S.view.scale >= B.grid.minGap) { levels.push(step); }
    }
    if (!levels.length) { levels = [B.grid.base]; }
    for (var k = 0; k < gridPaths.length; k++) {
      var st = levels[k];
      if (!st) { gridPaths[k].setAttribute('d', ''); continue; }
      var d = '';
      var xA = rnd4(minX), xB = rnd4(maxX), yA = rnd4(minY), yB = rnd4(maxY);
      // 用整数下标乘 step，避免 0.1 这种步长累加产生浮点误差
      var ix0 = Math.ceil(minX / st), ix1 = Math.floor(maxX / st);
      for (var ix = ix0; ix <= ix1; ix++) {
        var gx = rnd4(ix * st);
        d += 'M' + gx + ' ' + yA + 'L' + gx + ' ' + yB;
      }
      var iy0 = Math.ceil(minY / st), iy1 = Math.floor(maxY / st);
      for (var iy = iy0; iy <= iy1; iy++) {
        var gy = rnd4(iy * st);
        d += 'M' + xA + ' ' + gy + 'L' + xB + ' ' + gy;
      }
      gridPaths[k].setAttribute('d', d);
    }
  }

  // ---------------- 渲染 ----------------
  function render() {
    layerEdges.innerHTML = '';
    layerArrows.innerHTML = '';
    var withArrows = arrowsOn();
    S.edges.forEach(function (e) {
      var a = getPoint(e.from), b = getPoint(e.to);
      if (!a || !b) { return; }
      var ln = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-linecap': 'round' });
      ln.setAttribute('class', 'geo-edge' + (isSelEdge(e.id) ? ' is-selected' : ''));
      ln.style.setProperty('--ec', e.color);
      ln.dataset.edgeId = e.id;
      e._el = ln;
      layerEdges.appendChild(ln);

      if (withArrows) {
        var ap = el('polygon', { 'class': 'geo-arrow' });
        layerArrows.appendChild(ap);
        e._arrow = ap;
      } else { e._arrow = null; }
    });

    layerPoints.innerHTML = '';
    layerLabels.innerHTML = '';
    S.points.forEach(function (p) {
      var c = el('circle', { r: p.size });
      c.setAttribute('class', 'geo-point' + (isSelPoint(p.id) ? ' is-selected' : ''));
      c.style.setProperty('--pt', p.color);
      c.dataset.pointId = p.id;
      p._el = c;
      layerPoints.appendChild(c);

      var t = el('text', { 'class': 'geo-label' });
      t.textContent = p.label + (p.role === 's' ? ' (S)' : (p.role === 't' ? ' (T)' : ''));
      p._label = t;
      layerLabels.appendChild(t);

      if (p.role) {
        var rg = el('circle', { 'class': 'geo-role', 'data-role': p.role });
        layerLabels.appendChild(rg);
        p._role = rg;
      } else { p._role = null; }
    });

    // 角度标签
    S.angleItems = [];
    if (S.showAngles) {
      computeAngles().forEach(function (a) {
        var t2 = el('text', { 'class': 'geo-angle', 'text-anchor': 'middle' });
        var deg = a.ang * 180 / Math.PI;
        t2.textContent = deg.toFixed(1) + '°/' + a.ang.toFixed(3) + 'rad';
        layerLabels.appendChild(t2);
        S.angleItems.push({ el: t2, px: a.px, py: a.py, dir: a.dir });
      });
    }

    applyView();
    if (!isEditingControl()) { refreshControls(); }
    if (!isEditingInfo()) { renderInfo(); }
  }

  // ---------------- 数据操作 ----------------
  function addPoint(x, y) {
    var p = { id: S.nextPointId++, x: x, y: y, label: S.nextLabel++, side: '', role: '', color: S.style.pointColor, size: S.style.pointSize };
    S.points.push(p);
    render();
    return p;
  }
  function pushEdge(from, to) {
    if (from === to || from == null || to == null) { return null; }
    var dup = S.edges.some(function (e) {
      return (e.from === from && e.to === to) || (e.from === to && e.to === from);
    });
    if (dup) { return null; }
    var e = { id: S.nextEdgeId++, from: from, to: to, cap: 0, flow: 0, color: S.style.edgeColor, width: S.style.edgeWidth };
    S.edges.push(e);
    return e;
  }
  function addEdge(from, to) { if (pushEdge(from, to)) { render(); } }
  function deletePoint(id) {
    S.points = S.points.filter(function (p) { return p.id !== id; });
    S.edges = S.edges.filter(function (e) { return e.from !== id && e.to !== id; });
    S.sel.points = S.sel.points.filter(function (x) { return x !== id; });
    S.sel.edges = S.sel.edges.filter(function (x) { return getEdge(x) !== null; });
    S.hull = []; S.centroid = null;                    // 点变了，结果作废
    render();
  }
  function deleteEdge(id) {
    S.edges = S.edges.filter(function (e) { return e.id !== id; });
    S.sel.edges = S.sel.edges.filter(function (x) { return x !== id; });
    render();
  }
  function clearSelection() { S.sel.points = []; S.sel.edges = []; }
  function deleteSelection() {
    var pset = S.sel.points.slice(), eset = S.sel.edges.slice();
    S.points = S.points.filter(function (p) { return pset.indexOf(p.id) < 0; });
    S.edges = S.edges.filter(function (e) {
      return eset.indexOf(e.id) < 0 && pset.indexOf(e.from) < 0 && pset.indexOf(e.to) < 0;
    });
    S.hull = []; S.centroid = null;                    // 点变了，结果作废
    clearSelection();
    render();
  }

  // ---------------- 顶部控件 ----------------
  function isEditingControl() {
    var a = document.activeElement;
    return a === colPoint || a === colEdge || a === numPointSize || a === numEdgeWidth;
  }
  function refreshControls() {
    var sp = S.sel.points.length ? getPoint(S.sel.points[0]) : null;
    var se = S.sel.edges.length ? getEdge(S.sel.edges[0]) : null;
    colPoint.value = sp ? sp.color : S.style.pointColor;
    numPointSize.value = sp ? sp.size : S.style.pointSize;
    colEdge.value = se ? se.color : S.style.edgeColor;
    numEdgeWidth.value = se ? se.width : S.style.edgeWidth;
    var np = S.sel.points.length, ne = S.sel.edges.length;
    ctlTarget.textContent = (np || ne)
      ? ('选中 ' + (np ? np + ' 点' : '') + (ne ? (np ? '、' : '') + ne + ' 边' : ''))
      : '新对象';
  }
  colPoint.addEventListener('input', function () {
    var v = colPoint.value;
    if (S.sel.points.length) { S.sel.points.forEach(function (id) { var p = getPoint(id); if (p) { p.color = v; } }); render(); }
    else { S.style.pointColor = v; }
  });
  numPointSize.addEventListener('input', function () {
    var v = parseFloat(numPointSize.value); if (!(v > 0)) { return; }
    if (S.sel.points.length) { S.sel.points.forEach(function (id) { var p = getPoint(id); if (p) { p.size = v; } }); render(); }
    else { S.style.pointSize = v; }
  });
  colEdge.addEventListener('input', function () {
    var v = colEdge.value;
    if (S.sel.edges.length) { S.sel.edges.forEach(function (id) { var e = getEdge(id); if (e) { e.color = v; } }); render(); }
    else { S.style.edgeColor = v; }
  });
  numEdgeWidth.addEventListener('input', function () {
    var v = parseFloat(numEdgeWidth.value); if (!(v > 0)) { return; }
    if (S.sel.edges.length) { S.sel.edges.forEach(function (id) { var e = getEdge(id); if (e) { e.width = v; } }); render(); }
    else { S.style.edgeWidth = v; }
  });

  // ---------------- 左侧信息窗 ----------------
  function isEditingInfo() { return infoBody.contains(document.activeElement); }
  function infoRow(key, node) {
    var d = document.createElement('div'); d.className = 'info-row';
    var k = document.createElement('span'); k.className = 'k'; k.textContent = key;
    var v = document.createElement('span'); v.className = 'v';
    if (typeof node === 'string') { v.textContent = node; } else { v.appendChild(node); }
    d.appendChild(k); d.appendChild(v);
    return d;
  }
  function infoInput(value, onInput, type) {
    var i = document.createElement('input');
    i.type = type || 'text';
    i.value = value;
    i.addEventListener('input', function () { onInput(i.value); });
    return i;
  }
  function renderInfo() {
    var np = S.sel.points.length, ne = S.sel.edges.length;
    infoBody.innerHTML = '';
    if (!np && !ne) { infoBody.className = 'info-empty'; infoBody.textContent = '未选中任何对象'; return; }
    infoBody.className = '';

    if (np === 1 && ne === 0) {
      var p = getPoint(S.sel.points[0]);
      if (!p) { return; }
      infoBody.appendChild(infoRow('类型', '点'));
      infoBody.appendChild(infoRow('编号', infoInput(p.label, function (v) { p.label = v; if (p._label) { p._label.textContent = v; } }, 'number')));

      // 坐标可改：输入后回车（或失焦）即应用
      var cx = document.createElement('input');
      var cy = document.createElement('input');
      cx.type = 'number'; cy.type = 'number';
      cx.step = 'any'; cy.step = 'any';
      cx.className = 'coord'; cy.className = 'coord';
      cx.value = rnd4(p.x); cy.value = rnd4(p.y);
      cx.title = cy.title = '改完按回车应用';
      function commitCoord() {
        var vx = parseFloat(cx.value), vy = parseFloat(cy.value);
        if (isFinite(vx)) { p.x = vx; }
        if (isFinite(vy)) { p.y = vy; }
        render();
      }
      cx.addEventListener('change', commitCoord);
      cy.addEventListener('change', commitCoord);
      cx.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { commitCoord(); } });
      cy.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { commitCoord(); } });
      var coordWrap = document.createElement('span');
      coordWrap.className = 'coord-wrap';
      coordWrap.appendChild(cx);
      coordWrap.appendChild(cy);
      infoBody.appendChild(infoRow('坐标', coordWrap));
      infoBody.appendChild(infoRow('染色', infoInput(p.side, function (v) { p.side = v; })));

      var roleWrap = document.createElement('span');
      roleWrap.className = 'role-wrap';
      var bS = document.createElement('button');
      bS.type = 'button'; bS.textContent = '源点';
      bS.className = 'role' + (p.role === 's' ? ' on-s' : '');
      bS.addEventListener('click', function () { setRole(p.id, p.role === 's' ? '' : 's'); });
      var bT = document.createElement('button');
      bT.type = 'button'; bT.textContent = '汇点';
      bT.className = 'role' + (p.role === 't' ? ' on-t' : '');
      bT.addEventListener('click', function () { setRole(p.id, p.role === 't' ? '' : 't'); });
      roleWrap.appendChild(bS); roleWrap.appendChild(bT);
      infoBody.appendChild(infoRow('角色', roleWrap));
      return;
    }
    if (ne === 1 && np === 0) {
      var e = getEdge(S.sel.edges[0]);
      if (!e) { return; }
      var a = getPoint(e.from), b = getPoint(e.to);
      infoBody.appendChild(infoRow('类型', '边'));
      infoBody.appendChild(infoRow('编号', '#' + e.id));
      infoBody.appendChild(infoRow('方向', (a ? a.label : '?') + ' → ' + (b ? b.label : '?')));
      infoBody.appendChild(infoRow('容量', infoInput(e.cap, function (v) { e.cap = parseFloat(v) || 0; }, 'number')));
      infoBody.appendChild(infoRow('流量', infoInput(e.flow, function (v) { e.flow = parseFloat(v) || 0; }, 'number')));
      return;
    }
    infoBody.className = 'info-empty';
    infoBody.textContent = '选中 ' + (np ? np + ' 点' : '') + (ne ? (np ? '、' : '') + ne + ' 边' : '');
  }

  // ---------------- 右侧面板 ----------------
  panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  function setDragMode(mode) {
    S.dragMode = mode;
    var btns = segDrag.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) { btns[i].classList.toggle('active', btns[i].dataset.mode === mode); }
  }
  segDrag.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (b && b.dataset.mode) { setDragMode(b.dataset.mode); }
  });

  // ---------------- 弹出小菜单 ----------------
  function showMenu(sx, sy, wx, wy) {
    menu.innerHTML = '';
    var liAdd = document.createElement('li');
    liAdd.textContent = '添加点';
    liAdd.addEventListener('click', function () { addPoint(wx, wy); hideMenu(); });
    menu.appendChild(liAdd);
    var liClear = document.createElement('li');
    liClear.textContent = '取消选中';
    liClear.addEventListener('click', function () { clearSelection(); render(); hideMenu(); });
    menu.appendChild(liClear);
    menu.style.left = sx + 'px';
    menu.style.top = sy + 'px';
    menu.classList.remove('hidden');
  }
  function hideMenu() { menu.classList.add('hidden'); menu2.classList.add('hidden'); }
  menu.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  menu2.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

  // ---- 右键空白呼出的菜单：★ 内容你自己定，改这个数组即可 ★ ----
  function contextMenuItems(wx, wy) {
    return [
      { label: '求凸包',       run: runHull },
      { label: '求重心',       run: runCentroid },
      { label: '求最大流',     run: runMaxFlow },
      { label: (S.showAngles ? '隐藏角度' : '显示角度'), run: toggleAngles },
      { label: '删除所有边',   run: runClearEdges },
      { label: '删除所有',     run: runDeleteSelected }
    ];
  }
  function showContextMenu(sx, sy, wx, wy) {
    menu2.innerHTML = '';
    contextMenuItems(wx, wy).forEach(function (it) {
      var li = document.createElement('li');
      li.textContent = it.label;
      li.addEventListener('click', function () { hideMenu(); it.run(); });
      menu2.appendChild(li);
    });
    menu2.style.left = sx + 'px';
    menu2.style.top = sy + 'px';
    menu2.classList.remove('hidden');
  }
  function resetView() {
    S.view.scale = 1; S.view.rot = 0; S.view.panX = 0; S.view.panY = 0;
    applyView();
  }

  // ---------------- 框选矩形 ----------------
  var marquee = el('rect', { 'class': 'geo-marquee' });
  marquee.style.display = 'none';
  layerUI.appendChild(marquee);
  function showMarquee(x0, y0, x1, y1) {
    marquee.setAttribute('x', Math.min(x0, x1));
    marquee.setAttribute('y', Math.min(y0, y1));
    marquee.setAttribute('width', Math.abs(x1 - x0));
    marquee.setAttribute('height', Math.abs(y1 - y0));
    marquee.style.display = '';
  }
  function hideMarquee() { marquee.style.display = 'none'; }

  // ---------------- 指针交互 ----------------
  var drag = null;
  function localXY(e) { var r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function idOf(target, key) { return (target && target.dataset && target.dataset[key]) ? +target.dataset[key] : null; }
  // 点在左侧信息窗 / 右侧面板 / 菜单 / 按钮上时，不算画布操作
  function isUI(t) {
    return panel.contains(t) || info.contains(t) || menu.contains(t) || menu2.contains(t)
        || t === btnImport || t === btnHelp;
  }

  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) { return; }
    if (isUI(e.target)) { return; }
    hideMenu();
    var q = localXY(e);
    var pid = idOf(e.target, 'pointId');
    var eid = idOf(e.target, 'edgeId');
    if (pid !== null) { drag = { kind: 'point', id: pid, sx: q.x, sy: q.y, lx: q.x, ly: q.y, moved: false }; }
    else if (eid !== null) { drag = { kind: 'edge', id: eid, sx: q.x, sy: q.y, lx: q.x, ly: q.y, moved: false }; }
    else { drag = { kind: 'empty', sx: q.x, sy: q.y, lx: q.x, ly: q.y, moved: false }; }
  });

  window.addEventListener('pointermove', function (e) {
    if (!drag) { return; }
    var q = localXY(e);
    var dx = q.x - drag.sx, dy = q.y - drag.sy;
    if (!drag.moved && Math.sqrt(dx * dx + dy * dy) > B.clickThreshold) { drag.moved = true; }

    if (drag.kind === 'point') {
      if (!drag.moved) { return; }
      var ids = isSelPoint(drag.id) ? S.sel.points : [drag.id];
      var w0 = screenToWorld(drag.lx, drag.ly), w1 = screenToWorld(q.x, q.y);
      var ddx = w1.x - w0.x, ddy = w1.y - w0.y;
      ids.forEach(function (id) { var p = getPoint(id); if (p) { p.x += ddx; p.y += ddy; } });
      drag.lx = q.x; drag.ly = q.y;
      render();

    } else if (drag.kind === 'edge') {
      if (!drag.moved) { return; }
      var eids = isSelEdge(drag.id) ? S.sel.edges : [drag.id];
      var a0 = screenToWorld(drag.lx, drag.ly), a1 = screenToWorld(q.x, q.y);
      var edx = a1.x - a0.x, edy = a1.y - a0.y;
      var moved = {};
      eids.forEach(function (id) {
        var ed = getEdge(id); if (!ed) { return; }
        [ed.from, ed.to].forEach(function (pid) {
          if (moved[pid]) { return; }
          moved[pid] = 1;
          var p = getPoint(pid); if (p) { p.x += edx; p.y += edy; }
        });
      });
      drag.lx = q.x; drag.ly = q.y;
      render();

    } else {
      if (!drag.moved) { return; }
      if (S.dragMode === 'pan') {
        S.view.panX += q.x - drag.lx; S.view.panY += q.y - drag.ly; applyView();
      } else if (S.dragMode === 'rotate') {
        var k = center();
        var r0 = Math.atan2(drag.ly - k.y, drag.lx - k.x);
        var r1 = Math.atan2(q.y - k.y, q.x - k.x);
        var da = r1 - r0;
        if (da > Math.PI) { da -= Math.PI * 2; } else if (da < -Math.PI) { da += Math.PI * 2; }
        S.view.rot -= da;              // 世界 y 向上、屏幕 y 向下，旋转方向取反才跟手
        var cs = Math.cos(da), sn = Math.sin(da);
        var px = S.view.panX, py = S.view.panY;
        S.view.panX = px * cs - py * sn; S.view.panY = px * sn + py * cs;
        applyView();
      } else { showMarquee(drag.sx, drag.sy, q.x, q.y); }
      drag.lx = q.x; drag.ly = q.y;
    }
  });

  window.addEventListener('pointerup', function (e) {
    if (!drag) { return; }
    var q = localXY(e);
    if (drag.kind === 'point') {
      if (!drag.moved) { clickPoint(drag.id); }
    } else if (drag.kind === 'edge') {
      if (!drag.moved) { clickEdge(drag.id); }
    } else {
      if (!drag.moved) {
        var w = screenToWorld(drag.sx, drag.sy);
        showMenu(drag.sx, drag.sy, w.x, w.y);
      } else if (S.dragMode === 'select') {
        hideMarquee();
        var x0 = Math.min(drag.sx, q.x), x1 = Math.max(drag.sx, q.x);
        var y0 = Math.min(drag.sy, q.y), y1 = Math.max(drag.sy, q.y);
        var spr = {};
        S.points.forEach(function (p) { spr[p.id] = worldToScreen(p.x, p.y); });
        S.sel.points = S.points.filter(function (p) {
          var s = spr[p.id];
          return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
        }).map(function (p) { return p.id; });
        var gotPoints = S.sel.points.length > 0;
        S.sel.edges = S.edges.filter(function (ed) {
          var a = getPoint(ed.from), b = getPoint(ed.to);
          if (!a || !b) { return false; }
          var sa = spr[ed.from], sb = spr[ed.to];
          if (gotPoints) {
            // 框里有点：边要整条落在框内才算
            return sa.x >= x0 && sa.x <= x1 && sa.y >= y0 && sa.y <= y1 &&
                   sb.x >= x0 && sb.x <= x1 && sb.y >= y0 && sb.y <= y1;
          }
          // 框里没点：只要框"经过"这条边就算选中（方便选边）
          return segRectHit(sa, sb, x0, y0, x1, y1);
        }).map(function (ed) { return ed.id; });
        render();
      }
    }
    drag = null;
  });

  function clickPoint(id) {
    var sp = S.sel.points, se = S.sel.edges;
    if (sp.indexOf(id) >= 0) {
      if (sp.length === 1 && se.length === 0) { clearSelection(); render(); return; }
      S.sel.points = [id]; S.sel.edges = []; render(); return;
    }
    if (sp.length >= 1) {
      var froms = sp.slice();
      clearSelection();
      froms.forEach(function (f) { pushEdge(f, id); });
      render(); return;
    }
    S.sel.points = [id]; S.sel.edges = [];
    render();
  }
  function clickEdge(id) {
    var only = (S.sel.edges.length === 1 && S.sel.points.length === 0 && S.sel.edges[0] === id);
    S.sel.points = [];
    S.sel.edges = only ? [] : [id];
    render();
  }

  stage.addEventListener('contextmenu', function (e) {
    if (!svg.contains(e.target)) { return; }   // 面板 / 信息窗等 UI 上的右键交给浏览器
    e.preventDefault();
    hideMenu();
    var q = localXY(e), w = screenToWorld(q.x, q.y);

    // 右键「点 / 边」→ 呼出菜单
    var pid = idOf(e.target, 'pointId'), eid = idOf(e.target, 'edgeId');
    if (pid !== null || eid !== null) {
      // 若右键的对象没被选中，则先把它选上（菜单操作都作用于选中的目标）
      if (pid !== null && !isSelPoint(pid)) { S.sel.points = [pid]; S.sel.edges = []; render(); }
      else if (eid !== null && !isSelEdge(eid)) { S.sel.points = []; S.sel.edges = [eid]; render(); }
      showContextMenu(q.x, q.y, w.x, w.y);
      return;
    }
    // 右键空白 → 取消选中
    if (S.sel.points.length || S.sel.edges.length) { clearSelection(); render(); }
  });

  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    var q = localXY(e), k = center();
    var w = screenToWorld(q.x, q.y);
    var factor = Math.pow(B.zoomStep, -e.deltaY);
    S.view.scale = clamp(S.view.scale * factor, B.zoomMin, B.zoomMax);
    var rs = rotScale(w.x, w.y, S.view.scale, S.view.rot);
    S.view.panX = q.x - k.x - rs.x;
    S.view.panY = q.y - k.y - rs.y;
    applyView();
  }, { passive: false });

  btnClear.addEventListener('click', function () {
    if (!S.points.length && !S.edges.length) { return; }
    if (confirm('确定清空画板吗？此操作不可撤销。')) {
      S.points = []; S.edges = []; clearSelection();
      render();
    }
  });

  // ---------------- 导入 ----------------
  function openImport() { impMask.classList.remove('hidden'); impPoints.focus(); }
  function closeImport() { impMask.classList.add('hidden'); }
  btnImport.addEventListener('click', openImport);
  document.getElementById('imp-cancel').addEventListener('click', closeImport);
  impMask.addEventListener('pointerdown', function (e) { if (e.target === impMask) { closeImport(); } });

  function parseNums(text, cols) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line[0] === '#') { return; }
      var p = line.split(/[\s,]+/).map(Number);
      if (p.length >= cols) {
        var ok = true;
        for (var i = 0; i < cols; i++) { if (!isFinite(p[i])) { ok = false; } }
        if (ok) { out.push(p); }
      }
    });
    return out;
  }
  function doImport(replace) {
    var pts = parseNums(impPoints.value, 2);
    if (!pts.length) { alert('点数据为空或格式不对（每行应为 x y）'); return; }
    var eds = parseNums(impEdges.value, 2);

    if (replace) {
      S.points = []; S.edges = []; clearSelection();
      S.nextPointId = 1; S.nextEdgeId = 1; S.nextLabel = 1;
    }
    var base = S.nextLabel - 1;                 // 已有编号数
    var labelToId = {};
    pts.forEach(function (p, i) {
      var label = base + i + 1;
      var pt = { id: S.nextPointId++, x: p[0], y: p[1], label: label, side: '', role: '', color: S.style.pointColor, size: S.style.pointSize };
      S.points.push(pt);
      labelToId[label] = pt.id;
    });
    S.nextLabel = base + pts.length + 1;

    var added = 0;
    eds.forEach(function (e) {
      var a = labelToId[base + e[0]], b = labelToId[base + e[1]];
      if (a == null || b == null) { return; }
      if (pushEdge(a, b)) { added++; }
    });

    closeImport();
    fitToView();
    render();
    alert('导入完成：' + pts.length + ' 个点，' + added + ' 条边。');
  }
  document.getElementById('imp-replace').addEventListener('click', function () { doImport(true); });
  document.getElementById('imp-append').addEventListener('click', function () { doImport(false); });

  function fitToView() {
    if (!S.points.length) { return; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    S.points.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    var bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
    var vw = stage.clientWidth || 800, vh = stage.clientHeight || 600;
    var s = Math.min((vw - 140) / bw, (vh - 140) / bh);
    s = clamp(s, B.zoomMin, B.zoomMax);
    S.view.scale = s;
    var bc = rotScale((minX + maxX) / 2, (minY + maxY) / 2, s, S.view.rot);
    S.view.panX = -bc.x;
    S.view.panY = -bc.y;
    applyView();
  }

  // ---------------- 收尾 ----------------
  window.addEventListener('pointerdown', function (e) {
    if (!menu.contains(e.target) && !menu2.contains(e.target)) { hideMenu(); }
  });
  window.addEventListener('resize', function () { render(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeImport(); hideMenu(); clearSelection(); render(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingControl() && !isEditingInfo()
        && (S.sel.points.length || S.sel.edges.length)) {
      e.preventDefault();
      deleteSelection();
    }
  });

  // ---------------- 启动 ----------------
  applyTheme();
  setDragMode(S.dragMode);
  render();

  window.GEO.state = S;
  window.GEO.render = render;
})();
