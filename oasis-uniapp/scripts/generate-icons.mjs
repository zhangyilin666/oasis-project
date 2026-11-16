// 生成 TabBar 图标 + App Icon
// 用法: node scripts/generate-icons.mjs
// 仅更新应用图标: node scripts/generate-icons.mjs --app-only
import sharp from 'sharp'

const ICON_DIR = 'src/static/images'
const TAB_SIZE = 81
const APP_SIZE = 1024

// 辅助: 创建纯色圆/形状的 SVG
async function svgIcon(shape, color) {
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
    case 'app-icon': { // 使用已确认的三花形象和当前品牌名
      const sprite = (await sharp('src/static/ui/cat-calico-sprite.webp').png().toBuffer()).toString('base64')
      return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${APP_SIZE}" height="${APP_SIZE}" viewBox="0 0 1024 1024">
        <defs>
          <clipPath id="cat"><rect x="160" y="48" width="704" height="704"/></clipPath>
        </defs>
        <rect width="1024" height="1024" rx="224" fill="#eee7f8"/>
        <circle cx="512" cy="410" r="340" fill="#faf8fc"/>
        <image xlink:href="data:image/png;base64,${sprite}" x="160" y="48" width="2112" height="1408" clip-path="url(#cat)"/>
        <text x="512" y="895" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="140" font-weight="bold" fill="#59428e">猫来运转</text>
      </svg>`
    }
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

  for (const [name, shape, color] of (process.argv.includes('--app-only') ? [] : pairs)) {
    const svg = await svgIcon(shape, color)
    await sharp(Buffer.from(svg)).resize(TAB_SIZE, TAB_SIZE).png().toFile(`${ICON_DIR}/${name}`)
    console.log(`  ${name} (${TAB_SIZE}x${TAB_SIZE})`)
  }

  // App Icon
  const appSvg = await svgIcon('app-icon')
  await sharp(Buffer.from(appSvg)).resize(APP_SIZE, APP_SIZE).png().toFile(`${ICON_DIR}/app-icon.png`)
  console.log(`  app-icon.png (${APP_SIZE}x${APP_SIZE})`)

  console.log('\n✅ 图标生成完成')
}

generate().catch(e => { console.error(e); process.exit(1) })
