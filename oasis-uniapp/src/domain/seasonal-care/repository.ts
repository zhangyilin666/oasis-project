import { createSnapshotStore, type SnapshotRecord, type SnapshotStorage } from '../records/snapshot-store'
import { isSeasonalCareSnapshot, type SeasonalCareSnapshot } from './index'
export const SEASONAL_CARE_STORAGE_KEY = 'oasis.seasonal-care.records.v1'
export const MAX_SEASONAL_CARE_RECORDS = 50
export type SeasonalCareRecord = SnapshotRecord<SeasonalCareSnapshot>
export function createSeasonalCareRepository(storage: SnapshotStorage) {
  return createSnapshotStore<SeasonalCareSnapshot>(storage, { key: SEASONAL_CARE_STORAGE_KEY, kind: 'seasonal-care', title: '节气生活记录', maxRecords: MAX_SEASONAL_CARE_RECORDS, validate: isSeasonalCareSnapshot })
}
