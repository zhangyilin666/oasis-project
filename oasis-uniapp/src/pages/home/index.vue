<template>
  <view class="home-page">
    <view class="home-header">
      <text class="header-title">小易</text>
      <text class="header-date">{{ todayStr }}</text>
    </view>

    <!-- 每日运势骨架屏 -->
    <view class="card fortune-skeleton" v-if="isFortuneLoading && !fortune">
      <view class="fortune-header-placeholder"></view>
      <view class="skeleton" style="height: 28rpx; margin-bottom: 16rpx"></view>
      <view class="skeleton" style="height: 28rpx; width: 60%"></view>
      <view class="skeleton" style="height: 28rpx"></view>
    </view>

    <!-- 每日运势 -->
    <view class="card fortune-card" v-if="fortune">
      <view class="fortune-head">
        <view class="fortune-head-left">
          <text class="fortune-title">🔮 今日运势</text>
          <text class="fortune-ganzhi">{{ fortune.day_gan_zhi }}日</text>
        </view>
        <view class="fortune-badge-wrap">
          <text class="fortune-relation-badge">{{ fortune.day_relation }}</text>
        </view>
      </view>
      <view class="fortune-body">
        <text class="fortune-text">{{ fortune.fortune_text }}</text>
      </view>
      <view class="fortune-tags">
        <view class="fortune-tag" v-if="fortune.lucky_color">
          <text class="tag-icon">🎨</text>
          <text class="tag-text">幸运色：{{ fortune.lucky_color }}</text>
        </view>
        <view class="fortune-tag" v-if="fortune.lucky_direction">
          <text class="tag-icon">🧭</text>
          <text class="tag-text">幸运方位：{{ fortune.lucky_direction }}</text>
        </view>
        <view class="fortune-tag" v-if="fortune.clash_info">
          <text class="tag-icon">⚠️</text>
          <text class="tag-text">{{ fortune.clash_info }}</text>
        </view>
      </view>
      <view class="fortune-warning" v-if="fortune.warning && fortune.warning !== '无'">
        <text class="warning-text">💡 {{ fortune.warning }}</text>
      </view>
    </view>

    <!-- 未完成分析引导 -->
    <view class="card fortune-guide" v-if="isFortuneError && fortuneErrorCode === 400">
      <view class="guide-content">
        <text class="guide-icon">🔮</text>
        <text class="guide-title">解锁今日运势</text>
        <text class="guide-desc">完成八字分析后，每天都能看到专属于您的运势解读</text>
        <button class="guide-btn" @click="goAnalyze">👉 立即分析八字</button>
      </view>
    </view>

    <!-- 黄历卡片 -->
    <view class="card almanac-card" v-if="almanac">
      <view class="almanac-top">
        <view class="almanac-date-row">
          <text class="lunar-date">{{ almanac.lunar_year_cn }}{{ almanac.lunar_month_cn }}{{ almanac.lunar_day_cn }}</text>
        </view>
        <view class="almanac-ganzhi">
          <text class="ganzhi-text">{{ almanac.year_gan_zhi }}</text>
          <text class="animal-text">{{ almanac.animal }}年</text>
        </view>
      </view>
      <view class="divider"></view>
      <view class="almanac-chong" v-if="almanac.chong_sheng_xiao">
        <text class="chong-label">冲煞</text>
        <text class="chong-value">{{ almanac.chong_sheng_xiao }}</text>
      </view>
      <view class="almanac-section" v-if="almanac.yi.length > 0">
        <text class="section-label yi-label">宜</text>
        <view class="tag-list">
          <text class="tag-yi" v-for="(y, idx) in almanac.yi" :key="'yi-' + idx">{{ y }}</text>
        </view>
      </view>
      <view class="almanac-section" v-if="almanac.ji.length > 0">
        <text class="section-label ji-label">忌</text>
        <view class="tag-list">
          <text class="tag-ji" v-for="(j, idx) in almanac.ji" :key="'ji-' + idx">{{ j }}</text>
        </view>
      </view>
      <view class="almanac-section" v-if="almanac.ji_shen.length > 0">
        <text class="section-label">吉神</text>
        <view class="tag-list">
          <text class="tag-ji-shen" v-for="(s, idx) in almanac.ji_shen" :key="'js-' + idx">{{ s }}</text>
        </view>
      </view>
      <view class="almanac-section" v-if="almanac.xiong_sha.length > 0">
        <text class="section-label">凶煞</text>
        <view class="tag-list">
          <text class="tag-ji" v-for="(x, idx) in almanac.xiong_sha" :key="'xs-' + idx">{{ x }}</text>
        </view>
      </view>
    </view>

    <!-- 黄历骨架屏 -->
    <view class="card" v-if="isAlmanacLoading && !almanac">
      <view class="skeleton" style="height: 28rpx; margin-bottom: 16rpx"></view>
      <view class="skeleton" style="height: 28rpx; width: 60%"></view>
      <view class="skeleton" style="height: 28rpx"></view>
    </view>

    <ErrorRetry v-if="isAlmanacError && !almanac" @retry="loadAlmanac" />

    <!-- 快速操作 -->
    <view class="quick-actions">
      <button class="btn-analyze" @click="goAnalyze">🪐 立即分析八字</button>
    </view>

    <!-- 简介卡片 -->
    <view class="card intro-card">
      <text class="intro-title">关于小易</text>
      <text class="intro-text">
        基于传统历法（lunar-python）和 AI 大模型，为您提供专业的八字命理分析、
        五行生克解读、运势建议及每日黄历宜忌查询。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { getAlmanacApi, getDailyFortuneApi, type AlmanacDay, type DailyFortune } from '@/api/xiaoyi'
