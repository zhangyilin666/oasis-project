import { createSnapshotStore, type SnapshotStorage, type SnapshotRecord } from '../records/snapshot-store'
import { isFlowStudySnapshot, type FlowStudySnapshot } from './index'
export const FLOW_STUDY_STORAGE_KEY = 'oasis.flow-study.records.v1'
export type FlowStudyRecord = SnapshotRecord<FlowStudySnapshot>
export function createFlowStudyRepository(storage: SnapshotStorage) {
  return createSnapshotStore(storage, { key: FLOW_STUDY_STORAGE_KEY, kind: 'flow-study', title: '流年流月记录', maxRecords: 20, maxBytes: 1_500_000, validate: isFlowStudySnapshot })
}
