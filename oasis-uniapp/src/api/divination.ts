import { get, post, del } from './request'
import { API_PREFIX, DEMO_MODE } from '@/config/env'
import type { DivinationInput, DivinationResult, Hexagram } from '@/domain/divination'

export type DivinationReadingStatus = 'pending' | 'processing' | 'completed' | 'failed'
export interface DivinationEvidence {
  id: string
  title: string
  text: string
  sourceTitle: string
  url: string
  hexagramNumber: number
  linePosition?: number
}
export interface DivinationReadingFacts {
  version: 'zhouyi-reading-facts-v1'
  ruleVersion: string
  questionInstant: string
  original: Hexagram
  changed: Hexagram
  movingLines: number[]
  mutual?: Hexagram
  bodyUse?: DivinationResult['bodyUse']
  evidence: DivinationEvidence[]
  sourceVersion: string
  readingScope: string[]
  sourceLicense?: { license: string; url: string; attribution: string; changes: string }
}
export interface CitedReadingText { text: string; evidence_ids: string[] }
export interface DivinationAnalysis {
  facts_echo: { original_number: number; changed_number: number; moving_lines: number[] }
  overview: CitedReadingText
  question_reading: CitedReadingText
  actions: CitedReadingText[]
  reflection_questions: string[]
  limits: string
}
export interface DivinationReading {
  reading_id: number
  status: DivinationReadingStatus
  input: DivinationInput
  rule_version: string
  facts: DivinationReadingFacts
  analysis: DivinationAnalysis | null
  error_message: string | null
  created_at: string
  updated_at: string
  model?: string | null
}
export interface DivinationReadingSummary {
  reading_id: number
  status: DivinationReadingStatus
  question: string
  method: DivinationInput['method']
  original_name: string
  changed_name: string
  created_at: string
  updated_at: string
}
export interface DivinationHistory {
  readings: DivinationReadingSummary[]
  total: number
  skip: number
  limit: number
  daily_limit: number
  remaining_today: number | null
}
export interface DivinationSubmission { request_id: string; input: DivinationInput; rule_version: string }

const path = `${API_PREFIX}/oasis/divinations`
function requireOnlineMode() {
  if (DEMO_MODE) throw new Error('离线体验模式可真实起卦；AI 解读与云端记录须在正式在线版本中使用。')
}
export async function createDivinationReading(payload: DivinationSubmission): Promise<DivinationReading> {
  requireOnlineMode()
  return (await post<DivinationReading>(path, payload)).data
}
export async function getDivinationReading(id: number): Promise<DivinationReading> {
  requireOnlineMode()
  return (await get<DivinationReading>(`${path}/${id}`)).data
}
export async function getDivinationHistory(skip = 0, limit = 20): Promise<DivinationHistory> {
  requireOnlineMode()
  return (await get<DivinationHistory>(path, { skip, limit })).data
}
export async function deleteDivinationReading(id: number): Promise<void> {
  requireOnlineMode()
  await del<{ reading_id: number }>(`${path}/${id}`)
}
