<template>
  <view class="page-shell home-page">
    <view v-if="DEMO_MODE" class="demo-banner">离线界面体验版 · 以下内容均为示例</view>
    <view class="home-header">
      <view><text class="brand">猫来运转<text class="brand-dot">·</text></text><text class="page-caption">每一天，多懂自己一点</text></view>
      <AppButton class="avatar-button" aria-label="打开我的账号" @click="goProfile"><AppIcon name="cat" /></AppButton>
    </view>
    <view class="daily-panel">
    <view class="welcome-panel">
      <view class="welcome-copy">
        <text class="date-label">{{ todayStr }}</text>
        <text class="welcome-title">每日运势</text>
        <text class="welcome-caption" aria-live="polite" aria-atomic="true">{{ catMessage }}</text>
      </view>
      <AppButton class="cat-greeting" :class="{ 'is-playful': catMood === 'playful' }" aria-label="摸摸三花小猫，听它说句话" @click="greetCat">
        <CatCompanion class="welcome-cat" :mood="catMood" aria-hidden="true" />
        <text class="cat-tap-hint">三花小先生</text>
      </AppButton>
    </view>

    <view v-if="isFortuneLoading" class="content-panel" aria-live="polite">
      <view class="skeleton skeleton-title"></view><view class="skeleton skeleton-line"></view><view class="skeleton skeleton-line short"></view>
      <view class="daily-loading"><CatCompanion small mood="thinking" /><text class="loading-hint">小猫正在整理今日内容，稍等一下…</text></view>
    </view>
    <view v-else-if="fortune" class="content-panel fortune-panel">
      <view class="fortune-heading"><text class="fortune-ganzhi">{{ fortune.day_gan_zhi }}日</text><text class="status-chip">{{ fortune.day_relation }}</text></view>
      <AppButton class="person-switch" @click="goReports" aria-label="到报告页切换每日查询对象"><text>{{ fortune.birth_info }}</text><text class="switch-label">切换 ›</text></AppButton>
      <text class="fortune-copy">{{ fortune.fortune_text }}</text>
      <view class="fortune-extras">
        <text v-if="fortune.lucky_color">幸运色 · {{ fortune.lucky_color }}</text>
        <text v-if="fortune.lucky_direction">方位 · {{ fortune.lucky_direction }}</text>
      </view>
      <text class="fortune-reminder" v-if="fortune.warning && fortune.warning !== '无'">{{ fortune.warning }}</text>
    </view>
    <view v-else-if="isFortuneError && fortuneErrorCode === 400" class="content-panel first-step">
      <view class="first-step-icon"><AppIcon name="moon" /></view>
      <view><text class="first-step-title">你的专属解读，从这里开始</text><text class="page-caption">填写出生信息，看看属于你的四柱与大运。</text></view>
      <AppButton class="btn-secondary" @click="goAnalyze">创建第一份报告 <text aria-hidden="true">→</text></AppButton>
    </view>
    <ErrorRetry v-else-if="isFortuneError" message="今日内容暂时没能加载" @retry="loadFortune" />

    </view>

    <view id="today-almanac" class="section-heading"><text class="section-title">翻开今日黄历</text><text class="muted">传统历法</text></view>
    <view v-if="almanac" class="content-panel almanac-panel">
      <view class="almanac-heading"><view><text class="almanac-date">{{ almanac.lunar_month_cn }}月{{ almanac.lunar_day_cn }}</text><text class="page-caption">{{ almanac.year_gan_zhi }} · {{ almanac.animal }}年</text></view><AppIcon name="calendar" /></view>
      <view class="divider"></view>
      <view class="almanac-row"><text class="almanac-label yi-label">宜</text><view class="tag-list"><text class="tag-yi" v-for="y in (almanacExpanded ? almanac.yi : almanac.yi.slice(0, 4))" :key="y">{{ y }}</text></view></view>
      <view class="almanac-row"><text class="almanac-label ji-label">忌</text><view class="tag-list"><text class="tag-ji" v-for="j in (almanacExpanded ? almanac.ji : almanac.ji.slice(0, 4))" :key="j">{{ j }}</text></view></view>
      <template v-if="almanacExpanded">
        <view class="almanac-row"><text class="almanac-label">吉神</text><view class="tag-list"><text class="tag-ji-shen" v-for="s in almanac.ji_shen" :key="s">{{ s }}</text></view></view>
        <view class="almanac-row"><text class="almanac-label">凶煞</text><view class="tag-list"><text class="tag-ji" v-for="x in almanac.xiong_sha" :key="x">{{ x }}</text></view></view>
        <text class="page-caption" v-if="almanac.chong_sheng_xiao">冲生肖 · {{ almanac.chong_sheng_xiao }}</text>
      </template>
      <AppButton class="almanac-toggle text-button" :aria-expanded="almanacExpanded" @click="almanacExpanded = !almanacExpanded">{{ almanacExpanded ? '收起详细黄历 −' : '查看完整黄历 ＋' }}</AppButton>
    </view>
    <view v-else-if="isAlmanacLoading" class="content-panel"><view class="skeleton skeleton-title"></view><view class="skeleton skeleton-line"></view></view>
    <ErrorRetry v-else-if="isAlmanacError" message="黄历暂时没能加载" @retry="loadAlmanac" />
    <AppButton class="almanac-toggle text-button" @click="goAlmanac">按日期查看黄历与交节时刻 ↗</AppButton>
    <view class="primary-entries" role="group" aria-label="选择八字解读或问一卦">
      <AppButton class="primary-entry ming-entry" aria-label="命，八字 AI 解读" @click="goAnalyze">
        <view class="primary-entry-top"><text class="primary-character">命</text><text class="primary-arrow" aria-hidden="true">↗</text></view>
        <text class="primary-title">八字 AI 解读</text>
        <text class="primary-description">填写出生资料<br />读一份专属解读</text>
      </AppButton>
      <AppButton class="primary-entry bu-entry" aria-label="卜，自动起卦与 AI 解读" @click="goDivination">
        <view class="primary-entry-top"><text class="primary-character">卜</text><text class="primary-arrow" aria-hidden="true">↗</text></view>
        <text class="primary-title">问一卦</text>
        <text class="primary-description">带着一个问题<br />起卦，读懂卦意</text>
      </AppButton>
    </view>
    <view class="support-links" role="group" aria-label="报告与记录">
      <AppButton class="support-link" @click="goReports"><AppIcon name="book" /><text>我的报告</text><text aria-hidden="true">↗</text></AppButton>
    </view>
    <text class="footer-note">传统文化与 AI 解读，仅供学习与娱乐参考</text>
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { onShow, onPullDownRefresh, onHide } from '@dcloudio/uni-app'
import { getAlmanacApi, getDailyFortuneApi, type AlmanacDay, type DailyFortune } from '@/api/xiaoyi'
import { getSelectedReport, setSelectedReport, clearSelectedReport } from '@/utils/storage'
import { DEMO_MODE } from '@/config/env'
import ErrorRetry from '@/components/ErrorRetry.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import AppIcon from '@/components/AppIcon.vue'
const fortune = ref<DailyFortune | null>(null)
const isFortuneLoading = ref(true), isFortuneError = ref(false), fortuneErrorCode = ref(0)
const almanac = ref<AlmanacDay | null>(null)
const isAlmanacLoading = ref(true), isAlmanacError = ref(false), almanacExpanded = ref(false)
const todayStr = ref('')
const defaultCatMessage = '认识自己的节奏，认真对待每个问题。'
const catMood = ref<'welcome' | 'playful' | 'comfort'>('welcome')
const catMessage = ref(defaultCatMessage)
const catReplies = [
 { mood: 'playful', message: '被你发现啦，小鱼干分你一半。' },
 { mood: 'comfort', message: '命盘可以慢慢看，问题也可以慢慢想。' },
 { mood: 'playful', message: '有想问的事吗？小猫陪你理一理。' },
] as const
let replyIndex = 0
let catTimer: ReturnType<typeof setTimeout> | undefined
function resetCat() {
 if (catTimer) clearTimeout(catTimer)
 catTimer = undefined
 catMood.value = 'welcome'; catMessage.value = defaultCatMessage
}
function greetCat() {
 if (catTimer) clearTimeout(catTimer)
 const reply = catReplies[replyIndex++ % catReplies.length]
 catMood.value = reply.mood; catMessage.value = reply.message
 catTimer = setTimeout(resetCat, 4500)
}
onUnmounted(resetCat)
let fortuneGeneration = 0, almanacGeneration = 0
onShow(() => {
 const now = new Date()
 todayStr.value = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Shanghai' })
 loadAll()
})
onHide(() => { fortuneGeneration++; almanacGeneration++; resetCat() })
function loadAll() { return Promise.all([loadFortune(), loadAlmanac()]) }
async function loadFortune() {
 const generation = ++fortuneGeneration
 isFortuneLoading.value = true; isFortuneError.value = false; fortune.value = null
 try {
  const selectedId = getSelectedReport()
  let res
  try { res = await getDailyFortuneApi(selectedId) }
  catch (error: any) {
   if (generation !== fortuneGeneration || !selectedId || error?.code !== 400) throw error
   // The selected report may have been removed on another device.
   clearSelectedReport(selectedId)
   res = await getDailyFortuneApi()
  }
  if (generation !== fortuneGeneration) return
  fortune.value = res.data; setSelectedReport(res.data.report_id)
 } catch (e: any) {
  if (generation !== fortuneGeneration) return
  isFortuneError.value = true; fortuneErrorCode.value = e?.code || 0
 } finally { if (generation === fortuneGeneration) isFortuneLoading.value = false }
}
async function loadAlmanac() {
 const generation = ++almanacGeneration
 isAlmanacLoading.value = true; isAlmanacError.value = false
 almanac.value = null
 try {
  const res = await getAlmanacApi()
  if (generation === almanacGeneration) almanac.value = res.data
 } catch { if (generation === almanacGeneration) isAlmanacError.value = true }
 finally { if (generation === almanacGeneration) isAlmanacLoading.value = false }
}
function goAnalyze() { uni.navigateTo({ url: '/pages/analyze/index' }) }
function goDivination() { uni.navigateTo({ url: '/pages/divination/index' }) }
function goAlmanac() { uni.navigateTo({ url: '/pages/almanac/index' }) }
function goReports() { uni.switchTab({ url: '/pages/reports/index' }) }
function goProfile() { uni.switchTab({ url: '/pages/profile/index' }) }
onPullDownRefresh(() => { loadAll().finally(() => uni.stopPullDownRefresh()) })
</script>

