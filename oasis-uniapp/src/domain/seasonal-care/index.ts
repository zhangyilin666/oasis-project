import { calculateAlmanac, type AlmanacSolarTerm } from '../almanac'
import { culturalSeasonForTerm, selectSeasonalCareCards, SEASONAL_CARE_CONTENT_VERSION, SEASONAL_CARE_THEMES, CULTURAL_SEASON_LABELS, type CulturalSeason, type SeasonalCareTheme, type SeasonalCareCard } from './cards'
export * from './cards'
export const SEASONAL_CARE_RULE_VERSION = 'seasonal-care-v1'
export const SEASONAL_CARE_CONVENTIONS = Object.freeze([
  '按所选公历日期的 12:00、固定 UTC+08:00 查询，范围 1900–2099 年；不跟随设备时区或历史夏令时。交节日以中午所处的节气区间归类。',
  '四时目录以立春、立夏、立秋、立冬为分界，每季六个节气。这是文化阅读的组织方式，不表示用户所在地的气象季节。',
  '节气名称部分反映古代中原地区的气候与农事。南北半球及不同地区的天气、物候可能不同，请记录当地实际观察。',
  '文化导读是对古代文本的原创短评；历史养生观与现代公共健康资料分区展示，古文中的病因和疗效说法不转为本页建议。',
  '公共健康卡为所列机构资料的短摘要，全年适用的主题不会因节气改变成处方；本页不生成诊断、治疗、食疗配方或命盘健康推断。',
  '习惯、状态和笔记由你手动记录，不打健康分、不判断是否达标。已有医嘱优先；持续健康困扰应向合资格专业人员咨询。',
  '资料更新日期与本版复核日期分别保留；记录保存完整卡片与来源快照，回看不会静默替换为新内容。',
])
export interface SeasonalCareQuery { date: string; theme: SeasonalCareTheme }
export interface SeasonalCareCalendar {
  ruleVersion: 'almanac-v1'
  engine: 'lunar-typescript'
  engineVersion: '1.8.6'
  timeZone: 'UTC+08:00'
  sampleTime: '12:00'
  utcTime: string
  lunarLabel: string
  currentTerm: string
  previous: AlmanacSolarTerm
  next: AlmanacSolarTerm
  precisionNote: string
  season: CulturalSeason
  seasonLabel: string
  source: { title: string; url: string; checkedAt: '2026-10-03' }
}
export interface SeasonalCareReading {
  schemaVersion: 1
  ruleVersion: typeof SEASONAL_CARE_RULE_VERSION
  contentVersion: typeof SEASONAL_CARE_CONTENT_VERSION
  query: SeasonalCareQuery
  calendar: SeasonalCareCalendar
  cultureCards: SeasonalCareCard[]
  healthCards: SeasonalCareCard[]
  conventions: string[]
}
export type SeasonalCareHabitStatus = 'observed' | 'planned' | 'done'
export interface SeasonalCareNote { habit: string; status: SeasonalCareHabitStatus; observation: string; note: string }
export interface SeasonalCareSnapshot { schemaVersion: 1; ruleVersion: typeof SEASONAL_CARE_RULE_VERSION; reading: SeasonalCareReading; personal: SeasonalCareNote }
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
function dateMs(date: unknown): number {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01' || date > '2099-12-31') throw new Error('请输入 1900-01-01 至 2099-12-31 之间的日期。')
  const [year, month, day] = date.split('-').map(Number), instant = Date.UTC(year, month - 1, day)
  if (new Date(instant).toISOString().slice(0, 10) !== date) throw new Error('这个日期不存在，请检查年月日。')
  return instant
}
function normalizeQuery(query: SeasonalCareQuery): SeasonalCareQuery {
  if (!object(query)) throw new Error('请先选择日期与主题。')
  dateMs(query.date)
  if (!SEASONAL_CARE_THEMES.some(theme => theme.id === query.theme)) throw new Error('请选择本版支持的主题。')
  return { date: query.date, theme: query.theme }
}
function same(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => same(value, right[index]))
  if (object(left) && object(right)) { const keys = Object.keys(left); return keys.length === Object.keys(right).length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && same(left[key], right[key])) }
  return false
}
function makeReading(query: SeasonalCareQuery, calendar: SeasonalCareCalendar): SeasonalCareReading {
  const cards = selectSeasonalCareCards(calendar.season, query.theme)
  return { schemaVersion: 1, ruleVersion: SEASONAL_CARE_RULE_VERSION, contentVersion: SEASONAL_CARE_CONTENT_VERSION, query, calendar, cultureCards: cards.filter(card => card.layer === 'culture'), healthCards: cards.filter(card => card.layer === 'public-health'), conventions: [...SEASONAL_CARE_CONVENTIONS] }
}
export function getSeasonalCareReading(raw: SeasonalCareQuery): SeasonalCareReading {
  const query = normalizeQuery(raw), almanac = calculateAlmanac({ date: query.date, time: '12:00' }), season = culturalSeasonForTerm(almanac.solarTerms.current)
  return makeReading(query, { ruleVersion: 'almanac-v1', engine: 'lunar-typescript', engineVersion: '1.8.6', timeZone: 'UTC+08:00', sampleTime: '12:00', utcTime: almanac.observation.utcTime, lunarLabel: almanac.lunar.label, currentTerm: almanac.solarTerms.current, previous: { ...almanac.solarTerms.previous }, next: { ...almanac.solarTerms.next }, precisionNote: almanac.solarTerms.precisionNote, season, seasonLabel: CULTURAL_SEASON_LABELS[season], source: { title: '香港天文台 · 二十四节气定义与季候背景', url: 'https://www.hko.gov.hk/sc/gts/time/24solarterms.htm', checkedAt: '2026-10-03' } })
}
const termOrder = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒']
function validTerm(term: unknown): term is AlmanacSolarTerm {
  if (!object(term) || !termOrder.includes(term.name) || (term.kind !== '节' && term.kind !== '中气') || typeof term.utcTime !== 'string' || typeof term.beijingTime !== 'string') return false
  const instant = Date.parse(term.utcTime)
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== term.utcTime || term.beijingTime !== new Date(instant + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') || term.kind !== (termOrder.indexOf(term.name) % 2 === 0 ? '节' : '中气')) return false
  return Object.keys(term).length === 4
}
/** Validate frozen content and chronology, without recalculating the saved astronomy. */
export function isSeasonalCareReading(value: unknown): value is SeasonalCareReading {
  try {
    if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== SEASONAL_CARE_RULE_VERSION || value.contentVersion !== SEASONAL_CARE_CONTENT_VERSION || !object(value.calendar)) return false
    const query = normalizeQuery(value.query), calendar = value.calendar
    if (!same(query, value.query) || !validTerm(calendar.previous) || !validTerm(calendar.next)) return false
    const observation = dateMs(query.date) + 4 * 3600000, previous = Date.parse(calendar.previous.utcTime), next = Date.parse(calendar.next.utcTime)
    if (previous > observation || next <= observation || next - previous < 13 * 86400000 || next - previous > 17 * 86400000 || termOrder[(termOrder.indexOf(calendar.previous.name) + 1) % 24] !== calendar.next.name || calendar.currentTerm !== calendar.previous.name) return false
    if (typeof calendar.lunarLabel !== 'string' || !calendar.lunarLabel || calendar.lunarLabel.length > 60 || calendar.lunarLabel.trim() !== calendar.lunarLabel || typeof calendar.precisionNote !== 'string') return false
    const season = culturalSeasonForTerm(calendar.currentTerm)
    const expectedCalendar: SeasonalCareCalendar = { ruleVersion: 'almanac-v1', engine: 'lunar-typescript', engineVersion: '1.8.6', timeZone: 'UTC+08:00', sampleTime: '12:00', utcTime: new Date(observation).toISOString(), lunarLabel: calendar.lunarLabel, currentTerm: calendar.currentTerm, previous: calendar.previous, next: calendar.next, precisionNote: '交节时间为历法库计算值；显示秒位便于复核，独立参考核对到分钟，不代表秒级准确。', season, seasonLabel: CULTURAL_SEASON_LABELS[season], source: { title: '香港天文台 · 二十四节气定义与季候背景', url: 'https://www.hko.gov.hk/sc/gts/time/24solarterms.htm', checkedAt: '2026-10-03' } }
    return same(value, makeReading(query, expectedCalendar))
  } catch { return false }
}
function field(value: unknown, limit: number, label: string, required = false): string {
  if (typeof value !== 'string') throw new Error(`请填写${label}。`)
  const trimmed = value.trim()
  if ((required && !trimmed) || trimmed.length > limit) throw new Error(`${label}${required ? '不能为空，且' : ''}最多 ${limit} 字。`)
  return trimmed
}
export function normalizeSeasonalCareNote(value: SeasonalCareNote): SeasonalCareNote {
  if (!object(value) || !['observed', 'planned', 'done'].includes(value.status)) throw new Error('请选择这次记录的状态。')
  return { habit: field(value.habit, 100, '记录主题', true), status: value.status, observation: field(value.observation, 1000, '当地观察'), note: field(value.note, 2000, '个人笔记') }
}
export function createSeasonalCareSnapshot(reading: SeasonalCareReading, personal: SeasonalCareNote): SeasonalCareSnapshot {
  if (!isSeasonalCareReading(reading)) throw new Error('阅读资料格式异常或版本不支持，请重新查询。')
  return { schemaVersion: 1, ruleVersion: SEASONAL_CARE_RULE_VERSION, reading: JSON.parse(JSON.stringify(reading)), personal: normalizeSeasonalCareNote(personal) }
}
export function isSeasonalCareSnapshot(value: unknown): value is SeasonalCareSnapshot {
  try { return object(value) && value.schemaVersion === 1 && value.ruleVersion === SEASONAL_CARE_RULE_VERSION && isSeasonalCareReading(value.reading) && same(value, createSeasonalCareSnapshot(value.reading, value.personal)) } catch { return false }
}
export function validateSeasonalCareSnapshot(value: unknown): SeasonalCareSnapshot {
  if (!isSeasonalCareSnapshot(value)) throw new Error('节气生活快照格式异常或版本不支持。')
  return JSON.parse(JSON.stringify(value)) as SeasonalCareSnapshot
}
