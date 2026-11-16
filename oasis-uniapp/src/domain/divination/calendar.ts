import { Solar } from 'lunar-typescript'
import type { QuestionContext } from './index'

export const MEIHUA_CALENDAR_VERSION = 'meihua-calendar-v1' as const
export const MEIHUA_CALENDAR_SOURCES = [
  { title: '《梅花易数》卷一 · 年月日时起例、观梅占、牡丹占', url: 'https://zh.wikisource.org/zh-hans/梅花易數/卷一' },
  { title: 'lunar 作者文档 · 农历年月日与闰月', url: 'https://6tail.cn/calendar/lunar.ymd.html' },
  { title: 'lunar 作者文档 · 农历年支与时支', url: 'https://6tail.cn/calendar/lunar.ganzhi.html' },
  { title: '香港天文台 · 2025 公历农历对照表', url: 'https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2025c.txt' },
] as const

const CALENDAR_RULES = {
  timeBasis: 'fixed-utc8', yearBoundary: 'lunar-new-year', dayBoundary: 'midnight',
  leapMonthPolicy: 'same-number', mutualPolicy: 'original-structure', bodyUsePolicy: 'moving-trigram-is-use',
} as const

export const MEIHUA_CALENDAR_CONVENTIONS = [
  '将问事地时间按填写的 UTC 偏移换算为瞬间，再统一以固定 UTC+08:00 起卦；不校正真太阳时。',
  '按农历正月初一换年，以年支子 1 至亥 12 取数；月份、日数使用农历，不使用节气月建。',
  '以北京时间 00:00 换日；23:00–00:59 为子时，23:00–23:59 仍用当日农历日期。',
  '闰月取同名月数，如闰六月仍取 6，同时保留闰月标记。',
  '固定 UTC+8、00:00 换日及闰月取同月数是本工具约定；古籍未给出现代时区及这些边界的统一规则。',
] as const

export interface MeihuaCalendarFacts {
  engine: { name: 'lunar-typescript'; version: '1.8.6' }
  beijingTime: string
  lunar: { year: number; yearBranch: string; month: number; day: number; isLeapMonth: boolean; label: string }
  timeBranch: string
  numbers: { year: number; month: number; day: number; time: number }
  upperSum: number
  total: number
  upperNumber: number
  lowerNumber: number
  movingLine: number
  rules: typeof CALENDAR_RULES
  conventions: string[]
  sources: { title: string; url: string }[]
}

/** Both Date values are UTC containers: Beijing wall fields must use getUTC* only. */
export function resolveCalendarTime(context: QuestionContext, methodLabel = '梅花时间法'): { instant: Date; beijing: Date } {
  const instant = new Date(Date.parse(`${context.date}T${context.time}:00Z`) - context.utcOffset * 3_600_000)
  const beijing = new Date(instant.getTime() + 8 * 3_600_000)
  for (const [label, date] of [['UTC 瞬间', instant], ['北京时间', beijing]] as const) {
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2099) {
      throw new Error(`${methodLabel}转换后的${label}须在 1900 至 2099 年之间，请核对日期与 UTC 偏移。`)
    }
  }
  return { instant, beijing }
}

export function calculateMeihuaCalendar(context: QuestionContext): MeihuaCalendarFacts {
  const { beijing } = resolveCalendarTime(context)
  const lunar = Solar.fromYmdHms(beijing.getUTCFullYear(), beijing.getUTCMonth() + 1, beijing.getUTCDate(), beijing.getUTCHours(), beijing.getUTCMinutes(), 0).getLunar()
  // Ordinary year index follows lunar New Year. The Exact variants follow Li Chun.
  const year = lunar.getYearZhiIndex() + 1, month = Math.abs(lunar.getMonth()), day = lunar.getDay()
  const time = lunar.getTimeZhiIndex() + 1
  const upperSum = year + month + day, total = upperSum + time
  return {
    engine: { name: 'lunar-typescript', version: '1.8.6' },
    beijingTime: `${beijing.toISOString().slice(0, 16).replace('T', ' ')} UTC+08:00`,
    lunar: { year: lunar.getYear(), yearBranch: lunar.getYearZhi(), month, day, isLeapMonth: lunar.getMonth() < 0, label: `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}` },
    timeBranch: lunar.getTimeZhi(), numbers: { year, month, day, time }, upperSum, total,
    upperNumber: upperSum % 8 || 8, lowerNumber: total % 8 || 8, movingLine: total % 6 || 6,
    rules: { ...CALENDAR_RULES }, conventions: [...MEIHUA_CALENDAR_CONVENTIONS], sources: MEIHUA_CALENDAR_SOURCES.map(source => ({ ...source })),
  }
}
