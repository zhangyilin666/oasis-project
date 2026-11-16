import type { BirthProfile } from './types'
import { resolveZonedTime } from './timezone'

export interface NormalizedBirth {
  profile: BirthProfile
  instant: Date
  chinese: { year: number; month: number; day: number; hour: number; minute: number; second: number; date: string }
  chineseTime: string
}
const pad = (value: number) => String(value).padStart(2, '0')

/** Explicit UTC arithmetic: neither parsing nor calendar inputs use device timezone. */
export function normalizeBirth(profile: BirthProfile): NormalizedBirth {
  if (!profile || !/^\d{4}-\d{2}-\d{2}$/.test(profile.date)) throw new Error('请填写完整的公历出生日期')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(profile.time)) throw new Error('请填写准确的出生时间（时:分），不能用默认时间代替未知时刻')
  if (profile.gender !== '男' && profile.gender !== '女') throw new Error('请选择用于传统排盘规则的性别')
  if (!profile.timeZone && (!Number.isFinite(profile.utcOffset) || profile.utcOffset < -12 || profile.utcOffset > 14 || !Number.isInteger(profile.utcOffset * 4))) {
    throw new Error('UTC 偏移须为 -12 至 +14 小时，以 0.25 小时为步长')
  }
  if (profile.timeChoice !== undefined && !['earlier', 'later'].includes(profile.timeChoice)) throw new Error('请选择有效的重复时刻处理方式')
  if (profile.timePrecision !== undefined && !['minute', 'approximate'].includes(profile.timePrecision)) throw new Error('请确认出生时间精度；时间不详时不能生成确定命盘')
  if (profile.place && (!Number.isFinite(profile.place.latitude) || !Number.isFinite(profile.place.longitude) || Math.abs(profile.place.latitude) > 90 || Math.abs(profile.place.longitude) > 180)) {
    throw new Error('出生地纬度须为 −90 至 +90，经度须为 −180 至 +180；南纬、西经填负数')
  }
  const [year, month, day] = profile.date.split('-').map(Number)
  const [hour, minute] = profile.time.split(':').map(Number)
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (year < 1900 || year > 2099 || wall.getUTCFullYear() !== year || wall.getUTCMonth() + 1 !== month || wall.getUTCDate() !== day) {
    throw new Error('请输入有效日期，支持 1900 年至今的出生资料')
  }
  const resolved = profile.timeZone ? resolveZonedTime(wall.getTime(), profile.timeZone, profile.timeChoice) : { instant: new Date(wall.getTime() - profile.utcOffset * 3_600_000), utcOffset: profile.utcOffset }
  const { instant } = resolved
  if (instant.getTime() > Date.now()) throw new Error('出生时刻不能晚于当前时间，请核对日期和 UTC 偏移')
  const beijing = new Date(instant.getTime() + 8 * 3_600_000)
  const chinese = {
    year: beijing.getUTCFullYear(), month: beijing.getUTCMonth() + 1,
    day: beijing.getUTCDate(), hour: beijing.getUTCHours(), minute: beijing.getUTCMinutes(), second: beijing.getUTCSeconds(),
    date: '',
  }
  if (chinese.year < 1900 || chinese.year > 2099) throw new Error('换算到北京时间后超出本版支持范围（1900–2099 年）')
  chinese.date = `${chinese.year}-${pad(chinese.month)}-${pad(chinese.day)}`
  return { profile: { ...profile, utcOffset: resolved.utcOffset, ...(profile.place ? { place: { ...profile.place } } : {}) }, instant, chinese, chineseTime: `${chinese.date} ${pad(chinese.hour)}:${pad(chinese.minute)}${chinese.second ? ':' + pad(chinese.second) : ''} UTC+08:00` }
}

export function validateObservationDate(value: string, birthDate: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('请选择完整的公历观察日期')
  const parsed = new Date(value + 'T12:00:00Z')
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < birthDate || value > '2099-12-31') {
    throw new Error('观察日期须为出生日期至 2099 年之间的有效公历日期')
  }
}

/** iztro distinguishes early Zi (0) from late Zi (12). */
export function ziweiTimeIndex(hour: number): number { return Math.floor((hour + 1) / 2) }
