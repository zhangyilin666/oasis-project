import { JYOTISH_RULE_VERSION, type JyotishSnapshot } from './index'
import { AYANAMSA_MODEL, JYOTISH_BODIES } from './astronomy'
import { DASHA_LORDS, DASHA_YEARS, NAKSHATRAS, SIGNS } from './rules'

export const JYOTISH_STORAGE_KEY = 'oasis.jyotish.snapshots.v1'
export const MAX_JYOTISH_RECORDS = 20
export interface JyotishRecord { id: string; name: string; savedAt: string; snapshot: JyotishSnapshot }
export interface JyotishStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }
const MAX_LENGTH = 1500000
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 500): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const finite = (value: unknown, min = -Infinity, max = Infinity): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const integer = (value: unknown, min: number, max: number) => finite(value, min, max) && Number.isInteger(value)
const listOfText = (value: unknown) => Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(item => text(item))
function iso(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
function date(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2099-12-31' }
function zodiac(value: unknown): boolean {
  return object(value) && finite(value.longitude, 0, 360) && value.longitude < 360 && integer(value.signIndex, 0, 11) && value.sign === SIGNS[value.signIndex] && finite(value.degreeInSign, 0, 30) && value.degreeInSign < 30 && Math.abs(value.longitude - value.signIndex * 30 - value.degreeInSign) < 1e-8
}
function period(value: unknown): boolean { return object(value) && DASHA_LORDS.includes(value.lord) && iso(value.startUtc) && iso(value.endUtc) && value.startUtc < value.endUtc && finite(value.years, 0, 20) && value.years > 0 && Math.abs(Date.parse(value.endUtc) - Date.parse(value.startUtc) - value.years * 365.25 * 86400000) <= 2 }

/** Structural and internal consistency checks only: never request a fresh ephemeris. */
export function validateJyotishSnapshot(value: unknown): asserts value is JyotishSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== JYOTISH_RULE_VERSION || !iso(value.birthUtc)) throw new Error('snapshot version')
  const p = value.profile
  if (!object(p) || !date(p.date) || typeof p.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time) || !['男', '女'].includes(p.gender) || !finite(p.utcOffset, -24, 24) || (p.timePrecision !== undefined && !['minute', 'approximate'].includes(p.timePrecision)) || (p.timeZone !== undefined && !text(p.timeZone, 100)) || (p.timeChoice !== undefined && !['earlier', 'later'].includes(p.timeChoice))) throw new Error('profile')
  if (p.place !== undefined && (!object(p.place) || !finite(p.place.latitude, -90, 90) || !finite(p.place.longitude, -180, 180) || (p.place.name !== undefined && (typeof p.place.name !== 'string' || p.place.name.length > 100)))) throw new Error('place')
  if (new Date(Date.parse(value.birthUtc) + p.utcOffset * 3600000).toISOString().slice(0, 16) !== `${p.date}T${p.time}`) throw new Error('birth instant')
  if (!object(value.timeResolution) || !['manual', 'iana'].includes(value.timeResolution.mode) || value.timeResolution.utcOffset !== p.utcOffset || (value.timeResolution.mode === 'iana' && value.timeResolution.timeZone !== p.timeZone)) throw new Error('time resolution')
  const observation = value.observation
  if (!object(observation) || !date(observation.date) || observation.localTime !== '12:00' || observation.timeZone !== 'UTC+08:00' || observation.utcTime !== observation.date + 'T04:00:00.000Z') throw new Error('observation')
  if (!object(value.engine) || value.engine.name !== 'astronomy-engine' || value.engine.version !== '2.1.19' || value.engine.license !== 'MIT' || !object(value.ayanamsa) || value.ayanamsa.model !== AYANAMSA_MODEL || !finite(value.ayanamsa.meanDegrees, 20, 27) || !finite(value.ayanamsa.trueDegrees, 20, 27)) throw new Error('engine')
  if (!Array.isArray(value.positions) || value.positions.length !== 7 || !value.positions.every((position: any, index: number) => object(position) && position.body === JYOTISH_BODIES[index] && text(position.name, 10) && finite(position.longitude, 0, 360) && position.longitude < 360 && zodiac(position.d1) && zodiac(position.d9) && position.d1.longitude === position.longitude && (position.house === null || integer(position.house, 1, 12)))) throw new Error('positions')
  const houses = value.houses
  if (!object(houses) || !['ready', 'unavailable'].includes(houses.status)) throw new Error('houses')
  if (houses.status === 'ready') {
    if (!p.place || Math.abs(p.place.latitude) >= 66 || p.timePrecision === 'approximate' || !zodiac(houses.ascendant) || !zodiac(houses.midheaven) || !zodiac(houses.navamsaAscendant) || !Array.isArray(houses.cusps) || houses.cusps.length !== 12 || !houses.cusps.every((cusp: unknown, index: number) => cusp === (houses.ascendant.signIndex * 30 + index * 30) % 360) || value.positions.some((position: any) => position.house === null)) throw new Error('ready houses')
  } else if (!text(houses.reason) || value.positions.some((position: any) => position.house !== null)) throw new Error('unavailable houses')
  const n = value.nakshatra
  if (!object(n) || !integer(n.index, 0, 26) || n.number !== n.index + 1 || n.name !== NAKSHATRAS[n.index] || !integer(n.pada, 1, 4) || !finite(n.fraction, 0, 1) || n.fraction >= 1 || !finite(n.remainingFraction, 0, 1) || Math.abs(n.fraction + n.remainingFraction - 1) > 1e-12 || n.lord !== DASHA_LORDS[n.index % 9] || !finite(n.remainingYears, 0, 20)) throw new Error('nakshatra')
  const v = value.vimshottari
  if (!object(v) || v.yearDays !== 365.25 || v.interval !== '[start,end)' || !Array.isArray(v.periods) || v.periods.length !== 9) throw new Error('dasha')
  for (let i = 0; i < 9; i++) {
    const maha = v.periods[i]
    const lordIndex = (n.index % 9 + i) % 9
    if (!period(maha) || maha.lord !== DASHA_LORDS[lordIndex] || maha.years !== DASHA_YEARS[lordIndex] || (i > 0 && maha.startUtc !== v.periods[i - 1].endUtc) || !Array.isArray(maha.antardashas) || maha.antardashas.length !== 9) throw new Error('maha')
    for (let j = 0; j < 9; j++) {
      const sub = maha.antardashas[j]
      if (!period(sub) || sub.lord !== DASHA_LORDS[(lordIndex + j) % 9] || Math.abs(sub.years - maha.years * DASHA_YEARS[(lordIndex + j) % 9] / 120) > 1e-12 || (j === 0 ? sub.startUtc !== maha.startUtc : sub.startUtc !== maha.antardashas[j - 1].endUtc) || (j === 8 && sub.endUtc !== maha.endUtc)) throw new Error('antar')
    }
  }
  if (!(v.periods[0].startUtc <= value.birthUtc && value.birthUtc < v.periods[0].endUtc)) throw new Error('birth dasha')
  const activeMaha = observation.utcTime >= value.birthUtc ? v.periods.find((maha: any) => maha.startUtc <= observation.utcTime && observation.utcTime < maha.endUtc) : undefined
  const activeAntar = activeMaha?.antardashas.find((sub: any) => sub.startUtc <= observation.utcTime && observation.utcTime < sub.endUtc)
  if (activeMaha && activeAntar) {
    if (!object(v.active) || v.active.maha !== activeMaha.lord || v.active.antar !== activeAntar.lord || v.active.mahaStartUtc !== activeMaha.startUtc || v.active.mahaEndUtc !== activeMaha.endUtc || v.active.antarStartUtc !== activeAntar.startUtc || v.active.antarEndUtc !== activeAntar.endUtc) throw new Error('active')
  } else if (v.active !== null) throw new Error('inactive')
  if (!listOfText(value.conventions) || !listOfText(value.limitations) || !Array.isArray(value.sources) || value.sources.length !== 4 || !value.sources.every((source: any) => object(source) && text(source.title) && text(source.version) && text(source.license) && text(source.url, 1000) && /^https:\/\/[^\s]+$/.test(source.url))) throw new Error('references')
}

