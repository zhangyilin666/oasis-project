<template>
 <view class="page-shell report-detail-page">
  <view v-if="DEMO_MODE" class="demo-banner">离线界面体验版 · 这份报告是虚构示例</view>
  <view class="waiting-panel" v-if="status === 'pending' || status === 'processing'" role="status" aria-live="polite">
   <CatCompanion mood="thinking" /><text class="eyebrow">小猫正在认真翻书</text><text class="page-heading">你的解读，正在路上</text>
   <text class="processing-hint">{{ statusMessage }}</text><view class="waiting-dots" aria-hidden="true"><view></view><view></view><view></view></view>
   <text class="processing-birth" v-if="report">{{ report.birth_info }}</text><AppButton class="btn-secondary" @click="goReports">先去看看我的手记</AppButton>
  </view>
  <view class="waiting-panel" v-else-if="status === 'failed' || status === 'timeout'" role="status">
   <CatCompanion mood="comfort" /><text class="page-heading">稍作停留，再试一次</text><text class="processing-hint">{{ statusMessage }}</text>
   <AppButton v-if="status === 'failed' && report?.can_retry" class="btn-primary" :disabled="retrying" @click="retryAnalysis">{{ retrying ? '正在提交…' : '重新生成解读' }}</AppButton>
   <AppButton v-else class="btn-primary" @click="resetPolling">重新获取报告</AppButton><AppButton class="text-button" @click="goReports">回到我的手记</AppButton>
   <AppButton v-if="!DEMO_MODE && report && canDeleteReport(status)" class="text-button report-delete" :disabled="deleting" @click="removeReport">{{ deleting ? '正在删除…' : '删除这份报告' }}</AppButton>
  </view>
  <view class="waiting-panel" v-else-if="isInitialLoading && !report"><CatCompanion mood="thinking" /><text class="processing-hint">正在翻开你的手记…</text></view>
  <ErrorRetry v-else-if="isLoadError && !report" message="暂时没能打开这份报告" @retry="resetPolling" />
  <template v-if="status === 'completed' && report && report.calendar_data">
   <view class="report-cover">
    <view class="cover-top"><view><text class="eyebrow">猫来运转 · 专属探索手记</text><text class="cover-greeting">解读准备好啦，一起翻开看看。</text></view><CatCompanion small mood="complete" /></view>
    <text class="page-heading">{{ reportName(report.birth_info) }}的解读</text><text class="cover-birth">{{ reportBirth(report.birth_info) }}</text>
    <view class="cover-tags"><text>四柱排盘</text><text>大运流年</text><text>生活建议</text></view>
    <AppButton class="btn-primary" @click="selectForDaily">{{ isDailySelected ? '查看我的今日提示' : '用这份报告查询今日提示' }} <text aria-hidden="true">→</text></AppButton>
   </view>
   <view class="reading-nav" role="group" aria-label="报告章节"><AppButton @click="scrollToSection('reading')">专属解读</AppButton><AppButton @click="scrollToSection('chart')">四柱命盘</AppButton><AppButton @click="scrollToSection('dayun')">大运流年</AppButton></view>
   <view class="report-section" id="reading">
    <text class="section-kicker">01 / 了解自己</text><text class="section-title">你的专属解读</text>
    <ReportProse v-if="hasAiAnalysis" :content="report.ai_analysis || ''" /><text v-else class="page-caption">这份报告尚未包含 AI 解读。</text>
    <ReportEvidence :references="report.calendar_data.references" :verification="report.calendar_data.verification" />
   </view>
   <view class="suggestion-panel" v-if="report.calendar_data.suggestion"><view class="suggestion-heading"><AppIcon name="heart" /><text class="section-title">把了解，放进生活里</text></view><ReportProse :content="report.calendar_data.suggestion" /></view>
   <view class="report-section" id="chart" v-if="report.calendar_data.full_bazi">
    <text class="section-kicker">02 / 四柱命盘</text><text class="section-title">你的八字底色</text>
    <TermGuide :content="'四柱 日主 天干 地支 干支 五行 十神 藏干 纳音 地势 旬空 大运 流年 起运 虚岁 ' + (report.ai_analysis || '')" />
    <view class="pillar-cards"><view v-for="(key, index) in pillars" :key="key" class="pillar-card"><text class="pillar-label">{{ ['年柱','月柱','日柱','时柱'][index] }}</text><text class="pillar-gz">{{ report.calendar_data[key]?.gan_zhi }}</text><text class="pillar-element">{{ report.calendar_data[key]?.wu_xing }}</text></view></view>
    <AppButton class="text-button chart-toggle" :aria-expanded="chartExpanded" @click="chartExpanded = !chartExpanded">{{ chartExpanded ? '收起完整排盘 −' : '查看十神、藏干等完整排盘 ＋' }}</AppButton>
    <view v-if="chartExpanded" class="bazi-table">
     <view class="bazi-header"><text></text><text v-for="label in ['年柱','月柱','日柱','时柱']" :key="label">{{ label }}</text></view>
     <view class="bazi-row" v-for="col in baziColumns" :key="col.key"><text class="bazi-label">{{ col.label }}</text><text v-for="(_, index) in pillars" :key="index" class="bazi-cell">{{ getBaziCell(index, col.key) }}</text></view>
     <view class="palace-line"><text>命宫 {{ report.calendar_data.ming_gong || '—' }}</text><text>身宫 {{ report.calendar_data.shen_gong || '—' }}</text><text>胎元 {{ report.calendar_data.tai_yuan || '—' }}</text></view>
    </view>
   </view>
   <view class="report-section" id="dayun" v-if="yunDisplay">
    <text class="section-kicker">03 / 时间的线索</text><text class="section-title">大运与流年</text>
    <text class="yun-summary-text">出生后 {{ yunDisplay.startAge }} 年 {{ yunDisplay.startMonths }} 月 {{ yunDisplay.startDays }} 天起运，{{ yunDisplay.isForward ? '顺行' : '逆行' }}。起运日期 {{ yunDisplay.startSolarDate }}，下表按虚岁显示。</text>
    <text class="expand-hint">点开一段大运，查看每一年的干支</text>
    <view class="dayun-item" v-for="dy in yunDisplay.daYun" :key="dy.index">
     <AppButton class="dayun-header" :class="{ 'dayun-current': dy.isCurrent }" @click="dy.expanded = !dy.expanded" :aria-expanded="dy.expanded">
      <text class="dayun-ganzhi">{{ dy.ganZhi }}</text><view class="dayun-dates"><text>{{ dy.startAge }}–{{ dy.endAge }} 岁 <text class="current-tag" v-if="dy.isCurrent">当前</text></text><text class="dayun-year">{{ dy.startYear }}–{{ dy.endYear }}</text></view><text class="dayun-arrow">{{ dy.expanded ? '−' : '＋' }}</text>
     </AppButton>
     <view class="liunian-list" v-if="dy.expanded"><view class="liunian-item" v-for="ln in dy.liuNian" :key="ln.year"><text>{{ ln.year }} · {{ ln.ganZhi }}</text><text>{{ ln.age }}岁</text></view></view>
    </view>
    <view v-if="yunSummaryText" class="yun-comment"><text class="section-title">这段旅程的提示</text><ReportProse :content="yunSummaryText" /></view>
   </view>
   <view class="report-ending"><CatCompanion small mood="comfort" /><text>看见更多可能，也相信自己的选择。</text></view>
   <AppButton class="btn-secondary" @click="goReports">收好手记，回到报告</AppButton>
   <AppButton v-if="!DEMO_MODE" class="text-button report-delete" :disabled="deleting" @click="removeReport">{{ deleting ? '正在删除…' : '删除这份报告' }}</AppButton>
   <text class="footer-note">{{ formatReportDate(report.created_at) }} 创建<br />传统文化与 AI 解读，仅供学习与娱乐参考</text>
  </template>
 </view>
