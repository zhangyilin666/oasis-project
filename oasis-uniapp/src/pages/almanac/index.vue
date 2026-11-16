<template>
  <view class="page-shell almanac-page">
    <view class="intro">
      <view class="intro-copy"><text class="eyebrow">传统历法 · 日期浏览</text><text class="page-heading">翻一页日历，<br />看一程时序。</text><text class="page-caption">农历、干支与二十四节气，随日期慢慢读。</text></view>
      <CatCompanion class="intro-cat" mood="thinking" />
    </view>

    <view class="panel date-panel">
      <view class="date-time-grid">
        <view class="form-group"><text class="form-label">公历日期</text><picker mode="date" :value="selectedDate" :start="ALMANAC_MIN_DATE" :end="ALMANAC_MAX_DATE" aria-label="选择黄历公历日期" @change="selectedDate = $event.detail.value"><view class="form-picker">{{ selectedDate }}<text aria-hidden="true">⌄</text></view></picker></view>
        <view class="form-group"><text class="form-label">查看时刻 · UTC+8</text><picker mode="time" :value="selectedTime" aria-label="选择查看时刻，固定 UTC 加八小时" @change="selectedTime = $event.detail.value"><view class="form-picker">{{ selectedTime }}<text aria-hidden="true">⌄</text></view></picker></view>
      </view>
      <text class="small-copy">1900–2099 年 · 默认正午 12:00 · 固定 UTC+08:00。时刻用于判断交节前后。</text>
      <view class="date-navigation" role="group" aria-label="浏览相邻日期"><AppButton class="date-button" :disabled="selectedDate <= ALMANAC_MIN_DATE" @click="moveDate(-1)">← 前一天</AppButton><AppButton class="date-button today-button" @click="showToday">今天</AppButton><AppButton class="date-button" :disabled="selectedDate >= ALMANAC_MAX_DATE" @click="moveDate(1)">后一天 →</AppButton></view>
      <text v-if="errorMessage" class="error-note" role="alert">{{ errorMessage }}</text>
    </view>

    <template v-if="result">
      <view class="panel calendar-panel" aria-live="polite">
        <view class="calendar-header"><text class="eyebrow">{{ result.input.date }} · {{ result.observation.weekday }}</text><text class="animal-label">{{ result.lunar.animal }}年</text></view>
        <text class="lunar-date" selectable>{{ result.lunar.label }}</text>
        <text v-if="result.lunar.isLeapMonth" class="leap-note">本日位于闰{{ result.lunar.month }}月</text>
        <view class="ganzhi-grid">
          <view class="ganzhi-item"><text class="fact-label">农历年干支</text><text class="ganzhi-value">{{ result.ganzhi.lunarYear }}</text><text class="fact-rule">春节 00:00 换年</text></view>
          <view class="ganzhi-item"><text class="fact-label">节气年干支</text><text class="ganzhi-value">{{ result.ganzhi.solarTermYear }}</text><text class="fact-rule">立春交节换年</text></view>
          <view class="ganzhi-item"><text class="fact-label">节令月干支</text><text class="ganzhi-value">{{ result.ganzhi.solarTermMonth }}</text><text class="fact-rule">十二节交节换月</text></view>
          <view class="ganzhi-item"><text class="fact-label">日干支</text><text class="ganzhi-value">{{ result.ganzhi.day }}</text><text class="fact-rule">00:00 换日</text></view>
        </view>
      </view>

      <view class="panel term-panel">
        <text class="eyebrow">天文历法 · 二十四节气</text><text class="panel-title">此刻处于{{ result.solarTerms.current }}区间</text>
        <text class="small-copy">以 {{ result.input.date }} {{ result.input.time }}（UTC+08:00）为准。</text>
        <view class="term-timeline">
          <view class="term-event current-event"><view class="term-dot" /><view class="term-copy"><text class="fact-label">上一交节 · 当前区间起点</text><text class="term-name">{{ result.solarTerms.previous.name }}<text class="term-kind">{{ result.solarTerms.previous.kind }}</text></text><text class="term-time" selectable>{{ result.solarTerms.previous.beijingTime }}</text></view></view>
          <view class="term-event"><view class="term-dot" /><view class="term-copy"><text class="fact-label">下一交节</text><text class="term-name">{{ result.solarTerms.next.name }}<text class="term-kind">{{ result.solarTerms.next.kind }}</text></text><text class="term-time" selectable>{{ result.solarTerms.next.beijingTime }}</text></view></view>
        </view>
        <text class="small-copy">以上均为 UTC+08:00。{{ result.solarTerms.precisionNote }}</text>
        <AppButton class="text-button" @click="openSource('https://www.hko.gov.hk/sc/gts/astronomy/Solar_Term.htm')">对照香港天文台节气表 ↗</AppButton>
      </view>

      <view class="panel traditional-panel">
        <text class="eyebrow">传统历书 · 通用参考</text><text class="panel-title">这一日的宜与忌</text>
        <view class="activity-row"><text class="activity-label yi-label">宜</text><text class="activity-copy">{{ result.traditional.yi.join(' · ') || '暂无资料' }}</text></view>
        <view class="activity-row"><text class="activity-label ji-label">忌</text><text class="activity-copy">{{ result.traditional.ji.join(' · ') || '暂无资料' }}</text></view>
        <text class="small-copy">此处为传统宜忌资料，与上方历法事实分开展示。{{ result.traditional.convention }}</text>
        <AppButton class="text-button" @click="openSource(result.traditional.sourceUrl)">查看宜忌资料说明 ↗</AppButton>
      </view>

    </template>
    <text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>


    <view class="panel source-panel"><AppButton class="disclosure-button" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen"><text>历法口径与来源</text><text aria-hidden="true">{{ sourcesOpen ? '−' : '＋' }}</text></AppButton><view v-if="sourcesOpen" class="source-content"><text v-for="convention in ALMANAC_CONVENTIONS" :key="convention" class="small-copy">{{ convention }}</text><text class="small-copy">本机使用 lunar-typescript 1.8.6 计算，规则版本 almanac-v1。香港天文台资料用于独立样本核对；不代表整个日期范围均获逐日核验。远期朔日及交节接近午夜时，不同历表可能相差一日。</text><AppButton v-for="source in ALMANAC_SOURCES" :key="source.url" class="text-button source-link" @click="openSource(source.url)">{{ source.title }} ↗</AppButton></view></view>
    <text class="footer-note">随四时流转，把日子过成自己的节奏。</text>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { ALMANAC_MIN_DATE, ALMANAC_MAX_DATE, ALMANAC_CONVENTIONS, ALMANAC_SOURCES, calculateAlmanac, getAlmanacToday, shiftAlmanacDate, type AlmanacResult } from '@/domain/almanac'

