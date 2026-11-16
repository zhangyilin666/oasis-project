<template>
  <view class="page-shell seasonal-page">
    <view class="intro"><view><text class="eyebrow">节气与养生文化</text><text class="page-heading">读四时，<br />也照看日常。</text><text class="page-caption">文化阅读 · 公共健康资料 · 自选习惯笔记</text></view><CatCompanion class="intro-cat" character="herbal" /></view>
    <text class="privacy-note">笔记只留在本机，不上传给 AI，也不与出生档案关联。</text>
    <view class="panel">
      <text class="panel-title">按日期与主题查阅</text>
      <view class="form-group"><text class="form-label">公历日期 · YYYY-MM-DD</text>
        <!-- #ifdef H5 -->
        <input v-model="date" class="form-input" maxlength="10" placeholder="YYYY-MM-DD" aria-label="节气生活日期，格式 YYYY-MM-DD" />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker mode="date" :value="date" start="1900-01-01" end="2099-12-31" aria-label="节气生活日期，格式 YYYY-MM-DD" @change="date = $event.detail.value"><view class="form-picker">{{ date }}</view></picker>
        <!-- #endif -->
        <text class="small-copy">按当天 12:00、固定 UTC+08:00 查看节气区间。</text>
      </view>
      <view class="form-group"><text class="form-label">主题</text>
        <!-- #ifdef H5 -->
        <select v-model="theme" class="form-picker native-select" aria-label="节气生活主题"><option v-for="option in SEASONAL_CARE_THEMES" :key="option.id" :value="option.id">{{ option.label }}</option></select>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker mode="selector" :range="themeLabels" :value="themeIndex" aria-label="节气生活主题" @change="theme = SEASONAL_CARE_THEMES[Number($event.detail.value)].id"><view class="form-picker">{{ themeLabels[themeIndex] }}</view></picker>
        <!-- #endif -->
      </view>
      <text v-if="queryError" class="error-note" role="alert">{{ queryError }}</text><text v-if="queryStale && !reading" class="small-copy">日期或主题已更新，请重新查阅。</text>
      <AppButton class="btn-primary" @click="read">查看这个时节的资料</AppButton>
    </view>

    <view v-if="reading" id="seasonal-reading">
      <view class="panel calendar-panel"><text class="eyebrow">{{ reading.query.date }} · 12:00 UTC+08:00</text><view class="term-heading"><text class="term-name">{{ reading.calendar.currentTerm }}</text><text class="season-label">{{ reading.calendar.seasonLabel }}季文化目录</text></view><text class="small-copy">{{ reading.calendar.lunarLabel }}</text><text class="small-copy">本区间始于 {{ reading.calendar.previous.beijingTime }}<br />下一节气 {{ reading.calendar.next.name }} · {{ reading.calendar.next.beijingTime }}</text><text class="small-copy">四时目录不是所在地天气预报。南北半球、地区与实际物候可能不同。</text><text class="precision-note">{{ reading.calendar.precisionNote }}</text></view>

      <view class="section-heading"><text class="panel-title">传统文化阅读</text><text class="small-copy">原创短评，参考《素问·四气调神大论》。古代养生观保留为文化阅读。</text></view>
      <text v-if="!reading.cultureCards.length" class="empty-section">这个主题没有传统文化卡；可切换“四时文化”查看。</text>
      <view v-for="card in reading.cultureCards" :key="card.id" class="panel culture-card"><text class="card-layer">文化导读</text><text class="card-title">{{ card.title }}</text><text class="card-body" selectable>{{ card.summary }}</text><text class="reflection-prompt">观察线索：{{ card.reflectionPrompt }}</text><view class="source-note"><text>{{ card.source.title }} · {{ card.source.location }}</text><text>{{ card.source.revision }} · 复核 {{ card.source.checkedAt }}</text><AppButton class="source-link" @click="openSource(card.source.url)">阅读古籍原文 ↗</AppButton></view></view>

      <view class="section-heading"><text class="panel-title">现代公共健康资料</text><text class="small-copy">全年通用的短摘要，分别附机构原文。这里不作个体诊断或治疗安排。</text></view>
      <text v-if="!reading.healthCards.length" class="empty-section">这个主题没有公共健康卡；可切换饮食、活动或作息主题。</text>
      <view v-for="card in reading.healthCards" :key="card.id" class="panel health-card"><text class="card-layer">公共健康科普 · 全年资料</text><text class="card-title">{{ card.title }}</text><text class="card-body" selectable>{{ card.summary }}</text><text class="reflection-prompt">记录线索：{{ card.reflectionPrompt }}</text><view class="source-note"><text>{{ card.source.author }} · {{ card.source.title }}</text><text>{{ card.source.location }}</text><text>页面日期 {{ card.source.publishedAt }} · 复核 {{ card.source.checkedAt }}</text><AppButton class="source-link" @click="openSource(card.source.url)">阅读机构原文 ↗</AppButton></view></view>

      <view class="panel notes-panel"><text class="panel-title">留下自己的日常笔记</text><text class="small-copy">日期 {{ reading.query.date }}。如实记录即可，不打分、不判断达标。</text>
        <view class="form-group"><text class="form-label">记录主题或自选习惯</text><input v-model="habit" class="form-input" maxlength="100" placeholder="例如：记录晚间放下手机的时间" aria-label="自选习惯，最多 100 字" /></view>
        <view class="form-group"><text class="form-label">这次记录的状态</text><view class="status-options"><AppButton v-for="option in statusOptions" :key="option.id" :class="{ selected: status === option.id }" :aria-pressed="status === option.id" @click="status = option.id">{{ option.label }}</AppButton></view></view>
        <view class="form-group"><text class="form-label">当地观察 · 选填</text><textarea v-model="observation" class="text-input" maxlength="1000" placeholder="记下所在地的天气、物候或环境，与书中描写有什么异同。" aria-label="当地观察，最多 1000 字" /></view>
        <view class="form-group"><text class="form-label">我的作息与复盘 · 选填</text><textarea v-model="note" class="text-input note-input" maxlength="2000" placeholder="今天做过什么、休息得怎样、接下来想调整哪一件小事。" aria-label="个人作息笔记，最多 2000 字" /></view>
        <text class="scope-note">以个人实际情况和已有医嘱为准；持续健康困扰应向合资格专业人员咨询。</text>
        <text v-if="viewingSavedAt" class="small-copy">{{ viewingSavedAt.slice(0, 10) }} 保存的原样资料 · {{ reading.contentVersion }}</text><text v-if="noteChanged" class="small-copy">笔记已修改，可另存一份；原记录保留原样。</text><text v-if="recordError" class="error-note" role="alert">{{ recordError }}</text>
        <AppButton class="btn-secondary" :disabled="Boolean(savedRecordId) || Boolean(storageError)" @click="saveNote">{{ savedRecordId ? '这条笔记已保存在本机' : '保存资料与笔记快照' }}</AppButton><text class="small-copy">同时保存当前主题的卡片、出处和节气事实，最多 50 条。</text>
      </view>
    </view>

    <view class="panel"><view class="record-heading"><text class="panel-title">本机节气生活记录</text><text class="small-copy">{{ records.length }} / 50</text></view><text v-if="storageError" class="error-note" role="alert">{{ storageError }}</text><text v-if="recordError && !reading" class="error-note" role="alert">{{ recordError }}</text><AppButton v-if="storageError" class="source-link" @click="loadRecords">重试读取记录</AppButton><text v-if="!records.length && !storageError" class="empty-section">还没有保存的记录。可以从观察今天的一件小事开始。</text>
      <view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="openRecord(record)"><text class="record-title">{{ record.snapshot.personal.habit }}</text><text class="small-copy">{{ record.snapshot.reading.query.date }} · {{ record.snapshot.reading.calendar.currentTerm }} · {{ statusLabel(record.snapshot.personal.status) }}</text><text class="small-copy">{{ themeLabel(record.snapshot.reading.query.theme) }} · 查看原样快照 ↗</text></AppButton><AppButton class="source-link delete-button" :aria-label="`删除节气生活记录：${record.snapshot.personal.habit}`" @click="confirmDelete(record)">删除</AppButton></view>
      <AppButton class="btn-secondary export-button" :disabled="!records.length || Boolean(storageError)" @click="exportRecords">导出全部节气生活记录 JSON</AppButton><text class="small-copy">浏览器下载；其他端复制后请自行粘贴保存。清除本机数据会删除记录。</text><text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>
    </view>
    <view class="panel source-panel"><AppButton class="disclosure-button" :aria-expanded="conventionsOpen" @click="conventionsOpen = !conventionsOpen"><text>阅读约定与历法来源</text><text>{{ conventionsOpen ? '−' : '＋' }}</text></AppButton><view v-if="conventionsOpen"><text v-for="item in SEASONAL_CARE_CONVENTIONS" :key="item" class="small-copy">{{ item }}</text><AppButton class="source-link" @click="openSource('https://www.hko.gov.hk/sc/gts/time/24solarterms.htm')">香港天文台 · 节气与季候背景 ↗</AppButton><text class="small-copy">本机历法 lunar-typescript 1.8.6 · almanac-v1。内容与资料复核日期见每张卡片。</text></view></view>
    <text class="footer-note">把古书放回时代，把观察留给今天。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { getAlmanacToday } from '@/domain/almanac'
