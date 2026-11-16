import { WESTERN_STUDY_RULE_VERSION, type WesternStudySnapshot } from './index'
import { SYNASTRY_ORB_DEGREES, SYNASTRY_RULE_VERSION, findSynastryAspects } from './synastry'
import { SIGNS } from '../metaphysics/positions'
import { MAJOR_ASPECTS } from '../metaphysics/transits'
import { wholeSignHouse } from '../metaphysics/houses'
import { equalAscendantHouse } from './houses'

export const WESTERN_STUDY_STORAGE_KEY = 'oasis.western-study.snapshots.v1'
export const MAX_WESTERN_STUDY_RECORDS = 20
export interface WesternStudyRecord { id: string; name: string; note: string; savedAt: string; snapshot: WesternStudySnapshot }
export interface WesternStudyStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }
const MAX_LENGTH = 1500000
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 500): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const integer = (value: unknown, min: number, max: number) => finite(value, min, max) && Number.isInteger(value)
const longitude = (value: unknown) => finite(value, 0, 360) && value < 360
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9
const listOfText = (value: unknown) => Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(item => text(item))
function iso(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
function date(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2099-12-31' }

function validatePerson(person: unknown, role: string) {
  if (!object(person) || person.role !== role || !text(person.name, 30) || !iso(person.utcTime)) throw new Error('person')
  const p = person.profile
  if (!object(p) || !date(p.date) || typeof p.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time) || !['男', '女'].includes(p.gender) || !finite(p.utcOffset, -24, 24) || (p.timePrecision !== undefined && !['minute', 'approximate'].includes(p.timePrecision)) || (p.timeZone !== undefined && !text(p.timeZone, 100)) || (p.timeChoice !== undefined && !['earlier', 'later'].includes(p.timeChoice))) throw new Error('profile')
  if (p.place !== undefined && (!object(p.place) || !finite(p.place.latitude, -90, 90) || !finite(p.place.longitude, -180, 180) || (p.place.name !== undefined && (typeof p.place.name !== 'string' || p.place.name.length > 100)))) throw new Error('place')
  if (new Date(Date.parse(person.utcTime) + p.utcOffset * 3600000).toISOString().slice(0, 16) !== `${p.date}T${p.time}`) throw new Error('birth instant')
  if (!object(person.timeResolution) || person.timeResolution.mode !== (p.timeZone ? 'iana' : 'manual') || person.timeResolution.utcOffset !== p.utcOffset || (p.timeZone && (person.timeResolution.timeZone !== p.timeZone || person.timeResolution.choice !== p.timeChoice))) throw new Error('time resolution')
  if (!Array.isArray(person.positions) || person.positions.length !== 10 || !person.positions.every((position: any, index: number) => object(position) && position.body === BODIES[index] && text(position.name, 10) && longitude(position.longitude) && position.sign === SIGNS[Math.floor(position.longitude / 30)] && finite(position.degree, 0, 30) && position.degree < 30 && close(position.degree, position.longitude % 30) && ['顺行', '逆行', '近驻留'].includes(position.motion) && (position.wholeSignHouse === null || integer(position.wholeSignHouse, 1, 12)) && (position.equalAscendantHouse === null || integer(position.equalAscendantHouse, 1, 12)))) throw new Error('positions')
  const houses = person.houses
  if (!object(houses) || !['ready', 'unavailable'].includes(houses.status)) throw new Error('houses')
  if (houses.status === 'ready') {
    if (!p.place || Math.abs(p.place.latitude) >= 66 || p.timePrecision === 'approximate' || !longitude(houses.ascendant) || !longitude(houses.midheaven) || !object(houses.wholeSign) || houses.wholeSign.id !== 'whole-sign' || !object(houses.equalAscendant) || houses.equalAscendant.id !== 'equal-ascendant') throw new Error('ready houses')
    for (const key of ['wholeSign', 'equalAscendant']) {
      const system = houses[key]
      const start = key === 'wholeSign' ? Math.floor(houses.ascendant / 30) * 30 : houses.ascendant
      if (!Array.isArray(system.cusps) || system.cusps.length !== 12 || !system.cusps.every((cusp: unknown, index: number) => longitude(cusp) && close(cusp as number, (start + index * 30) % 360))) throw new Error('cusps')
    }
    if (houses.wholeSign.midheavenHouse !== wholeSignHouse(houses.midheaven, houses.ascendant) || houses.equalAscendant.midheavenHouse !== equalAscendantHouse(houses.midheaven, houses.ascendant)) throw new Error('mc house')
    if (!person.positions.every((position: any) => position.wholeSignHouse === wholeSignHouse(position.longitude, houses.ascendant) && position.equalAscendantHouse === equalAscendantHouse(position.longitude, houses.ascendant))) throw new Error('house placement')
  } else if (!text(houses.reason) || person.positions.some((position: any) => position.wholeSignHouse !== null || position.equalAscendantHouse !== null)) throw new Error('unavailable houses')
  if (!listOfText(person.limitations)) throw new Error('person limitations')
}

/** Validate stored inputs and geometry; no ephemeris or timezone lookup is performed. */
export function validateWesternStudySnapshot(value: unknown): asserts value is WesternStudySnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== WESTERN_STUDY_RULE_VERSION || !['house-comparison', 'synastry'].includes(value.mode)) throw new Error('version')
  if (!object(value.engine) || value.engine.name !== 'astronomy-engine' || value.engine.version !== '2.1.19' || value.engine.license !== 'MIT' || value.zodiac !== 'tropical-true-ecliptic-of-date' || !Array.isArray(value.houseSystems) || value.houseSystems.join('/') !== 'whole-sign/equal-ascendant') throw new Error('rules')
  if (!Array.isArray(value.participants) || value.participants.length !== (value.mode === 'synastry' ? 2 : 1)) throw new Error('participants')
  value.participants.forEach((person: unknown, index: number) => validatePerson(person, index === 0 ? 'A' : 'B'))
  const synastry = value.synastry
  if (value.mode === 'house-comparison') { if (synastry !== null) throw new Error('single mode') }
  else {
    if (!object(synastry) || synastry.ruleVersion !== SYNASTRY_RULE_VERSION || synastry.kind !== 'cross-chart-natal-aspects' || synastry.orbDegrees !== SYNASTRY_ORB_DEGREES || synastry.pairsConsidered !== 100 || !Array.isArray(synastry.aspectsIncluded) || synastry.aspectsIncluded.length !== MAJOR_ASPECTS.length || !synastry.aspectsIncluded.every((aspect: any, index: number) => object(aspect) && aspect.angle === MAJOR_ASPECTS[index].angle && aspect.name === MAJOR_ASPECTS[index].name) || !Array.isArray(synastry.aspects) || synastry.aspects.length > 100) throw new Error('synastry rules')
    // Only check the already-saved longitudes against already-saved aspects.
    const expected = findSynastryAspects(value.participants[0].positions, value.participants[1].positions)
    if (synastry.aspects.length !== expected.length || !synastry.aspects.every((aspect: any, index: number) => object(aspect) && ['aBody', 'bBody', 'aName', 'bName', 'name', 'angle'].every(key => aspect[key] === expected[index][key as keyof typeof expected[number]]) && ['separation', 'orb'].every(key => finite(aspect[key], 0, 180) && close(aspect[key], expected[index][key as 'separation' | 'orb'])))) throw new Error('synastry aspects')
  }
  if (!listOfText(value.conventions) || !listOfText(value.limitations) || !Array.isArray(value.sources) || value.sources.length !== 4 || !value.sources.every((source: any) => object(source) && text(source.title) && text(source.version) && text(source.license) && text(source.url, 1000) && /^https:\/\/[^\s]+$/.test(source.url))) throw new Error('references')
}

