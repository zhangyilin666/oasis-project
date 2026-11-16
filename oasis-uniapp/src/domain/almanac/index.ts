import { Solar, type JieQi } from 'lunar-typescript'

export const ALMANAC_MIN_DATE = '1900-01-01'
export const ALMANAC_MAX_DATE = '2099-12-31'
export const ALMANAC_RULE_VERSION = 'almanac-v1'
const UTC_OFFSET_HOURS = 8

export interface AlmanacInput { date: string; time?: string }
export interface AlmanacSource { title: string; url: string; role: 'reference' | 'calculation' | 'traditional' }
export interface AlmanacSolarTerm {
  name: string
  kind: '节' | '中气'
  beijingTime: string
  utcTime: string
}
export interface AlmanacResult {
  schemaVersion: 1
  ruleVersion: typeof ALMANAC_RULE_VERSION
  engine: { name: 'lunar-typescript'; version: '1.8.6'; license: 'MIT' }
  input: Required<AlmanacInput>
  observation: { timeZone: 'UTC+08:00'; utcOffset: 8; utcTime: string; weekday: string }
  lunar: { year: number; month: number; day: number; isLeapMonth: boolean; label: string; animal: string }
  ganzhi: { lunarYear: string; solarTermYear: string; solarTermMonth: string; day: string }
  solarTerms: { current: string; previous: AlmanacSolarTerm; next: AlmanacSolarTerm; precisionNote: string }
  traditional: { yi: string[]; ji: string[]; monthGanZhi: string; convention: string; sourceUrl: string }
  conventions: string[]
  sources: AlmanacSource[]
}

export const ALMANAC_SOURCES: readonly AlmanacSource[] = [
  { title: '香港天文台 · 公历与农历日期对照表', url: 'https://www.hko.gov.hk/sc/gts/time/conversion.htm', role: 'reference' },
  { title: '香港天文台 · 二十四节气时刻（香港时间）', url: 'https://www.hko.gov.hk/sc/gts/astronomy/Solar_Term.htm', role: 'reference' },
  { title: '香港天文台 · 节气与太阳黄经', url: 'https://www.hko.gov.hk/sc/gts/time/24solarterms.htm', role: 'reference' },
  { title: 'lunar · 干支计算口径', url: 'https://6tail.cn/calendar/lunar.ganzhi.html', role: 'calculation' },
  { title: 'lunar · 节气计算说明', url: 'https://6tail.cn/calendar/lunar.jieqi.html', role: 'calculation' },
  { title: 'lunar · 宜忌资料与流派口径', url: 'https://6tail.cn/calendar/lunar.yiji.html', role: 'traditional' },
]

export const ALMANAC_CONVENTIONS = [
  '公历日期范围为 1900–2099 年；日期与时间固定按 UTC+08:00 解释，不跟随设备时区，也不套用历史夏令时。',
  '农历年及其生肖以农历正月初一 00:00 为界；闰月单独标明。',
  '节气年干支以立春交节时刻为界；节令月干支以十二节的交节时刻为界。',
  '日干支以 00:00 换日，23:00 不提前换日。',
  '当前节气区间从上一交节计算时刻开始，到下一交节计算时刻之前结束；节与中气均纳入。',
]

function dateMilliseconds(date: unknown): number {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('请选择有效的公历日期（YYYY-MM-DD）。')
  if (date < ALMANAC_MIN_DATE || date > ALMANAC_MAX_DATE) throw new Error('黄历日期支持 1900-01-01 至 2099-12-31。')
  const [year, month, day] = date.split('-').map(Number)
  const instant = Date.UTC(year, month - 1, day)
  if (new Date(instant).toISOString().slice(0, 10) !== date) throw new Error('这个公历日期不存在，请重新选择。')
  return instant
}

function timeParts(time: unknown): [number, number] {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('请选择有效时间（00:00–23:59）。')
  return time.split(':').map(Number) as [number, number]
}

function solarTermEvent(term: JieQi): AlmanacSolarTerm {
  const solar = term.getSolar()
  return {
    name: term.getName(), kind: term.isJie() ? '节' : '中气', beijingTime: solar.toYmdHms(),
    utcTime: new Date(Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour() - UTC_OFFSET_HOURS, solar.getMinute(), solar.getSecond())).toISOString(),
  }
}

/** Civil date in fixed UTC+8, independent of the device's configured time zone. */
export function getAlmanacToday(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error('无法读取当前日期。')
  return new Date(now.getTime() + UTC_OFFSET_HOURS * 3600000).toISOString().slice(0, 10)
}

export function shiftAlmanacDate(date: string, days: -1 | 1): string {
  if (days !== -1 && days !== 1) throw new Error('日期浏览每次移动一天。')
  const shifted = new Date(dateMilliseconds(date) + days * 86400000).toISOString().slice(0, 10)
  dateMilliseconds(shifted)
  return shifted
}

export function calculateAlmanac(input: AlmanacInput): AlmanacResult {
  if (!input || typeof input !== 'object') throw new Error('请先选择黄历日期。')
  const dayMilliseconds = dateMilliseconds(input.date)
  const time = input.time === undefined ? '12:00' : input.time
  const [hour, minute] = timeParts(time)
  const [year, month, day] = input.date.split('-').map(Number)
  // Explicit civil components avoid Solar.fromDate(), which follows the device zone.
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
  const lunar = solar.getLunar()
  // false means exact time: the previous event includes equality, the next is strict.
  const previous = solarTermEvent(lunar.getPrevJieQi(false))
  const next = solarTermEvent(lunar.getNextJieQi(false))
  return {
    schemaVersion: 1, ruleVersion: ALMANAC_RULE_VERSION,
    engine: { name: 'lunar-typescript', version: '1.8.6', license: 'MIT' },
    input: { date: input.date, time },
    observation: { timeZone: 'UTC+08:00', utcOffset: 8, utcTime: new Date(dayMilliseconds + (hour - UTC_OFFSET_HOURS) * 3600000 + minute * 60000).toISOString(), weekday: `星期${solar.getWeekInChinese()}` },
    lunar: { year: lunar.getYear(), month: Math.abs(lunar.getMonth()), day: lunar.getDay(), isLeapMonth: lunar.getMonth() < 0, label: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`, animal: lunar.getYearShengXiao() },
    ganzhi: { lunarYear: lunar.getYearInGanZhi(), solarTermYear: lunar.getYearInGanZhiExact(), solarTermMonth: lunar.getMonthInGanZhiExact(), day: lunar.getDayInGanZhi() },
    solarTerms: { current: previous.name, previous, next, precisionNote: '交节时间为历法库计算值；显示秒位便于复核，独立参考核对到分钟，不代表秒级准确。' },
    traditional: { yi: [...lunar.getDayYi(1)], ji: [...lunar.getDayJi(1)], monthGanZhi: lunar.getMonthInGanZhi(), convention: '通用传统宜忌采用整日口径：十二节交节所在日 00:00 起按新月干支查表，与上方按交节时刻换月的节令月可能不同。不同历书可有差异，不作个人择日结论。', sourceUrl: 'https://6tail.cn/calendar/lunar.yiji.html' },
    conventions: [...ALMANAC_CONVENTIONS], sources: ALMANAC_SOURCES.map(source => ({ ...source })),
  }
}
