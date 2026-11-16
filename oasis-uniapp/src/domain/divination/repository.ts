import { calculateDivination, validateDivinationInput, validateDivinationRuleVersion, type DivinationInput, type DivinationResult, type DivinationRuleVersion } from './index'

export const DIVINATION_STORAGE_KEY = 'oasis.divination.records.v1'
export const MAX_DIVINATION_RECORDS = 50
export interface DivinationRecord { id: string; savedAt: string; input: DivinationInput; ruleVersion: DivinationRuleVersion }
export interface RecordStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }

function parseRecords(raw: unknown): DivinationRecord[] {
  if (raw === '' || raw === undefined || raw === null) return []
  if (typeof raw !== 'string' || raw.length > 250000) throw new Error('本地问事记录格式异常，原始数据已保留。')
  try {
    const data = JSON.parse(raw)
    if (data?.schemaVersion !== 1 || !Array.isArray(data.records) || data.records.length > MAX_DIVINATION_RECORDS) throw new Error('schema')
    const ids = new Set<string>()
    return data.records.map((item: Record<string, unknown>) => {
      if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) || typeof item.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.savedAt) || !Number.isFinite(Date.parse(item.savedAt)) || new Date(item.savedAt).toISOString() !== item.savedAt) throw new Error('record')
      ids.add(item.id)
      const input = validateDivinationInput(item.input)
      const ruleVersion = validateDivinationRuleVersion(input.method, item.ruleVersion)
      return { id: item.id, savedAt: item.savedAt, input, ruleVersion }
    })
  } catch { throw new Error('本地问事记录无法读取，原始数据已保留；请勿清理应用数据。') }
}

export function createDivinationRepository(storage: RecordStorage) {
  function list(): DivinationRecord[] {
    let raw: unknown
    try { raw = storage.getItem(DIVINATION_STORAGE_KEY) } catch { throw new Error('无法读取本机存储，请检查浏览器或应用存储权限。') }
    return parseRecords(raw)
  }
  function write(records: DivinationRecord[]) {
    try { storage.setItem(DIVINATION_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records })) } catch { throw new Error('保存失败：本机存储不可用或空间不足，尚未写入此次更改。') }
  }
  return {
    list,
    save(result: DivinationResult, savedAt = new Date().toISOString()): DivinationRecord {
      const records = list()
      if (records.length >= MAX_DIVINATION_RECORDS) throw new Error('已保存 50 条记录，请先导出备份或删除不需要的记录。')
      if (!Number.isFinite(Date.parse(savedAt)) || new Date(savedAt).toISOString() !== savedAt) throw new Error('保存时间格式不正确。')
      const input = validateDivinationInput(result.input)
      const ruleVersion = validateDivinationRuleVersion(input.method, result.ruleVersion)
      const prefix = `question-${Date.parse(savedAt)}`
      let suffix = 1
      while (records.some(record => record.id === `${prefix}-${suffix}`)) suffix++
      const record: DivinationRecord = { id: `${prefix}-${suffix}`, savedAt, input, ruleVersion }
      write([record, ...records])
      return record
    },
    remove(id: string): void {
      const records = list()
      if (!records.some(record => record.id === id)) throw new Error('这条记录已不存在，请刷新记录列表。')
      write(records.filter(record => record.id !== id))
    },
    exportJSON(): string {
      return JSON.stringify({ schemaVersion: 1, kind: 'oasis-divination-records', records: list().map(record => ({ ...record, result: calculateDivination(record.input, record.ruleVersion) })) }, null, 2)
    },
  }
}
