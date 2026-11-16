import type { BirthProfile } from '@/domain/metaphysics/types'
import type { StudyPersonInput } from '@/domain/western-study'

export interface StudyPersonForm { name: string; date: string; time: string; genderIndex: number; precisionIndex: number; utcOffset: string; timeZone: string; choiceIndex: number; placeEnabled: boolean; placeName: string; latitude: string; longitude: string }
export const newPersonForm = (name: string): StudyPersonForm => ({ name, date: '', time: '', genderIndex: 0, precisionIndex: 0, utcOffset: '8', timeZone: '', choiceIndex: 0, placeEnabled: false, placeName: '', latitude: '', longitude: '' })
export function fillPersonForm(form: StudyPersonForm, name: string, profile: BirthProfile) {
  Object.assign(form, { name, date: profile.date, time: profile.time, genderIndex: profile.gender === '女' ? 1 : 2, precisionIndex: profile.timePrecision === 'approximate' ? 2 : 1, utcOffset: String(profile.utcOffset), timeZone: profile.timeZone || '', choiceIndex: profile.timeChoice === 'earlier' ? 1 : profile.timeChoice === 'later' ? 2 : 0, placeEnabled: Boolean(profile.place), placeName: profile.place?.name || '', latitude: profile.place ? String(profile.place.latitude) : '', longitude: profile.place ? String(profile.place.longitude) : '' })
}
export function readPersonForm(form: StudyPersonForm, role: string): StudyPersonInput {
  if (!form.precisionIndex) throw new Error(`${role}：请明确选择出生时间精度`)
  if (!form.genderIndex) throw new Error(`${role}：请选择通用出生资料的性别；它不参与本页几何计算`)
  if (!form.utcOffset.trim() && !form.timeZone.trim()) throw new Error(`${role}：请填写出生时的UTC偏移或历史IANA时区`)
  if (form.placeEnabled && (!form.latitude.trim() || !form.longitude.trim())) throw new Error(`${role}：启用出生地点后，请同时填写纬度和经度`)
  return { name: form.name, profile: { date: form.date, time: form.time, gender: form.genderIndex === 1 ? '女' : '男', timePrecision: form.precisionIndex === 2 ? 'approximate' : 'minute', utcOffset: Number(form.utcOffset), ...(form.timeZone.trim() ? { timeZone: form.timeZone.trim(), ...(form.choiceIndex ? { timeChoice: form.choiceIndex === 1 ? 'earlier' as const : 'later' as const } : {}) } : {}), ...(form.placeEnabled ? { place: { name: form.placeName.trim(), latitude: Number(form.latitude), longitude: Number(form.longitude) } } : {}) } }
}
