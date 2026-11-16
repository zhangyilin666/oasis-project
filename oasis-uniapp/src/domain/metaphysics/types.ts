/** Serializable, versioned facts shared by deterministic chart adapters and the UI. */
export type SystemId = 'bazi' | 'ziwei' | 'western'
export interface BirthProfile {
  date: string
  time: string
  gender: '男' | '女'
  /** UTC offset at birth, including historical daylight saving if applicable. */
  utcOffset: number
  /** Optional IANA zone; when present, resolve the historical offset on this device. */
  timeZone?: string
  timeChoice?: 'earlier' | 'later'
  timePrecision?: 'minute' | 'approximate'
  place?: { name?: string; latitude: number; longitude: number }
}
export interface ExplorationOptions {
  observationDate?: string
  /** Append explicit alternative-rule comparisons without changing the primary charts. */
  compareRules?: boolean
}
export interface ChartFact { label: string; value: string }
export interface ChartSection { title: string; caption?: string; facts: ChartFact[] }
export interface ChartSource { title: string; url: string; version: string; license: string }
export interface ChartResult {
  id: SystemId
  title: string
  status: 'ready' | 'error'
  error?: string
  summary: ChartFact[]
  sections: ChartSection[]
  conventions: string[]
  limitations: string[]
  source: ChartSource
  /** Identifies the unchanged primary preset and the explicitly requested comparisons. */
  ruleProfile?: { id: string; version: string; comparisonIds: string[] }
  /** Present only when this saved chart actually contains a transit snapshot. */
  observation?: {
    date: string
    timeZone: 'UTC+08:00'
    localTime: '12:00'
    utcTime: string
    kind: 'transit-snapshot'
    orbDegrees: 1
    ruleVersion: 'western-transit-v1'
  }
}
export interface ComparisonRow {
  theme: string
  bazi: string
  ziwei: string
  western: string
  note: string
}
export interface ExplorationResult {
  schemaVersion: 1
  profile: BirthProfile
  utcTime: string
  chineseTime: string
  options?: ExplorationOptions
  rulesVersion?: string
  timeResolution?: { mode: 'manual' | 'iana'; timeZone?: string; utcOffset: number; choice?: 'earlier' | 'later' }
  charts: ChartResult[]
  comparison: ComparisonRow[]
  notices: string[]
}
export interface Tradition {
  id: string
  name: string
  category: '山' | '医' | '命' | '相' | '卜'
  status: 'available' | 'existing' | 'planned'
  summary: string
  scope: string
  phase: string
}