</template>
<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getReportDetailApi, retryReportApi, type ReportDetail } from '@/api/xiaoyi'
import { setSelectedReport, getSelectedReport } from '@/utils/storage'
import { canDeleteReport, confirmDeleteReport } from '@/utils/reports'
import { formatReportDate, reportName, reportBirth } from '@/utils/display'
import { DEMO_MODE } from '@/config/env'
import CatCompanion from '@/components/CatCompanion.vue'
import AppIcon from '@/components/AppIcon.vue'
import ReportProse from '@/components/ReportProse.vue'
import ReportEvidence from '@/components/ReportEvidence.vue'
import TermGuide from '@/components/TermGuide.vue'
import ErrorRetry from '@/components/ErrorRetry.vue'

const MAX_POLLS = 320
const POLL_INTERVAL = 3000

const pillars = ['year', 'month', 'day', 'hour'] as const

const baziColumns = [
  { key: 'gan_zhi', label: '干支' },
  { key: 'gan', label: '天干' },
  { key: 'zhi', label: '地支' },
  { key: 'na_yin', label: '纳音' },
  { key: 'wu_xing', label: '五行' },
  { key: 'shi_shen_gan', label: '十神(干)' },
  { key: 'shi_shen_zhi', label: '十神(支)' },
  { key: 'di_shi', label: '地势' },
  { key: 'hide_gan', label: '藏干' },
  { key: 'xun', label: '旬' },
  { key: 'xun_kong', label: '旬空' },
]