const selectedDate = ref(getAlmanacToday()), selectedTime = ref('12:00')
const result = ref<AlmanacResult | null>(null), errorMessage = ref(''), notice = ref(''), sourcesOpen = ref(false)
function errorText(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试。' }
function calculate() {
  result.value = null; errorMessage.value = ''; notice.value = ''
  try { result.value = calculateAlmanac({ date: selectedDate.value, time: selectedTime.value }) }
  catch (error) { errorMessage.value = errorText(error) }
}
function moveDate(days: -1 | 1) {
  try { selectedDate.value = shiftAlmanacDate(selectedDate.value, days) }
  catch (error) { errorMessage.value = errorText(error) }
}
function showToday() { selectedDate.value = getAlmanacToday(); calculate() }
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => { notice.value = '来源链接已复制，可粘贴到浏览器阅读。' }, fail: () => { notice.value = '链接复制失败，请稍后重试。' } })
  // #endif
}
watch([selectedDate, selectedTime], calculate, { immediate: true, flush: 'sync' })
</script>

<style scoped>
.almanac-page { padding-bottom: 100px; }
.intro { display: flex; align-items: center; gap: 8px; margin-bottom: 22px; }
.intro-copy { flex: 1; min-width: 0; }
.intro-cat { flex-shrink: 0; width: 86px; }
.eyebrow, .page-heading, .page-caption, .panel-title, .small-copy, .fact-label, .fact-rule, .ganzhi-value, .term-name, .term-time { display: block; }
.eyebrow { font-size: 11px; color: #8b659c; letter-spacing: 1px; line-height: 1.7; }
.page-heading { margin: 8px 0; font-size: 28px; line-height: 1.4; font-weight: 700; color: #463751; }
.page-caption { color: #827889; font-size: 12px; line-height: 1.8; }
.panel { background: #fff; border: 1px solid #eee7f4; border-radius: 22px; padding: 20px; margin-bottom: 18px; min-width: 0; }
.panel-title { color: #493954; font-size: 18px; line-height: 1.5; font-weight: 650; margin: 6px 0 8px; }
.small-copy { font-size: 12px; color: #82768c; line-height: 1.85; overflow-wrap: anywhere; }
.date-time-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 10px; margin-bottom: 12px; }
.form-group { min-width: 0; }
.form-label { display: block; font-size: 12px; color: #65536e; margin-bottom: 8px; }
.form-picker { min-height: 44px; display: flex; justify-content: space-between; align-items: center; gap: 6px; border: 1px solid #e5dcec; border-radius: 12px; padding: 0 10px; color: #4f3d59; font-size: 14px; font-variant-numeric: tabular-nums; }
.date-navigation { display: flex; gap: 8px; margin-top: 16px; }
.date-button { flex: 1; min-width: 0; margin: 0; padding: 0 5px; min-height: 42px; border-radius: 12px; background: #f7f3fa; color: #73547e; font-size: 12px; line-height: 42px; }
.today-button { background: #ede3f3; color: #644372; }
.calendar-panel { background: linear-gradient(160deg, #fff, #fcf9fe); }
.calendar-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.animal-label { padding: 5px 9px; color: #876232; background: #faf0dc; border-radius: 8px; font-size: 12px; flex-shrink: 0; }
.lunar-date { display: block; font-size: 23px; font-weight: 650; line-height: 1.65; color: #4c3659; margin: 14px 0 6px; overflow-wrap: anywhere; }
.leap-note { display: block; color: #826248; font-size: 12px; margin: 2px 0 8px; }
.ganzhi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
.ganzhi-item { background: #f7f2fa; border-radius: 14px; padding: 13px 12px; min-width: 0; }
.fact-label { color: #86758c; font-size: 11px; line-height: 1.6; }
.ganzhi-value { font-size: 26px; line-height: 1.65; color: #674677; font-weight: 650; }
.fact-rule { color: #8b7b92; font-size: 10px; line-height: 1.65; }
.term-timeline { margin: 20px 0 18px; }
.term-event { display: flex; position: relative; gap: 14px; padding-bottom: 22px; }
.term-event:last-child { padding-bottom: 0; }
.term-event:first-child::before { content: ''; position: absolute; left: 4px; top: 10px; bottom: -10px; width: 1px; background: #e3d4eb; }
.term-dot { flex-shrink: 0; z-index: 1; width: 9px; height: 9px; margin-top: 5px; border-radius: 50%; background: #c1a3cf; }
.current-event .term-dot { background: #9162a8; }
.term-copy { min-width: 0; }
.term-name { color: #523f5d; font-size: 21px; line-height: 1.7; font-weight: 650; }
.term-kind { display: inline-block; margin-left: 10px; font-size: 10px; font-weight: 400; color: #98839f; vertical-align: middle; }
.term-time { font-size: 13px; color: #76627f; line-height: 1.8; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.traditional-panel { border-color: #efe7db; }
.traditional-panel .eyebrow { color: #9a7952; }
.activity-row { display: flex; gap: 12px; align-items: flex-start; margin: 17px 0; }
.activity-label { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 9px; font-size: 15px; }
.yi-label { background: #eaf3ed; color: #547c63; }
.ji-label { background: #f6eceb; color: #9f6b66; }
.activity-copy { color: #6c5c66; font-size: 13px; line-height: 2.1; min-width: 0; overflow-wrap: anywhere; }
.text-button { display: block; padding: 9px 0; margin: 4px 0 0; background: transparent; border: 0; color: #866094; font-size: 12px; line-height: 1.7; text-align: left; white-space: normal; overflow-wrap: anywhere; }
.text-button::after, .disclosure-button::after, .date-button::after { border: 0; }
.export-button { margin: 16px 0 10px; width: 100%; }
.disclosure-button { background: transparent; display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 2px 0; margin: 0; text-align: left; color: #65516f; font-size: 14px; line-height: 1.6; }
.source-content { padding-top: 14px; }
.source-content .small-copy { margin-bottom: 10px; }
.source-link { width: 100%; }
.snapshot-note { margin-top: 14px; padding: 10px 12px; background: #f7f0e6; border-radius: 12px; }
.records-heading { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.empty-note { padding: 20px 0 8px; }
.record-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid #f0e8f4; }
.record-open { flex: 1; min-width: 0; background: transparent; border: 0; padding: 0; margin: 0; text-align: left; white-space: normal; }
.record-open::after { border: 0; }
.record-date { display: block; font-size: 14px; color: #695078; line-height: 1.8; }
.delete-button { color: #a5777e; flex-shrink: 0; padding: 8px; }
.error-note, .notice { display: block; color: #a65962; font-size: 12px; line-height: 1.8; margin-top: 12px; overflow-wrap: anywhere; }
.notice { color: #6d557c; padding: 0 10px 18px; }
.footer-note { display: block; text-align: center; color: #a08ba8; font-size: 11px; line-height: 1.8; padding: 4px 0 20px; }
@media (max-width: 350px) { .panel { padding: 16px; } .page-heading { font-size: 25px; } .intro-cat { width: 66px; } .date-time-grid { gap: 8px; } .form-picker { padding: 0 7px; font-size: 12px; } .form-label { font-size: 11px; } .ganzhi-grid { gap: 8px; } .ganzhi-item { padding: 12px 9px; } .lunar-date { font-size: 21px; } }
</style>
