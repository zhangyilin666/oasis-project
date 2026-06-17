// 生成 TabBar 图标 + App Icon
// 用法: node scripts/generate-icons.mjs
import sharp from 'sharp'

const ICON_DIR = 'src/static/images'
const TAB_SIZE = 81
const APP_SIZE = 1024

// 辅助: 创建纯色圆/形状的 SVG
function svgIcon(shape, color) {
  const c = color || '#8c8c8c'
  switch (shape) {
    case 'home': // 房屋形状
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${TAB_SIZE}" height="${TAB_SIZE}" viewBox="0 0 81 81">
        <path d="M40.5 12L12 38v31h22V51h13v18h22V38L40.5 12z" fill="${c}"/>
      </svg>`
    case 'reports': // 文档/列表
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${TAB_SIZE}" height="${TAB_SIZE}" viewBox="0 0 81 81">
        <rect x="16" y="10" width="49" height="61" rx="4" fill="none" stroke="${c}" stroke-width="5"/>
        <line x1="28" y1="28" x2="53" y2="28" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
        <line x1="28" y1="40" x2="53" y2="40" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
        <line x1="28" y1="52" x2="42" y2="52" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
      </svg>`
    case 'profile': // 人物
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${TAB_SIZE}" height="${TAB_SIZE}" viewBox="0 0 81 81">
        <circle cx="40.5" cy="28" r="14" fill="${c}"/>
        <path d="M12 75c0-16 12-26 28.5-26S69 59 69 75" fill="${c}"/>
      </svg>`
    case 'app-icon': // App 图标: 渐变绿底 + O 字
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${APP_SIZE}" height="${APP_SIZE}" viewBox="0 0 1024 1024">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2c5f2d"/>
            <stop offset="100%" stop-color="#1a3a1c"/>
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>
        <circle cx="512" cy="400" r="140" fill="none" stroke="#ffffff" stroke-width="36" opacity="0.9"/>
        <text x="512" y="700" text-anchor="middle" font-family="sans-serif" font-size="200" font-weight="bold" fill="#ffffff" opacity="0.9">小易</text>
        <text x="512" y="870" text-anchor="middle" font-family="sans-serif" font-size="64" fill="#ffffff" opacity="0.5">XIAOYI</text>
      </svg>`
    default:
      return ''
  }
}

async function generate() {
  const pairs = [
    ['tab-home.png', 'home', '#8c8c8c'],
    ['tab-home-active.png', 'home', '#2c5f2d'],
    ['tab-reports.png', 'reports', '#8c8c8c'],
    ['tab-reports-active.png', 'reports', '#2c5f2d'],
    ['tab-profile.png', 'profile', '#8c8c8c'],
    ['tab-profile-active.png', 'profile', '#2c5f2d'],
  ]

  for (const [name, shape, color] of pairs) {
    const svg = svgIcon(shape, color)
    await sharp(Buffer.from(svg)).resize(TAB_SIZE, TAB_SIZE).png().toFile(`${ICON_DIR}/${name}`)
    console.log(`  ${name} (${TAB_SIZE}x${TAB_SIZE})`)
  }

  // App Icon
  const appSvg = svgIcon('app-icon')
  await sharp(Buffer.from(appSvg)).resize(APP_SIZE, APP_SIZE).png().toFile(`${ICON_DIR}/app-icon.png`)
  console.log(`  app-icon.png (${APP_SIZE}x${APP_SIZE})`)

  console.log('\n✅ 所有图标生成完成')
}

generate().catch(e => { console.error(e); process.exit(1) })
