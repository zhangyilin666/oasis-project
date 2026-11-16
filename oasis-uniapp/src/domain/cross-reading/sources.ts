import { createChartArchive, type SavedChart } from '../metaphysics/archive'
import { createFlowStudyRepository, type FlowStudyRecord } from '../flow-study/repository'
import { createJyotishRepository, type JyotishRecord } from '../jyotish/repository'
import { createQizhengRepository, type QizhengRecord } from '../qizheng/repository'
import { createQizhengLodgesRepository, type QizhengLodgesRecord } from '../qizheng-lodges/repository'
import { createWesternStudyRepository, type WesternStudyRecord } from '../western-study/repository'
import { createQimenRepository, type QimenRecord } from '../qimen/repository'
import { createLiurenRepository, type LiurenRecord } from '../liuren/repository'
import { createDivinationRepository, type DivinationRecord } from '../divination/repository'
import { createDateSelectionRepository, type DateSelectionRecord } from '../date-selection/repository'
import { createTarotRepository, type TarotRecord } from '../tarot/repository'
import { createAlmanacRepository, type AlmanacRecord } from '../almanac/repository'
import { createSpaceRepository, type SpaceRecord } from '../space/repository'
import { createSeasonalCareRepository, type SeasonalCareRecord } from '../seasonal-care/repository'
import { createPracticeRepository, type PracticeRecord } from '../practice/repository'
import { createNameRepository, type NameSnapshot } from '../names'
import { createCulturalNoteRepository, type CulturalNoteSnapshot } from '../physiognomy'
import { createBazhaiRepository, type BazhaiSnapshot } from '../bazhai'
import { createTaiyiRepository, type TaiyiRecord } from '../taiyi/repository'
import type { SnapshotRecord } from '../records/snapshot-store'

export const CROSS_SOURCE_KINDS = ['birth-charts', 'flow-study', 'jyotish', 'western-study', 'qizheng', 'qizheng-lodges', 'qimen', 'liuren', 'taiyi', 'divination', 'date-selection', 'tarot', 'almanac', 'space', 'bazhai', 'seasonal-care', 'practice', 'name-culture', 'physiognomy-culture'] as const
export type CrossSourceKind = typeof CROSS_SOURCE_KINDS[number]
export interface CrossSourceRecords {
  'birth-charts': SavedChart; 'flow-study': FlowStudyRecord; jyotish: JyotishRecord; 'western-study': WesternStudyRecord
  qizheng: QizhengRecord; 'qizheng-lodges': QizhengLodgesRecord; qimen: QimenRecord; liuren: LiurenRecord; taiyi: TaiyiRecord; divination: DivinationRecord
  'date-selection': DateSelectionRecord; tarot: TarotRecord; almanac: AlmanacRecord; space: SpaceRecord
  'seasonal-care': SeasonalCareRecord; practice: PracticeRecord
  bazhai: SnapshotRecord<BazhaiSnapshot>; 'name-culture': SnapshotRecord<NameSnapshot>; 'physiognomy-culture': SnapshotRecord<CulturalNoteSnapshot>
}
export type CrossSourceSelection = { [K in CrossSourceKind]: { kind: K; key: string; record: CrossSourceRecords[K] } }[CrossSourceKind]
export interface CrossSourceStorage { getItem(key: string): unknown }
export const CROSS_SOURCE_LABELS: Readonly<Record<CrossSourceKind, string>> = Object.freeze({
  'birth-charts': '出生三盘', 'flow-study': '流年流月', jyotish: '印度占星', 'western-study': '西方星盘研究', qizheng: '七政天文对照', 'qizheng-lodges': '清历宿度',
  qimen: '奇门', liuren: '六壬', taiyi: '太乙岁计', divination: '易卦', 'date-selection': '日期筛选', tarot: '塔罗手记', almanac: '黄历收藏', space: '空间事实', 'seasonal-care': '节气生活', practice: '静心练习',
  bazhai: '八宅文化对照', 'name-culture': '姓名文化', 'physiognomy-culture': '相学文化阅读',
})
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const forbiddenWrite = () => { throw new Error('主题同读只读取来源记录，不允许修改原记录。') }
function readKind(kind: CrossSourceKind, storage: CrossSourceStorage): CrossSourceRecords[CrossSourceKind][] {
  const simple = { getItem: (key: string) => storage.getItem(key), setItem: forbiddenWrite }
  const legacy = { get: (key: string) => storage.getItem(key), set: forbiddenWrite }
  switch (kind) {
    case 'birth-charts': return createChartArchive(legacy).list()
    case 'flow-study': return createFlowStudyRepository(simple).list()
    case 'jyotish': return createJyotishRepository(simple).list()
    case 'western-study': return createWesternStudyRepository(simple).list()
    case 'qizheng': return createQizhengRepository(simple).list()
    case 'qizheng-lodges': return createQizhengLodgesRepository(simple).list()
    case 'qimen': return createQimenRepository(legacy).list()
    case 'liuren': return createLiurenRepository(legacy).list()
    case 'taiyi': return createTaiyiRepository(legacy).list()
    case 'divination': return createDivinationRepository(simple).list()
    case 'date-selection': return createDateSelectionRepository(simple).list()
    case 'tarot': return createTarotRepository(simple).list()
    case 'almanac': return createAlmanacRepository(simple).list()
    case 'space': return createSpaceRepository(legacy).list()
    case 'seasonal-care': return createSeasonalCareRepository(simple).list()
    case 'practice': return createPracticeRepository(simple).load().records
    case 'name-culture': return createNameRepository(simple).list()
    case 'physiognomy-culture': return createCulturalNoteRepository(simple).list()
    case 'bazhai': return createBazhaiRepository(simple).list()
  }
}
export function sourceKey(kind: CrossSourceKind, id: string): string { return `${kind}:${id}` }
export function sourceTitle(selection: CrossSourceSelection): string {
  switch (selection.kind) {
    case 'birth-charts': case 'jyotish': case 'western-study': case 'qizheng': case 'qizheng-lodges': return selection.record.name
    case 'flow-study': return selection.record.snapshot.input.name
    case 'qimen': case 'liuren': case 'taiyi': return selection.record.snapshot.input.name
    case 'divination': return selection.record.input.question
    case 'date-selection': return selection.record.snapshot.input.title
    case 'tarot': return selection.record.snapshot.question
    case 'almanac': return `${selection.record.result.input.date} · 黄历`
    case 'space': return selection.record.snapshot.facts.name
    case 'seasonal-care': return selection.record.snapshot.personal.habit
    case 'practice': return selection.record.snapshot.topic.title
    case 'name-culture': return selection.record.snapshot.input.name
    case 'physiognomy-culture': return selection.record.snapshot.input.title
    case 'bazhai': return selection.record.snapshot.input.facts.name
  }
}
export function sourceSavedAt(selection: CrossSourceSelection): string { return typeof selection.record.savedAt === 'number' ? new Date(selection.record.savedAt).toISOString() : selection.record.savedAt }
export interface CrossSourceCatalog { selections: CrossSourceSelection[]; errors: { kind: CrossSourceKind; label: string; message: string }[]; counts: Record<CrossSourceKind, number> }

