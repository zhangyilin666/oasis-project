import { hexagramFromLines, TRIGRAMS, type Element, type Hexagram, type Line, type Trigram } from './hexagrams'
import { calculateMeihuaCalendar, resolveCalendarTime, MEIHUA_CALENDAR_VERSION, type MeihuaCalendarFacts } from './calendar'
import { calculateNajia, LIUYAO_NAJIA_VERSION, type NajiaFacts } from './najia'
export { HEXAGRAMS, TRIGRAMS, hexagramFromLines } from './hexagrams'
export { MEIHUA_CALENDAR_VERSION, MEIHUA_CALENDAR_SOURCES, MEIHUA_CALENDAR_CONVENTIONS } from './calendar'
export { LIUYAO_NAJIA_VERSION, LIUYAO_NAJIA_CONVENTIONS, LIUYAO_NAJIA_SOURCES } from './najia'
export type { Hexagram, Line, Trigram, Element } from './hexagrams'

export type LineValue = 6 | 7 | 8 | 9
export type CoinValue = 2 | 3
export const LIUYAO_COINS_VERSION = 'liuyao-coins-v1' as const
export const LIUYAO_COINS_SOURCES = [
  { title: '《增删卜易》· 三钱起卦', url: 'https://www.shidianguji.com/book/SDZJ0627/chapter/1lctz64upgl55' },
  { title: '《文公易说》· 四象数义', url: 'https://www.shidianguji.com/zh/book/SK0055/chapter/1jzn41hy7capf' },
  { title: '《增删卜易》· 动变章（固定修订）', url: 'https://zh.wikisource.org/w/index.php?title=增刪卜易/7&oldid=2100290' },
] as const
export type DivinationMethod = 'liuyao-coins' | 'liuyao-manual' | 'liuyao-najia' | 'meihua-two-numbers' | 'meihua-calendar'
export type DivinationRuleVersion = 'divination-v1' | typeof MEIHUA_CALENDAR_VERSION | typeof LIUYAO_NAJIA_VERSION | typeof LIUYAO_COINS_VERSION
export interface QuestionContext { question: string; date: string; time: string; utcOffset: number }
export type CoinDivinationInput = QuestionContext & { method: 'liuyao-coins'; lines: LineValue[]; coins: CoinValue[][] }
export type DivinationInput = QuestionContext & (
  { method: 'liuyao-coins'; lines: LineValue[]; coins: CoinValue[][] } |
  { method: 'liuyao-manual'; lines: LineValue[] } |
  { method: 'liuyao-najia'; lines: LineValue[] } |
  { method: 'meihua-two-numbers'; numbers: [number, number] } |
  { method: 'meihua-calendar' }
)
export type ElementRelation = '体用比和' | '体生用' | '用生体' | '体克用' | '用克体'
export interface DivinationResult {
  ruleVersion: DivinationRuleVersion
  input: DivinationInput
  questionInstant: string
  original: Hexagram
  changed: Hexagram
  movingLines: number[]
  mutual?: Hexagram
  bodyUse?: { body: Trigram; use: Trigram; bodyPosition: '上卦' | '下卦'; usePosition: '上卦' | '下卦'; relation: ElementRelation }
  calculation: string[]
  calendar?: MeihuaCalendarFacts
  najia?: NajiaFacts
}

export const DIVINATION_SOURCES = [
  { title: '《周易本义》卷一 · 上经卦序与上下卦', url: 'https://zh.wikisource.org/wiki/周易本義_(四庫全書本)/卷1' },
  { title: '《周易本义》卷二 · 下经卦序与上下卦', url: 'https://zh.wikisource.org/wiki/周易本義_(四庫全書本)/卷2' },
  { title: '《梅花易数》卷一 · 卦数、生克、互卦', url: 'https://zh.wikisource.org/zh-hans/梅花易數/卷一' },
  { title: '《梅花易数》卷二 · 体用', url: 'https://zh.wikisource.org/zh-hans/梅花易數/卷二' },
  { title: 'Unicode · 六十四卦符号对照', url: 'https://www.unicode.org/charts/PDF/U4DC0.pdf' },
]

/** No coercion: blank, exponent notation, Infinity and unsafe numbers are rejected. */
export function parseMeihuaNumber(value: string): number {
  if (typeof value !== 'string' || !/^[0-9]{1,6}$/.test(value) || Number(value) < 1) throw new Error('两数均须为 1 至 999999 的整数。')
  return Number(value)
}