export function createJyotishRepository(storage: JyotishStorage, now = () => new Date(), makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`) {
  function list(): JyotishRecord[] {
    try {
      const raw = storage.getItem(JYOTISH_STORAGE_KEY)
      if (raw === '' || raw === null || raw === undefined) return []
      if (typeof raw !== 'string' || raw.length > MAX_LENGTH) throw new Error('size')
      const payload = JSON.parse(raw)
      if (!object(payload) || payload.version !== 1 || !Array.isArray(payload.records) || payload.records.length > MAX_JYOTISH_RECORDS) throw new Error('version')
      for (const record of payload.records) {
        if (!object(record) || !text(record.id, 100) || !text(record.name, 40) || !iso(record.savedAt)) throw new Error('record')
        validateJyotishSnapshot(record.snapshot)
      }
      if (new Set(payload.records.map((record: JyotishRecord) => record.id)).size !== payload.records.length) throw new Error('duplicate')
      return clone(payload.records)
    } catch { throw new Error('印度占星本机档案无法读取或格式异常，已停止写入以保留原数据') }
  }
  function write(records: JyotishRecord[]) {
    const serialized = JSON.stringify({ version: 1, records })
    if (serialized.length > MAX_LENGTH) throw new Error('档案容量已满，请先导出并删除不需要的记录')
    try { storage.setItem(JYOTISH_STORAGE_KEY, serialized) } catch { throw new Error('本机保存失败，本次操作未确认成功；可先导出当前结果') }
  }
  return {
    list,
    save(name: string, snapshot: JyotishSnapshot): JyotishRecord {
      const label = name.trim()
      if (!text(label, 40)) throw new Error('档案名称需为 1–40 个字')
      validateJyotishSnapshot(snapshot)
      const records = list()
      if (records.length >= MAX_JYOTISH_RECORDS) throw new Error('最多保留 20 份印度占星档案，请先导出并删除不需要的记录')
      const record: JyotishRecord = { id: makeId(), name: label, savedAt: now().toISOString(), snapshot: clone(snapshot) }
      if (!text(record.id, 100) || records.some(item => item.id === record.id) || !iso(record.savedAt)) throw new Error('档案编号或保存时间无效，请重试')
      write([record, ...records])
      return clone(record)
    },
    remove(id: string) { const records = list().filter(record => record.id !== id); write(records); return records },
    exportJSON() { return { format: 'oasis-jyotish-collection', formatVersion: 1, exportedAt: now().toISOString(), records: list() } },
  }
}
