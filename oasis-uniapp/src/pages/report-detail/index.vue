<template>
  <view class="report-detail-page">
    <!-- 排队中 / 分析中 -->
    <view class="card" v-if="status === 'pending' || status === 'processing'">
      <view class="processing-view">
        <view class="processing-spinner"></view>
        <text class="processing-title">AI 正在分析您的命盘</text>
        <text class="processing-hint">{{ statusMessage }}</text>
        <text class="processing-birth" v-if="report">{{ report.birth_info }}</text>
      </view>
    </view>

    <!-- 失败 / 超时 -->
    <view class="card" v-if="status === 'failed' || status === 'timeout'">
      <view class="error-view">
        <text class="error-icon">⚠️</text>
        <text class="error-title">分析{{ status === 'timeout' ? '超时' : '失败' }}</text>
        <text class="error-message">{{ statusMessage }}</text>
        <button class="retry-btn" @click="resetPolling">重新获取</button>
      </view>
    </view>

    <!-- 初始加载中 -->
    <LoadingOverlay v-if="isInitialLoading && !report && status !== 'failed' && status !== 'timeout'" text="加载报告..." />

    <!-- 加载出错（非分析失败） -->
    <view class="card" v-if="isLoadError && !report && status !== 'failed' && status !== 'timeout' && status !== 'pending' && status !== 'processing'">
      <ErrorRetry @retry="resetPolling" />
    </view>

    <!-- 报告内容 -->
    <template v-if="report && report.calendar_data">
      <!-- 基本信息 -->
      <view class="card">
        <text class="section-title">📋 基本信息</text>
        <view class="info-grid">
          <text class="info-item">{{ report.birth_info }}</text>
          <text class="info-item" v-if="report.calendar_data.animal">生肖：{{ report.calendar_data.animal }}</text>
          <text class="info-item" v-if="report.calendar_data.lunar_date">农历：{{ report.calendar_data.lunar_date }}</text>
        </view>
      </view>

      <!-- 八字四柱 -->
      <view class="card" v-if="report.calendar_data.full_bazi">
        <text class="section-title">🪐 八字四柱</text>
        <view class="bazi-header">
          <text class="bazi-header-cell"></text>
          <text class="bazi-header-cell">年柱</text>
          <text class="bazi-header-cell">月柱</text>
          <text class="bazi-header-cell">日柱</text>
          <text class="bazi-header-cell">时柱</text>
        </view>
        <view class="bazi-row" v-for="col in baziColumns" :key="col.key">
          <text class="bazi-label">{{ col.label }}</text>
          <text class="bazi-cell">{{ getBaziCell(0, col.key) }}</text>
          <text class="bazi-cell">{{ getBaziCell(1, col.key) }}</text>
          <text class="bazi-cell">{{ getBaziCell(2, col.key) }}</text>
          <text class="bazi-cell">{{ getBaziCell(3, col.key) }}</text>
        </view>
      </view>

      <!-- 大运流年 -->
      <view class="card" v-if="yunDisplay">
        <text class="section-title">📅 大运流年</text>
        <view class="yun-summary" v-if="yunDisplay.startSolarDate">
          <text class="yun-summary-text">起运：{{ yunDisplay.startSolarDate }}（{{ yunDisplay.startAge }}岁{{ yunDisplay.isForward ? '顺行' : '逆行' }}）</text>
        </view>
        <view class="dayun-item" v-for="dy in yunDisplay.daYun" :key="dy.index" @click="dy.expanded = !dy.expanded">
          <view class="dayun-header" :class="{ 'dayun-current': dy.isCurrent }">
            <text class="dayun-ganzhi">{{ dy.ganZhi }}</text>
            <text class="dayun-age">{{ dy.startAge }}-{{ dy.endAge }}岁</text>
            <text class="dayun-year">{{ dy.startYear }}-{{ dy.endYear }}</text>
            <text class="dayun-arrow">{{ dy.expanded ? '▼' : '▶' }}</text>
          </view>
          <view class="liunian-list" v-if="dy.expanded">
            <text class="liunian-item" v-for="ln in dy.liuNian" :key="ln.year">{{ ln.year }}({{ ln.age }}岁) {{ ln.ganZhi }}</text>
          </view>
        </view>
      </view>

      <!-- 大运评语 -->
      <view class="card" v-if="yunSummaryText">
        <text class="section-title">📝 大运评语</text>
        <text class="yun-summary-text-body">{{ yunSummaryText }}</text>
      </view>

      <!-- 命宫 · 身宫 -->
      <view class="card" v-if="report.calendar_data.ming_gong || report.calendar_data.shen_gong">
        <text class="section-title">🏛️ 命宫 · 身宫</text>
        <view class="palace-row">
          <text class="palace-label">命宫</text>
          <text class="palace-value">{{ report.calendar_data.ming_gong || '—' }}</text>
        </view>
        <view class="palace-row">
          <text class="palace-label">身宫</text>
          <text class="palace-value">{{ report.calendar_data.shen_gong || '—' }}</text>
        </view>
        <view class="palace-row" v-if="report.calendar_data.tai_yuan">
          <text class="palace-label">胎元</text>
          <text class="palace-value">{{ report.calendar_data.tai_yuan }}</text>
        </view>
      </view>

      <!-- AI 命理分析 -->
      <view class="card" v-if="hasAiAnalysis">
        <text class="section-title">🤖 AI 命理分析</text>
        <text class="ai-text">{{ report.ai_analysis }}</text>
      </view>
      <view class="card" v-else>
        <text class="section-title">🤖 AI 命理分析</text>
        <text class="empty-text">AI 分析未生成</text>
      </view>

      <!-- 分析日志 -->
      <view class="card" v-if="report.analysis_logs && report.analysis_logs.length > 0">
        <text class="section-title">📊 分析日志</text>
        <view class="log-item" v-for="(lg, idx) in report.analysis_logs" :key="idx">
          <view class="log-header">
            <text class="log-model">{{ lg.model_name }}</text>
            <text class="log-status" :class="lg.status === 'success' ? 'log-success' : 'log-error'">{{ lg.status === 'success' ? '✓' : '✗' }}</text>
          </view>
          <view class="log-detail">
            <text class="log-meta">{{ formatLatency(lg.latency_ms) }}</text>
            <text class="log-meta" v-if="lg.total_tokens">{{ lg.total_tokens }} tokens</text>
            <text class="log-meta" v-if="lg.trace_id">{{ lg.trace_id }}</text>
          </view>
        </view>
      </view>

      <!-- 页脚 -->
      <view class="report-footer">
        <text class="footer-text">创建于 {{ report.created_at }}</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getReportDetailApi, type ReportDetail } from '@/api/xiaoyi'