<style scoped lang="scss">
.demo-banner { margin-bottom: 16px; padding: 10px 14px; border-radius: 12px; background: #fff1db; color: #76551c; font-size: 12px; }
.home-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.brand { font-size: 28px; font-weight: 600; letter-spacing: 2px; line-height: 1.2; }
.brand-dot { color: #a18abb; margin-left: 4px; }
.home-header .page-caption { margin-top: 4px; font-size: 12px; }
.avatar-button { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: #f0ebfa; border-radius: 50%; padding: 0; margin: 0; }
.daily-panel { padding: 0 18px 18px; border: 1px solid #eae2f1; border-radius: 24px; background: #f4f0f7; overflow: hidden; }
.daily-panel > .content-panel { padding: 16px; border-radius: 16px; }
.welcome-panel { display: grid; grid-template-columns: minmax(0, 1fr) 90px; align-items: center; gap: 12px; padding: 18px 0 16px; box-sizing: border-box; }
.welcome-copy { min-width: 0; }
.date-label { display: block; color: #7a6c84; font-size: 11px; line-height: 1.6; }
.welcome-title { display: block; margin-top: 6px; font-size: 22px; font-weight: 600; line-height: 1.5; }
.welcome-caption { display: block; min-height: 36px; font-size: 11px; line-height: 1.7; color: #796b85; margin-top: 5px; }
.cat-greeting { display: flex; flex-direction: column; align-items: center; width: 90px; padding: 0; margin: 0; background: transparent; border-radius: 16px; line-height: 1.5; transition: transform .18s ease-out; }
.cat-greeting.is-playful { transform: rotate(-3deg); }
.welcome-cat { width: 90px; height: 90px; }
.cat-tap-hint { font-size: 10px; color: #796b85; }
.primary-entries { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: 12px; margin-top: 16px; }
.primary-entry { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; width: 100%; min-height: 194px; margin: 0; padding: 20px 18px; box-sizing: border-box; border: 1px solid var(--entry-border); border-radius: 22px; background: var(--entry-background); color: var(--entry-ink); text-align: left; white-space: normal; line-height: 1.6; }
.ming-entry { --entry-background: #f5f0fa; --entry-border: #d8c9e6; --entry-ink: #6f538c; }
.bu-entry { --entry-background: #eee7f7; --entry-border: #cdbbdc; --entry-ink: #6f538c; }
.primary-entry-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; margin-bottom: 16px; }
.primary-character { font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 44px; font-weight: 600; line-height: 1.1; }
.primary-arrow { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex-shrink: 0; border: 1px solid var(--entry-border); border-radius: 50%; font-size: 19px; line-height: 1; }
.primary-title { display: block; font-size: 18px; font-weight: 600; line-height: 1.5; }
.primary-description { display: block; margin-top: 7px; font-size: 12px; line-height: 1.8; }
.support-links { display: flex; justify-content: center; margin: 14px 0 4px; padding: 4px 0; border-bottom: 1px solid #eae3ef; }
.support-link { display: flex; align-items: center; justify-content: center; gap: 8px; width: auto; min-width: 0; min-height: 44px; padding: 8px 2px; margin: 0; background: transparent; color: #756480; font-size: 12px; line-height: 1.6; }
.support-link .app-icon { width: 17px; height: 17px; }
.daily-loading { display: flex; align-items: center; gap: 8px; }.daily-loading .cat-companion { flex-shrink: 0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 28px 0 12px; }
.section-heading .section-title { margin: 0; }
.content-panel { background: white; border: 1px solid #f0ecf5; border-radius: 20px; padding: 20px; }
.fortune-heading { display: flex; align-items: center; justify-content: space-between; }
.fortune-ganzhi { font-size: 18px; font-weight: 600; }
.person-switch { display: flex; text-align: left; gap: 8px; align-items: center; justify-content: space-between; font-size: 12px; min-height: 44px; line-height: 1.6; color: #726680; padding: 8px 0; margin: 8px 0; background: none; }
.person-switch > text:first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.switch-label { white-space: nowrap; color: #6a509c; }
.fortune-copy { display: block; overflow-wrap: anywhere; font-size: 16px; line-height: 1.9; white-space: pre-wrap; }
.fortune-extras { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; font-size: 12px; color: #6d5887; }
.fortune-extras text { background: #f5f1fa; border-radius: 8px; padding: 6px 10px; }
.fortune-reminder { display: block; background: #fcf4e9; color: #906438; padding: 12px; border-radius: 12px; margin-top: 12px; font-size: 14px; }
.first-step { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 12px; }
.first-step-title { font-size: 16px; font-weight: 600; }
.first-step .page-caption { margin-top: 8px; line-height: 1.8; }
.first-step .btn-secondary { grid-column: 1/-1; margin-top: 8px; font-size: 14px; }
.almanac-heading { display: flex; align-items: center; justify-content: space-between; }
.almanac-date { font-size: 18px; font-weight: 600; }
.almanac-heading .page-caption { margin-top: 4px; font-size: 12px; }
.almanac-row { display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }
.almanac-label { min-width: 28px; padding-top: 4px; font-size: 14px; font-weight: 600; }
.yi-label { color: #387361; }.ji-label { color: #a64b61; }
.tag-list { display: flex; flex-wrap: wrap; gap: 8px; }
.almanac-toggle { width: 100%; min-height: 44px; white-space: normal; margin-top: 8px; border-top: 1px solid #f0ecf5; padding-top: 12px; }
.footer-note { font-size: 12px; margin-top: 16px; }
.skeleton-title { height: 20px; width: 40%; margin-bottom: 20px; }.skeleton-line { height: 14px; margin: 12px 0; }.short { width: 75%; }.loading-hint { font-size: 12px; color: var(--color-text-muted); }
@media (max-width: 350px) { .home-page { padding-left: 16px; padding-right: 16px; }.daily-panel { padding: 0 14px 14px; }.daily-panel > .content-panel { padding: 14px; }.welcome-panel { padding: 14px 0; grid-template-columns: minmax(0, 1fr) 76px; gap: 8px; }.cat-greeting { width: 76px; }.welcome-cat { width: 76px; height: 76px; }.welcome-title { font-size: 19px; }.date-label { font-size: 10px; }.primary-entries { gap: 10px; }.primary-entry { min-height: 180px; padding: 17px 13px; border-radius: 19px; }.primary-character { font-size: 42px; }.primary-title { font-size: 17px; }.primary-description { font-size: 11px; }.primary-arrow { width: 25px; height: 25px; font-size: 18px; }.support-link { gap: 4px; font-size: 11px; }.support-link .app-icon { width: 15px; height: 15px; } }
@media (prefers-reduced-motion: reduce) { .cat-greeting { transition: none; }.cat-greeting.is-playful { transform: none; } }
</style>
