import { ALMANAC_MAX_DATE, ALMANAC_MIN_DATE, ALMANAC_RULE_VERSION, type AlmanacResult } from './index'

export const ALMANAC_STORAGE_KEY = 'oasis.almanac.snapshots.v1'
export const MAX_ALMANAC_RECORDS = 20
export interface AlmanacRecord { id: string; savedAt: string; result: AlmanacResult }
export interface AlmanacStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }
const MAX_STORAGE_LENGTH = 300000

function object(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown, max = 200): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max }
function strings(value: unknown, maxItems = 50, maxLength = 300): value is string[] { return Array.isArray(value) && value.length <= maxItems && value.every(item => text(item, maxLength)) }
function integer(value: unknown, min: number, max: number): boolean { return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max }
function iso(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value
}
function url(value: unknown): boolean { return text(value, 1000) && /^https:\/\/[^\s]+$/.test(value) }
function term(value: unknown): boolean {
  if (!object(value) || !text(value.name, 10) || !['节', '中气'].includes(value.kind) || typeof value.beijingTime !== 'string' || !/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value.beijingTime) || !date(value.beijingTime.slice(0, 10)) || !iso(value.utcTime)) return false
  return new Date(Date.parse(value.utcTime) + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') === value.beijingTime
}

/** Validate stored shape and internal timestamps without recalculating historical facts. */
function validateResult(value: unknown): asserts value is AlmanacResult {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== ALMANAC_RULE_VERSION) throw new Error('snapshot version')
  if (!object(value.engine) || value.engine.name !== 'lunar-typescript' || !text(value.engine.version, 30) || value.engine.license !== 'MIT') throw new Error('engine')
  if (!object(value.input) || !date(value.input.date) || value.input.date < ALMANAC_MIN_DATE || value.input.date > ALMANAC_MAX_DATE || typeof value.input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.input.time)) throw new Error('input')
  if (!object(value.observation) || value.observation.timeZone !== 'UTC+08:00' || value.observation.utcOffset !== 8 || !iso(value.observation.utcTime) || !text(value.observation.weekday, 10)) throw new Error('observation')
  if (new Date(Date.parse(value.observation.utcTime) + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ') !== `${value.input.date} ${value.input.time}`) throw new Error('input instant')
  if (!object(value.lunar) || !integer(value.lunar.year, 1899, 2099) || !integer(value.lunar.month, 1, 12) || !integer(value.lunar.day, 1, 30) || typeof value.lunar.isLeapMonth !== 'boolean' || !text(value.lunar.label, 100) || !text(value.lunar.animal, 10)) throw new Error('lunar')
  if (!object(value.ganzhi) || !['lunarYear', 'solarTermYear', 'solarTermMonth', 'day'].every(key => text(value.ganzhi[key], 10))) throw new Error('ganzhi')
  if (!object(value.solarTerms) || !term(value.solarTerms.previous) || !term(value.solarTerms.next) || value.solarTerms.current !== value.solarTerms.previous.name || !text(value.solarTerms.precisionNote, 300)) throw new Error('solar terms')
  if (!(value.solarTerms.previous.utcTime <= value.observation.utcTime && value.observation.utcTime < value.solarTerms.next.utcTime)) throw new Error('term interval')
  if (!object(value.traditional) || !strings(value.traditional.yi) || !strings(value.traditional.ji) || !text(value.traditional.monthGanZhi, 10) || !text(value.traditional.convention, 500) || !url(value.traditional.sourceUrl)) throw new Error('traditional')
  if (!strings(value.conventions, 20, 500) || !Array.isArray(value.sources) || value.sources.length > 20 || !value.sources.every((source: unknown) => object(source) && text(source.title) && url(source.url) && ['reference', 'calculation', 'traditional'].includes(source.role))) throw new Error('sources')
}

function parseRecords(raw: unknown): AlmanacRecord[] {
  if (raw === '' || raw === null || raw === undefined) return []
  if (typeof raw !== 'string' || raw.length > MAX_STORAGE_LENGTH) throw new Error('本机黄历收藏格式异常，原始数据已保留。')
  try {
    const payload = JSON.parse(raw)
    if (!object(payload) || payload.schemaVersion !== 1 || !Array.isArray(payload.records) || payload.records.length > MAX_ALMANAC_RECORDS) throw new Error('schema')
    const ids = new Set<string>()
    return payload.records.map((record: unknown) => {
      if (!object(record) || !text(record.id, 100) || ids.has(record.id) || !iso(record.savedAt)) throw new Error('record')
      validateResult(record.result)
      ids.add(record.id)
      return { id: record.id, savedAt: record.savedAt, result: record.result }
    })
  } catch { throw new Error('本机黄历收藏损坏或版本不兼容，原始数据已保留，未覆盖。请保留浏览器或应用数据。') }
}

export function createAlmanacRepository(storage: AlmanacStorage) {
  function list(): AlmanacRecord[] {
    let raw: unknown
    try { raw = storage.getItem(ALMANAC_STORAGE_KEY) } catch { throw new Error('无法读取本机黄历收藏，请检查浏览器或应用存储权限。') }
    return parseRecords(raw)
  }
  function write(records: AlmanacRecord[]) {
    const serialized = JSON.stringify({ schemaVersion: 1, records })
    if (serialized.length > MAX_STORAGE_LENGTH) throw new Error('黄历收藏大小超过限制，请先导出或删除部分记录。')
    try { storage.setItem(ALMANAC_STORAGE_KEY, serialized) } catch { throw new Error('黄历收藏保存失败：本机存储不可用或空间不足，尚未写入此次更改。') }
  }
  return {
    list,
    save(result: AlmanacResult, savedAt = new Date().toISOString()): AlmanacRecord {
      const records = list()
      if (records.length >= MAX_ALMANAC_RECORDS) throw new Error('已收藏 20 条日期快照，请先导出备份或删除不需要的记录。')
      if (!iso(savedAt)) throw new Error('保存时间格式不正确。')
      try { validateResult(result) } catch { throw new Error('这份黄历快照不完整或版本不兼容，未保存。') }
      const prefix = `almanac-${Date.parse(savedAt)}`
      let suffix = 1
      while (records.some(record => record.id === `${prefix}-${suffix}`)) suffix++
      const record: AlmanacRecord = { id: `${prefix}-${suffix}`, savedAt, result: JSON.parse(JSON.stringify(result)) }
      write([record, ...records])
      return record
    },
    remove(id: string): void {
      const records = list()
      if (!records.some(record => record.id === id)) throw new Error('这条收藏已不存在，请刷新收藏列表。')
      write(records.filter(record => record.id !== id))
    },
    exportJSON(): string { return JSON.stringify({ schemaVersion: 1, kind: 'oasis-almanac-snapshots', records: list() }, null, 2) },
  }
}
