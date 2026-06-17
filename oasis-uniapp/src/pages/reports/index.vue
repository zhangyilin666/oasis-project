<template>
  <view class="reports-page">
    <!-- 报告列表 -->
    <template v-if="!isEmpty && !isError">
      <view class="card report-item" v-for="r in reports" :key="r.id" @click="goDetail(r.id)">
        <view class="report-item-header">
          <text class="report-info">{{ r.birth_info }}</text>
          <text class="report-arrow">→</text>
        </view>
        <text class="report-preview" v-if="r.ai_analysis_preview">{{ r.ai_analysis_preview }}...</text>
        <text class="report-date">{{ r.created_at }}</text>
      </view>
    </template>

    <!-- 加载更多 -->
    <view class="load-more" v-if="isLoadingMore">
      <text>正在加载...</text>
    </view>

    <!-- 已加载全部 -->
    <view class="load-more" v-if="!hasMore && reports.length > 0">
      <text class="no-more">— 共 {{ total }} 条报告 —</text>
    </view>

    <!-- 空状态 -->
    <EmptyState v-if="isEmpty && !isLoadingMore && !isError" message="还没有分析报告" hint="前往首页开始你的第一次八字分析" />

    <!-- 错误状态 -->
    <ErrorRetry v-if="isError && !isLoadingMore" @retry="loadReports" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getReportsApi, type ReportSummary } from '@/api/xiaoyi'
import EmptyState from '@/components/EmptyState.vue'
import ErrorRetry from '@/components/ErrorRetry.vue'

const PAGE_SIZE = 20

const reports = ref<ReportSummary[]>([])
const total = ref(0)
const skip = ref(0)
const hasMore = ref(true)
const isEmpty = ref(false)
const isError = ref(false)
const isLoadingMore = ref(false)

onShow(() => {
  skip.value = 0
  reports.value = []
  hasMore.value = true
  isEmpty.value = false
  isError.value = false
  loadReports()
})

function loadReports() {
  if (isLoadingMore.value) return
  isLoadingMore.value = true

  const currentSkip = skip.value
  getReportsApi(currentSkip, PAGE_SIZE)
    .then((res) => {
      if (currentSkip === 0) {
        reports.value = res.data.reports
      } else {
        reports.value = [...reports.value, ...res.data.reports]
      }
      total.value = res.data.total
      hasMore.value = reports.value.length < res.data.total
      isEmpty.value = reports.value.length === 0
      isError.value = false
      isLoadingMore.value = false
      uni.stopPullDownRefresh()
    })
    .catch(() => {
      if (currentSkip === 0 && reports.value.length === 0) {
        isError.value = true
        isLoadingMore.value = false
      } else {
        isLoadingMore.value = false
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
      uni.stopPullDownRefresh()
    })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/report-detail/index?id=${id}` })
}

onPullDownRefresh(() => {
  skip.value = 0
  reports.value = []
  hasMore.value = true
  isEmpty.value = false
  isError.value = false
  loadReports()
})

onReachBottom(() => {
  if (!hasMore.value || isLoadingMore.value) return
  skip.value = reports.value.length
  loadReports()
})
</script>

<style lang="scss" scoped>
.reports-page { padding-bottom: 1.25rem; }
.report-item {
  padding: 24rpx;
  margin-bottom: 1rpx;
}
.report-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.report-info {
  font-size: 28rpx;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.report-arrow { color: #7a7a7a; margin-left: 12rpx; }
.report-preview {
  font-size: 26rpx;
  color: #555555;
  margin-top: 12rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.report-date {
  font-size: 22rpx;
  color: #7a7a7a;
  margin-top: 8rpx;
  display: block;
}
.load-more {
  text-align: center;
  padding: 24rpx;
  color: #7a7a7a;
  font-size: 26rpx;
}
</style>