function validateContext(value: Record<string, unknown>): QuestionContext {
  if (typeof value.question !== 'string' || !value.question.trim() || value.question.trim().length > 200) throw new Error('请填写 1 至 200 字的记录问题。')
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || value.date < '1900-01-01' || value.date > '2099-12-31') throw new Error('请选择 1900 至 2099 年之间的有效问事日期。')
  const date = new Date(`${value.date}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.date) throw new Error('问事日期不存在，请核对年月日。')
  if (typeof value.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) throw new Error('请选择有效的问事时间。')
  if (typeof value.utcOffset !== 'number' || !Number.isFinite(value.utcOffset) || value.utcOffset < -12 || value.utcOffset > 14 || !Number.isInteger(value.utcOffset * 4)) throw new Error('UTC 偏移须为 −12 至 +14 之间、以 15 分钟为单位的数值。')
  return { question: value.question.trim(), date: value.date, time: value.time, utcOffset: value.utcOffset }
}

export function validateDivinationInput(value: unknown): DivinationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('起卦资料格式不正确。')
  const raw = value as Record<string, unknown>
  const context = validateContext(raw)
  if (raw.method === 'liuyao-coins' || raw.method === 'liuyao-manual' || raw.method === 'liuyao-najia') {
    if (!Array.isArray(raw.lines) || raw.lines.length !== 6 || Array.from(raw.lines).some(line => ![6, 7, 8, 9].includes(line))) throw new Error('请自下而上填写六个爻值，每爻只能为 6、7、8 或 9。')
    if (raw.method === 'liuyao-najia' || raw.method === 'liuyao-coins') resolveCalendarTime(context, '六爻纳甲')
    if (raw.method === 'liuyao-coins') {
      if (!Array.isArray(raw.coins) || raw.coins.length !== 6 || Array.from(raw.coins).some(group => !Array.isArray(group) || group.length !== 3 || Array.from(group).some(coin => coin !== 2 && coin !== 3))) throw new Error('三钱模拟须保留六组钱面，每组恰好三个2（字）或3（背）。')
      const coins = raw.coins as CoinValue[][]
      if (coins.some((group, index) => group.reduce<number>((sum, coin) => sum + coin, 0) !== (raw.lines as unknown[])[index])) throw new Error('钱面记录与爻值不一致，无法恢复这次起卦。')
      return { ...context, method: raw.method, lines: [...raw.lines] as LineValue[], coins: coins.map(group => [...group]) }
    }
    return { ...context, method: raw.method, lines: [...raw.lines] as LineValue[] }
  }
  if (raw.method === 'meihua-two-numbers') {
    if (!Array.isArray(raw.numbers) || raw.numbers.length !== 2 || Array.from(raw.numbers).some(number => typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1 || number > 999999)) throw new Error('两数均须为 1 至 999999 的整数。')
    return { ...context, method: raw.method, numbers: [...raw.numbers] as [number, number] }
  }
  if (raw.method === 'meihua-calendar') {
    resolveCalendarTime(context)
    return { ...context, method: raw.method }
  }
  throw new Error('未知的起卦方式。')
}

export function validateDivinationRuleVersion(method: DivinationMethod, version: unknown): DivinationRuleVersion {
  const expected = method === 'liuyao-coins' ? LIUYAO_COINS_VERSION : method === 'meihua-calendar' ? MEIHUA_CALENDAR_VERSION : method === 'liuyao-najia' ? LIUYAO_NAJIA_VERSION : 'divination-v1'
  if (version !== expected) throw new Error('起卦方法与规则版本不匹配，无法复算这条记录；原始数据已保留。')
  return expected
}

export function elementRelation(body: Element, use: Element): ElementRelation {
  const generates: Record<Element, Element> = { 金: '水', 水: '木', 木: '火', 火: '土', 土: '金' }
  const controls: Record<Element, Element> = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' }
  if (!Object.prototype.hasOwnProperty.call(generates, body) || !Object.prototype.hasOwnProperty.call(generates, use)) throw new Error('未知五行。')
  if (body === use) return '体用比和'
  if (generates[body] === use) return '体生用'
  if (generates[use] === body) return '用生体'
  if (controls[body] === use) return '体克用'
  return '用克体'
}

export function calculateDivination(value: unknown, savedRuleVersion?: unknown): DivinationResult {
  const input = validateDivinationInput(value)
  const ruleVersion = input.method === 'liuyao-coins' ? LIUYAO_COINS_VERSION : input.method === 'meihua-calendar' ? MEIHUA_CALENDAR_VERSION : input.method === 'liuyao-najia' ? LIUYAO_NAJIA_VERSION : 'divination-v1'
  if (savedRuleVersion !== undefined) validateDivinationRuleVersion(input.method, savedRuleVersion)
  const questionInstant = new Date(Date.parse(`${input.date}T${input.time}:00Z`) - input.utcOffset * 3600000).toISOString()
  let lines: Line[]
  let movingLines: number[]
  let calendar: MeihuaCalendarFacts | undefined
  const calculation: string[] = []
  if (input.method === 'liuyao-coins' || input.method === 'liuyao-manual' || input.method === 'liuyao-najia') {
    lines = input.lines.map(line => line === 7 || line === 9 ? 1 : 0)
    movingLines = input.lines.flatMap((line, index) => line === 6 || line === 9 ? [index + 1] : [])
    if (input.method === 'liuyao-coins') {
      calculation.push('数字三钱模拟：每次三枚、共六次，字面计2、背面计3；保存后的钱面保持不变，回看不重新随机。', ...input.coins.map((group, index) => `第${index + 1}次（自下而上）：${group.map(coin => coin === 2 ? '字2' : '背3').join(' + ')} = ${input.lines[index]}。`))
    }
    calculation.push(`自下而上爻值：${input.lines.join('、')}`, '6 老阴变阳；7 少阳不变；8 少阴不变；9 老阳变阴。')
  } else if (input.method === 'meihua-two-numbers') {
    const [first, second] = input.numbers
    const upperNumber = first % 8 || 8, lowerNumber = second % 8 || 8
    movingLines = [(first + second) % 6 || 6]
    lines = [...TRIGRAMS[lowerNumber - 1].lines, ...TRIGRAMS[upperNumber - 1].lines]
    calculation.push(`上卦：${first} ÷ 8 余 ${first % 8} → ${TRIGRAMS[upperNumber - 1].name}（${upperNumber}）`, `下卦：${second} ÷ 8 余 ${second % 8} → ${TRIGRAMS[lowerNumber - 1].name}（${lowerNumber}）`, `动爻：(${first} + ${second}) ÷ 6 余 ${(first + second) % 6} → 第 ${movingLines[0]} 爻`)
  } else {
    calendar = calculateMeihuaCalendar(input)
    const { numbers, upperSum, total, upperNumber, lowerNumber, movingLine } = calendar
    movingLines = [movingLine]
    lines = [...TRIGRAMS[lowerNumber - 1].lines, ...TRIGRAMS[upperNumber - 1].lines]
    calculation.push(
      `UTC 瞬间：${questionInstant}；演算时间：${calendar.beijingTime}。`,
      `演算农历：${calendar.lunar.label}，${calendar.timeBranch}时。`,
      `取数：${calendar.lunar.yearBranch}年 ${numbers.year}、${calendar.lunar.isLeapMonth ? '闰' : ''}${numbers.month}月 ${numbers.month}、${numbers.day}日 ${numbers.day}、${calendar.timeBranch}时 ${numbers.time}。`,
      `年月日合数：${numbers.year} + ${numbers.month} + ${numbers.day} = ${upperSum}；加时总数：${upperSum} + ${numbers.time} = ${total}。`,
      `上卦：${upperSum} ÷ 8 余 ${upperSum % 8} → ${TRIGRAMS[upperNumber - 1].name}（${upperNumber}）`,
      `下卦：${total} ÷ 8 余 ${total % 8} → ${TRIGRAMS[lowerNumber - 1].name}（${lowerNumber}）`,
      `动爻：${total} ÷ 6 余 ${total % 6} → 第 ${movingLine} 爻`,
    )
  }
  const original = hexagramFromLines(lines)
  const changed = hexagramFromLines(lines.map((line, index) => movingLines.includes(index + 1) ? (line === 0 ? 1 : 0) : line))
  const result: DivinationResult = { ruleVersion, input, questionInstant, original, changed, movingLines, calculation, ...(calendar ? { calendar } : {}) }
  if (input.method === 'liuyao-coins' || input.method === 'liuyao-najia') {
    const najia = calculateNajia(input, original, changed, movingLines)
    result.najia = najia
    calculation.push(
      `UTC 瞬间：${questionInstant}；演算时间：${najia.calendar.beijingTime}。`,
      `本卦属${najia.palace.name}宫${najia.palace.element}，${najia.palace.stage}卦；世在第 ${najia.palace.shiPosition} 爻，应在第 ${najia.palace.yingPosition} 爻。`,
      `月建${najia.calendar.monthBranch}${najia.calendar.monthElement}，以${najia.calendar.monthStart.name}（${najia.calendar.monthStart.beijingTime}）起算；日辰${najia.calendar.dayGanzhi}。`,
      `${najia.xun}旬，旬空${najia.voidBranches.join('、')}；六神从初爻${najia.lines[0].spirit}起，逐爻向上循环。`,
      `各爻按内外经卦纳甲，地支取五行；六亲以本卦宫${najia.palace.element}为基准，动爻变出沿用此基准。`,
      najia.missingKin.length ? `本卦缺${najia.missingKin.join('、')}；从本宫纯卦列出同位伏神候选，未自动选用神。` : '本卦五类六亲俱全，按本版本缺亲规则不列伏神候选。',
    )
  }
  if (input.method === 'meihua-two-numbers' || input.method === 'meihua-calendar') {
    result.mutual = hexagramFromLines([lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]])
    const lowerMoves = movingLines[0] <= 3
    const body = lowerMoves ? original.upper : original.lower, use = lowerMoves ? original.lower : original.upper
    result.bodyUse = { body, use, bodyPosition: lowerMoves ? '上卦' : '下卦', usePosition: lowerMoves ? '下卦' : '上卦', relation: elementRelation(body.element, use.element) }
    calculation.push('本卦第 2、3、4 爻为下互，第 3、4、5 爻为上互。乾坤也按此结构取互卦。', '动爻所在经卦为用，另一经卦为体；体用关系按本卦五行计算。')
  }
  return result
}
