<template>
  <view class="page-shell selection-page">
    <view class="intro"><view><text class="page-heading">把日子安排妥当</text><text class="page-caption">先看现实安排，再逐条查看文化资料。</text></view><CatCompanion mood="thinking" class="intro-cat" /></view>
    <text class="privacy-note">筛选与记录保存在当前设备。可自行导出完整条件、日期事实和筛选日志。</text>

    <view class="panel">
      <text class="panel-title">我的日期筛选</text><text class="small-copy lead-copy">一次比较 1–31 天；每一天都保留通过、冲突或未涵盖的原因。</text>
      <view class="form-group"><text class="form-label">计划名称</text><input v-model="title" class="form-input" maxlength="100" placeholder="例如：十月的周末出行" aria-label="计划名称" /></view>
      <view class="date-fields">
        <view class="form-group"><text class="form-label">起始日期</text>
          <!-- #ifdef H5 -->
          <input v-model="startDate" class="form-input" maxlength="10" placeholder="YYYY-MM-DD" aria-label="起始日期，格式 YYYY-MM-DD" />
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <picker mode="date" :value="startDate" start="1900-01-01" end="2099-12-31" aria-label="选择起始日期" @change="startDate = $event.detail.value"><view class="form-picker">{{ startDate }}</view></picker>
          <!-- #endif -->
        </view>
        <view class="form-group"><text class="form-label">结束日期</text>
          <!-- #ifdef H5 -->
          <input v-model="endDate" class="form-input" maxlength="10" placeholder="YYYY-MM-DD" aria-label="结束日期，格式 YYYY-MM-DD" />
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <picker mode="date" :value="endDate" start="1900-01-01" end="2099-12-31" aria-label="选择结束日期" @change="endDate = $event.detail.value"><view class="form-picker">{{ endDate }}</view></picker>
          <!-- #endif -->
        </view>
      </view>
      <view class="form-group"><text class="form-label">事项</text>
        <!-- #ifdef H5 -->
        <select v-model="activity" class="form-picker native-select" aria-label="筛选事项"><option v-for="option in activityLabels" :key="option" :value="option">{{ option }}</option></select>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker :range="activityLabels" :value="activityLabels.indexOf(activity)" aria-label="筛选事项" @change="activity = activityLabels[Number($event.detail.value)]"><view class="form-picker">{{ activity }} <text>⌄</text></view></picker>
        <!-- #endif -->
      </view>
      <view class="form-group"><text class="form-label">筛选方式</text><view class="mode-options"><AppButton :class="{ selected: mode === 'practical-only' }" :aria-pressed="mode === 'practical-only'" @click="mode = 'practical-only'">仅按现实条件</AppButton><AppButton :class="{ selected: mode === 'require-yi' }" :aria-pressed="mode === 'require-yi'" @click="mode = 'require-yi'">同时核对宜忌</AppButton></view><text class="small-copy">{{ mode === 'practical-only' ? '可用星期与排除日决定候选；传统宜忌仍保留供查看。' : '现实条件通过后，还须事项列于宜且不列于忌；未列出不会自动通过。' }}</text></view>
      <view class="form-group"><text class="form-label">可用星期</text><view class="weekday-options"><AppButton v-for="day in weekdayOrder" :key="day" :class="{ selected: availableWeekdays.includes(day) }" :aria-label="DATE_SELECTION_WEEKDAYS[day]" :aria-pressed="availableWeekdays.includes(day)" @click="toggleWeekday(day)">{{ DATE_SELECTION_WEEKDAYS[day].slice(-1) }}</AppButton></view><text class="small-copy">至少选一天；只代表你的日程，不推断法定假期或他人可用时间。</text></view>
      <view class="form-group"><AppButton class="disclosure-button" :aria-expanded="exclusionsOpen" @click="exclusionsOpen = !exclusionsOpen"><text>排除具体日期 · 已选 {{ excludedDates.length }} 天</text><text>{{ exclusionsOpen ? '−' : '＋' }}</text></AppButton><view v-if="exclusionsOpen"><text v-if="!windowDates.length" class="small-copy">先选择有效的 1–31 天窗口，再勾选无法安排的日期。</text><view class="exclusion-options"><AppButton v-for="date in windowDates" :key="date" :class="{ excluded: excludedDates.includes(date) }" :aria-label="`${date}，${excludedDates.includes(date) ? '已排除' : '未排除'}`" :aria-pressed="excludedDates.includes(date)" @click="toggleExcluded(date)">{{ date.slice(5) }}</AppButton></view><view v-if="outsideExcludedDates.length" class="outside-exclusions"><text class="small-copy">这些排除日已不在新窗口内，请移除后重算：</text><AppButton v-for="date in outsideExcludedDates" :key="date" class="text-button" @click="toggleExcluded(date)">移除 {{ date }} ×</AppButton></view><text class="small-copy">选中的日期按现实冲突处理，不会被传统宜忌覆盖。</text></view></view>
      <view class="form-group"><text class="form-label">场地、人员与其他安排（选填）</text><textarea v-model="venueNotes" class="text-input" maxlength="1000" placeholder="例如：场地档期还未确认；同行人需要提前一周请假。" aria-label="安排备注" /><text class="small-copy">备注供逐日人工确认，填写文字不会自动变为“已满足”。</text></view>
      <text class="scope-note">当前宜忌表来自上游作者对网络历表的归纳，不同历书可能不同。候选仅表示本次启用条件通过。</text>
      <text v-if="errorMessage" class="error-note" role="alert">{{ errorMessage }}</text><text v-if="stale && !result" class="small-copy">条件已修改，请重新筛选后再保存。</text>
      <AppButton class="btn-primary" @click="calculate">查看逐日筛选结果</AppButton>
    </view>

    <view v-if="result" id="selection-result" class="panel">
      <text class="panel-title preserved-text">{{ result.input.title }}</text><text class="small-copy">{{ result.input.startDate }} 至 {{ result.input.endDate }} · {{ result.input.activity }} · {{ result.input.mode === 'practical-only' ? '仅按现实条件' : '同时核对宜忌' }}</text>
      <view class="summary"><text><text class="candidate-count">{{ result.summary.candidates }}</text> 天候选</text><text>{{ result.summary.conflicts }} 天冲突</text><text>{{ result.summary.notCovered }} 天未涵盖</text></view>
      <text v-if="!result.summary.candidates" class="scope-note">当前条件下没有候选日期。可以查看冲突原因，再调整真实的日程条件。</text>
      <text v-if="result.input.venueNotes" class="small-copy preserved-text">安排备注（待人工确认）：{{ result.input.venueNotes }}</text>
      <text class="small-copy">日序排列；没有吉日分数或优先排名。场地与人员情况仍需确认。</text>
      <view class="result-filter"><AppButton :class="{ selected: !onlyCandidates }" :aria-pressed="!onlyCandidates" @click="onlyCandidates = false">全部 {{ result.summary.total }} 天</AppButton><AppButton :class="{ selected: onlyCandidates }" :aria-pressed="onlyCandidates" @click="onlyCandidates = true">只看候选 {{ result.summary.candidates }} 天</AppButton></view>
      <view v-for="day in visibleDays" :key="day.facts.date" class="day-card" :class="day.outcome">
        <view class="day-heading"><text>{{ day.facts.date }} <text class="day-week">{{ DATE_SELECTION_WEEKDAYS[day.facts.weekday] }}</text></text><text class="outcome-badge">{{ outcomeLabels[day.outcome] }}</text></view>
        <text class="small-copy">{{ day.facts.lunarLabel }} · {{ day.facts.dayGanZhi }}日</text>
        <text class="reason-copy">{{ day.rules[2].reason }}{{ !day.rules[2].applied ? '（仅供查看）' : '' }}</text>
        <AppButton class="day-disclosure" :aria-expanded="expandedDates.includes(day.facts.date)" @click="toggleDetails(day.facts.date)">{{ expandedDates.includes(day.facts.date) ? '收起' : '查看' }} 4 条规则与原始宜忌 <text>{{ expandedDates.includes(day.facts.date) ? '−' : '＋' }}</text></AppButton>
        <view v-if="expandedDates.includes(day.facts.date)" class="day-details">
          <view v-for="rule in day.rules" :key="rule.id" class="rule-row"><view class="rule-heading"><text>{{ rule.title }}</text><text class="rule-status" :class="rule.status">{{ statusLabels[rule.status] }}</text></view><text class="small-copy">{{ rule.reason }}</text><text class="rule-source">{{ rule.applied ? '参与候选筛选' : '保留信息，不参与筛选' }} · {{ rule.source === 'user-input' ? '依据：你的输入' : '依据：上游整日宜忌表' }}</text></view>
          <view class="raw-table"><text class="small-copy" selectable>原表宜：{{ day.facts.yi.join('、') }}</text><text class="small-copy" selectable>原表忌：{{ day.facts.ji.join('、') }}</text><text class="small-copy">查表月干支 {{ day.facts.tableMonthGanZhi }} · UTC+08:00 · 交节当日 00:00 换月</text></view>
        </view>
      </view>
      <text v-if="onlyCandidates && !visibleDays.length" class="small-copy empty-note">没有候选；切回“全部”可查看逐日理由。</text>
      <text class="small-copy version-note">{{ result.ruleVersion }} · {{ result.tableVersion }}</text>
      <AppButton class="btn-secondary" :disabled="Boolean(savedRecordId) || Boolean(storageError)" @click="saveResult">{{ savedRecordId ? '这条快照已保存在本机' : '保存完整筛选快照' }}</AppButton>
      <text v-if="recordError" class="error-note" role="alert">{{ recordError }}</text><text class="small-copy">保存全部日期与理由，最多 20 条。回看保存时的快照，不静默套用新表重算。</text>
    </view>

    <view class="panel"><view class="record-heading"><text class="panel-title">本机筛选记录</text><text class="small-copy">{{ records.length }} / 20</text></view>
      <text v-if="storageError" class="error-note" role="alert">{{ storageError }}</text><text v-if="recordError && !result" class="error-note" role="alert">{{ recordError }}</text><AppButton v-if="storageError" class="text-button" @click="loadRecords">重试读取记录</AppButton>
      <text v-if="!records.length && !storageError" class="small-copy empty-note">还没有保存的日期筛选。</text>
      <view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="openRecord(record)"><text class="record-title">{{ record.snapshot.input.title }}</text><text class="small-copy">{{ record.snapshot.input.startDate }} 至 {{ record.snapshot.input.endDate }}</text><text class="small-copy">{{ record.snapshot.input.activity }} · {{ record.snapshot.summary.candidates }} 天候选 · 回看快照 ↗</text></AppButton><AppButton class="text-button delete-button" :aria-label="`删除筛选记录：${record.snapshot.input.title}`" @click="confirmDelete(record)">删除</AppButton></view>
      <AppButton class="btn-secondary export-button" :disabled="!records.length || Boolean(storageError)" @click="exportRecords">导出全部筛选记录 JSON</AppButton><text class="small-copy">浏览器下载；其他端复制后请自行粘贴保存。</text><text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>
    </view>

    <view class="panel source-panel"><AppButton class="disclosure-button" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen"><text>筛选规则与资料来源</text><text>{{ sourcesOpen ? '−' : '＋' }}</text></AppButton><view v-if="sourcesOpen"><text v-for="convention in DATE_SELECTION_CONVENTIONS" :key="convention" class="small-copy">{{ convention }}</text><AppButton v-for="source in DATE_SELECTION_SOURCES" :key="source.url" class="text-button source-link" @click="openSource(source.url)">{{ source.title }} ↗</AppButton></view></view>
    <text class="footer-note">给安排留出余地，把每一步理由看清。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { getAlmanacToday } from '@/domain/almanac'
