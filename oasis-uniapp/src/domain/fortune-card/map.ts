/** Display data for the shareable daily card. Never includes identity or links. */

export const FORTUNE_CARD_WIDTH = 1080
export const FORTUNE_CARD_HEIGHT = 1440
export const APP_NAME = '猫来运转'
export const SUMMARY_LIMIT = 72

/** Cute display index only. Unknown relations stay unlabeled instead of inventing a number. */
export const RELATION_SCORE: Record<string, number> = {
  食神: 5,
  正印: 5,
  正财: 4,
  偏财: 4,
  正官: 4,
  比肩: 3,
  偏印: 3,
  伤官: 3,
  劫财: 2,
  七杀: 2,
}

const COLOR_SWATCHES: Array<[string, string]> = [
  ['天蓝色', '#7eb6e6'],
  ['蓝', '#6a90d4'],
  ['青', '#6eb3b0'],
  ['绿', '#5eae86'],
  ['紫', '#8d74c4'],
  ['粉', '#e7a0b4'],
  ['红', '#e36b6b'],
  ['橙', '#e39a4a'],
  ['黄', '#e2c15a'],
  ['金', '#d4a017'],
  ['白', '#f7f3ea'],
  ['黑', '#3a3544'],
  ['棕', '#a67c52'],
  ['米', '#e6d3b3'],
]

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export interface FortuneCardSource {
  date: string
  dayGanZhi?: string
  dayRelation?: string
  fortuneText?: string
  luckyColor?: string
  luckyDirection?: string
  luckyNumber?: string | null
  lunarMonth?: string
  lunarDay?: string
  yearGanZhi?: string
  yi?: string[]
  ji?: string[]
  sign?: FortuneCardSign | null
  /** Private text to strip from the summary. It is never copied onto the card. */
  redact?: string | null
}

export interface FortuneCardSign {
  number?: number | null
  grade?: string | null
  line?: string | null
}

export interface FortuneCardModel {
  width: number
  height: number
  solarDate: string
  weekday: string
  lunarLine: string
  relation: string
  score: number | null
  summary: string
  luckyColor: string | null
  colorSwatch: string | null
  luckyDirection: string | null
  luckyNumber: string | null
  yi: string | null
  ji: string | null
  signLine: string | null
  footer: typeof APP_NAME
}

export function scoreForRelation(relation: string): number | null {
  const hit = Object.keys(RELATION_SCORE)
    .sort((a, b) => b.length - a.length)
    .find(key => relation.includes(key))
  return hit ? RELATION_SCORE[hit] : null
}

export function colorSwatch(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const exact = COLOR_SWATCHES.find(([label]) => label === trimmed)
  if (exact) return exact[1]
  const partial = COLOR_SWATCHES.find(([label]) => trimmed.includes(label))
  return partial ? partial[1] : '#c4b4de'
}

export function wrapText(text: string, maxWidth: number, measure: (sample: string) => number): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    if (char === '\n') {
      lines.push(current)
      current = ''
      continue
    }
    const next = current + char
    if (current && measure(next) > maxWidth) {
      lines.push(current)
      current = char.trim() ? char : ''
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

export function buildFortuneCard(source: FortuneCardSource): FortuneCardModel {
  const date = parseDate(source.date)
  const relation = clean(source.dayRelation, 12)
  const color = clean(source.luckyColor, 8)
  return {
    width: FORTUNE_CARD_WIDTH,
    height: FORTUNE_CARD_HEIGHT,
    solarDate: date.label,
    weekday: date.weekday,
    lunarLine: lunarLine(source),
    relation,
    score: relation ? scoreForRelation(relation) : null,
    summary: summarize(source.fortuneText, source.redact),
    luckyColor: color || null,
    colorSwatch: color ? colorSwatch(color) : null,
    luckyDirection: clean(source.luckyDirection, 8) || null,
    luckyNumber: cleanNumber(source.luckyNumber),
    yi: firstItem(source.yi),
    ji: firstItem(source.ji),
    signLine: formatSignLine(source.sign),
    footer: APP_NAME,
  }
}

function parseDate(value: string): { label: string; weekday: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return { label: '今日', weekday: '' }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  return {
    label: `${year}年${month}月${day}日`,
    weekday: `周${WEEKDAYS[utc.getUTCDay()]}`,
  }
}

function lunarLine(source: FortuneCardSource): string {
  const month = clean(source.lunarMonth, 4)
  const day = clean(source.lunarDay, 4)
  const year = clean(source.yearGanZhi, 8)
  const ganzhi = clean(source.dayGanZhi, 8)
  const lunar = month && day ? `${month}月${day}` : ''
  return [lunar, year, ganzhi ? `${ganzhi}日` : ''].filter(Boolean).join(' · ')
}

function summarize(text: string | undefined, redact: string | null | undefined): string {
  const hidden = redactTokens(redact)
  let plain = (text || '').replace(/\s+/g, ' ').trim()
  for (const token of hidden) plain = plain.split(token).join('')
  plain = plain
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/g, '')
    .replace(/\d{1,2}:\d{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return '今天按自己的节奏来就好。'
  if (plain.length <= SUMMARY_LIMIT) return plain
  const clipped = plain.slice(0, SUMMARY_LIMIT)
  const pause = Math.max(clipped.lastIndexOf('。'), clipped.lastIndexOf('，'))
  const body = pause >= 24 ? clipped.slice(0, pause + 1) : clipped
  return body.replace(/[，。]$/, '') + '…'
}

function redactTokens(secret: string | null | undefined): string[] {
  if (!secret) return []
  return [...new Set(secret.split(/\s+/).map(token => token.trim()).filter(token => token.length >= 2))]
}

function formatSignLine(sign: FortuneCardSign | null | undefined): string | null {
  const number = Number(sign?.number)
  if (!Number.isInteger(number) || number < 1 || number > 100) return null
  const grade = sign?.grade && ['上上', '上', '中', '下'].includes(sign.grade) ? sign.grade : ''
  const line = clean(sign?.line || '', 16)
  if (!line) return null
  return [`第${number}签`, grade, line].filter(Boolean).join(' · ')
}

function firstItem(values: string[] | undefined): string | null {
  const item = values?.map(value => clean(value, 8)).find(Boolean)
  return item || null
}

function clean(value: string | undefined, limit: number): string {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function cleanNumber(value: string | null | undefined): string | null {
  const text = (value || '').trim()
  if (!/^[\d一二三四五六七八九十]{1,4}$/.test(text)) return null
  return text
}