import ErrorRetry from '@/components/ErrorRetry.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'

const MAX_POLLS = 60
const POLL_INTERVAL = 2000

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

let reportId: number | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollCount = 0

onLoad((options: any) => {
  uni.setNavigationBarTitle({ title: '分析报告' })

  if (!options?.id) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    uni.navigateBack()
    return
  }
  reportId = parseInt(options.id)
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
  // 然后每 2 秒轮询
  pollTimer = setInterval(fetchReport, POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function resetPollingState() {
  stopPolling()
  pollCount = 0
  isInitialLoading.value = true
  isLoadError.value = false
}

function resetPolling() {
  resetPollingState()
  startPolling()
}

function fetchReport() {
  if (!reportId) return

  pollCount++
  if (pollCount > MAX_POLLS) {
    stopPolling()
    status.value = 'timeout'
    statusMessage.value = '分析超时，AI 服务响应较慢，请返回重试'
    isInitialLoading.value = false
    isLoadError.value = true
    return
  }

  getReportDetailApi(reportId)
    .then((res) => {
      const data = res.data
      const st = data?.status || 'completed'

      if (st === 'pending' || st === 'processing') {
        report.value = data
        status.value = st
        isInitialLoading.value = true
        isLoadError.value = false
        statusMessage.value = st === 'pending'
          ? '正在准备分析...'
          : 'AI 正在分析您的命盘，预计需要 30-60 秒...'
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

      // completed
      stopPolling()
      processCompletedReport(data)
    })
    .catch(() => {
      if (!pollTimer) {
        // timer already stopped, show error
        isLoadError.value = true
        isInitialLoading.value = false
      }
      // if timer is still running, silently retry on next poll
    })
}

function processCompletedReport(data: ReportDetail) {
  report.value = data
  status.value = data.status || 'completed'

  // Parse yun data
  const yun = (data.calendar_data as any)?.yun
  if (yun?.da_yun) {
    const currentYear = new Date().getFullYear()
    yunDisplay.value = {
      startAge: yun.start_age_num || 0,
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

function formatLatency(ms: number): string {
  if (!ms) return ''
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}
</script>

<style lang="scss" scoped>
.report-detail-page { padding-bottom: 1.875rem; }
.section-title {
  font-size: 32rpx;
  font-weight: 600;
  display: block;
  margin-bottom: 16rpx;
}

/* Processing view */
.processing-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 0;
}
.processing-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 0.1875rem solid #e0e0e0;
  border-top-color: #2c5f2d;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24rpx;
}
@keyframes spin { to { transform: rotate(360deg); } }
.processing-title {
  font-size: 32rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.processing-hint {
  font-size: 26rpx;
  color: #7a7a7a;
  text-align: center;
  padding: 0 1.5rem;
}
.processing-birth {
  font-size: 22rpx;
  color: #7a7a7a;
  margin-top: 24rpx;
}

/* Error view */
.error-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 0;
}
.error-icon { font-size: 2.5rem; margin-bottom: 16rpx; }
.error-title { font-size: 32rpx; font-weight: 600; margin-bottom: 12rpx; }
.error-message {
  font-size: 26rpx;
  color: #7a7a7a;
  text-align: center;
  padding: 0 1.5rem;
  margin-bottom: 24rpx;
}
.retry-btn {
  background: #2c5f2d;
  color: #fff;
  border-radius: 1.25rem;
  padding: 0.375rem 1.5rem;
  border: none;
  font-size: 28rpx;
}

/* Info grid */
.info-grid { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.info-item {
  font-size: 26rpx;
  color: #555555;
  background: #f5f5f5;
  padding: 0.25rem 0.5rem;
  border-radius: 8rpx;
}

/* Bazi table */
.bazi-header, .bazi-row { display: flex; }
.bazi-header-cell {
  flex: 1;
  text-align: center;
  font-size: 22rpx;
  font-weight: 600;
  color: #7a7a7a;
  padding: 0.25rem 0;
}
.bazi-label {
  width: 3.75rem;
  font-size: 22rpx;
  color: #7a7a7a;
  padding: 0.1875rem 0.125rem;
}
.bazi-cell {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  padding: 0.1875rem 0.0625rem;
  border-bottom: 0.03125rem solid #e0e0e0;
}

/* Dayun */
.yun-summary { margin-bottom: 16rpx; }
.yun-summary-text { font-size: 26rpx; color: #555555; }
.yun-summary-text-body { font-size: 26rpx; line-height: 1.8; color: #111111; }
.dayun-item { padding: 0.375rem 0; border-bottom: 0.03125rem solid #f5f5f5; }
.dayun-header { display: flex; align-items: center; gap: 12rpx; }
.dayun-current { background: #e8f5e9; margin: -0.25rem -0.375rem; padding: 0.25rem 0.375rem; border-radius: 8rpx; }
.dayun-ganzhi { font-size: 32rpx; font-weight: 600; color: #2c5f2d; }
.dayun-age { font-size: 26rpx; color: #555555; }
.dayun-year { font-size: 22rpx; color: #7a7a7a; flex: 1; }
.dayun-arrow { font-size: 22rpx; color: #7a7a7a; }
.liunian-list { display: flex; flex-wrap: wrap; gap: 0.125rem; margin-top: 12rpx; padding-left: 1.5rem; }
.liunian-item { font-size: 22rpx; color: #555555; background: #f5f5f5; padding: 0.125rem 0.375rem; border-radius: 8rpx; }

/* Palace */
.palace-row { display: flex; align-items: center; margin-bottom: 0.25rem; }
.palace-label { font-size: 26rpx; color: #7a7a7a; width: 2.5rem; }
.palace-value { font-size: 28rpx; color: #111111; }

/* AI text */
.ai-text { font-size: 28rpx; line-height: 2; color: #111111; white-space: pre-wrap; }
.empty-text { font-size: 26rpx; color: #7a7a7a; text-align: center; padding: 1.25rem 0; }

/* Logs */
.log-item { padding: 0.375rem 0; border-bottom: 0.03125rem solid #f5f5f5; }
.log-header { display: flex; justify-content: space-between; margin-bottom: 0.125rem; }
.log-model { font-size: 26rpx; font-weight: 500; }
.log-status { font-size: 26rpx; }
.log-success { color: #2e7d32; }
.log-error { color: #c62828; }
.log-detail { display: flex; gap: 0.5rem; }
.log-meta { font-size: 22rpx; color: #7a7a7a; }

/* Footer */
.report-footer { text-align: center; padding: 32rpx 0; }
.footer-text { font-size: 22rpx; color: #7a7a7a; }
</style>
