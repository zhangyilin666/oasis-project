import { deleteReportApi, type ReportSummary } from '@/api/xiaoyi'
import { DEMO_MODE } from '@/config/env'
import { reportName } from './display'
import { clearSelectedReport } from './storage'

export function canDeleteReport(status: string): boolean {
  return status === 'completed' || status === 'failed'
}

export async function confirmDeleteReport(report: Pick<ReportSummary, 'id' | 'birth_info' | 'status'>): Promise<boolean> {
  if (DEMO_MODE || !canDeleteReport(report.status)) return false
  const confirmed = await new Promise<boolean>((resolve, reject) => uni.showModal({
    title: '删除报告？',
    content: `确定删除「${reportName(report.birth_info)}」的报告吗？报告内容和对应的今日提示会被移除，删除后无法恢复。`,
    confirmText: '删除',
    confirmColor: '#a53e58',
    cancelText: '保留报告',
    success: result => resolve(result.confirm),
    fail: reject,
  }))
  if (!confirmed) return false
  try {
    await deleteReportApi(report.id)
  } catch (error: any) {
    // Another device may already have deleted this report.
    if (error?.code !== 404) throw error
  }
  clearSelectedReport(report.id)
  uni.showToast({ title: '报告已删除', icon: 'success' })
  return true
}
