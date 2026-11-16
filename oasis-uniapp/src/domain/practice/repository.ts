import { MAX_PRACTICE_NOTE_LENGTH, PRACTICE_RULE_VERSION, practiceNote, type PracticeDraft } from './index'

export const PRACTICE_STORAGE_KEY = 'oasis.practice.sessions.v1'
export const MAX_PRACTICE_RECORDS = 50
export interface PracticeRecord { id: string; savedAt: number; snapshot: PracticeDraft }
export interface PracticeState { schemaVersion: 1; active: PracticeDraft | null; records: PracticeRecord[] }
export interface PracticeStorage { getItem(key: string): unknown; setItem(key: string, value: string): void }
const MAX_STORAGE_LENGTH = 400000
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
function object(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max }
function time(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000 }

/** Historical notes and guidance are restored verbatim; they are never replaced by current topic text. */
function validateDraft(value: unknown): asserts value is PracticeDraft {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== PRACTICE_RULE_VERSION || !text(value.id, 100)) throw new Error('version')
  if (!object(value.topic) || !['quiet-seat', 'notice-sounds', 'gather-thoughts'].includes(value.topic.id) || !text(value.topic.title, 100) || !text(value.topic.introduction, 300) || !Array.isArray(value.topic.guidance) || value.topic.guidance.length < 1 || value.topic.guidance.length > 10 || !value.topic.guidance.every((item: unknown) => text(item, 500))) throw new Error('topic')
  if (!Number.isInteger(value.durationMinutes) || value.durationMinutes < 1 || value.durationMinutes > 60 || !['running', 'paused', 'completed'].includes(value.status)) throw new Error('duration/status')
  if (!time(value.startedAt) || !time(value.lastObservedAt) || !Number.isSafeInteger(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > value.durationMinutes * 60000) throw new Error('time')
  if (typeof value.note !== 'string' || value.note.length > MAX_PRACTICE_NOTE_LENGTH || !Number.isSafeInteger(value.clockRollbackCount) || value.clockRollbackCount < 0) throw new Error('note/clock')
  if (value.clockRollbackCount === 0 ? value.lastClockRollbackAt !== null : !time(value.lastClockRollbackAt)) throw new Error('rollback')
  if (value.status === 'running') {
    if (!time(value.anchorAt) || value.anchorAt !== value.lastObservedAt || value.elapsedMs >= value.durationMinutes * 60000) throw new Error('anchor')
  } else if (value.anchorAt !== null) throw new Error('inactive anchor')
  if (value.status === 'completed') {
    if (!time(value.completedAt) || !['elapsed', 'early'].includes(value.completionReason) || value.completedAt > value.lastObservedAt || (value.completionReason === 'elapsed' && value.elapsedMs !== value.durationMinutes * 60000)) throw new Error('completion')
  } else if (value.completedAt !== null || value.completionReason !== null || value.elapsedMs >= value.durationMinutes * 60000) throw new Error('unfinished')
}

function parseState(raw: unknown): PracticeState {
  if (raw === '' || raw === undefined || raw === null) return { schemaVersion: 1, active: null, records: [] }
  if (typeof raw !== 'string' || raw.length > MAX_STORAGE_LENGTH) throw new Error('本机练习数据格式异常，原始数据已保留。')
  try {
    const value = JSON.parse(raw)
    if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.records) || value.records.length > MAX_PRACTICE_RECORDS) throw new Error('schema')
    const ids = new Set<string>()
    for (const record of value.records) {
      if (!object(record) || !text(record.id, 100) || ids.has(record.id) || !time(record.savedAt)) throw new Error('record')
      validateDraft(record.snapshot)
      if (record.snapshot.id !== record.id || record.snapshot.status !== 'completed') throw new Error('record snapshot')
      ids.add(record.id)
    }
    if (value.active !== null) { validateDraft(value.active); if (ids.has(value.active.id)) throw new Error('duplicate active') }
    return value as unknown as PracticeState
  } catch { throw new Error('本机练习数据损坏或版本不兼容，原始数据已保留，未覆盖。请保留浏览器或应用数据。') }
}

export function createPracticeRepository(storage: PracticeStorage) {
  function load(): PracticeState {
    let raw: unknown
    try { raw = storage.getItem(PRACTICE_STORAGE_KEY) } catch { throw new Error('无法读取本机练习数据，请检查浏览器或应用存储权限。') }
    return parseState(raw)
  }
  function write(value: PracticeState) {
    const serialized = JSON.stringify(value)
    if (serialized.length > MAX_STORAGE_LENGTH) throw new Error('练习记录大小超过限制，请先导出备份或删除部分记录。')
    try { storage.setItem(PRACTICE_STORAGE_KEY, serialized) } catch { throw new Error('草稿或记录写入失败：本机存储不可用或空间不足。当前页面仍保留输入，请重试保存或导出后再离开。') }
  }
  return {
    load,
    saveDraft(draft: PracticeDraft): PracticeDraft {
      try { validateDraft(draft) } catch { throw new Error('这份练习草稿不完整或版本不兼容，未保存。') }
      const state = load()
      if (state.records.some(record => record.id === draft.id)) throw new Error('这次练习已保存为记录，请重新读取本机数据。')
      if (state.active && state.active.id !== draft.id) throw new Error('本机已有另一份练习草稿，请先回看并处理，不会覆盖。')
      // A completed session is terminal; stale timer callbacks cannot turn it back into a running draft.
      if (state.active?.status === 'completed' && draft.status !== 'completed') throw new Error('这份草稿已经完成，请重新读取本机数据。')
      const snapshot = copy(draft)
      write({ ...state, active: snapshot })
      return snapshot
    },
    saveRecord(id: string, note: string, savedAt = Date.now()): PracticeRecord {
      const state = load()
      const existing = state.records.find(record => record.id === id)
      if (existing) return copy(existing)
      if (!state.active || state.active.id !== id || state.active.status !== 'completed') throw new Error('请先结束当前练习，再保存为记录。')
      if (state.records.length >= MAX_PRACTICE_RECORDS) throw new Error('已保存 50 条练习记录，请先导出备份或删除不需要的记录。完成草稿仍然保留。')
      if (!time(savedAt)) throw new Error('无法读取有效的保存时间。')
      const record: PracticeRecord = { id, savedAt, snapshot: { ...state.active, note: practiceNote(note) } }
      // One write atomically adds the record and consumes its draft.
      write({ schemaVersion: 1, active: null, records: [record, ...state.records] })
      return copy(record)
    },
    discardDraft(id: string): void {
      const state = load()
      if (!state.active || state.active.id !== id) throw new Error('这份草稿已不存在，请重新读取本机数据。')
      write({ ...state, active: null })
    },
    removeRecord(id: string): void {
      const state = load()
      if (!state.records.some(record => record.id === id)) throw new Error('这条记录已不存在，请刷新列表。')
      write({ ...state, records: state.records.filter(record => record.id !== id) })
    },
    exportJSON(): string { return JSON.stringify({ kind: 'oasis-practice-sessions', ...load() }, null, 2) },
  }
}
