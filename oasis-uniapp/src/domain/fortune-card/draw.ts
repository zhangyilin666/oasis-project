import {
  APP_NAME,
  FORTUNE_CARD_HEIGHT,
  FORTUNE_CARD_WIDTH,
  wrapText,
  type FortuneCardModel,
} from './map'

export const CARD_FONT = '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Source Han Sans SC", "WenQuanYi Micro Hei", sans-serif'
export const CAT_CELL = { columns: 3, rows: 2, column: 0, row: 0 }

export function drawFortuneCard(
  ctx: CanvasRenderingContext2D,
  card: FortuneCardModel,
  cat: CanvasImageSource | null = null,
): void {
  const width = FORTUNE_CARD_WIDTH
  const height = FORTUNE_CARD_HEIGHT
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#f6f1fb'
  ctx.fillRect(0, 0, width, height)
  blob(ctx, 120, 80, 280, '#efe4f8')
  blob(ctx, 900, 260, 220, '#f8e7d6')
  blob(ctx, 180, 1240, 200, '#e7f3ee')

  roundRect(ctx, 72, 72, width - 144, height - 144, 48, '#ffffff')

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#8d74c4'
  ctx.font = `500 34px ${CARD_FONT}`
  ctx.fillText('今日运势', width / 2, 118)

  ctx.fillStyle = '#302b40'
  ctx.font = `600 64px ${CARD_FONT}`
  ctx.fillText(card.solarDate, width / 2, 176)
  ctx.fillStyle = '#7a6c84'
  ctx.font = `400 34px ${CARD_FONT}`
  ctx.fillText([card.weekday, card.lunarLine].filter(Boolean).join('  '), width / 2, 258)

  drawCat(ctx, cat, width / 2, 470)

  ctx.fillStyle = '#7760b2'
  ctx.font = `600 40px ${CARD_FONT}`
  const relation = card.relation || '今日'
  const stars = card.score ? '  ' + '★'.repeat(card.score) + '☆'.repeat(5 - card.score) : ''
  ctx.fillText(relation + stars, width / 2, 690)

  const summaryLines = wrapText(card.summary, 760, sample => measure(ctx, sample, `400 36px ${CARD_FONT}`)).slice(0, 4)
  ctx.fillStyle = '#302b40'
  ctx.font = `400 36px ${CARD_FONT}`
  summaryLines.forEach((line, index) => ctx.fillText(line, width / 2, 770 + index * 54))

  drawFacts(ctx, card, 1020)
  drawAdvice(ctx, card, 1160)
  if (card.signLine) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#6f538c'
    ctx.font = `500 28px ${CARD_FONT}`
    ctx.fillText(card.signLine, width / 2, 1224)
  }

  ctx.fillStyle = '#a18abb'
  ctx.font = `600 32px ${CARD_FONT}`
  ctx.fillText(APP_NAME, width / 2, 1272)
  ctx.font = `400 24px ${CARD_FONT}`
  ctx.fillStyle = '#b3a6c0'
  ctx.fillText('仅供娱乐参考', width / 2, 1318)
}

function drawCat(ctx: CanvasRenderingContext2D, cat: CanvasImageSource | null, centerX: number, centerY: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, 132, 0, Math.PI * 2)
  ctx.fillStyle = '#f4eef9'
  ctx.fill()
  ctx.clip()
  if (cat) {
    const source = imageSize(cat)
    const cellWidth = source.width / CAT_CELL.columns
    const cellHeight = source.height / CAT_CELL.rows
    ctx.drawImage(
      cat,
      CAT_CELL.column * cellWidth,
      CAT_CELL.row * cellHeight,
      cellWidth,
      cellHeight,
      centerX - 120,
      centerY - 120,
      240,
      240,
    )
  } else {
    ctx.fillStyle = '#d8c9e6'
    ctx.beginPath()
    ctx.arc(centerX, centerY + 10, 70, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawFacts(ctx: CanvasRenderingContext2D, card: FortuneCardModel, y: number): void {
  const facts = [
    card.luckyColor ? { label: '幸运色', value: card.luckyColor, swatch: card.colorSwatch } : null,
    card.luckyNumber ? { label: '幸运数', value: card.luckyNumber, swatch: null } : null,
    card.luckyDirection ? { label: '方位', value: card.luckyDirection, swatch: null } : null,
  ].filter((item): item is { label: string; value: string; swatch: string | null } => item !== null)
  if (!facts.length) return
  const gap = 24
  const chipWidth = Math.min(280, Math.floor((860 - gap * (facts.length - 1)) / facts.length))
  const total = facts.length * chipWidth + (facts.length - 1) * gap
  let x = (FORTUNE_CARD_WIDTH - total) / 2
  for (const fact of facts) {
    roundRect(ctx, x, y, chipWidth, 92, 24, '#f7f3fb')
    if (fact.swatch) {
      ctx.beginPath()
      ctx.arc(x + 36, y + 46, 14, 0, Math.PI * 2)
      ctx.fillStyle = fact.swatch
      ctx.fill()
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = '#7a6c84'
    ctx.font = `400 22px ${CARD_FONT}`
    ctx.fillText(fact.label, x + (fact.swatch ? 62 : 28), y + 16)
    ctx.fillStyle = '#302b40'
    ctx.font = `600 30px ${CARD_FONT}`
    ctx.fillText(fact.value, x + (fact.swatch ? 62 : 28), y + 46)
    x += chipWidth + gap
  }
}

function drawAdvice(ctx: CanvasRenderingContext2D, card: FortuneCardModel, y: number): void {
  if (!card.yi && !card.ji) return
  ctx.textAlign = 'center'
  ctx.font = `500 32px ${CARD_FONT}`
  const yi = card.yi ? `宜 ${card.yi}` : ''
  const ji = card.ji ? `忌 ${card.ji}` : ''
  const line = [yi, ji].filter(Boolean).join('    ')
  ctx.fillStyle = card.yi && !card.ji ? '#387361' : '#6f538c'
  if (card.yi && card.ji) {
    const yiWidth = measure(ctx, yi, ctx.font)
    const gap = measure(ctx, '    ', ctx.font)
    const total = yiWidth + gap + measure(ctx, ji, ctx.font)
    let cursor = (FORTUNE_CARD_WIDTH - total) / 2
    ctx.textAlign = 'left'
    ctx.fillStyle = '#387361'
    ctx.fillText(yi, cursor, y)
    cursor += yiWidth + gap
    ctx.fillStyle = '#a64b61'
    ctx.fillText(ji, cursor, y)
    return
  }
  ctx.fillText(line, FORTUNE_CARD_WIDTH / 2, y)
}

function measure(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  ctx.font = font
  return ctx.measureText(text).width
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string): void {
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
  ctx.fill()
}

function imageSize(image: CanvasImageSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }
  if (image instanceof HTMLCanvasElement) return { width: image.width, height: image.height }
  if ('width' in image && 'height' in image) return { width: Number(image.width) || 1536, height: Number(image.height) || 1024 }
  return { width: 1536, height: 1024 }
}
