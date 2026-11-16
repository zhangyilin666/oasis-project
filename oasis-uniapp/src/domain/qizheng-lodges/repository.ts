import { LODGE_MAX_YEAR, LODGE_MIN_YEAR, QIZHENG_LODGES_RULE_VERSION, type QizhengLodgesSnapshot } from './index'
import { CIRCLE_ARCSECONDS, LODGE_ANNUAL_SHIFT_ARCSECONDS, LODGE_BASE_TABLE, LODGE_BASE_YEAR, LODGE_TABLE_VERSION } from './table'

export const QIZHENG_LODGES_STORAGE_KEY = 'oasis.qizheng-lodges.snapshots.v1'
export const MAX_QIZHENG_LODGES_RECORDS = 20
export interface QizhengLodgesRecord { id: string; name: string; note: string; savedAt: string; snapshot: QizhengLodgesSnapshot }
export interface QizhengLodgesStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }
const MAX_LENGTH = 750000
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 500): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
const wrap = (value: number) => ((value % CIRCLE_ARCSECONDS) + CIRCLE_ARCSECONDS) % CIRCLE_ARCSECONDS
const textList = (value: unknown, length: number) => Array.isArray(value) && value.length === length && value.every(line => text(line))
function iso(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }

/** Checks the saved integer geometry and versioned table; never replaces a saved result. */
export function validateQizhengLodgesSnapshot(value: unknown): asserts value is QizhengLodgesSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== QIZHENG_LODGES_RULE_VERSION || value.scope !== 'historical-ecliptic-lodge-table-lookup') throw new Error('version')
  const input = value.input, rules = value.rules
  if (!object(input) || !text(input.label, 30) || !integer(input.yearLabel, LODGE_MIN_YEAR, LODGE_MAX_YEAR) || !integer(input.palace, 0, 11) || !integer(input.degree, 0, 29) || !integer(input.minute, 0, 59) || !integer(input.second, 0, 59)) throw new Error('input')
  if (!object(rules) || rules.tableVersion !== LODGE_TABLE_VERSION || rules.epochYearLabel !== LODGE_BASE_YEAR || rules.epochName !== '康熙二十三年甲子' || rules.yearKind !== 'explicit-historical-year-label' || rules.origin !== 'winter-solstice' || rules.originInModernLongitude !== 270 || rules.circleDegrees !== 360 || rules.palaceDegrees !== 30 || rules.angleBase !== 60 || rules.annualShiftArcseconds !== LODGE_ANNUAL_SHIFT_ARCSECONDS || rules.interval !== 'start-inclusive-end-exclusive') throw new Error('rules')
  const years = input.yearLabel - LODGE_BASE_YEAR, shift = years * LODGE_ANNUAL_SHIFT_ARCSECONDS
  const angle = (input.palace * 30 + input.degree) * 3600 + input.minute * 60 + input.second
  if (value.yearsFromEpoch !== years || value.shiftArcseconds !== shift || value.angleArcseconds !== angle || value.vernalOriginArcseconds !== wrap(angle + 270 * 3600)) throw new Error('angle')
  if (!Array.isArray(value.table) || value.table.length !== 28) throw new Error('table')
  value.table.forEach((row: unknown, index: number) => {
    const base = LODGE_BASE_TABLE[index], next = LODGE_BASE_TABLE[(index + 1) % 28]
    if (!object(row) || row.name !== base.name || row.referenceStar !== base.referenceStar || row.sourceFigure !== base.figure || row.baseStartArcseconds !== base.startArcseconds || row.startArcseconds !== wrap(base.startArcseconds + shift) || row.endArcseconds !== wrap(next.startArcseconds + shift) || row.widthArcseconds !== wrap(next.startArcseconds - base.startArcseconds) || row.nextMansion !== next.name) throw new Error('table row')
  })
  const selected = value.table.find((row: any) => wrap(angle - row.startArcseconds) < row.widthArcseconds)
  const result = value.result
  if (!selected || !object(result) || result.mansion !== selected.name || result.referenceStar !== selected.referenceStar || result.nextMansion !== selected.nextMansion || result.startArcseconds !== selected.startArcseconds || result.endArcseconds !== selected.endArcseconds || result.widthArcseconds !== selected.widthArcseconds || result.withinArcseconds !== wrap(angle - selected.startArcseconds) || result.remainingArcseconds !== selected.widthArcseconds - result.withinArcseconds || result.atBoundary !== (result.withinArcseconds === 0)) throw new Error('result')
  if (!textList(value.conventions, 6) || !textList(value.limitations, 4) || !Array.isArray(value.sources) || value.sources.length !== 4 || !value.sources.every((source: any) => object(source) && text(source.id, 20) && text(source.title) && text(source.version) && text(source.license) && text(source.url, 1000) && /^https:\/\/[^\s]+$/.test(source.url))) throw new Error('references')
}

export function createQizhengLodgesRepository(storage: QizhengLodgesStorage, now = () => new Date(), makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`) {
  function list(): QizhengLodgesRecord[] {
    try {
      const raw = storage.getItem(QIZHENG_LODGES_STORAGE_KEY)
      if (raw === '' || raw === null || raw === undefined) return []
      if (typeof raw !== 'string' || raw.length > MAX_LENGTH) throw new Error('size')
      const data = JSON.parse(raw)
      if (!object(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > MAX_QIZHENG_LODGES_RECORDS) throw new Error('collection')
      for (const record of data.records) {
        if (!object(record) || !text(record.id, 100) || !text(record.name, 40) || typeof record.note !== 'string' || record.note.length > 2000 || !iso(record.savedAt)) throw new Error('record')
        validateQizhengLodgesSnapshot(record.snapshot)
      }
      if (new Set(data.records.map((record: QizhengLodgesRecord) => record.id)).size !== data.records.length) throw new Error('duplicate')
      return clone(data.records)
    } catch { throw new Error('清历宿度本机档案无法读取或格式异常，已停止写入以保留原数据') }
  }
  function write(records: QizhengLodgesRecord[]) {
    const serialized = JSON.stringify({ version: 1, records })
    if (serialized.length > MAX_LENGTH) throw new Error('清历宿度档案容量已满，请先导出并删除不需要的记录')
    try { storage.setItem(QIZHENG_LODGES_STORAGE_KEY, serialized) } catch { throw new Error('本机保存失败，本次操作未确认成功；可先导出当前结果') }
  }
  return {
    list,
    save(name: string, note: string, snapshot: QizhengLodgesSnapshot): QizhengLodgesRecord {
      if (typeof name !== 'string' || !text(name.trim(), 40) || typeof note !== 'string' || note.length > 2000) throw new Error('名称需为1–40个字，笔记最多2000字')
      validateQizhengLodgesSnapshot(snapshot)
      const records = list()
      if (records.length >= MAX_QIZHENG_LODGES_RECORDS) throw new Error('最多保留20份清历宿度档案，请先导出并删除不需要的记录')
      const record = { id: makeId(), name: name.trim(), note, savedAt: now().toISOString(), snapshot: clone(snapshot) }
      if (!text(record.id, 100) || records.some(item => item.id === record.id) || !iso(record.savedAt)) throw new Error('档案编号或保存时间无效，请重试')
      write([record, ...records]); return clone(record)
    },
    remove(id: string) { const records = list().filter(record => record.id !== id); write(records); return records },
    exportJSON() { return { format: 'oasis-qizheng-lodges-collection', formatVersion: 1, exportedAt: now().toISOString(), records: list() } },
  }
}