/** Reads requested repositories independently, retaining all kinds for historical snapshots. */
export function listCrossReadingSources(storage: CrossSourceStorage, includedKinds: readonly CrossSourceKind[] = CROSS_SOURCE_KINDS): CrossSourceCatalog {
  const selections: CrossSourceSelection[] = [], errors: CrossSourceCatalog['errors'] = [], counts = {} as Record<CrossSourceKind, number>
  const included = new Set(includedKinds)
  for (const kind of CROSS_SOURCE_KINDS) {
    counts[kind] = 0
    if (!included.has(kind)) continue
    try {
      const records = readKind(kind, storage)
      for (const record of records) selections.push({ kind, key: sourceKey(kind, record.id), record: copy(record) } as CrossSourceSelection)
      counts[kind] = records.length
    } catch (error) { errors.push({ kind, label: CROSS_SOURCE_LABELS[kind], message: error instanceof Error ? error.message : '读取失败，原记录保留。' }) }
  }
  return { selections, errors, counts }
}

/** Reuse each source's saved-record validator through a private in-memory envelope. Never read live records here. */
export function validateSourceSelection(value: unknown): CrossSourceSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('来源记录格式不正确。')
  const raw = value as Record<string, any>, kind = raw.kind as CrossSourceKind
  if (!CROSS_SOURCE_KINDS.includes(kind) || !raw.record || typeof raw.record !== 'object' || typeof raw.record.id !== 'string' || raw.key !== sourceKey(kind, raw.record.id)) throw new Error('来源类型或标识不支持。')
  let envelope: unknown
  if (['birth-charts', 'jyotish', 'western-study', 'qizheng', 'qizheng-lodges', 'qimen', 'liuren', 'taiyi', 'space'].includes(kind)) envelope = { version: 1, records: [raw.record] }
  else if (['flow-study', 'date-selection', 'seasonal-care', 'name-culture', 'physiognomy-culture', 'bazhai'].includes(kind)) envelope = { schemaVersion: 1, kind, records: [raw.record] }
  else if (kind === 'practice') envelope = { schemaVersion: 1, active: null, records: [raw.record] }
  else envelope = { schemaVersion: 1, records: [raw.record] }
  const encoded = JSON.stringify(envelope)
  const records = readKind(kind, { getItem: () => encoded })
  if (records.length !== 1) throw new Error('来源记录不完整。')
  // Keep the full validated source record rather than replacing it with a different normalized representation.
  return copy(raw) as CrossSourceSelection
}