import { getSeasonalCareReading, createSeasonalCareSnapshot, validateSeasonalCareSnapshot, SEASONAL_CARE_THEMES, SEASONAL_CARE_CONVENTIONS, type SeasonalCareReading, type SeasonalCareTheme, type SeasonalCareHabitStatus } from '@/domain/seasonal-care'
import { createSeasonalCareRepository, type SeasonalCareRecord } from '@/domain/seasonal-care/repository'
import { exportJson } from '@/utils/export-json'

const date = ref(getAlmanacToday()), theme = ref<SeasonalCareTheme>('all'), reading = ref<SeasonalCareReading | null>(null)
const habit = ref(''), status = ref<SeasonalCareHabitStatus>('observed'), observation = ref(''), note = ref('')
const records = ref<SeasonalCareRecord[]>([]), savedRecordId = ref(''), viewingSavedAt = ref(''), queryError = ref(''), storageError = ref(''), recordError = ref(''), notice = ref(''), queryStale = ref(false), noteChanged = ref(false), conventionsOpen = ref(false)
const themeLabels = SEASONAL_CARE_THEMES.map(option => option.label), themeIndex = computed(() => SEASONAL_CARE_THEMES.findIndex(option => option.id === theme.value))
const statusOptions: { id: SeasonalCareHabitStatus; label: string }[] = [{ id: 'observed', label: '只作观察' }, { id: 'planned', label: '计划尝试' }, { id: 'done', label: '已经做过' }]
const repository = createSeasonalCareRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
function message(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试。' }
function themeLabel(value: SeasonalCareTheme) { return SEASONAL_CARE_THEMES.find(option => option.id === value)?.label ?? value }
function statusLabel(value: SeasonalCareHabitStatus) { return statusOptions.find(option => option.id === value)?.label ?? value }
function scrollToReading() { nextTick(() => uni.pageScrollTo({ selector: '#seasonal-reading', duration: 250 })) }
function read() {
  queryError.value = ''; recordError.value = ''; notice.value = ''; reading.value = null; savedRecordId.value = ''; viewingSavedAt.value = ''; noteChanged.value = false
  try { reading.value = getSeasonalCareReading({ date: date.value, theme: theme.value }); queryStale.value = false; scrollToReading() } catch (error) { queryError.value = message(error) }
}
function loadRecords() { try { records.value = repository.list(); storageError.value = '' } catch (error) { records.value = []; storageError.value = message(error) } }
function saveNote() {
  if (!reading.value || savedRecordId.value || storageError.value) return
  recordError.value = ''; notice.value = ''
  try {
    const snapshot = createSeasonalCareSnapshot(reading.value, { habit: habit.value, status: status.value, observation: observation.value, note: note.value }), record = repository.save(snapshot)
    savedRecordId.value = record.id; viewingSavedAt.value = record.savedAt; noteChanged.value = false; loadRecords(); notice.value = '已保存卡片、来源、节气事实和你的笔记。'
  } catch (error) { recordError.value = message(error) }
}
function openRecord(record: SeasonalCareRecord) {
  try {
    const snapshot = validateSeasonalCareSnapshot(record.snapshot)
    date.value = snapshot.reading.query.date; theme.value = snapshot.reading.query.theme; habit.value = snapshot.personal.habit; status.value = snapshot.personal.status; observation.value = snapshot.personal.observation; note.value = snapshot.personal.note
    reading.value = snapshot.reading; savedRecordId.value = record.id; viewingSavedAt.value = record.savedAt; queryStale.value = false; noteChanged.value = false; queryError.value = ''; recordError.value = ''; notice.value = ''; scrollToReading()
  } catch (error) { recordError.value = message(error) }
}
function confirmDelete(record: SeasonalCareRecord) {
  uni.showModal({ title: '删除这条节气生活记录？', content: record.snapshot.personal.habit, confirmText: '删除', cancelText: '保留', success: response => {
    if (!response.confirm) return
    recordError.value = ''; notice.value = ''
    try { repository.remove(record.id); if (savedRecordId.value === record.id) { savedRecordId.value = ''; viewingSavedAt.value = '' }; loadRecords(); notice.value = '已删除这条记录。' } catch (error) { recordError.value = message(error) }
  } })
}
async function exportRecords() {
  recordError.value = ''; notice.value = ''
  try { const result = await exportJson(JSON.parse(repository.exportJSON()), `oasis-seasonal-care-${getAlmanacToday()}.json`); notice.value = result === 'download' ? '已发起 JSON 下载，请在浏览器下载目录确认。' : '记录 JSON 已复制，请粘贴到文件或笔记中保存。' } catch (error) { recordError.value = message(error) }
}
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => { notice.value = '来源链接已复制，可粘贴到浏览器阅读。' }, fail: () => { notice.value = '链接复制失败，请稍后重试。' } })
  // #endif
}
watch([date, theme], () => { if (reading.value) queryStale.value = true; reading.value = null; savedRecordId.value = ''; viewingSavedAt.value = ''; queryError.value = ''; recordError.value = ''; notice.value = ''; noteChanged.value = false }, { flush: 'sync' })
watch([habit, status, observation, note], () => { if (savedRecordId.value) noteChanged.value = true; savedRecordId.value = ''; recordError.value = ''; notice.value = '' }, { flush: 'sync' })
loadRecords()
</script>

