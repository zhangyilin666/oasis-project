import { Lunar, LunarUtil, LunarYear, Solar } from 'lunar-typescript'

export const MIN_BIRTH_DATE = '1900-01-01'
export type BirthCalendar = 'solar' | 'lunar'
export interface BirthDateParts { year: number; month: number; day: number }
export interface BirthDateOption { value: number; label: string }
export type BirthDateSelection = { [K in keyof BirthDateParts]?: number | null }
/** Pass the page's current local-date ceiling; these helpers never read the clock. */
export interface BirthDateBounds { min?: string; max: string }
export interface BirthTimeParts { hour: number; minute: number }

function checkCalendar(calendar: BirthCalendar): void {
  if (calendar !== 'solar' && calendar !== 'lunar') throw new Error('请选择公历或农历。')
}

function checkYear(calendar: BirthCalendar, year: number): void {
  checkCalendar(calendar)
  // Early January 1900 belongs to lunar year 1899.
  if (!Number.isInteger(year) || year < (calendar === 'lunar' ? 1899 : 1900) || year > 9999) {
    throw new Error('出生年份不在支持范围内。')
  }
}

function solarMonthDays(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('请选择有效月份。')
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function daysInMonth(calendar: BirthCalendar, year: number, month: number): number {
  checkYear(calendar, year)
  if (calendar === 'solar') return solarMonthDays(year, month)
  if (!Number.isInteger(month)) throw new Error('请选择有效农历月份。')
  const lunarMonth = LunarYear.fromYear(year).getMonth(month)
  if (!lunarMonth) throw new Error('该农历年份没有这个月份，请重新选择。')
  return lunarMonth.getDayCount()
}

function parseSolarDate(iso: string): BirthDateParts {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('公历日期须为完整的 YYYY-MM-DD。')
  const [year, month, day] = iso.split('-').map(Number)
  checkYear('solar', year)
  if (day < 1 || day > solarMonthDays(year, month)) throw new Error('日期不存在，请重新选择年月日。')
  return { year, month, day }
}

const pad = (value: number) => String(value).padStart(2, '0')
const solarISO = ({ year, month, day }: BirthDateParts) => `${year}-${pad(month)}-${pad(day)}`

/** Leap months have a negative value and a separate, explicit 闰 label. */
export function getBirthMonths(calendar: BirthCalendar, year: number): BirthDateOption[] {
  checkYear(calendar, year)
  if (calendar === 'solar') return Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1}月` }))
  // getMonths() also contains neighbouring years; only expose the selected year.
  return LunarYear.fromYear(year).getMonthsInYear().map(month => ({
    value: month.getMonth(),
    label: `${month.isLeap() ? '闰' : ''}${LunarUtil.MONTH[Math.abs(month.getMonth())]}月`,
  }))
}

export function getBirthDays(calendar: BirthCalendar, year: number, month: number): BirthDateOption[] {
  const count = daysInMonth(calendar, year, month)
  return Array.from({ length: count }, (_, index) => ({
    value: index + 1,
    label: calendar === 'lunar' ? LunarUtil.DAY[index + 1] : `${index + 1}日`,
  }))
}

/** Never fill missing parts or clamp a stale day after a month/year change. */
export function birthDateToSolar(calendar: BirthCalendar, parts: BirthDateSelection, bounds: BirthDateBounds): string {
  checkCalendar(calendar)
  if (!parts || !Number.isInteger(parts.year) || !Number.isInteger(parts.month) || !Number.isInteger(parts.day)) {
    throw new Error('请选择完整的出生年月日。')
  }
  const { year, month, day } = parts as BirthDateParts
  if (day < 1 || day > daysInMonth(calendar, year, month)) throw new Error('日期不存在，请重新选择日期。')
  const iso = calendar === 'solar' ? solarISO({ year, month, day }) : Lunar.fromYmd(year, month, day).getSolar().toYmd()
  const min = bounds?.min ?? MIN_BIRTH_DATE
  const max = bounds?.max
  parseSolarDate(min)
  parseSolarDate(max)
  if (min > max) throw new Error('出生日期的可选范围无效。')
  if (iso < min) throw new Error(`出生日期不能早于 ${min}。`)
  if (iso > max) throw new Error(`出生日期不能晚于 ${max}。`)
  return iso
}

/** Switch presentation calendars without changing the stored solar date. */
export function solarToBirthDate(iso: string, calendar: BirthCalendar): BirthDateParts {
  checkCalendar(calendar)
  const parts = parseSolarDate(iso)
  if (calendar === 'solar') return parts
  const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar()
  return { year: lunar.getYear(), month: lunar.getMonth(), day: lunar.getDay() }
}

export function formatLunarBirthDate(iso: string): string {
  const parts = parseSolarDate(iso)
  const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar()
  return `农历 ${lunar.getYear()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
}

/** An empty/partial time remains unknown, including an unselected minute. */
export function parseBirthTime(value: string): BirthTimeParts | null {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  const [hour, minute] = value.split(':').map(Number)
  return { hour, minute }
}

export function formatBirthTime(hour: number | null | undefined, minute: number | null | undefined): string {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error('请选择完整的出生时分。')
  if (hour! < 0 || hour! > 23 || minute! < 0 || minute! > 59) throw new Error('出生时间须为 00:00 至 23:59。')
  return `${pad(hour!)}:${pad(minute!)}`
}
