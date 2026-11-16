import { createSnapshotStore, type SnapshotRecord, type SnapshotStorage } from '../records/snapshot-store'
import { isDateSelectionSnapshot, type DateSelectionSnapshot } from './index'

export const DATE_SELECTION_STORAGE_KEY = 'oasis.date-selection.records.v1'
export const MAX_DATE_SELECTION_RECORDS = 20
export type DateSelectionRecord = SnapshotRecord<DateSelectionSnapshot>
export function createDateSelectionRepository(storage: SnapshotStorage) {
  return createSnapshotStore<DateSelectionSnapshot>(storage, { key: DATE_SELECTION_STORAGE_KEY, kind: 'date-selection', title: '日期筛选记录', maxRecords: MAX_DATE_SELECTION_RECORDS, maxBytes: 2_500_000, validate: isDateSelectionSnapshot })
}
