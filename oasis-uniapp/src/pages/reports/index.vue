<template>
 <view class="page-shell reports-page">
  <view v-if="DEMO_MODE" class="demo-banner">离线界面体验版 · 报告为虚构示例</view>
  <view class="heading-row"><view><text class="eyebrow">每一份，都关于你</text><text class="page-heading">我的探索手记</text></view><AppButton class="add-report" @click="goAnalyze" aria-label="创建新报告"><AppIcon name="plus" /></AppButton></view>
  <view class="report-caption"><text class="page-caption">{{ total ? '共 ' + total + ' 条记录' : '每一次探索，都在这里' }}</text><AppButton class="text-button" @click="resetReports" :disabled="isLoadingMore">刷新</AppButton></view>
  <view class="report-list" v-if="reports.length">
   <view class="report-card" v-for="r in reports" :key="r.id">
    <AppButton class="report-open" @click="goDetail(r.id)">
    <view class="report-top"><AppIcon name="book" /><text class="report-name">{{ reportName(r.birth_info) }}<text class="report-kind">的八字解读</text></text></view>
    <text class="birth-summary">{{ reportBirth(r.birth_info) }}</text>
    <view class="report-bottom"><text>{{ formatReportDate(r.created_at) }}</text><text class="report-link">查看记录 →</text></view>
    </AppButton>
    <view class="report-actions" v-if="!DEMO_MODE && canDeleteReport(r.status)"><AppButton class="text-button report-delete" :disabled="deletingId !== null" @click="removeReport(r)">{{ deletingId === r.id ? '正在删除…' : '删除报告' }}</AppButton></view>
   </view>
  </view>
  <view v-if="isLoadingMore && !reports.length" class="list-skeleton" aria-label="正在加载报告"><view v-for="n in 2" :key="n" class="skeleton"></view></view>
  <ErrorRetry v-if="isError && !isLoadingMore" message="报告暂时没能加载" @retry="loadReports" />
  <EmptyState v-else-if="!reports.length && !isLoadingMore" message="第一份手记，等你来开启" hint="小猫已经准备好了，一起多了解自己一点。" action-label="创建我的第一份报告" @action="goAnalyze" />
  <AppButton v-if="hasMore && reports.length" class="text-button load-more" :disabled="isLoadingMore" @click="loadReports">{{ isLoadingMore ? '正在翻找…' : '加载更多手记' }}</AppButton>
  <text v-if="reports.length && !hasMore" class="footer-note">每一次探索，都是与自己靠近一点</text>
 </view>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getReportsApi, type ReportSummary } from '@/api/xiaoyi'
import { canDeleteReport, confirmDeleteReport } from '@/utils/reports'
import { DEMO_MODE } from '@/config/env'
import { formatReportDate, reportName, reportBirth } from '@/utils/display'
import EmptyState from '@/components/EmptyState.vue'
import ErrorRetry from '@/components/ErrorRetry.vue'
import AppIcon from '@/components/AppIcon.vue'
const reports = ref<ReportSummary[]>([]), total = ref(0), hasMore = ref(true), isError = ref(false), isLoadingMore = ref(false)
const deletingId = ref<number | null>(null)
let generation = 0
onShow(resetReports)
onHide(() => { generation++; isLoadingMore.value = false })
function resetReports() {
 generation++; reports.value = []; total.value = 0; hasMore.value = true; isError.value = false; isLoadingMore.value = false
 return loadReports()
}
async function loadReports() {
 if (isLoadingMore.value || !hasMore.value) return
 const requestGeneration = generation
 isLoadingMore.value = true; isError.value = false
 try {
  const res = await getReportsApi(reports.value.length, 20)
  if (requestGeneration !== generation) return
  reports.value = [...reports.value, ...res.data.reports]
  total.value = res.data.total; hasMore.value = reports.value.length < res.data.total
 } catch { if (requestGeneration === generation) isError.value = true }
 finally { if (requestGeneration === generation) isLoadingMore.value = false; uni.stopPullDownRefresh() }
}
function goDetail(id: number) { uni.navigateTo({ url: '/pages/report-detail/index?id=' + id }) }
function goAnalyze() { uni.navigateTo({ url: '/pages/analyze/index' }) }
async function removeReport(report: ReportSummary) {
 if (deletingId.value !== null) return
 const requestGeneration = generation
 deletingId.value = report.id
 try {
  if (!await confirmDeleteReport(report) || requestGeneration !== generation) return
  // Ignore a list request started before deletion so it cannot put this card back.
  generation++; isLoadingMore.value = false; isError.value = false
  reports.value = reports.value.filter(item => item.id !== report.id)
  total.value = Math.max(0, total.value - 1); hasMore.value = reports.value.length < total.value
 } catch (error: any) {
  uni.showToast({ title: error?.message || '删除未成功，请重试', icon: 'none' })
 } finally { deletingId.value = null }
}
onPullDownRefresh(resetReports)
onReachBottom(loadReports)
</script>
<style scoped>
.demo-banner { margin-bottom: 16px; padding: 10px 14px; border-radius: 12px; background: #fff1db; color: #76551c; font-size: 12px; }
.heading-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }.heading-row .page-heading { font-size: 24px; }
.add-report { width: 44px; height: 44px; padding: 0; margin: 0; border-radius: 14px; background: #eee7f8; display: flex; align-items: center; justify-content: center; }
.report-caption { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; }.report-caption .page-caption { margin: 0; font-size: 12px; }
.report-list, .list-skeleton { margin-top: 20px; }
.report-card { display: block; box-sizing: border-box; text-align: left; width: 100%; margin: 0 0 16px; padding: 20px; border-radius: 20px; background: white; border: 1px solid #eee8f4; line-height: 1.6; color: #302b40; }
.report-open { display: block; width: 100%; padding: 0; margin: 0; background: none; text-align: left; line-height: 1.6; color: inherit; border-radius: 0; }
.report-actions { display: flex; justify-content: flex-end; margin-top: 8px; }.report-delete { color: #a53e58; min-height: 44px; margin: 0; padding: 0 8px; font-size: 12px; }
.report-top { display: flex; align-items: center; gap: 12px; }
.report-name { display: block; min-width: 0; font-size: 18px; font-weight: 600; overflow-wrap: anywhere; }.report-kind { font-size: 14px; font-weight: 400; margin-left: 8px; color: #736581; }
.birth-summary { display: block; font-size: 12px; color: #777083; margin-top: 8px; overflow-wrap: anywhere; }
.report-bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #777083; border-top: 1px solid #f0ecf5; padding-top: 16px; margin-top: 16px; }.report-link { color: #654e9e; }
.load-more { width: 100%; }.list-skeleton .skeleton { height: 180px; margin-bottom: 16px; border-radius: 20px; }
</style>