const report = ref<ReportDetail | null>(null)
const isInitialLoading = ref(true)
const isLoadError = ref(false)
const status = ref<string>('')        // pending | processing | completed | failed | timeout
const statusMessage = ref('')
const yunDisplay = ref<any>(null)
const yunSummaryText = ref('')
const hasAiAnalysis = ref(false)
const chartExpanded = ref(false)
const isDailySelected = ref(false)
const deleting = ref(false)
async function removeReport() {
 if (!report.value || deleting.value) return
 deleting.value = true
 try {
  if (await confirmDeleteReport(report.value)) { stopPolling(); report.value = null; goReports() }
 } catch (error: any) {
  uni.showToast({ title: error?.message || '删除未成功，请重试', icon: 'none' })
 } finally { deleting.value = false }
}
function goReports() { uni.switchTab({ url: '/pages/reports/index' }) }
function scrollToSection(id: string) { uni.pageScrollTo({ selector: '#' + id, offsetTop: -110, duration: 250 }) }

let reportId: number | null = null
let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollCount = 0
let pollGeneration = 0
const retrying = ref(false)

onLoad((options: any) => {
  uni.setNavigationBarTitle({ title: '分析报告' })

  if (!options?.id || !/^\d+$/.test(options.id) || Number(options.id) < 1) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    goReports()
    return
  }
  reportId = parseInt(options.id)
  isDailySelected.value = getSelectedReport() === reportId
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

function startPolling() {
  resetPollingState()
  pollCount = 0
  // 立即 fetch 一次
  fetchReport()
}

function stopPolling() {
  pollGeneration++
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function resetPollingState() {
  stopPolling()
  pollCount = 0
  report.value = null
  status.value = ''
  isInitialLoading.value = true
  isLoadError.value = false
}

function resetPolling() {
  resetPollingState()
  startPolling()
}

async function fetchReport() {
  if (!reportId) return

  pollCount++
  if (pollCount > MAX_POLLS) {
    stopPolling()
    status.value = 'timeout'
    statusMessage.value = '暂时停止等待。可以稍后在报告列表查看，或重新获取。'
    isInitialLoading.value = false
    isLoadError.value = true
    return
  }

  const generation = pollGeneration
  try {
      const res = await getReportDetailApi(reportId)
      if (generation !== pollGeneration) return
      const data = res.data
      if (!data?.id) throw new Error('报告数据不完整')
      const st = data.status

      if (st === 'pending' || st === 'processing') {
        report.value = data
        status.value = st
        isInitialLoading.value = true
        isLoadError.value = false
        statusMessage.value = st === 'pending'
          ? '正在准备分析...'
          : 'AI 正在分析，通常需要 1-3 分钟。可以离开此页，稍后到报告列表查看。'
        return
      }

      if (st === 'failed') {
        stopPolling()
        report.value = data
        status.value = st
        isInitialLoading.value = false
        isLoadError.value = true
        statusMessage.value = data?.error_message || '分析失败，请返回重试'
        return
      }

      if (st !== 'completed') throw new Error('报告状态异常')
      stopPolling()
      processCompletedReport(data)
    } catch (error: any) {
      if (generation !== pollGeneration) return
      if (!report.value || error?.code === 404 || error?.code === 401) {
        stopPolling()
        isLoadError.value = true
        isInitialLoading.value = false
        return
      }
      statusMessage.value = '网络暂时中断，正在重新连接...'
    } finally {
      if (generation === pollGeneration) pollTimer = setTimeout(fetchReport, POLL_INTERVAL)
    }
}

async function retryAnalysis() {
  if (!reportId || retrying.value) return
  retrying.value = true
  try {
    const res = await retryReportApi(reportId)
    uni.redirectTo({ url: `/pages/report-detail/index?id=${res.data.report_id}` })
  } catch (error: any) {
    uni.showToast({ title: error.message || '重试失败', icon: 'none' })
  } finally { retrying.value = false }
}
function selectForDaily() {
  if (!reportId) return
  setSelectedReport(reportId)
  isDailySelected.value = true
  uni.switchTab({ url: '/pages/home/index' })
}

function processCompletedReport(data: ReportDetail) {
  report.value = data
  status.value = data.status || 'completed'

  // Parse yun data
  const yun = (data.calendar_data as any)?.yun
  if (yun?.da_yun) {
    const currentYear = new Date().getFullYear()
    yunDisplay.value = {
      startAge: yun.start_year_num || 0,
      startMonths: yun.start_month_num || 0,
      startDays: yun.start_day_num || 0,
      startSolarDate: yun.start_solar_date,
      isForward: yun.is_forward,
      daYun: yun.da_yun.map((dy: any) => ({
        ...dy,
        ganZhi: dy.gan_zhi,
        startAge: dy.start_age,
        endAge: dy.end_age,
        startYear: dy.start_year,
        endYear: dy.end_year,
        isCurrent: currentYear >= dy.start_year && currentYear <= dy.end_year,
        expanded: currentYear >= dy.start_year && currentYear <= dy.end_year,
        liuNian: (dy.liu_nian || []).map((ln: any) => ({
          ...ln,
          ganZhi: ln.gan_zhi,
        })),
      })),
    }
    yunSummaryText.value = data.calendar_data.yun_summary || ''
  }

  hasAiAnalysis.value = !!(data.ai_analysis && data.ai_analysis.trim())
  isInitialLoading.value = false
  isLoadError.value = false
}

function getBaziCell(pillarIdx: number, key: string): string {
  if (!report.value?.calendar_data) return '—'
  const p = report.value.calendar_data[pillars[pillarIdx]]
  return p?.[key] ?? '—'
}

</script>
<style scoped>
.demo-banner { margin-bottom: 16px; padding: 10px 14px; border-radius: 12px; background: #fff1db; color: #76551c; font-size: 12px; }
.report-detail-page { padding-top: 20px; }
.report-delete { color: #a53e58; min-height: 44px; margin: 8px auto; font-size: 12px; }
.cover-greeting { display: block; margin-top: 8px; font-size: 12px; line-height: 1.8; color: #71617e; }
.cover-top { gap: 12px; }
.waiting-panel { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 0; min-height: 440px; }
.waiting-panel .eyebrow { margin: 24px 0 8px; }.waiting-panel .page-heading { font-size: 24px; }
.processing-hint { display: block; margin: 16px 0; font-size: 14px; color: #726580; max-width: 300px; line-height: 1.9; }
.processing-birth { display: block; font-size: 12px; color: #777083; margin: 12px 0 24px; }
.waiting-panel .btn-primary, .waiting-panel .btn-secondary { margin-top: 20px; max-width: 300px; }
.waiting-dots { display: flex; gap: 8px; margin: 8px 0; }.waiting-dots view { width: 6px; height: 6px; border-radius: 50%; background: #aa96c7; animation: breathe 1.5s ease-in-out infinite; }.waiting-dots view:nth-child(2) { animation-delay: .2s; }.waiting-dots view:nth-child(3) { animation-delay: .4s; }
@keyframes breathe { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
.report-cover { background: #eee7f8; padding: 24px 20px; border-radius: 24px; }.cover-top { display: flex; align-items: center; justify-content: space-between; }.cover-top .eyebrow { margin: 0; letter-spacing: 1px; }.report-cover .page-heading { font-size: 24px; margin-top: 16px; overflow-wrap: anywhere; }.cover-birth { display: block; font-size: 12px; color: #71617e; margin-top: 8px; overflow-wrap: anywhere; }.cover-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 24px; font-size: 12px; color: #6e5588; }.cover-tags text { border: 1px solid #d8cbe7; padding: 2px 8px; border-radius: 6px; }.report-cover .btn-primary { font-size: 14px; justify-content: space-between; }
.reading-nav { position: sticky; top: 44px; z-index: 5; display: flex; margin: 12px -4px 24px; background: #faf8fc; border-bottom: 1px solid #e9e1f1; padding: 8px 0; }.reading-nav button { flex: 1; min-height: 44px; padding: 0 4px; line-height: 44px; margin: 0; background: none; font-size: 14px; color: #6c5787; }
.report-section { padding: 12px 0 28px; scroll-margin-top: 120px; }.section-kicker { display: block; color: #8a759f; font-size: 12px; letter-spacing: 1px; margin-bottom: 8px; }.section-title { font-size: 18px; margin-bottom: 20px; }.suggestion-panel { background: #f3efe7; padding: 20px; border-radius: 20px; margin: 0 0 32px; }.suggestion-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }.suggestion-heading .section-title { margin: 0; font-size: 16px; }
.pillar-cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }.pillar-card { background: white; border: 1px solid #ece5f2; border-radius: 16px; padding: 16px 4px; text-align: center; }.pillar-card:nth-child(3) { background: #eee7f8; border-color: #d8c9e9; }.pillar-label { display: block; font-size: 12px; color: #776882; }.pillar-gz { display: block; font-size: 24px; font-weight: 600; margin: 12px 0; color: #5c477c; }.pillar-element { display: block; font-size: 12px; color: #776882; }.chart-toggle { width: 100%; margin-top: 12px; font-size: 12px; }
.bazi-table { background: white; border-radius: 16px; padding: 8px; margin-top: 12px; }.bazi-header, .bazi-row { display: grid; grid-template-columns: 48px repeat(4,minmax(0,1fr)); }.bazi-header { background: #f6f1fb; border-radius: 8px; }.bazi-header text, .bazi-row text { font-size: 12px; text-align: center; padding: 10px 2px; overflow-wrap: anywhere; }.bazi-row { border-bottom: 1px solid #f0ebf6; }.bazi-label { color: #84768e; }.palace-line { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 4px 8px; font-size: 12px; color: #776882; }
.yun-summary-text { display: block; font-size: 14px; color: #726580; line-height: 1.9; }.expand-hint { display: block; font-size: 12px; color: #8a759f; margin: 16px 0; }.dayun-item { border-bottom: 1px solid #eae3f1; }.dayun-header { display: flex; align-items: center; gap: 16px; min-height: 72px; width: 100%; padding: 12px; margin: 4px 0; background: none; text-align: left; line-height: 1.6; color: #302b40; border-radius: 12px; }.dayun-current { background: #eee7f8; }.dayun-ganzhi { font-size: 18px; font-weight: 600; color: #6b508c; }.dayun-dates { flex: 1; font-size: 14px; }.dayun-year { display: block; font-size: 12px; color: #81728e; margin-top: 4px; }.current-tag { font-size: 12px; color: #765d93; margin-left: 8px; }.dayun-arrow { color: #8c77a4; font-size: 18px; }.liunian-list { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; padding: 8px 0 16px; }.liunian-item { background: white; padding: 10px; border-radius: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }.liunian-item text:last-child { color: #887895; }.yun-comment { margin-top: 28px; }.report-ending { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #7c698c; margin: 8px 0 24px; }
</style>
