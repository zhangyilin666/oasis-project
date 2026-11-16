import type { BirthProfile, ExplorationOptions } from './types'
export interface BirthExtrasValue {
  timeZone: string
  customTimeZone: boolean
  timeChoice: '' | 'earlier' | 'later'
  timePrecision: 'minute' | 'approximate'
  placeEnabled: boolean
  placeName: string
  latitude: string
  longitude: string
  observationDate: string
  compareRules: boolean
}
export function emptyBirthExtras(): BirthExtrasValue {
  return { timeZone: '', customTimeZone: false, timeChoice: '', timePrecision: 'minute', placeEnabled: false, placeName: '', latitude: '', longitude: '', observationDate: '', compareRules: false }
}
export function extrasFromProfile(profile: BirthProfile, options: ExplorationOptions = {}): BirthExtrasValue {
  return { timeZone: profile.timeZone || '', customTimeZone: false, timeChoice: profile.timeChoice || '', timePrecision: profile.timePrecision || 'minute', placeEnabled: !!profile.place, placeName: profile.place?.name || '', latitude: profile.place ? String(profile.place.latitude) : '', longitude: profile.place ? String(profile.place.longitude) : '', observationDate: options.observationDate || '', compareRules: options.compareRules === true }
}
export function optionsFromExtras(extras: BirthExtrasValue): ExplorationOptions {
  return { ...(extras.observationDate ? { observationDate: extras.observationDate } : {}), ...(extras.compareRules ? { compareRules: true } : {}) }
}
export function applyBirthExtras(profile: BirthProfile, extras: BirthExtrasValue): BirthProfile {
  if (extras.customTimeZone && !extras.timeZone.trim()) throw new Error('请填写自定义 IANA 时区名称，例如 America/New_York，或选择手动 UTC 偏移')
  const result: BirthProfile = { date: profile.date, time: profile.time, gender: profile.gender, utcOffset: profile.utcOffset, timePrecision: extras.timePrecision }
  if (extras.timeZone.trim()) result.timeZone = extras.timeZone.trim()
  if (extras.timeChoice) result.timeChoice = extras.timeChoice
  if (extras.placeEnabled) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(extras.latitude.trim()) || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(extras.longitude.trim())) throw new Error('请填写有效经纬度，或关闭出生地点后计算基础星盘')
    result.place = { latitude: Number(extras.latitude), longitude: Number(extras.longitude), ...(extras.placeName.trim() ? { name: extras.placeName.trim().slice(0, 60) } : {}) }
  }
  return result
}
