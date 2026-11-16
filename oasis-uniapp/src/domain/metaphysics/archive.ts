import type { ExplorationResult } from './types'

export const CHART_ARCHIVE_KEY = '__xiaoyi_local_charts_v1'
export interface SavedChart { id: string; name: string; savedAt: string; result: ExplorationResult }
export interface ArchiveStorage { get(key: string): unknown; set(key: string, value: unknown): void }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const isObject = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const factList = (value: unknown) => Array.isArray(value) && value.every(f => isObject(f) && typeof f.label === 'string' && typeof f.value === 'string')
const validDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2099-12-31') return false
  const date = new Date(value + 'T12:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function validProfile(value: unknown): boolean {
  if (!isObject(value) || !validDate(value.date) || typeof value.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
    || !['男', '女'].includes(value.gender) || !Number.isFinite(value.utcOffset) || Math.abs(value.utcOffset) > 24) return false
  if (value.timeZone !== undefined && (typeof value.timeZone !== 'string' || value.timeZone.length > 100)) return false
  if (value.timeChoice !== undefined && !['earlier', 'later'].includes(value.timeChoice)) return false
  if (value.timePrecision !== undefined && !['minute', 'approximate'].includes(value.timePrecision)) return false
  return value.place === undefined || (isObject(value.place) && Number.isFinite(value.place.latitude) && Math.abs(value.place.latitude) <= 90
    && Number.isFinite(value.place.longitude) && Math.abs(value.place.longitude) <= 180 && (value.place.name === undefined || typeof value.place.name === 'string'))
}

function isResult(value: unknown): value is ExplorationResult {
  if (!isObject(value) || value.schemaVersion !== 1 || !validProfile(value.profile)) return false
  if (typeof value.utcTime !== 'string' || typeof value.chineseTime !== 'string' || !Array.isArray(value.charts) || value.charts.length !== 3) return false
  if (!Number.isFinite(new Date(value.utcTime).getTime()) || !value.utcTime.endsWith('Z')) return false
  if (value.options !== undefined && (!isObject(value.options) || (value.options.observationDate !== undefined && !validDate(value.options.observationDate))
    || (value.options.compareRules !== undefined && typeof value.options.compareRules !== 'boolean'))) return false
  if (value.timeResolution !== undefined && (!isObject(value.timeResolution) || !['manual', 'iana'].includes(value.timeResolution.mode) || !Number.isFinite(value.timeResolution.utcOffset)
    || value.timeResolution.utcOffset !== value.profile.utcOffset || (value.timeResolution.timeZone !== undefined && typeof value.timeResolution.timeZone !== 'string'))) return false
  if (new Set(value.charts.map(c => c?.id)).size !== 3) return false
  if (!value.charts.every(c => isObject(c) && ['bazi', 'ziwei', 'western'].includes(c.id) && ['ready', 'error'].includes(c.status)
    && typeof c.title === 'string' && factList(c.summary) && Array.isArray(c.sections) && c.sections.every((s: unknown) => isObject(s) && typeof s.title === 'string' && factList(s.facts))
    && Array.isArray(c.conventions) && c.conventions.every((s: unknown) => typeof s === 'string')
    && Array.isArray(c.limitations) && c.limitations.every((s: unknown) => typeof s === 'string')
    && (c.ruleProfile === undefined || (isObject(c.ruleProfile) && typeof c.ruleProfile.id === 'string' && typeof c.ruleProfile.version === 'string'
      && Array.isArray(c.ruleProfile.comparisonIds) && c.ruleProfile.comparisonIds.every((id: unknown) => typeof id === 'string')))
    && isObject(c.source) && ['title', 'url', 'version', 'license'].every(k => typeof c.source[k] === 'string'))) return false
  return Array.isArray(value.comparison) && value.comparison.every(row => isObject(row) && ['theme', 'bazi', 'ziwei', 'western', 'note'].every(k => typeof row[k] === 'string'))
    && Array.isArray(value.notices) && value.notices.every(s => typeof s === 'string')
}

/** Stores immutable result snapshots. Reading never recalculates or changes existing data. */
export function createChartArchive(storage: ArchiveStorage, now = () => new Date(), makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`) {
  function list(): SavedChart[] {
    let data: unknown
    try {
      data = storage.get(CHART_ARCHIVE_KEY)
      if (data === '' || data === null || data === undefined) return []
      if (typeof data === 'string') data = JSON.parse(data)
    } catch { throw new Error('无法读取本机档案，原有数据未改动') }
    if (!isObject(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 30
      || !data.records.every(r => isObject(r) && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.savedAt === 'string' && isResult(r.result))
      || new Set(data.records.map(r => r.id)).size !== data.records.length) throw new Error('本机档案格式异常，已停止写入以保留原数据')
    return clone(data.records)
  }
  function write(records: SavedChart[]) {
    try { storage.set(CHART_ARCHIVE_KEY, { version: 1, records: clone(records) }) }
    catch { throw new Error('保存失败，请检查本机存储空间；本次操作未确认成功') }
  }
  return {
    list,
    save(name: string, result: ExplorationResult): SavedChart {
      const label = name.trim()
      if (!label || label.length > 40) throw new Error('档案名称需为 1–40 个字')
      if (!isResult(result) || !result.charts.some(c => c.status === 'ready')) throw new Error('请先完成至少一个体系的排盘再保存')
      const records = list()
      if (records.length >= 30) throw new Error('本机最多保留 30 份档案，请先导出并自行删除不需要的记录')
      const record: SavedChart = { id: makeId(), name: label, savedAt: now().toISOString(), result: clone(result) }
      if (records.some(r => r.id === record.id)) throw new Error('档案编号冲突，请重试保存')
      write([record, ...records])
      return clone(record)
    },
    remove(id: string): SavedChart[] {
      const remaining = list().filter(record => record.id !== id)
      write(remaining)
      return remaining
    },
  }
}

export function chartExport(result: ExplorationResult, name = '三盘同参', savedAt?: string) {
  if (!isResult(result)) throw new Error('没有可导出的有效排盘')
  return { format: 'xiaoyi-chart', formatVersion: 1, name, exportedAt: new Date().toISOString(), ...(savedAt ? { savedAt } : {}), result: clone(result) }
}
