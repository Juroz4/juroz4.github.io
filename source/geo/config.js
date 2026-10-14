/* ============================================================
 * 凸包画板 · 配置（美术风格 + 交互参数）
 * ------------------------------------------------------------
 * ★★ 想改外观 / 手感，只改这个文件就行，改完刷新页面生效。★★
 *     颜色、粗细、点的大小、缩放灵敏度、方向判定阈值……全在这。
 *     逻辑代码（geo.js）不用动。
 * ============================================================ */
window.GEO = window.GEO || {};

window.GEO.config = {

  /* ---------------- 美术风格 ---------------- */
  theme: {
    bg:     '#f4f6fb',   // 画布背景色
    grid:   '#e4e9f2',   // 网格线颜色
    text:   '#344054',   // 工具栏文字
    accent: '#2f6feb',   // 主题色（备用）

    point: {             // 「点」的样子
      fill:        '#2f6feb',   // 填充
      stroke:      '#ffffff',   // 描边
      strokeWidth: 2,           // 描边粗细（屏幕像素）
      radius:      6,           // 半径（屏幕像素，缩放时大小不变）
      hoverFill:   '#ff7a45',   // 鼠标悬停
      selFill:     '#12b76a'    // 被选中
    },

    edge: {              // 「手动连的边」的样子
      stroke:      '#98a2b3',
      width:       2,           // 屏幕像素
      hoverStroke: '#ff7a45',
      selStroke:   '#12b76a'
    },

    hull: {              // 「凸包」的样子（阶段3才用，先留着）
      stroke: '#f04438',
      width:  3,
      fill:   'rgba(240,68,56,0.06)'
    },

    menu: {              // 弹出小菜单
      bg:      '#ffffff',
      text:    '#344054',
      border:  '#e4e9f2',
      shadow:  '0 6px 24px rgba(16,24,40,0.14)',
      hoverBg: '#f2f4f7'
    },

    panel: {             // 右侧控制面板 / 左侧信息窗 / 导入弹窗
      bg:            '#ffffff',
      border:        '#e4e9f2',
      text:          '#344054',
      label:         '#667085',
      btnBg:         '#f2f4f7',
      btnText:       '#344054',
      btnActiveBg:   '#2f6feb',
      btnActiveText: '#ffffff',
      width:         128
    },

    label:  { fill: '#667085' },   // 点旁边的编号文字
    origin: { color: '#9aa4b2' },  // 原点(0,0)标记
    centroid: { color: '#7a5af8' },// 重心标记
    angle:    { color: '#b54708' },// 角度标签
    src:   { color: '#12b76a' },   // 源点圈
    snk:   { color: '#f04438' },   // 汇点圈
    arrow: { fill: '#98a2b3' },    // 边的方向箭头
    axis:  { x: '#e8590c', y: '#12b76a', z: '#2f6feb', len: 100 }  // 初始 x/y/z 坐标轴（长 100 世界单位）
  },

  /* ---------------- 交互参数 ---------------- */
  behavior: {
    clickThreshold: 4,     // 位移小于这么多像素 → 算「单击」，否则算「拖动」
    zoomStep:        1.003,  // 滚轮灵敏度（越大越快）
    zoomMin:         0.01,   // 最小缩放
    zoomMax:         1000,   // 最大缩放（要能看到 0.1 的格子，就得放得足够大）
    mode:            '2d',   // 初始模式：'2d' | '3d'（右上角按钮可切）
    pitch:          -32,     // 3D 初始俯仰角（度）
    yaw:             26,     // 3D 初始偏航角（度）
    dragMode:        'select', // 拖动空白时默认模式：'select'(框选) | 'pan'(平移) | 'rotate'(旋转)
    showGrid:        true,   // 是否显示网格
    showAxes:        true,   // 是否显示初始 x/y 坐标轴
    grid: {
      base:      0.1, // 最细网格单位：每隔 base、10*base、100*base… 画，逐级加粗
      minGap:    8,   // 某层网格的屏幕间距小于这个像素数就隐藏（太密不画）
      maxLevels: 3    // 最多同时显示几层（细 / 中 / 粗）
    }
  }
};
