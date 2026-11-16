import type { BirthProfile } from '../metaphysics/types'
import { normalizeBirth, type NormalizedBirth } from '../metaphysics/time'
import { resolveZonedTime } from '../metaphysics/timezone'

export interface ObservationTime { date: string; time: string; utcOffset: number; timeZone?: string; timeChoice?: 'earlier' | 'later' }
export interface TimeSnapshot {
  utcTime: string; beijingTime: string; resolvedUtcOffset: number; mode: 'manual' | 'iana'
  timeZone?: string; timeChoice?: 'earlier' | 'later'
}
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const pad = (n: number) => String(n).padStart(2, '0')
export function timeSnapshot(input: { utcOffset: number; timeZone?: string; timeChoice?: 'earlier' | 'later' }, instant: Date): TimeSnapshot {
  return { utcTime: instant.toISOString(), beijingTime: new Date(instant.getTime() + 28_800_000).toISOString().slice(0, 19).replace('T', ' '), resolvedUtcOffset: input.utcOffset, mode: input.timeZone ? 'iana' : 'manual', ...(input.timeZone ? { timeZone: input.timeZone } : {}), ...(input.timeChoice ? { timeChoice: input.timeChoice } : {}) }
}
export function normalizeFlowTimes(birth: BirthProfile, observation: ObservationTime): { birth: NormalizedBirth; observation: NormalizedBirth; birthTime: TimeSnapshot; observationTime: TimeSnapshot } {
  const normalizedBirth = normalizeBirth(birth)
  if (!observation || !/^\d{4}-\d{2}-\d{2}$/.test(observation.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(observation.time)) throw new Error('请填写完整的观测日期与时分，不用默认时刻代替未知时间。')
  if (!observation.timeZone && (!Number.isFinite(observation.utcOffset) || observation.utcOffset < -12 || observation.utcOffset > 14 || !Number.isInteger(observation.utcOffset * 4))) throw new Error('观测 UTC 偏移须为 −12 至 +14，以 0.25 小时为步长。')
  if (observation.timeChoice !== undefined && !['earlier', 'later'].includes(observation.timeChoice)) throw new Error('观测重复时刻选项不正确。')
  const [year, month, day] = observation.date.split('-').map(Number), [hour, minute] = observation.time.split(':').map(Number)
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (year < 1900 || year > 2099 || wall.toISOString().slice(0, 10) !== observation.date) throw new Error('观测日期须为 1900–2099 年的有效公历日期。')
  let resolved: { instant: Date; utcOffset: number }
  try { resolved = observation.timeZone ? resolveZonedTime(wall.getTime(), observation.timeZone, observation.timeChoice) : { instant: new Date(wall.getTime() - observation.utcOffset * 3_600_000), utcOffset: observation.utcOffset } }
  catch (error) { throw new Error(`观测时间：${error instanceof Error ? error.message.replace('出生记录', '时间记录') : '时区换算失败'}`) }
  if (resolved.instant.getTime() < normalizedBirth.instant.getTime()) throw new Error('观测时刻不能早于出生时刻，请核对日期、时分与时区。')
  const bj = new Date(resolved.instant.getTime() + 28_800_000)
  if (bj.getUTCFullYear() < 1900 || bj.getUTCFullYear() > 2099) throw new Error('观测时刻换算至 UTC+08:00 后超出 1900–2099 年范围。')
  const chinese = { year: bj.getUTCFullYear(), month: bj.getUTCMonth() + 1, day: bj.getUTCDate(), hour: bj.getUTCHours(), minute: bj.getUTCMinutes(), second: bj.getUTCSeconds(), date: bj.toISOString().slice(0, 10) }
  const normalizedObservation: NormalizedBirth = { profile: { ...observation, gender: birth.gender, utcOffset: resolved.utcOffset }, instant: resolved.instant, chinese, chineseTime: `${chinese.date} ${pad(chinese.hour)}:${pad(chinese.minute)}:${pad(chinese.second)} UTC+08:00` }
  return { birth: normalizedBirth, observation: normalizedObservation, birthTime: timeSnapshot(normalizedBirth.profile, normalizedBirth.instant), observationTime: timeSnapshot(normalizedObservation.profile, resolved.instant) }
}
