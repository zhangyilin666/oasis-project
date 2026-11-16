import { calculateAlmanac, ALMANAC_MIN_DATE, ALMANAC_MAX_DATE } from '../almanac'

export const DATE_SELECTION_RULE_VERSION = 'date-selection-v1'
export const DATE_SELECTION_TABLE_VERSION = 'lunar-typescript-1.8.6-sect1'
export const DATE_SELECTION_MAX_DAYS = 31
export const DATE_SELECTION_ACTIVITIES = Object.freeze(['嫁娶', '出行', '入宅', '开市'] as const)
export const DATE_SELECTION_WEEKDAYS = Object.freeze(['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'])
export type DateSelectionActivity = typeof DATE_SELECTION_ACTIVITIES[number]
export type DateSelectionMode = 'practical-only' | 'require-yi'
export type RuleStatus = 'pass' | 'conflict' | 'not-covered'
export interface DateSelectionInput {
  title: string
  startDate: string
  endDate: string
  activity: DateSelectionActivity
  mode: DateSelectionMode
  availableWeekdays: number[]
  excludedDates: string[]
  venueNotes: string
}
export interface DateSelectionFacts {
  date: string
  weekday: number
  lunarLabel: string
  dayGanZhi: string
  tableMonthGanZhi: string
  yi: string[]
  ji: string[]
}
export interface DateSelectionRule {
  id: 'weekday' | 'excluded-date' | 'traditional-activity' | 'venue-notes'
  title: string
  status: RuleStatus
  applied: boolean
  reason: string
  source: 'user-input' | typeof DATE_SELECTION_TABLE_VERSION
}
export interface DateSelectionDay {
  facts: DateSelectionFacts
  rules: DateSelectionRule[]
  outcome: 'candidate' | 'conflict' | 'not-covered'
}
export const DATE_SELECTION_SOURCES = Object.freeze([
  Object.freeze({ title: 'lunar 作者 · 宜忌资料来源与 sect 口径', url: 'https://6tail.cn/calendar/lunar.yiji.html' }),
  Object.freeze({ title: 'lunar-typescript · 上游实现与 MIT 许可', url: 'https://github.com/6tail/lunar-typescript' }),
  Object.freeze({ title: '香港天文台 · 公历与农历日期对照表', url: 'https://www.hko.gov.hk/sc/gts/time/conversion.htm' }),
])
export const DATE_SELECTION_CONVENTIONS = Object.freeze([
  '候选窗口包含首尾，最多 31 天，支持 1900-01-01 至 2099-12-31。日期按固定 UTC+08:00 解释，不跟随设备时区或历史夏令时。',
  '现实条件只核对可用星期和明确排除的日期。场地、人员及其他安排作为待人工确认的备注，不会被自动判为已满足。',
  '传统资料采用 lunar-typescript 1.8.6 的 getDayYi(1) / getDayJi(1)：交节所在日 00:00 起换用新月干支，而非交节时刻换月。日界为 00:00。',
  '上游作者说明宜忌表由 2345 网站十余年资料归纳而来，可能与其他历书不同；目前没有逐项古籍底本的完整证明。',
  '仅按事项名称精确匹配宜、忌条目；忌优先，宜忌同时出现仍为冲突。未列出、无、余事勿取等概括条目不会被自动解释为某事项通过。',
  '仅按现实条件模式保留传统资料供查看；同时核对宜忌模式要求事项列于宜且不列于忌。未涵盖不会自动成为候选。',
  '候选仅表示所启用的筛选条件通过；不包含个人八字、方位冲煞、时辰、场地核验或事项成功保证。所有日期和筛选理由均保留。',
])
export interface DateSelectionSnapshot {
  schemaVersion: 1
  ruleVersion: typeof DATE_SELECTION_RULE_VERSION
  tableVersion: typeof DATE_SELECTION_TABLE_VERSION
  calendar: { ruleVersion: 'almanac-v1'; engine: 'lunar-typescript'; engineVersion: '1.8.6'; timeZone: 'UTC+08:00'; sampleTime: '12:00'; sect: 1 }
  input: DateSelectionInput
  days: DateSelectionDay[]
  summary: { total: number; candidates: number; conflicts: number; notCovered: number }
  conventions: string[]
  sources: { title: string; url: string }[]
}
const DAY_MS = 86400000
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
function dateMs(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < ALMANAC_MIN_DATE || value > ALMANAC_MAX_DATE) throw new Error('日期须在 1900-01-01 至 2099-12-31 之间。')
  const [year, month, day] = value.split('-').map(Number)
  const instant = Date.UTC(year, month - 1, day)
  if (new Date(instant).toISOString().slice(0, 10) !== value) throw new Error('日期不存在，请检查年月日。')
  return instant
}
function textField(value: unknown, max: number, label: string, required = false): string {
  if (typeof value !== 'string') throw new Error(`请填写${label}。`)
  const result = value.trim()
  if ((required && !result) || result.length > max) throw new Error(`${label}${required ? '不能为空，且' : ''}最多 ${max} 字。`)
  return result
}
export function normalizeDateSelectionInput(input: DateSelectionInput): DateSelectionInput {
  if (!object(input)) throw new Error('请先填写日期筛选条件。')
  const start = dateMs(input.startDate), end = dateMs(input.endDate)
  if (end < start || (end - start) / DAY_MS >= DATE_SELECTION_MAX_DAYS) throw new Error('起止日期须按先后排列，包含首尾最多 31 天。')
  if (!DATE_SELECTION_ACTIVITIES.includes(input.activity)) throw new Error('请选择支持的事项：嫁娶、出行、入宅或开市。')
  if (input.mode !== 'practical-only' && input.mode !== 'require-yi') throw new Error('请选择有效的筛选方式。')
  if (!Array.isArray(input.availableWeekdays) || !input.availableWeekdays.length || input.availableWeekdays.length > 7 || input.availableWeekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(input.availableWeekdays).size !== input.availableWeekdays.length) throw new Error('请至少选择一个可用星期，且不能重复。')
  if (!Array.isArray(input.excludedDates) || input.excludedDates.length > DATE_SELECTION_MAX_DAYS || new Set(input.excludedDates).size !== input.excludedDates.length) throw new Error('排除日期不能重复，最多 31 天。')
  for (const date of input.excludedDates) { const instant = dateMs(date); if (instant < start || instant > end) throw new Error('排除日期须在本次候选窗口内。') }
  return { title: textField(input.title, 100, '计划名称', true), startDate: input.startDate, endDate: input.endDate, activity: input.activity, mode: input.mode, availableWeekdays: [...input.availableWeekdays].sort((a, b) => a - b), excludedDates: [...input.excludedDates].sort(), venueNotes: textField(input.venueNotes, 1000, '安排备注') }
}
export function dateSelectionDates(startDate: string, endDate: string): string[] {
  const start = dateMs(startDate), end = dateMs(endDate)
  if (end < start || (end - start) / DAY_MS >= DATE_SELECTION_MAX_DAYS) throw new Error('候选窗口包含首尾最多 31 天。')
  return Array.from({ length: (end - start) / DAY_MS + 1 }, (_, index) => new Date(start + index * DAY_MS).toISOString().slice(0, 10))
}
/** Exact membership only: neither the activity nor general-purpose phrases are guessed. */
export function evaluateTraditionalActivity(activity: DateSelectionActivity, yi: readonly string[], ji: readonly string[]): { status: RuleStatus; reason: string } {
  if (!DATE_SELECTION_ACTIVITIES.includes(activity)) throw new Error('事项不在本版支持范围。')
  const inYi = yi.includes(activity), inJi = ji.includes(activity)
  if (inJi) return { status: 'conflict', reason: inYi ? `“${activity}”同时列于宜和忌，保留两项依据并按冲突处理。` : `“${activity}”列于忌，存在传统资料冲突。` }
  if (inYi) return { status: 'pass', reason: `“${activity}”列于宜，且未列于忌。` }
  return { status: 'not-covered', reason: `宜、忌均未明确列出“${activity}”，本条无法判断。` }
}
function dayFromFacts(input: DateSelectionInput, facts: DateSelectionFacts): DateSelectionDay {
  const weekdayPass = input.availableWeekdays.includes(facts.weekday), excluded = input.excludedDates.includes(facts.date)
  const traditional = evaluateTraditionalActivity(input.activity, facts.yi, facts.ji)
  const rules: DateSelectionRule[] = [
    { id: 'weekday', title: '可用星期', status: weekdayPass ? 'pass' : 'conflict', applied: true, reason: `${DATE_SELECTION_WEEKDAYS[facts.weekday]}${weekdayPass ? '在' : '不在'}你选定的可用星期内。`, source: 'user-input' },
    { id: 'excluded-date', title: '排除日期', status: excluded ? 'conflict' : 'pass', applied: true, reason: excluded ? '你已明确排除这一天。' : '这一天未被你明确排除。', source: 'user-input' },
    { id: 'traditional-activity', title: `传统资料 · ${input.activity}`, ...traditional, applied: input.mode === 'require-yi', source: DATE_SELECTION_TABLE_VERSION },
    { id: 'venue-notes', title: '场地与人员安排', status: 'not-covered', applied: false, reason: input.venueNotes ? '已保留安排备注，内容仍需你逐日人工确认。' : '尚未填写安排备注，场地与人员可用情况未核验。', source: 'user-input' },
  ]
  const active = rules.filter(rule => rule.applied)
  return { facts: { ...facts, yi: [...facts.yi], ji: [...facts.ji] }, rules, outcome: active.some(rule => rule.status === 'conflict') ? 'conflict' : active.some(rule => rule.status === 'not-covered') ? 'not-covered' : 'candidate' }
}
function snapshotFromFacts(input: DateSelectionInput, facts: DateSelectionFacts[]): DateSelectionSnapshot {
  const days = facts.map(fact => dayFromFacts(input, fact))
  return { schemaVersion: 1, ruleVersion: DATE_SELECTION_RULE_VERSION, tableVersion: DATE_SELECTION_TABLE_VERSION, calendar: { ruleVersion: 'almanac-v1', engine: 'lunar-typescript', engineVersion: '1.8.6', timeZone: 'UTC+08:00', sampleTime: '12:00', sect: 1 }, input, days,
    summary: { total: days.length, candidates: days.filter(day => day.outcome === 'candidate').length, conflicts: days.filter(day => day.outcome === 'conflict').length, notCovered: days.filter(day => day.outcome === 'not-covered').length },
    conventions: [...DATE_SELECTION_CONVENTIONS], sources: DATE_SELECTION_SOURCES.map(source => ({ ...source })) }
}
export function calculateDateSelection(raw: DateSelectionInput): DateSelectionSnapshot {
  const input = normalizeDateSelectionInput(raw)
  const facts = dateSelectionDates(input.startDate, input.endDate).map(date => {
    const almanac = calculateAlmanac({ date, time: '12:00' })
    return { date, weekday: new Date(dateMs(date)).getUTCDay(), lunarLabel: almanac.lunar.label, dayGanZhi: almanac.ganzhi.day, tableMonthGanZhi: almanac.traditional.monthGanZhi, yi: [...almanac.traditional.yi], ji: [...almanac.traditional.ji] }
  })
  return snapshotFromFacts(input, facts)
}
function validTerms(value: unknown): value is string[] { return Array.isArray(value) && value.length >= 1 && value.length <= 150 && value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 30 && item.trim() === item) && new Set(value).size === value.length }
function validGanZhi(value: unknown): boolean {
  if (typeof value !== 'string' || value.length !== 2) return false
  const stem = '甲乙丙丁戊己庚辛壬癸'.indexOf(value[0]), branch = '子丑寅卯辰巳午未申酉戌亥'.indexOf(value[1])
  return stem >= 0 && branch >= 0 && stem % 2 === branch % 2
}
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameValue(value, right[index]))
  if (object(left) && object(right)) { const keys = Object.keys(left); return keys.length === Object.keys(right).length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key])) }
  return false
}
/** Validate saved facts and v1 rule logs; never silently recalculate historical calendar data. */
export function isDateSelectionSnapshot(value: unknown): value is DateSelectionSnapshot {
  try {
    if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== DATE_SELECTION_RULE_VERSION || value.tableVersion !== DATE_SELECTION_TABLE_VERSION) return false
    const input = normalizeDateSelectionInput(value.input)
    if (!sameValue(input, value.input)) return false
    const dates = dateSelectionDates(input.startDate, input.endDate)
    if (!Array.isArray(value.days) || value.days.length !== dates.length) return false
    const facts = value.days.map((day: unknown, index: number) => {
      if (!object(day) || !object(day.facts)) throw new Error('facts')
      const fact = day.facts
      if (fact.date !== dates[index] || fact.weekday !== new Date(dateMs(dates[index])).getUTCDay() || typeof fact.lunarLabel !== 'string' || !fact.lunarLabel || fact.lunarLabel.length > 60 || fact.lunarLabel.trim() !== fact.lunarLabel || !validGanZhi(fact.dayGanZhi) || !validGanZhi(fact.tableMonthGanZhi) || !validTerms(fact.yi) || !validTerms(fact.ji)) throw new Error('facts')
      return { date: fact.date, weekday: fact.weekday, lunarLabel: fact.lunarLabel, dayGanZhi: fact.dayGanZhi, tableMonthGanZhi: fact.tableMonthGanZhi, yi: [...fact.yi], ji: [...fact.ji] } as DateSelectionFacts
    })
    return sameValue(value, snapshotFromFacts(input, facts))
  } catch { return false }
}
export function validateDateSelectionSnapshot(value: unknown): DateSelectionSnapshot {
  if (!isDateSelectionSnapshot(value)) throw new Error('日期筛选快照格式异常或版本不支持。')
  return JSON.parse(JSON.stringify(value)) as DateSelectionSnapshot
}