import { calculateDateSelection, dateSelectionDates, validateDateSelectionSnapshot, DATE_SELECTION_ACTIVITIES, DATE_SELECTION_CONVENTIONS, DATE_SELECTION_SOURCES, DATE_SELECTION_WEEKDAYS, type DateSelectionActivity, type DateSelectionMode, type DateSelectionSnapshot } from '@/domain/date-selection'
import { createDateSelectionRepository, type DateSelectionRecord } from '@/domain/date-selection/repository'
import { exportJson } from '@/utils/export-json'

const title = ref(''), startDate = ref(getAlmanacToday()), endDate = ref(getAlmanacToday())
const activityLabels = [...DATE_SELECTION_ACTIVITIES], activity = ref<DateSelectionActivity>('出行'), mode = ref<DateSelectionMode>('practical-only')
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0], availableWeekdays = ref([0, 1, 2, 3, 4, 5, 6]), excludedDates = ref<string[]>([]), venueNotes = ref('')
const result = ref<DateSelectionSnapshot | null>(null), records = ref<DateSelectionRecord[]>([]), expandedDates = ref<string[]>([]), onlyCandidates = ref(false)
const errorMessage = ref(''), storageError = ref(''), recordError = ref(''), notice = ref(''), savedRecordId = ref(''), stale = ref(false), exclusionsOpen = ref(false), sourcesOpen = ref(false)
const repository = createDateSelectionRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const statusLabels = { pass: '通过', conflict: '冲突', 'not-covered': '未涵盖' }, outcomeLabels = { candidate: '候选', conflict: '冲突', 'not-covered': '未涵盖' }
const windowDates = computed(() => { try { return dateSelectionDates(startDate.value, endDate.value) } catch { return [] } })
const outsideExcludedDates = computed(() => excludedDates.value.filter(date => !windowDates.value.includes(date)))
const visibleDays = computed(() => result.value?.days.filter(day => !onlyCandidates.value || day.outcome === 'candidate') ?? [])
function message(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试。' }
function toggleWeekday(day: number) { availableWeekdays.value = availableWeekdays.value.includes(day) ? availableWeekdays.value.filter(value => value !== day) : [...availableWeekdays.value, day] }
function toggleExcluded(date: string) { excludedDates.value = excludedDates.value.includes(date) ? excludedDates.value.filter(value => value !== date) : [...excludedDates.value, date] }
function toggleDetails(date: string) { expandedDates.value = expandedDates.value.includes(date) ? expandedDates.value.filter(value => value !== date) : [...expandedDates.value, date] }
function showResult() { nextTick(() => uni.pageScrollTo({ selector: '#selection-result', duration: 250 })) }
function calculate() {
  result.value = null; errorMessage.value = ''; recordError.value = ''; notice.value = ''; savedRecordId.value = ''; expandedDates.value = []; onlyCandidates.value = false
  try { result.value = calculateDateSelection({ title: title.value, startDate: startDate.value, endDate: endDate.value, activity: activity.value, mode: mode.value, availableWeekdays: availableWeekdays.value, excludedDates: excludedDates.value, venueNotes: venueNotes.value }); stale.value = false; showResult() }
  catch (error) { errorMessage.value = message(error); if (outsideExcludedDates.value.length) exclusionsOpen.value = true }
}
function loadRecords() { try { records.value = repository.list(); storageError.value = '' } catch (error) { records.value = []; storageError.value = message(error) } }
function saveResult() {
  if (!result.value || savedRecordId.value || storageError.value) return
  recordError.value = ''; notice.value = ''
  try { const record = repository.save(result.value); savedRecordId.value = record.id; loadRecords(); notice.value = '已保存全部日期和规则日志。' } catch (error) { recordError.value = message(error) }
}
function openRecord(record: DateSelectionRecord) {
  try {
    const snapshot = validateDateSelectionSnapshot(record.snapshot), input = snapshot.input
    title.value = input.title; startDate.value = input.startDate; endDate.value = input.endDate; activity.value = input.activity; mode.value = input.mode; availableWeekdays.value = [...input.availableWeekdays]; excludedDates.value = [...input.excludedDates]; venueNotes.value = input.venueNotes
    result.value = snapshot; savedRecordId.value = record.id; expandedDates.value = []; onlyCandidates.value = false; stale.value = false; errorMessage.value = ''; recordError.value = ''; notice.value = ''; showResult()
  } catch (error) { recordError.value = message(error) }
}
function confirmDelete(record: DateSelectionRecord) {
  uni.showModal({ title: '删除这条筛选记录？', content: record.snapshot.input.title, confirmText: '删除', cancelText: '保留', success: response => {
    if (!response.confirm) return
    recordError.value = ''; notice.value = ''
    try { repository.remove(record.id); if (savedRecordId.value === record.id) savedRecordId.value = ''; loadRecords(); notice.value = '已删除这条筛选记录。' } catch (error) { recordError.value = message(error) }
  } })
}
async function exportRecords() {
  recordError.value = ''; notice.value = ''
  try { const exported = await exportJson(JSON.parse(repository.exportJSON()), `oasis-date-selection-${getAlmanacToday()}.json`); notice.value = exported === 'download' ? '已发起 JSON 下载，请在浏览器下载目录确认。' : '筛选记录已复制，请粘贴到文件或笔记中保存。' } catch (error) { recordError.value = message(error) }
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
watch([title, startDate, endDate, activity, mode, availableWeekdays, excludedDates, venueNotes], () => { if (result.value) stale.value = true; result.value = null; savedRecordId.value = ''; errorMessage.value = ''; recordError.value = ''; notice.value = '' }, { deep: true, flush: 'sync' })
loadRecords()
</script>

<style scoped>
.native-select { display: block; appearance: auto; font-family: inherit; cursor: pointer; }.native-select:focus-visible { outline: 2px solid #adc18e; outline-offset: 3px; }
.selection-page { padding-bottom: 42px; }.intro { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 20px; }.intro > view { min-width: 0; }.intro .page-heading { font-size: 25px; line-height: 1.55; }.intro .page-caption { font-size: 12px; line-height: 1.8; }.intro-cat { width: 108px; height: 108px; flex-shrink: 0; }.privacy-note { display: block; color: #65745e; font-size: 11px; line-height: 1.8; margin-bottom: 20px; }.panel { background: #fff; border: 1px solid #e7ece0; border-radius: 22px; padding: 20px; margin-bottom: 20px; }.panel-title { display: block; color: #46523b; font-size: 17px; line-height: 1.7; font-weight: 600; }.small-copy { display: block; color: #727a68; font-size: 11px; line-height: 1.9; margin-top: 7px; overflow-wrap: anywhere; }.lead-copy { margin-bottom: 22px; }.form-group { margin-bottom: 20px; min-width: 0; }.form-label { font-size: 13px; }.form-input, .form-picker { min-width: 0; padding: 0 12px; font-size: 14px; }.date-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }.text-input { width: 100%; box-sizing: border-box; min-height: 104px; height: 104px; padding: 12px; border: 1px solid #e3e8db; border-radius: 14px; background: #fafbf7; font-size: 14px; line-height: 1.8; color: #54614a; }
.mode-options, .result-filter { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }.mode-options button, .result-filter button, .weekday-options button, .exclusion-options button { width: 100%; min-height: 44px; padding: 10px 4px; margin: 0; border: 1px solid #e4e9dc; border-radius: 12px; background: #f9fbf6; color: #758068; font-size: 12px; line-height: 1.7; }.mode-options button.selected, .result-filter button.selected, .weekday-options button.selected { background: #e8efd9; border-color: #adc18e; color: #527138; }.weekday-options { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }.weekday-options button { font-size: 14px; min-width: 0; }.exclusion-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-top: 10px; }.exclusion-options button.excluded { color: #99545b; background: #f8eaeb; border-color: #d6a7ac; }.outside-exclusions { border-left: 2px solid #d9aab0; padding-left: 10px; margin-top: 12px; }.scope-note { display: block; color: #736f55; background: #f8f6e9; border-radius: 12px; padding: 12px; margin: 14px 0; font-size: 12px; line-height: 1.85; }.error-note { display: block; color: #98425b; background: #fcf0f3; border-radius: 12px; padding: 12px; margin: 12px 0; font-size: 12px; line-height: 1.85; overflow-wrap: anywhere; }.preserved-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.summary { display: flex; flex-wrap: wrap; gap: 12px; padding: 18px 0 12px; color: #6c775d; font-size: 12px; line-height: 1.8; }.summary .candidate-count { color: #58763d; font-size: 24px; margin-right: 3px; }.result-filter { margin: 18px 0; }.day-card { padding: 16px; border: 1px solid #e5e9df; border-radius: 16px; background: #fafcf8; margin-top: 12px; }.day-card.conflict { background: #fffafa; border-color: #efdddd; }.day-card.not-covered { background: #fcfbf6; border-color: #eae5d6; }.day-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 6px; color: #4d5c3e; font-size: 14px; font-weight: 600; line-height: 1.8; }.day-week { color: #859075; font-size: 11px; font-weight: 400; }.outcome-badge { font-size: 11px; font-weight: 400; color: #52773b; }.conflict .outcome-badge { color: #9b6268; }.not-covered .outcome-badge { color: #91814e; }.reason-copy { display: block; font-size: 12px; line-height: 1.9; color: #6f7664; margin-top: 12px; }.day-disclosure { display: flex; justify-content: space-between; gap: 10px; width: 100%; margin: 10px 0 0; padding: 8px 0 0; background: transparent; color: #6d8158; text-align: left; font-size: 11px; line-height: 1.8; min-height: 38px; }.rule-row { border-top: 1px solid #e9ece4; padding-top: 12px; margin-top: 12px; }.rule-heading { display: flex; justify-content: space-between; gap: 8px; color: #617052; font-size: 12px; line-height: 1.8; }.rule-status { flex-shrink: 0; }.rule-status.pass { color: #527b38; }.rule-status.conflict { color: #a6606e; }.rule-status.not-covered { color: #98834f; }.rule-source { display: block; font-size: 10px; color: #959c8b; line-height: 1.8; margin-top: 5px; }.raw-table { border-top: 1px dashed #dde4d4; margin-top: 14px; padding-top: 8px; }.version-note { margin: 18px 0 14px; }
.record-heading { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }.record-row { display: flex; align-items: center; gap: 8px; border-top: 1px solid #edf0e7; margin-top: 12px; padding-top: 12px; }.record-open { min-width: 0; flex: 1; margin: 0; padding: 4px 0; background: transparent; text-align: left; white-space: normal; line-height: 1.8; }.record-title { display: block; font-size: 14px; color: #61734e; overflow-wrap: anywhere; }.delete-button { flex-shrink: 0; color: #a56674; font-size: 12px; }.export-button { font-size: 13px; margin-top: 18px; }.empty-note { padding: 16px 0; }.notice { display: block; color: #60785b; background: #f0f5ef; border-radius: 10px; padding: 10px; margin-top: 12px; font-size: 12px; line-height: 1.85; }.source-panel { padding-top: 12px; padding-bottom: 12px; }.disclosure-button { display: flex; justify-content: space-between; gap: 12px; width: 100%; margin: 0; padding: 0; background: transparent; color: #687d53; font-size: 13px; line-height: 1.8; min-height: 44px; text-align: left; }.source-link { display: block; margin-top: 8px; padding-left: 0; text-align: left; white-space: normal; font-size: 11px; }
@media (max-width: 360px) { .panel { padding: 16px; }.intro .page-heading { font-size: 23px; }.intro-cat { width: 82px; height: 82px; }.date-fields { grid-template-columns: minmax(0, 1fr); gap: 0; }.day-card { padding: 12px; }.mode-options button { font-size: 11px; }.weekday-options { gap: 3px; }.form-input, .form-picker { font-size: 13px; } }
</style>
