import { validateTarotSnapshot, type TarotSnapshot } from './index'

export const TAROT_STORAGE_KEY = 'oasis.tarot.records.v1'
export const MAX_TAROT_RECORDS = 50
export interface TarotRecord { id: string; savedAt: string; snapshot: TarotSnapshot }
export interface TarotStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function parseRecords(raw: unknown): TarotRecord[] {
  if (raw === '' || raw === undefined || raw === null) return []
  if (typeof raw !== 'string' || raw.length > 1_000_000) throw new Error('本机塔罗记录格式异常，原始数据已保留。')
  try {
    const data = JSON.parse(raw)
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.records) || data.records.length > MAX_TAROT_RECORDS) throw new Error('schema')
    const ids = new Set<string>()
    return data.records.map((record: Record<string, unknown>) => {
      if (!record || typeof record.id !== 'string' || !record.id || record.id.length > 100 || ids.has(record.id) || !validTimestamp(record.savedAt)) throw new Error('record')
      ids.add(record.id)
      return { id: record.id, savedAt: record.savedAt, snapshot: validateTarotSnapshot(record.snapshot) }
    })
  } catch { throw new Error('本机塔罗记录无法读取，原始数据已保留；请勿清理应用数据。') }
}

export function createTarotRepository(storage: TarotStorage) {
  function list(): TarotRecord[] {
    let raw: unknown
    try { raw = storage.getItem(TAROT_STORAGE_KEY) } catch { throw new Error('无法读取本机塔罗记录，请检查存储权限后重试。') }
    return parseRecords(raw)
  }
  function write(records: TarotRecord[]) {
    try { storage.setItem(TAROT_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records })) }
    catch { throw new Error('保存失败：本机存储不可用或空间不足，尚未写入此次更改。') }
  }
  return {
    list,
    save(value: unknown, savedAt = new Date().toISOString()): TarotRecord {
      const records = list()
      if (records.length >= MAX_TAROT_RECORDS) throw new Error('已保存 50 条塔罗记录，请先导出或删除不需要的记录。')
      if (!validTimestamp(savedAt)) throw new Error('保存时间格式不正确。')
      const snapshot = validateTarotSnapshot(value)
      const prefix = `tarot-${Date.parse(savedAt)}`
      let suffix = 1
      while (records.some(record => record.id === `${prefix}-${suffix}`)) suffix++
      const record: TarotRecord = { id: `${prefix}-${suffix}`, savedAt, snapshot }
      write([record, ...records])
      return record
    },
    remove(id: string): void {
      const records = list()
      if (!records.some(record => record.id === id)) throw new Error('这条塔罗记录已不存在，请刷新记录列表。')
      write(records.filter(record => record.id !== id))
    },
    exportJSON(): string {
      return JSON.stringify({ schemaVersion: 1, kind: 'oasis-tarot-records', records: list() }, null, 2)
    },
  }
}
