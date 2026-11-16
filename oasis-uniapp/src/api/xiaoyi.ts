/**
 * Oasis 业务 API 服务 — 八字分析 / 报告 / 知识库 / 每日运势
 */
import { get, post, del } from './request'
import { API_PREFIX } from '@/config/env'

const XIAOYI = `${API_PREFIX}/oasis`

// ---- 类型定义 ----

export interface AnalyzePayload {
  name: string
  birth_date: string
  birth_time: string
  gender: string
  location: string
  is_solar_time: boolean
}

export interface ReportSummary {
  id: number
  birth_info: string
  status: string
  ai_analysis_preview: string
  created_at: string
  updated_at: string
}

export interface AnalysisLog {
  model_name: string
  status: string
  latency_ms: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  trace_id: string
  created_at: string
}

export interface ReportReference {
  id: string
  document_id: string
  title: string
  paragraph: number
  kind: string
  sha256: string
  snippet: string
}

export interface ReportVerification {
  version: number
  status: 'structured_checked' | 'not_checked'
  scope: string
  reference_ids: string[]
}

export interface ReportDetail {
  id: number
  user_id: number
  status: string
  error_message: string | null
  can_retry: boolean
  birth_info: string
  calendar_data: any
  ai_analysis: string | null
  is_premium: boolean
  analysis_logs_count: number
  analysis_logs: AnalysisLog[]
  created_at: string
  updated_at: string
}

export interface AlmanacDay {
  solar_date: string
  lunar_date: string
  day_gan_zhi: string
  animal: string
  yi: string[]
  ji: string[]
  ji_shen: string[]
  xiong_sha: string[]
  chong_sheng_xiao: string
  lunar_year_cn: string
  lunar_month_cn: string
  lunar_day_cn: string
  year_gan_zhi: string
}

export interface DailyFortune {
  report_id: number
  birth_info: string
  date: string
  day_gan_zhi: string
  day_relation: string
  clash_info: string
  fortune_text: string
  lucky_color: string
  lucky_direction: string
  warning: string
  is_cached: boolean
}

// ---- API 方法 ----

export function analyzeApi(payload: AnalyzePayload) {
  return post<{ report_id: number; status: string }>(`${XIAOYI}/analyze`, payload, {
    showLoading: true,
    loadingText: '正在提交...',
    timeout: 120000,
  })
}

export function getReportsApi(skip: number = 0, limit: number = 20) {
  return get<{ reports: ReportSummary[]; total: number; skip: number; limit: number }>(
    `${XIAOYI}/reports`,
    { skip, limit },
  )
}

export function getReportDetailApi(reportId: number) {
  return get<ReportDetail>(`${XIAOYI}/report/${reportId}`)
}

export function deleteReportApi(reportId: number) {
  return del<{ report_id: number }>(`${XIAOYI}/report/${reportId}`)
}

export function getKnowledgeListApi() {
  return get<{ total: number; documents: any[] }>(`${XIAOYI}/knowledge`)
}

export function getKnowledgeDocApi(docId: string) {
  return get<any>(`${XIAOYI}/knowledge/${docId}`)
}

export function getAlmanacApi(solarDate?: string) {
  return get<AlmanacDay>(`${XIAOYI}/almanac`, solarDate ? { solar_date: solarDate } : undefined)
}

export function getDailyFortuneApi(reportId?: number) {
  return get<DailyFortune>(`${XIAOYI}/daily-fortune`, { report_id: reportId }, { timeout: 150000 })
}

export interface FortuneStickResult {
  number: number
  grade: string
  title: string
  poem: string
  line: string
  plain: string
  cat: string
  date: string
  already_drawn: boolean
  disclaimer: string
}

export function getTodayStickApi() {
  return get<FortuneStickResult | null>(`${XIAOYI}/fortune-stick`)
}

export function drawFortuneStickApi(question = '') {
  return post<FortuneStickResult>(`${XIAOYI}/fortune-stick`, { question }, { timeout: 30000 })
}

export function retryReportApi(reportId: number) {
  return post<{ report_id: number; status: string }>(`${XIAOYI}/report/${reportId}/retry`)
}

export interface YunStartInfo {
  start_age: string
  start_solar_date: string
  is_forward: boolean
  direction_text: string
}

export interface LiunianItem {
  year: number
  age: number
  gan_zhi: string
  xun: string
  xun_kong: string
  shi_shen: string
  chong_he: string
  is_tai_sui: boolean
  is_current: boolean
}

export interface DayunItem {
  index: number
  gan_zhi: string
  start_age: number
  end_age: number
  start_year: number
  end_year: number
  xun: string
  xun_kong: string
  is_current: boolean
  liu_nian: LiunianItem[]
}

export interface YunData {
  is_premium: boolean
  start_info: YunStartInfo
  current_da_yun_index: number
  current_year: number
  da_yun: DayunItem[]
}

export function getYunApi() {
  return get<YunData>(`${XIAOYI}/yun`)
}
