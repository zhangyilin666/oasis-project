/** A bounded store for independent, immutable cultural-record snapshots. */
export interface SnapshotStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }
export interface SnapshotRecord<T> { id: string; savedAt: string; snapshot: T }
export interface SnapshotStoreOptions<T> {
  key: string; kind: string; title: string; maxRecords: number
  validate: (value: unknown) => value is T
  maxBytes?: number
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
function validIso(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

export function createSnapshotStore<T>(storage: SnapshotStorage, options: SnapshotStoreOptions<T>) {
  const limit = options.maxBytes ?? 1_000_000
  function list(): SnapshotRecord<T>[] {
    let raw: unknown
    try { raw = storage.getItem(options.key) } catch { throw new Error(`无法读取${options.title}，请检查本机存储权限。`) }
    if (raw === undefined || raw === null || raw === '') return []
    try {
      if (typeof raw !== 'string' || raw.length > limit) throw new Error('size')
      const data = JSON.parse(raw)
      if (!object(data) || data.schemaVersion !== 1 || data.kind !== options.kind || !Array.isArray(data.records) || data.records.length > options.maxRecords) throw new Error('schema')
      const ids = new Set<string>()
      return data.records.map((record: unknown) => {
        if (!object(record) || typeof record.id !== 'string' || !record.id || record.id.length > 100 || ids.has(record.id) || !validIso(record.savedAt) || !options.validate(record.snapshot)) throw new Error('record')
        ids.add(record.id)
        return { id: record.id, savedAt: record.savedAt, snapshot: record.snapshot }
      })
    } catch { throw new Error(`${options.title}格式异常或版本不兼容，原始数据已保留，已停止写入。`) }
  }
  function write(records: SnapshotRecord<T>[]) {
    const serialized = JSON.stringify({ schemaVersion: 1, kind: options.kind, records })
    if (serialized.length > limit) throw new Error(`${options.title}超出本机记录大小限制，请先导出并整理。`)
    try { storage.setItem(options.key, serialized) } catch { throw new Error(`保存${options.title}失败，请检查存储权限或剩余空间；本次更改未确认成功。`) }
  }
  return {
    list,
    save(snapshot: T, savedAt = new Date().toISOString()): SnapshotRecord<T> {
      const records = list()
      if (!options.validate(snapshot)) throw new Error('记录内容不完整或版本不支持，未保存。')
      if (!validIso(savedAt)) throw new Error('保存时间格式不正确。')
      if (records.length >= options.maxRecords) throw new Error(`最多保存 ${options.maxRecords} 条${options.title}，请先导出或删除不需要的记录。`)
      const prefix = `${options.kind}-${Date.parse(savedAt)}`
      let suffix = 1
      while (records.some(record => record.id === `${prefix}-${suffix}`)) suffix++
      const record = { id: `${prefix}-${suffix}`, savedAt, snapshot: clone(snapshot) }
      write([record, ...records])
      return clone(record)
    },
    remove(id: string) {
      const records = list()
      if (!records.some(record => record.id === id)) throw new Error('这条记录已不存在，请刷新后重试。')
      write(records.filter(record => record.id !== id))
    },
    exportJSON() { return JSON.stringify({ schemaVersion: 1, kind: options.kind, records: list() }, null, 2) },
  }
}