export function createWesternStudyRepository(storage: WesternStudyStorage, now = () => new Date(), makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`) {
  function list(): WesternStudyRecord[] {
    try {
      const raw = storage.getItem(WESTERN_STUDY_STORAGE_KEY)
      if (raw === '' || raw === null || raw === undefined) return []
      if (typeof raw !== 'string' || raw.length > MAX_LENGTH) throw new Error('size')
      const data = JSON.parse(raw)
      if (!object(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > MAX_WESTERN_STUDY_RECORDS) throw new Error('version')
      for (const record of data.records) {
        if (!object(record) || !text(record.id, 100) || !text(record.name, 40) || typeof record.note !== 'string' || record.note.length > 2000 || !iso(record.savedAt)) throw new Error('record')
        validateWesternStudySnapshot(record.snapshot)
      }
      if (new Set(data.records.map((record: WesternStudyRecord) => record.id)).size !== data.records.length) throw new Error('duplicate')
      return clone(data.records)
    } catch { throw new Error('星盘研究本机档案无法读取或格式异常，已停止写入以保留原数据') }
  }
  function write(records: WesternStudyRecord[]) {
    const serialized = JSON.stringify({ version: 1, records })
    if (serialized.length > MAX_LENGTH) throw new Error('星盘研究档案容量已满，请先导出并删除不需要的记录')
    try { storage.setItem(WESTERN_STUDY_STORAGE_KEY, serialized) } catch { throw new Error('本机保存失败，本次操作未确认成功；可先导出当前结果') }
  }
  return {
    list,
    save(name: string, note: string, snapshot: WesternStudySnapshot): WesternStudyRecord {
      const label = name.trim()
      if (!text(label, 40) || typeof note !== 'string' || note.length > 2000) throw new Error('名称需为1–40个字，笔记最多2000字')
      validateWesternStudySnapshot(snapshot)
      const records = list()
      if (records.length >= MAX_WESTERN_STUDY_RECORDS) throw new Error('最多保留20份星盘研究档案，请先导出并删除不需要的记录')
      const record = { id: makeId(), name: label, note, savedAt: now().toISOString(), snapshot: clone(snapshot) }
      if (!text(record.id, 100) || records.some(item => item.id === record.id) || !iso(record.savedAt)) throw new Error('档案编号或保存时间无效，请重试')
      write([record, ...records]); return clone(record)
    },
    remove(id: string) { const records = list().filter(record => record.id !== id); write(records); return records },
    exportJSON() { return { format: 'oasis-western-study-collection', formatVersion: 1, exportedAt: now().toISOString(), records: list() } },
  }
}