import { getToken } from '@/utils/storage'
import { useAuthStore } from '@/stores/auth'
import ErrorRetry from '@/components/ErrorRetry.vue'

const fortune = ref<DailyFortune | null>(null)
const isFortuneLoading = ref(true)
const isFortuneError = ref(false)
const fortuneErrorCode = ref(0)

const almanac = ref<AlmanacDay | null>(null)
const isAlmanacLoading = ref(true)
const isAlmanacError = ref(false)

const todayStr = ref('')

let fortunePromise: Promise<void> | null = null
let almanacPromise: Promise<void> | null = null

// 初始化日期字符串
{
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  todayStr.value = `${y}-${m}-${d}`
}

onShow(() => {
  // 等待认证完成后再加载数据，避免无 token 时 API 调用全部 401
  const auth = useAuthStore()
  if (auth.isLoggedIn || getToken()) {
    loadAll()
  } else {
    // 认证尚未完成，监听登录状态
    const stop = watch(
      () => auth.isLoggedIn,
      (loggedIn) => {
        if (loggedIn) {
          stop()
          loadAll()
        }
      },
    )
  }
})

function loadAll() {
  isAlmanacLoading.value = true
  isAlmanacError.value = false
  isFortuneLoading.value = true
  isFortuneError.value = false
  fortunePromise = loadFortune()
  almanacPromise = loadAlmanac()
}

async function loadFortune() {
  isFortuneLoading.value = true
  isFortuneError.value = false
  try {
    const res = await getDailyFortuneApi()
    fortune.value = res.data
    isFortuneLoading.value = false
  } catch (e: any) {
    isFortuneError.value = true
    isFortuneLoading.value = false
    fortuneErrorCode.value = e?.code || 0
  }
}

async function loadAlmanac() {
  isAlmanacLoading.value = true
  isAlmanacError.value = false
  try {
    const res = await getAlmanacApi()
    almanac.value = res.data
    isAlmanacLoading.value = false
  } catch {
    isAlmanacError.value = true
    isAlmanacLoading.value = false
  }
}

function goAnalyze() {
  uni.navigateTo({ url: '/pages/analyze/index' })
}

onPullDownRefresh(() => {
  loadAll()
  Promise.all([fortunePromise, almanacPromise].filter(Boolean)).finally(() => {
    uni.stopPullDownRefresh()
  })
})
</script>

