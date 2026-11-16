import { createSnapshotStore, type SnapshotStorage, type SnapshotRecord } from '../records/snapshot-store'
import { isCrossReadingSnapshot, type CrossReadingSnapshot } from './index'
export const CROSS_READING_STORAGE_KEY = 'oasis.cross-reading.records.v1'
export type CrossReadingRecord = SnapshotRecord<CrossReadingSnapshot>
export function createCrossReadingRepository(storage: SnapshotStorage) {
  return createSnapshotStore(storage, { key: CROSS_READING_STORAGE_KEY, kind: 'cross-reading', title: '主题同读记录', maxRecords: 10, maxBytes: 9_000_000, validate: isCrossReadingSnapshot })
}
