import { Solar } from 'lunar-typescript'
import { resolveCalendarTime } from './calendar'
import { hexagramFromLines, TRIGRAMS, type Element, type Hexagram, type Line } from './hexagrams'
import type { QuestionContext } from './index'

export const LIUYAO_NAJIA_VERSION = 'liuyao-najia-v1' as const
export const LIUYAO_NAJIA_SOURCES = [
  { title: '《增删卜易》· 八宫全图与世应六亲', url: 'https://zh.wikisource.org/wiki/增刪卜易/3/八卦各宮全圖' },
  { title: '《增删卜易》· 浑天甲子章', url: 'https://zh.wikisource.org/wiki/增刪卜易/4' },
  { title: '《增删卜易》· 六神章', url: 'https://zh.wikisource.org/zh-hant/增刪卜易/18' },
  { title: '《增删卜易》· 旬空章', url: 'https://zh.wikisource.org/zh-hant/增刪卜易/26' },
  { title: '《增删卜易》· 飞伏神章（识典古籍原文）', url: 'https://www.shidianguji.com/book/XYXZSBY/chapter/1lzxsny7d9s7d' },
  { title: 'lunar 作者文档 · 交节月柱与午夜日柱', url: 'https://6tail.cn/calendar/lunar.ganzhi.html' },
  { title: '国立天文台 · 2026 节气时刻独立核验表（日本标准时）', url: 'https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou262.html' },
]
export const LIUYAO_NAJIA_CONVENTIONS = [
  '原问事时间按填写的 UTC 偏移换成瞬间，再按固定 UTC+08:00 装卦；不校正真太阳时。',
  '月建按十二“节”的准确交接时刻切换；日辰以演算时间 00:00 换日，23:00 不提前换日。',
  '六神与旬空均从同一日干支导出；旬空只标地支关系，不代表事情必然无效或不利。',
  '六亲以本卦所属宫五行为基准，动爻变出仍沿用本卦宫；静爻不显示为动爻变出。',
  '本卦缺少某六亲时，列出本宫纯卦同位的全部伏神候选；尚未选择用神，也不判断出伏、旺衰或应期。',
  '固定 UTC+8、午夜日界及缺亲候选展示是本版本的明确约定，不代表所有流派采用同一规则。',
]

const STEMS = [...'甲乙丙丁戊己庚辛壬癸']
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥']
const BRANCH_ELEMENTS: Element[] = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']
const GENERATES: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const CONTROLS: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
const KINDS = ['父母', '兄弟', '子孙', '妻财', '官鬼'] as const
export type SixKin = typeof KINDS[number]
export type SixSpirit = '青龙' | '朱雀' | '勾陈' | '腾蛇' | '白虎' | '玄武'
const SPIRITS: SixSpirit[] = ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武']
const SPIRIT_STARTS = [0, 0, 1, 1, 2, 3, 4, 4, 5, 5]
// Traditional tables, always bottom to top; indexed by the existing trigram order.
const NAJIA_TABLE = [
  ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌'],
  ['丁巳', '丁卯', '丁丑', '丁亥', '丁酉', '丁未'],
  ['己卯', '己丑', '己亥', '己酉', '己未', '己巳'],
  ['庚子', '庚寅', '庚辰', '庚午', '庚申', '庚戌'],
  ['辛丑', '辛亥', '辛酉', '辛未', '辛巳', '辛卯'],
  ['戊寅', '戊辰', '戊午', '戊申', '戊戌', '戊子'],
  ['丙辰', '丙午', '丙申', '丙戌', '丙子', '丙寅'],
  ['乙未', '乙巳', '乙卯', '癸丑', '癸亥', '癸酉'],
]
const PALACE_MASKS = [0, 1, 3, 7, 15, 31, 23, 16]
const STAGES = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']
const SHI_POSITIONS = [6, 1, 2, 3, 4, 5, 4, 3]
const RULES = {
  timeBasis: 'fixed-utc8', monthBoundary: 'exact-jie', dayBoundary: 'midnight',
  kinBasis: 'original-palace-element', changedKinBasis: 'original-palace-element',
  hiddenPolicy: 'all-missing-kin-from-pure-palace', changedPolicy: 'moving-lines-only',
} as const

export interface NajiaPalace { name: string; element: Element; stage: string; shiPosition: number; yingPosition: number }
export interface NajiaLineIdentity { stem: string; branch: string; ganzhi: string; element: Element; kin: SixKin; isVoid: boolean }
export interface NajiaLine extends NajiaLineIdentity {
  position: number; value: Line; isMoving: boolean; role?: '世' | '应'; spirit: SixSpirit
  changed?: NajiaLineIdentity & { value: Line }
  hidden?: NajiaLineIdentity
}
export interface NajiaStructure {
  palace: NajiaPalace; lines: NajiaLine[]; missingKin: SixKin[]
  xun: string; voidBranches: string[]
}
export interface NajiaCalendar {
  engine: { name: 'lunar-typescript'; version: '1.8.6' }; beijingTime: string
  monthBranch: string; monthElement: Element; dayGanzhi: string; dayStem: string; dayBranch: string
  monthStart: { name: string; beijingTime: string }; nextMonthStart: { name: string; beijingTime: string }
}
export interface NajiaFacts extends NajiaStructure {
  calendar: NajiaCalendar; rules: typeof RULES; conventions: string[]; sources: { title: string; url: string }[]
}

