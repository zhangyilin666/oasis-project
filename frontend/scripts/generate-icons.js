// 生成 Tab Bar 图标 PNG（81×81px）
// 零依赖 — 纯 Node.js（zlib + fs）
// 用法: node scripts/generate-icons.js

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const SIZE = 81
const OUT = path.resolve(__dirname, '..', 'assets', 'images')

// ── PNG 编码器 ──────────────────────────────────────────

function crc32(buf) {
  // 标准 CRC32 查表法
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, typeBytes, data, crcVal])
}

function createPNG(width, height, pixelFn) {
  // 原始像素数据（每行 1 字节 filter + width×4 字节 RGBA）
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + width * 4)
    raw[rowOff] = 0 // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      const off = rowOff + 1 + x * 4
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
      raw[off + 3] = a
    }
  }

  const compressed = zlib.deflateSync(raw)

  // PNG 签名
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const iend = Buffer.alloc(0)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend)
  ])
}

// ── 绘制工具 ────────────────────────────────────────────

function fill(x, y) { return [0, 0, 0, 0] } // 透明背景

function rect(x, y, rx, ry, rw, rh, color) {
  if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
    return [...color, 255]
  }
  return null
}

function circle(x, y, cx, cy, r, color) {
  const dx = x - cx, dy = y - cy
  if (dx * dx + dy * dy <= r * r) {
    return [...color, 255]
  }
  return null
}

function polygon(x, y, pts, color) {
  // 偶数-奇数规则判断点是否在多边形内
  let inside = false
  const n = pts.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i][0], yi = pts[i][1]
    const xj = pts[j][0], yj = pts[j][1]
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  if (inside) return [...color, 255]
  return null
}

function line(x, y, x1, y1, x2, y2, w, color) {
  // 到线段的距离
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    const d = Math.sqrt((x - x1) ** 2 + (y - y1) ** 2)
    if (d <= w / 2) return [...color, 255]
    return null
  }
  let t = ((x - x1) * dx + (y - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const px = x1 + t * dx, py = y1 + t * dy
  const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
  if (d <= w / 2) return [...color, 255]
  return null
}

// ── 图标绘制函数 ────────────────────────────────────────

function draw(shapeFn, color) {
  return createPNG(SIZE, SIZE, (x, y) => {
    const px = shapeFn(x, y)
    if (px) return px
    return [0, 0, 0, 0] // 透明
  })
}

// ── 图标形状定义（归一化坐标 0–1 → 像素）────────────────

const S = SIZE // 81
const M = 8    // margin

// 首页图标：房子
function homeShape(x, y, color) {
  const margin = M
  const w = S - margin * 2
  const bodyTop = S * 0.42
  const bodyBottom = S - margin
  const bodyLeft = margin + w * 0.2
  const bodyRight = S - margin - w * 0.2

  // 屋顶（三角形）
  const roofPts = [
    [margin, bodyTop],
    [S / 2, margin],
    [S - margin, bodyTop]
  ]

  // 烟囱
  const chimney = rect(x, y, S * 0.6, S * 0.15, S * 0.12, S * 0.2, color)

  // 屋顶
  const roof = polygon(x, y, roofPts, color)

  // 墙体
  const wall = rect(x, y, bodyLeft, bodyTop, bodyRight - bodyLeft, bodyBottom - bodyTop, color)

  // 门
  const door = rect(x, y, S * 0.38, S * 0.58, S * 0.24, S * 0.28, color)

  return chimney || roof || wall || door || null
}

// 报告图标：文档 + 折角
function docShape(x, y, color) {
  const margin = M + 4
  const w = S - margin * 2
  const h = S - margin * 2
  const left = margin
  const top = margin
  const right = left + w
  const bottom = top + h
  const fold = Math.min(w, h) * 0.25

  // 主体矩形
  const body = rect(x, y, left, top, w, h, color)

  // 折角（右上角三角形切掉，形成折页效果）
  const foldPts = [
    [right - fold, top],
    [right, top],
    [right, top + fold]
  ]

  // 在折角三角形内的点 → 透明（切掉）
  const inFold = polygon(x, y, foldPts, [0, 0, 0])

  // 折线
  const foldLine = line(x, y, right - fold, top, right, top + fold, 2.5, color)

  // 文字行
  const lineH = 3.5
  const textLines = [
    [left + w * 0.18, top + h * 0.25, right - w * 0.12],
    [left + w * 0.18, top + h * 0.42, right - w * 0.25],
    [left + w * 0.18, top + h * 0.59, right - w * 0.18],
    [left + w * 0.18, top + h * 0.76, right - w * 0.32]
  ]

  let text = null
  for (const [lx, ly, rx2] of textLines) {
    const l = line(x, y, lx, ly, rx2, ly, lineH, color)
    if (l) { text = l; break }
  }

  if (inFold) return [0, 0, 0, 0]
  return body || foldLine || text || null
}

// 搜索图标（备用，暂不使用）
function searchShape(x, y, color) {
  const cx = S * 0.45, cy = S * 0.45, r = S * 0.22
  const circ = circle(x, y, cx, cy, r, color)
  const handle = line(x, y, cx + r * 0.7, cy + r * 0.7, S * 0.75, S * 0.75, 5, color)
  // 中间挖空
  const inner = circle(x, y, cx, cy, r * 0.6, [0, 0, 0])
  if (inner) return [0, 0, 0, 0]
  return circ || handle || null
}

// 用户图标（备用，供个人中心页使用）
function userShape(x, y, color) {
  const head = circle(x, y, S / 2, S * 0.33, S * 0.24, color)
  const body = circle(x, y, S / 2, S * 0.85, S * 0.38, color)
  const cutout = circle(x, y, S / 2, S * 0.82, S * 0.32, [0, 0, 0])
  if (cutout) return [0, 0, 0, 0]
  return head || body || null
}

// ── 生成 ────────────────────────────────────────────────

const gray = [140, 140, 140]    // #8c8c8c — 未选中
const active = [44, 95, 45]     // #2c5f2d — 选中

console.log('Generating tab bar icons (81×81 PNG)...\n')

const icons = [
  { file: 'tab-home.png',        fn: (x, y) => homeShape(x, y, gray) },
  { file: 'tab-home-active.png',  fn: (x, y) => homeShape(x, y, active) },
  { file: 'tab-reports.png',      fn: (x, y) => docShape(x, y, gray) },
  { file: 'tab-reports-active.png', fn: (x, y) => docShape(x, y, active) }
]

// 确保目录存在
if (!fs.existsSync(OUT)) {
  fs.mkdirSync(OUT, { recursive: true })
}

for (const { file, fn } of icons) {
  const png = draw(fn)
  const outPath = path.join(OUT, file)
  fs.writeFileSync(outPath, png)
  console.log(`  ✓ ${file}  (${png.length} bytes)`)
}

// 额外：生成个人中心页图标（备用）
const userOut = path.join(OUT, 'tab-profile.png')
const userActiveOut = path.join(OUT, 'tab-profile-active.png')
fs.writeFileSync(userOut, createPNG(SIZE, SIZE, (x, y) => {
  const px = userShape(x, y, gray)
  return px || [0, 0, 0, 0]
}))
fs.writeFileSync(userActiveOut, createPNG(SIZE, SIZE, (x, y) => {
  const px = userShape(x, y, active)
  return px || [0, 0, 0, 0]
}))
console.log('  ✓ tab-profile.png (extra)')
console.log('  ✓ tab-profile-active.png (extra)')

console.log('\nDone! Icons saved to assets/images/')
