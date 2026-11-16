export const SPACE_RULE_VERSION = 'space-record-v1' as const
export type NorthReference = 'true' | 'magnetic' | 'unknown'
export interface SpaceFacts {
  name: string
  locationNote: string
  layoutDescription: string
  directionTarget: string
  bearingDegrees: number | null
  northReference: NorthReference
  measurementTool: string
  measuredAt: string
  measurementBasis: string
  buildingPeriod: string
  moveInPeriod: string
  notes: string
}
export interface SpaceSnapshot {
  schemaVersion: 1
  ruleVersion: typeof SPACE_RULE_VERSION
  scope: 'facts-only'
  recordedAt: string
  facts: SpaceFacts
  directionStatus: 'unmeasured' | 'reference-unknown' | 'magnetic-only' | 'true-recorded'
  directionNote: string
  sources: { title: string; url: string; usage: string }[]
}
export const NORTH_REFERENCE_LABELS: Record<NorthReference, string> = { true: '真北', magnetic: '磁北', unknown: '尚不确定' }
export const SPACE_SOURCES = [{
  title: 'NOAA / NCEI：磁偏角与真北、磁北',
  url: 'https://www.ngdc.noaa.gov/geomag/declination.shtml',
  usage: '仅链接参考，说明为本项目自写；未引入 NOAA 模型、磁偏角数据或地图，也不使用其标志。',
}] as const

export function emptySpaceFacts(): SpaceFacts {
  return { name: '', locationNote: '', layoutDescription: '', directionTarget: '', bearingDegrees: null, northReference: 'unknown', measurementTool: '', measuredAt: '', measurementBasis: '', buildingPeriod: '', moveInPeriod: '', notes: '' }
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const textFields = [
  ['name', '档案名称', 40], ['locationNote', '地点备注', 200], ['layoutDescription', '户型或房间描述', 1500],
  ['directionTarget', '测量对象', 120], ['measurementTool', '测量工具', 100], ['measurementBasis', '测量依据', 500],
  ['buildingPeriod', '建筑时期', 100], ['moveInPeriod', '入住时期', 100], ['notes', '补充备注', 1500],
] as const

export function normalizeSpaceFacts(value: unknown): SpaceFacts {
  if (!object(value)) throw new Error('请填写有效的空间资料')
  const result = emptySpaceFacts()
  for (const [key, label, maximum] of textFields) {
    if (typeof value[key] !== 'string') throw new Error(`${label}须为文字`)
    const text = value[key].trim()
    if (text.length > maximum) throw new Error(`${label}最多 ${maximum} 个字符`)
    result[key] = text
  }
  if (!result.name) throw new Error('请给这份空间档案起个名字')
  if (typeof value.northReference !== 'string' || !['true', 'magnetic', 'unknown'].includes(value.northReference)) throw new Error('请选择真北、磁北或尚不确定')
  result.northReference = value.northReference as NorthReference
  if (value.bearingDegrees !== null && (typeof value.bearingDegrees !== 'number' || !Number.isFinite(value.bearingDegrees) || value.bearingDegrees < 0 || value.bearingDegrees >= 360)) {
    throw new Error('方向度数须为 0（含）至 360（不含）；未测量时请留空')
  }
  result.bearingDegrees = value.bearingDegrees as number | null
  if (typeof value.measuredAt !== 'string') throw new Error('测量日期须为公历日期，或留空')
  result.measuredAt = value.measuredAt.trim()
  if (result.measuredAt) {
    const date = new Date(`${result.measuredAt}T12:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.measuredAt) || result.measuredAt < '1900-01-01' || result.measuredAt > '2099-12-31' || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result.measuredAt) {
      throw new Error('测量日期须为 1900–2099 年内的有效公历日期，或留空')
    }
  }
  return result
}

/** Empty input stays unmeasured: Number('') must never turn it into north at 0°. */
export function parseBearing(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) throw new Error('请输入十进制度数，例如 0、90 或 182.5；未测量时请留空')
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0 || value >= 360) throw new Error('方向度数须为 0（含）至 360（不含）；360° 请明确改填 0°')
  return value
}

export function directionFacts(facts: SpaceFacts): Pick<SpaceSnapshot, 'directionStatus' | 'directionNote'> {
  if (facts.bearingDegrees === null) return { directionStatus: 'unmeasured', directionNote: '尚未记录方向度数；保留现有资料，不补出朝向或盘法。' }
  if (facts.northReference === 'unknown') return { directionStatus: 'reference-unknown', directionNote: '已有原始读数，北向基准尚不确定；不将它当作真北或磁北，也不推断方位。' }
  if (facts.northReference === 'magnetic') return { directionStatus: 'magnetic-only', directionNote: '仅记录磁北读数。磁偏角随地点与日期变化，本版不换算真北，不据此生成风水盘。' }
  return { directionStatus: 'true-recorded', directionNote: '按你注明的真北基准记录原始读数；本工具未核验测量精度，不生成风水盘或吉凶结论。' }
}

export function createSpaceSnapshot(input: unknown, now = new Date()): SpaceSnapshot {
  const facts = normalizeSpaceFacts(input)
  if (!Number.isFinite(now.getTime())) throw new Error('当前时间不可用，请稍后重试')
  return { schemaVersion: 1, ruleVersion: SPACE_RULE_VERSION, scope: 'facts-only', recordedAt: now.toISOString(), facts, ...directionFacts(facts), sources: SPACE_SOURCES.map(source => ({ ...source })) }
}

export function isSpaceSnapshot(value: unknown): value is SpaceSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== SPACE_RULE_VERSION || value.scope !== 'facts-only') return false
  if (typeof value.recordedAt !== 'string' || !value.recordedAt.endsWith('Z') || !Number.isFinite(Date.parse(value.recordedAt))) return false
  try { normalizeSpaceFacts(value.facts) } catch { return false }
  if (!['unmeasured', 'reference-unknown', 'magnetic-only', 'true-recorded'].includes(String(value.directionStatus)) || typeof value.directionNote !== 'string') return false
  if (directionFacts(value.facts as unknown as SpaceFacts).directionStatus !== value.directionStatus) return false
  return Array.isArray(value.sources) && value.sources.length > 0 && value.sources.every(source => object(source) && ['title', 'url', 'usage'].every(key => typeof source[key] === 'string'))
}
