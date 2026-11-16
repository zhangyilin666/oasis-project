import { QIZHENG_NAMES, QIZHENG_RULE_VERSION, type QizhengSnapshot } from './index'

export const QIZHENG_STORAGE_KEY = 'oasis.qizheng.reference-snapshots.v1'
export const MAX_QIZHENG_RECORDS = 20
export interface QizhengRecord { id: string; name: string; note: string; savedAt: string; snapshot: QizhengSnapshot }
export interface QizhengStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }
const MAX_LENGTH = 500000
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 500): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const listOfText = (value: unknown) => Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(item => text(item))
function iso(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
function date(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2099-12-31' }

/** Read stored coordinates, never recompute the historical snapshot. */
export function validateQizhengSnapshot(value: unknown): asserts value is QizhengSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== QIZHENG_RULE_VERSION || value.scope !== 'seven-governors-astronomical-reference' || !iso(value.utcTime)) throw new Error('snapshot')
  const m = value.moment
  if (!object(m) || !date(m.date) || typeof m.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time) || !finite(m.utcOffset, -24, 24) || !['minute', 'approximate'].includes(m.timePrecision) || (m.timeZone !== undefined && !text(m.timeZone, 100)) || (m.timeChoice !== undefined && !['earlier', 'later'].includes(m.timeChoice))) throw new Error('moment')
  if (new Date(Date.parse(value.utcTime) + m.utcOffset * 3600000).toISOString().slice(0, 16) !== `${m.date}T${m.time}`) throw new Error('instant')
  if (!object(value.timeResolution) || value.timeResolution.mode !== (m.timeZone ? 'iana' : 'manual') || value.timeResolution.utcOffset !== m.utcOffset || (m.timeZone && value.timeResolution.timeZone !== m.timeZone)) throw new Error('time resolution')
  if (!object(value.engine) || value.engine.name !== 'astronomy-engine' || value.engine.version !== '2.1.19' || value.engine.license !== 'MIT') throw new Error('engine')
  const c = value.coordinates
  if (!object(c) || c.center !== 'geocentric' || c.ecliptic !== 'true-ecliptic-of-date' || c.equatorial !== 'true-equator-of-date' || c.equinox !== 'true-equinox-of-date' || c.angleUnit !== 'modern-degree' || c.circleDegrees !== 360 || c.rightAscensionHoursPerCircle !== 24) throw new Error('coordinates')
  if (!Array.isArray(value.positions) || value.positions.length !== 7 || !value.positions.every((p: any, index: number) => object(p) && p.body === QIZHENG_NAMES[index].body && p.name === QIZHENG_NAMES[index].name && p.modernName === QIZHENG_NAMES[index].modernName && finite(p.longitude, 0, 360) && p.longitude < 360 && finite(p.latitude, -90, 90) && finite(p.rightAscensionHours, 0, 24) && p.rightAscensionHours < 24 && finite(p.rightAscensionDegrees, 0, 360) && p.rightAscensionDegrees < 360 && Math.abs(p.rightAscensionHours * 15 - p.rightAscensionDegrees) < 1e-9 && finite(p.declination, -90, 90) && finite(p.northPolarDistance, 0, 180) && Math.abs(90 - p.declination - p.northPolarDistance) < 1e-9)) throw new Error('positions')
  const ids = ['luohou', 'jidu', 'yuebei', 'ziqi', 'xiudu', 'minggong']
  if (!Array.isArray(value.unavailable) || value.unavailable.length !== 6 || !value.unavailable.every((item: any, index: number) => object(item) && item.id === ids[index] && item.status === 'unavailable' && text(item.name, 50) && text(item.description) && text(item.reason))) throw new Error('scope')
  if (!listOfText(value.conventions) || !listOfText(value.limitations) || !Array.isArray(value.sources) || value.sources.length !== 6 || !value.sources.every((source: any) => object(source) && text(source.id, 50) && text(source.title) && text(source.version) && text(source.license) && text(source.url, 1000) && /^https:\/\/[^\s]+$/.test(source.url))) throw new Error('references')
}

export function createQizhengRepository(storage: QizhengStorage, now = () => new Date(), makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`) {
  function list(): QizhengRecord[] {
    try {
      const raw = storage.getItem(QIZHENG_STORAGE_KEY)
      if (raw === '' || raw === null || raw === undefined) return []
      if (typeof raw !== 'string' || raw.length > MAX_LENGTH) throw new Error('size')
      const data = JSON.parse(raw)
      if (!object(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > MAX_QIZHENG_RECORDS) throw new Error('version')
      for (const record of data.records) {
        if (!object(record) || !text(record.id, 100) || !text(record.name, 40) || typeof record.note !== 'string' || record.note.length > 2000 || !iso(record.savedAt)) throw new Error('record')
        validateQizhengSnapshot(record.snapshot)
      }
      if (new Set(data.records.map((record: QizhengRecord) => record.id)).size !== data.records.length) throw new Error('duplicate')
      return clone(data.records)
    } catch { throw new Error('七政本机记录无法读取或格式异常，已停止写入以保留原数据') }
  }
  function write(records: QizhengRecord[]) {
    const serialized = JSON.stringify({ version: 1, records })
    if (serialized.length > MAX_LENGTH) throw new Error('七政档案容量已满，请先导出并删除不需要的记录')
    try { storage.setItem(QIZHENG_STORAGE_KEY, serialized) } catch { throw new Error('本机保存失败，本次操作未确认成功；可先导出当前结果') }
  }
  return {
    list,
    save(name: string, note: string, snapshot: QizhengSnapshot): QizhengRecord {
      const label = name.trim()
      if (!text(label, 40) || typeof note !== 'string' || note.length > 2000) throw new Error('名称需为1–40个字，笔记最多2000字')
      validateQizhengSnapshot(snapshot)
      const records = list()
      if (records.length >= MAX_QIZHENG_RECORDS) throw new Error('最多保存20份七政天文对照，请先导出并删除不需要的记录')
      const record = { id: makeId(), name: label, note, savedAt: now().toISOString(), snapshot: clone(snapshot) }
      if (!text(record.id, 100) || records.some(item => item.id === record.id) || !iso(record.savedAt)) throw new Error('档案编号或保存时间无效，请重试')
      write([record, ...records]); return clone(record)
    },
    remove(id: string) { const records = list().filter(record => record.id !== id); write(records); return records },
    exportJSON() { return { format: 'oasis-qizheng-reference-collection', formatVersion: 1, exportedAt: now().toISOString(), records: list() } },
  }
}
