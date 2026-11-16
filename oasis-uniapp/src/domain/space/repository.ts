import { isSpaceSnapshot, type SpaceSnapshot } from './index'

export const SPACE_STORAGE_KEY = '__oasis_space_records_v1'
export const SPACE_RECORD_LIMIT = 30
export interface SpaceRecord { id: string; savedAt: string; snapshot: SpaceSnapshot }
export interface SpaceStorage { get(key: string): unknown; set(key: string, value: unknown): void }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const validRecord = (value: unknown): value is SpaceRecord => object(value) && typeof value.id === 'string' && value.id.length > 0 && typeof value.savedAt === 'string' && value.savedAt.endsWith('Z') && Number.isFinite(Date.parse(value.savedAt)) && isSpaceSnapshot(value.snapshot)

/** Immutable snapshots in a dedicated key. Corrupt or unknown formats stop every write. */
export function createSpaceRepository(storage: SpaceStorage, now = () => new Date(), makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`) {
  function list(): SpaceRecord[] {
    let data: unknown
    try {
      data = storage.get(SPACE_STORAGE_KEY)
      if (data === undefined || data === null || data === '') return []
      if (typeof data === 'string') data = JSON.parse(data)
    } catch { throw new Error('无法读取空间档案，已停止写入；原有数据未改动，请重试读取') }
    if (!object(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > SPACE_RECORD_LIMIT || !data.records.every(validRecord) || new Set(data.records.map(record => record.id)).size !== data.records.length) {
      throw new Error('空间档案格式异常或版本不兼容，已停止写入以保留原数据')
    }
    return clone(data.records)
  }
  function write(records: SpaceRecord[]): void {
    try { storage.set(SPACE_STORAGE_KEY, { version: 1, records: clone(records) }) }
    catch { throw new Error('空间档案保存失败，请检查本机存储；本次操作未确认成功') }
  }
  return {
    list,
    save(snapshot: SpaceSnapshot): SpaceRecord {
      if (!isSpaceSnapshot(snapshot)) throw new Error('没有可保存的有效空间快照')
      const records = list()
      if (records.length >= SPACE_RECORD_LIMIT) throw new Error('本机最多保留 30 份空间档案，请先导出并自行删除不需要的记录')
      const instant = now()
      if (!Number.isFinite(instant.getTime())) throw new Error('当前时间不可用，请稍后重试')
      const id = makeId()
      if (!id || records.some(record => record.id === id)) throw new Error('空间档案编号冲突，请重试保存')
      const record = { id, savedAt: instant.toISOString(), snapshot: clone(snapshot) }
      write([record, ...records])
      return clone(record)
    },
    remove(id: string): SpaceRecord[] {
      const records = list()
      const remaining = records.filter(record => record.id !== id)
      if (remaining.length !== records.length) write(remaining)
      return clone(remaining)
    },
    exportAll() { return { format: 'oasis-space-records', formatVersion: 1, exportedAt: now().toISOString(), records: list() } },
  }
}

export function exportSpaceRecord(record: SpaceRecord, now = new Date()) {
  if (!validRecord(record)) throw new Error('没有可导出的有效空间档案')
  return { format: 'oasis-space-record', formatVersion: 1, exportedAt: now.toISOString(), record: clone(record) }
}
