import { isQimenSnapshot, type QimenSnapshot } from './index'

export const QIMEN_STORAGE_KEY = '__oasis_qimen_records_v1'
export const QIMEN_RECORD_LIMIT = 30
export interface QimenRecord { id: string; savedAt: string; snapshot: QimenSnapshot }
export interface QimenStorage { get(key: string): unknown; set(key: string, value: unknown): void }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const validRecord = (value: unknown): value is QimenRecord => object(value) && typeof value.id === 'string' && value.id.length > 0 && typeof value.savedAt === 'string' && value.savedAt.endsWith('Z') && Number.isFinite(Date.parse(value.savedAt)) && isQimenSnapshot(value.snapshot)

export function createQimenRepository(storage: QimenStorage, now = () => new Date(), makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`) {
  function list(): QimenRecord[] {
    let data: unknown
    try { data = storage.get(QIMEN_STORAGE_KEY); if (data === undefined || data === null || data === '') return []; if (typeof data === 'string') data = JSON.parse(data) }
    catch { throw new Error('无法读取奇门档案，已停止写入；原有数据未改动，请重试读取') }
    if (!object(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > QIMEN_RECORD_LIMIT || !data.records.every(validRecord) || new Set(data.records.map(record => record.id)).size !== data.records.length) throw new Error('奇门档案格式异常或版本不兼容，已停止写入以保留原数据')
    return clone(data.records)
  }
  function write(records: QimenRecord[]) {
    try { storage.set(QIMEN_STORAGE_KEY, { version: 1, records: clone(records) }) }
    catch { throw new Error('奇门档案保存失败，请检查本机存储；本次操作未确认成功') }
  }
  return {
    list,
    save(snapshot: QimenSnapshot): QimenRecord {
      if (!isQimenSnapshot(snapshot)) throw new Error('没有可保存的有效奇门盘快照')
      const records = list()
      if (records.length >= QIMEN_RECORD_LIMIT) throw new Error('本机最多保留 30 份奇门档案，请先导出并自行删除不需要的记录')
      const instant = now()
      if (!Number.isFinite(instant.getTime())) throw new Error('当前时间不可用，请重试')
      const id = makeId()
      if (!id || records.some(record => record.id === id)) throw new Error('奇门档案编号冲突，请重试保存')
      const record = { id, savedAt: instant.toISOString(), snapshot: clone(snapshot) }
      write([record, ...records]); return clone(record)
    },
    remove(id: string): QimenRecord[] { const records = list(), remaining = records.filter(record => record.id !== id); if (records.length !== remaining.length) write(remaining); return clone(remaining) },
    exportAll() { return { format: 'oasis-qimen-records', formatVersion: 1, exportedAt: now().toISOString(), records: list() } },
  }
}

export function exportQimenRecord(record: QimenRecord, now = new Date()) {
  if (!validRecord(record)) throw new Error('没有可导出的有效奇门档案')
  return { format: 'oasis-qimen-record', formatVersion: 1, exportedAt: now.toISOString(), record: clone(record) }
}