<style scoped>
.seasonal-page { padding-bottom: 42px; }.intro { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 20px; }.intro > view { min-width: 0; }.intro .page-heading { font-size: 25px; line-height: 1.6; }.intro .page-caption { font-size: 11px; line-height: 1.8; }.intro-cat { width: 126px; height: 156px; flex-shrink: 0; }.privacy-note { display: block; color: #657669; font-size: 11px; line-height: 1.8; margin-bottom: 20px; }.panel { background: #fff; border: 1px solid #e2ece5; border-radius: 22px; padding: 20px; margin-bottom: 20px; }.panel-title { display: block; color: #42594d; font-size: 17px; line-height: 1.7; font-weight: 600; }.small-copy { display: block; color: #768578; font-size: 11px; line-height: 1.9; margin-top: 7px; overflow-wrap: anywhere; }.form-group { margin: 20px 0; }.form-label { font-size: 13px; }.form-input, .form-picker { padding: 0 12px; font-size: 14px; }.native-select { display: block; appearance: auto; font-family: inherit; cursor: pointer; }.native-select:focus-visible { outline: 2px solid #92b4a0; outline-offset: 3px; }.calendar-panel { background: #f0f6f0; border-color: #dce8dd; }.term-heading { display: flex; align-items: baseline; gap: 14px; margin: 10px 0; }.term-name { color: #4a7055; font-size: 30px; font-family: serif; letter-spacing: 2px; }.season-label { color: #83927b; font-size: 12px; }.precision-note { display: block; color: #8b9785; font-size: 10px; line-height: 1.9; margin-top: 12px; }.section-heading { margin: 28px 4px 16px; }.card-layer { display: block; color: #9c855b; font-size: 10px; line-height: 1.8; letter-spacing: 1px; }.card-title { display: block; color: #736042; font-size: 17px; font-weight: 600; line-height: 1.7; margin-top: 10px; }.culture-card { border-color: #e9dfc9; background: #fffdf8; }.health-card { border-color: #dbe9e5; background: #fafdfc; }.health-card .card-layer { color: #789a8b; }.health-card .card-title { color: #4b7865; }.card-body { display: block; color: #647363; font-size: 14px; line-height: 2; margin-top: 14px; }.reflection-prompt { display: block; padding-left: 12px; border-left: 2px solid #d8caaa; color: #8b795c; font-size: 12px; line-height: 1.9; margin-top: 18px; }.health-card .reflection-prompt { border-color: #bfd5c8; color: #718c7d; }.source-note { border-top: 1px solid #eeeadd; margin-top: 20px; padding-top: 12px; }.source-note > text { display: block; color: #929884; font-size: 10px; line-height: 1.9; overflow-wrap: anywhere; }.source-link { display: block; margin: 6px 0 0; padding: 4px 0; min-height: 36px; color: #6a8973; background: transparent; font-size: 11px; line-height: 1.8; text-align: left; white-space: normal; }.empty-section { display: block; margin: 12px 4px 22px; color: #9ca391; font-size: 12px; line-height: 1.9; }
.notes-panel { margin-top: 28px; }.status-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }.status-options button { width: 100%; margin: 0; padding: 10px 4px; min-height: 44px; color: #7e8b7b; background: #f7faf5; border: 1px solid #e1e8da; border-radius: 12px; font-size: 12px; line-height: 1.8; }.status-options button.selected { color: #54785b; background: #e4f0e5; border-color: #a1c3a5; }.text-input { width: 100%; min-height: 104px; height: 104px; box-sizing: border-box; padding: 12px; color: #5d705d; background: #fafcf8; border: 1px solid #e2e9dc; border-radius: 14px; font-size: 14px; line-height: 1.9; }.note-input { height: 140px; min-height: 140px; }.scope-note { display: block; color: #788769; background: #f1f5e9; padding: 12px; margin: 16px 0; border-radius: 12px; font-size: 12px; line-height: 1.9; }.error-note { display: block; color: #98425b; background: #fcf0f3; border-radius: 12px; padding: 12px; margin: 12px 0; font-size: 12px; line-height: 1.85; overflow-wrap: anywhere; }.record-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }.record-row { display: flex; align-items: center; gap: 8px; border-top: 1px solid #eaf0e6; padding-top: 12px; margin-top: 12px; }.record-open { min-width: 0; flex: 1; margin: 0; padding: 4px 0; color: #617a5f; background: transparent; text-align: left; white-space: normal; line-height: 1.8; }.record-title { display: block; font-size: 14px; overflow-wrap: anywhere; }.delete-button { flex-shrink: 0; color: #a56674; font-size: 12px; }.export-button { margin-top: 18px; font-size: 13px; }.notice { display: block; color: #60785b; background: #f0f5ef; border-radius: 10px; padding: 10px; margin-top: 12px; font-size: 12px; line-height: 1.85; }.source-panel { padding-top: 12px; padding-bottom: 12px; }.disclosure-button { display: flex; justify-content: space-between; gap: 12px; width: 100%; margin: 0; padding: 0; min-height: 44px; color: #678770; background: transparent; font-size: 13px; line-height: 1.8; text-align: left; }
@media (max-width: 360px) { .panel { padding: 16px; }.intro .page-heading { font-size: 23px; }.intro-cat { width: 90px; height: 128px; }.status-options { gap: 5px; }.status-options button { font-size: 11px; }.card-title { font-size: 16px; } }
</style>