<style lang="scss" scoped>
.home-page { padding-bottom: 1.25rem; }
.home-header {
  padding: 1.875rem 1.5rem 1rem;
  background: linear-gradient(180deg, #e8f0e8, #f5f5f5);
}
.header-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #2c5f2d;
  display: block;
}
.header-date {
  font-size: 26rpx;
  color: #7a7a7a;
  margin-top: 0.25rem;
  display: block;
}

/* Fortune card */
.fortune-skeleton { padding: 1rem; min-height: 6.25rem; }
.fortune-header-placeholder { height: 1.25rem; background: #f0f0f0; border-radius: 8rpx; margin-bottom: 0.75rem; width: 50%; }
.fortune-card { padding: 0.75rem; }
.fortune-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
.fortune-title { font-size: 32rpx; font-weight: 600; display: block; }
.fortune-ganzhi { font-size: 26rpx; color: #7a7a7a; margin-top: 0.125rem; display: block; }
.fortune-relation-badge { background: #e8f5e9; color: #2c5f2d; padding: 0.125rem 0.5rem; border-radius: 0.625rem; font-size: 26rpx; font-weight: 500; }
.fortune-text { font-size: 28rpx; line-height: 1.8; color: #111111; }
.fortune-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem; }
.fortune-tag { display: flex; align-items: center; background: #f5f5f5; border-radius: 8rpx; padding: 0.25rem 0.5rem; }
.tag-icon { margin-right: 0.1875rem; font-size: 26rpx; }
.tag-text { font-size: 22rpx; color: #555555; }
.fortune-warning { margin-top: 0.5rem; padding: 0.375rem; background: #fff8e1; border-radius: 8rpx; }
.warning-text { font-size: 22rpx; color: #e65100; }

/* Guide card (no analysis yet) */
.fortune-guide { padding: 1.5rem 0.75rem; text-align: center; }
.guide-content { display: flex; flex-direction: column; align-items: center; }
.guide-icon { font-size: 2rem; margin-bottom: 0.5rem; }
.guide-title { font-size: 34rpx; font-weight: 600; margin-bottom: 0.375rem; }
.guide-desc { font-size: 26rpx; color: #7a7a7a; margin-bottom: 0.75rem; }
.guide-btn { background: linear-gradient(135deg, #2c5f2d, #1b3e1b); color: #fff; border-radius: 1.25rem; padding: 0.5rem 1.5rem; border: none; font-size: 28rpx; }

/* Almanac card */
.almanac-card { padding: 0.75rem; }
.almanac-top { display: flex; justify-content: space-between; align-items: center; }
.lunar-date { font-size: 34rpx; font-weight: 600; color: #2c5f2d; }
.ganzhi-text { font-size: 28rpx; color: #555555; }
.animal-text { font-size: 26rpx; color: #7a7a7a; margin-left: 0.25rem; }
.almanac-chong { display: flex; align-items: center; padding: 0.375rem 0; }
.chong-label { font-size: 22rpx; color: #7a7a7a; background: #f5f5f5; padding: 0.0625rem 0.375rem; border-radius: 0.125rem; margin-right: 0.375rem; }
.chong-value { font-size: 28rpx; color: #d32f2f; font-weight: 500; }
.almanac-section { display: flex; margin-bottom: 0.375rem; }
.section-label { font-size: 28rpx; font-weight: 600; min-width: 1.875rem; padding-top: 0.1875rem; }
.yi-label { color: #2e7d32; }
.ji-label { color: #c62828; }
.tag-list { display: flex; flex-wrap: wrap; gap: 0.25rem; flex: 1; }

/* Quick actions */
.quick-actions { padding: 0 1.5rem; margin-top: 1rem; }
.btn-analyze { width: 100%; background: linear-gradient(135deg, #2c5f2d, #1b3e1b); color: #fff; border-radius: 1.375rem; height: 2.75rem; line-height: 2.75rem; font-size: 32rpx; font-weight: 600; border: none; text-align: center; }

/* Intro card */
.intro-card { padding: 0.75rem; margin-top: 0.75rem; }
.intro-title { font-size: 28rpx; font-weight: 600; display: block; margin-bottom: 0.375rem; }
.intro-text { font-size: 26rpx; color: #555555; line-height: 1.8; }
</style>