function branchElement(branch: string): Element {
  const index = BRANCHES.indexOf(branch)
  if (index < 0) throw new Error('未知地支。')
  return BRANCH_ELEMENTS[index]
}

export function sixKin(palace: Element, line: Element): SixKin {
  if (!Object.prototype.hasOwnProperty.call(GENERATES, palace) || !Object.prototype.hasOwnProperty.call(GENERATES, line)) throw new Error('未知五行。')
  if (palace === line) return '兄弟'
  if (GENERATES[line] === palace) return '父母'
  if (GENERATES[palace] === line) return '子孙'
  return CONTROLS[palace] === line ? '妻财' : '官鬼'
}

export function sixSpirits(dayStem: string): SixSpirit[] {
  const index = STEMS.indexOf(dayStem)
  if (index < 0) throw new Error('未知日干。')
  return Array.from({ length: 6 }, (_, line) => SPIRITS[(SPIRIT_STARTS[index] + line) % 6])
}

export function dayXun(dayGanzhi: string): { xun: string; voidBranches: string[] } {
  const index = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]).indexOf(dayGanzhi)
  if (index < 0) throw new Error('日干支须为六十甲子中的有效组合。')
  const start = Math.floor(index / 10) * 10
  return { xun: `甲${BRANCHES[start % 12]}`, voidBranches: [BRANCHES[(start + 10) % 12], BRANCHES[(start + 11) % 12]] }
}

function bits(lines: readonly Line[]) { return lines.reduce<number>((mask, line, position) => mask | (line << position), 0) }

export function najiaPalace(hexagram: Hexagram): NajiaPalace {
  const code = bits(hexagram.lines)
  for (const trigram of TRIGRAMS) {
    const stage = PALACE_MASKS.indexOf(code ^ bits([...trigram.lines, ...trigram.lines]))
    if (stage >= 0) {
      const shiPosition = SHI_POSITIONS[stage]
      return { name: trigram.name, element: trigram.element, stage: STAGES[stage], shiPosition, yingPosition: (shiPosition + 2) % 6 + 1 }
    }
  }
  throw new Error('未找到卦宫。')
}

function identity(hexagram: Hexagram, position: number, palaceElement: Element, voidBranches: string[]): NajiaLineIdentity {
  const trigram = position < 3 ? hexagram.lower : hexagram.upper
  const ganzhi = NAJIA_TABLE[trigram.number - 1][position]
  const stem = ganzhi[0], branch = ganzhi[1], element = branchElement(branch)
  return { stem, branch, ganzhi, element, kin: sixKin(palaceElement, element), isVoid: voidBranches.includes(branch) }
}

/** Pure structural layer, separate from calendar conversion for exhaustive validation. */
export function buildNajiaStructure(original: Hexagram, changed: Hexagram, movingLines: number[], dayGanzhi: string): NajiaStructure {
  const palace = najiaPalace(original), { xun, voidBranches } = dayXun(dayGanzhi)
  const spirits = sixSpirits(dayGanzhi[0])
  const lines: NajiaLine[] = original.lines.map((value, index) => {
    const position = index + 1, isMoving = movingLines.includes(position)
    const role = position === palace.shiPosition ? '世' : position === palace.yingPosition ? '应' : undefined
    return {
      ...identity(original, index, palace.element, voidBranches), position, value, isMoving, spirit: spirits[index],
      ...(role ? { role } : {}),
      ...(isMoving ? { changed: { ...identity(changed, index, palace.element, voidBranches), value: changed.lines[index] } } : {}),
    }
  })
  const missingKin = KINDS.filter(kin => !lines.some(line => line.kin === kin))
  const trigram = TRIGRAMS.find(item => item.name === palace.name)!
  const pure = hexagramFromLines([...trigram.lines, ...trigram.lines])
  for (const [index, line] of lines.entries()) {
    const hidden = identity(pure, index, palace.element, voidBranches)
    if (missingKin.includes(hidden.kin)) line.hidden = hidden
  }
  return { palace, lines, missingKin, xun, voidBranches }
}

export function calculateNajia(context: QuestionContext, original: Hexagram, changed: Hexagram, movingLines: number[]): NajiaFacts {
  const { beijing } = resolveCalendarTime(context, '六爻纳甲')
  const lunar = Solar.fromYmdHms(beijing.getUTCFullYear(), beijing.getUTCMonth() + 1, beijing.getUTCDate(), beijing.getUTCHours(), beijing.getUTCMinutes(), 0).getLunar()
  const dayGanzhi = lunar.getDayInGanZhiExact2(), monthBranch = lunar.getMonthZhiExact()
  const previous = lunar.getPrevJie(false), next = lunar.getNextJie(false)
  return {
    ...buildNajiaStructure(original, changed, movingLines, dayGanzhi),
    calendar: {
      engine: { name: 'lunar-typescript', version: '1.8.6' }, beijingTime: `${beijing.toISOString().slice(0, 16).replace('T', ' ')} UTC+08:00`,
      monthBranch, monthElement: branchElement(monthBranch), dayGanzhi, dayStem: dayGanzhi[0], dayBranch: dayGanzhi[1],
      monthStart: { name: previous.getName(), beijingTime: `${previous.getSolar().toYmdHms()} UTC+08:00` },
      nextMonthStart: { name: next.getName(), beijingTime: `${next.getSolar().toYmdHms()} UTC+08:00` },
    },
    rules: { ...RULES }, conventions: [...LIUYAO_NAJIA_CONVENTIONS], sources: LIUYAO_NAJIA_SOURCES.map(source => ({ ...source })),
  }
}
