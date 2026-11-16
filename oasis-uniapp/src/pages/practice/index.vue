<template>
  <view class="page-shell practice-page">
    <view class="intro"><view class="intro-copy"><text class="eyebrow">山 · 静心修习</text><text class="page-heading">留一小段时间，<br />回到此时此地。</text><text class="page-caption">原创导读 · 简单计时 · 留下自己的感受</text></view><CatCompanion class="intro-cat" :mood="draft?.status === 'completed' ? 'complete' : 'thinking'" /></view>

    <view v-if="storageError || actionError" class="error-panel" role="alert"><text>{{ storageError || actionError }}</text><text v-if="unsaved" class="error-detail">当前进度尚未写入本机。请重试保存，或先导出当前草稿再离开。</text><AppButton class="text-button" @click="retryStorage">重试读取／保存</AppButton><AppButton v-if="draft && unsaved" class="text-button" @click="exportDraft">导出当前草稿 JSON</AppButton></view>
    <text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>

    <view class="panel">
      <text class="panel-title">今天想怎样停一停</text>
      <view class="topic-options" role="group" aria-label="选择静心练习主题"><AppButton v-for="topic in PRACTICE_TOPICS" :key="topic.id" class="topic-option" :class="{ selected: activeTopic.id === topic.id }" :aria-pressed="activeTopic.id === topic.id" :disabled="Boolean(draft)" @click="selectedTopicId = topic.id"><text>{{ topic.title }}</text></AppButton></view>
      <text class="topic-introduction">{{ activeTopic.introduction }}</text><view class="guidance"><view v-for="(line, index) in activeTopic.guidance" :key="line" class="guidance-row"><text class="guidance-number">{{ index + 1 }}</text><text>{{ line }}</text></view></view>
      <view class="duration-row"><text class="form-label">这一段的时长</text><picker mode="selector" :range="durationLabels" :value="selectedMinutes - 1" :disabled="Boolean(draft)" aria-label="选择练习时长，1 至 60 分钟" @change="selectedMinutes = Number($event.detail.value) + 1"><view class="duration-picker">{{ draft?.durationMinutes || selectedMinutes }} 分钟 <text aria-hidden="true">⌄</text></view></picker></view>
      <text class="small-copy">时间到了会在页面内结束计时。切到后台后仍按实际经过时间累计。</text>
      <AppButton v-if="!draft" class="btn-primary start-button" :disabled="Boolean(storageError)" @click="startPractice">开始这一段练习</AppButton>
    </view>

    <view v-if="draft" class="panel timer-panel">
      <text v-if="restored" class="restored-note">已恢复本机草稿</text>
      <text class="eyebrow">{{ draft.topic.title }} · {{ draft.durationMinutes }} 分钟</text>
      <view class="timer-ring" :class="draft.status"><text class="timer-status">{{ statusLabels[draft.status] }}</text><text class="timer-value" role="timer" aria-live="off" :aria-label="`剩余 ${remainingLabel}`">{{ remainingLabel }}</text><text class="timer-caption">{{ draft.status === 'completed' ? (draft.completionReason === 'elapsed' ? '这一段时间已到' : '已提前结束') : '剩余时间' }}</text></view>
      <text class="elapsed-copy">已练习 {{ formatPracticeTime(draft.elapsedMs) }}</text>
      <text v-if="draft.clockRollbackCount" class="clock-note" role="status">检测到过系统时间回拨，已保留累计时长。{{ draft.status === 'paused' ? '计时已暂停；确认设备时间后可继续。' : '此记录保留了时间回拨提示。' }}</text>
      <view v-if="draft.status !== 'completed'" class="timer-actions"><AppButton v-if="draft.status === 'running'" class="btn-secondary" @click="pausePractice">暂停</AppButton><AppButton v-else class="btn-primary" @click="resumePractice">继续</AppButton><AppButton class="btn-secondary end-button" @click="finishPractice">提前结束</AppButton></view>
      <text v-else class="completed-copy" role="status">练习已结束。草稿会保留，写下想留的话，再保存为记录。</text>
      <view class="note-group"><text class="form-label">此刻想留下的话</text><textarea v-model="noteInput" class="note-input" :maxlength="MAX_PRACTICE_NOTE_LENGTH" placeholder="记下一点感受、一件小事，或留白也可以。" aria-label="练习笔记，最多 2000 字，输入后保存为本机草稿" /><view class="note-meta"><text class="small-copy">{{ unsaved ? '草稿尚未保存' : '输入即保存为本机草稿' }}</text><text class="small-copy">{{ noteInput.length }} / {{ MAX_PRACTICE_NOTE_LENGTH }}</text></view></view>
      <AppButton v-if="draft.status === 'completed'" class="btn-primary save-button" @click="saveAsRecord">保存笔记为练习记录</AppButton>
      <view class="draft-links"><AppButton class="text-button" @click="exportDraft">导出当前草稿 JSON</AppButton><AppButton class="text-button delete-button" @click="confirmDiscard">删除这份草稿</AppButton></view>
      <text class="small-copy">本机草稿可在刷新后恢复；清除应用或浏览器数据会移除它。</text>
    </view>

    <view class="panel records-panel">
      <view class="record-heading"><text class="panel-title">留下的练习记录</text><text class="small-copy">{{ records.length }} / {{ MAX_PRACTICE_RECORDS }}</text></view><text class="small-copy">记录仅保存在本机，不随账号同步。</text>
      <text v-if="!records.length && !storageError" class="small-copy empty-note">还没有练习记录。结束后点击保存，把这一段留在这里。</text>
      <view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="viewedRecord = record"><text class="record-title">{{ record.snapshot.topic.title }}</text><text class="small-copy">{{ displayDate(record.snapshot.startedAt) }} · {{ formatPracticeTime(record.snapshot.elapsedMs) }}</text><text class="small-copy record-preview">{{ record.snapshot.note || '这一次，留白也很好。' }}</text></AppButton><AppButton class="text-button delete-button" :aria-label="`删除 ${displayDate(record.snapshot.startedAt)} 的${record.snapshot.topic.title}记录`" @click="confirmDelete(record)">删除</AppButton></view>
      <AppButton class="btn-secondary export-button" :disabled="Boolean(storageError) || (!records.length && !draft)" @click="exportAll">导出草稿与全部记录 JSON</AppButton><text class="small-copy">浏览器下载文件；其他端复制 JSON 后请自行粘贴保存。</text>
    </view>

    <view v-if="viewedRecord" class="panel record-detail"><view class="record-heading"><text class="eyebrow">保存时的原样记录</text><AppButton class="text-button" @click="viewedRecord = null">收起</AppButton></view><text class="panel-title">{{ viewedRecord.snapshot.topic.title }}</text><text class="small-copy">开始于 {{ displayDate(viewedRecord.snapshot.startedAt) }}</text><text class="small-copy">计划 {{ viewedRecord.snapshot.durationMinutes }} 分钟 · 实际 {{ formatPracticeTime(viewedRecord.snapshot.elapsedMs) }} · {{ viewedRecord.snapshot.completionReason === 'elapsed' ? '时间已到' : '提前结束' }}</text><text v-if="viewedRecord.snapshot.clockRollbackCount" class="clock-note">本次计时曾检测到系统时间回拨，累计时长已保留。</text><text class="saved-note" selectable>{{ viewedRecord.snapshot.note || '这一次没有写下笔记。' }}</text><text class="small-copy">{{ viewedRecord.snapshot.topic.introduction }}</text><text v-for="line in viewedRecord.snapshot.topic.guidance" :key="line" class="small-copy saved-guidance">{{ line }}</text><text class="small-copy">规则 {{ viewedRecord.snapshot.ruleVersion }}</text><AppButton class="text-button" @click="exportRecord(viewedRecord)">导出这条记录 JSON ↗</AppButton></view>

    <text class="footer-note">不必追求特别的状态，留意这一刻就可以。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { PRACTICE_TOPICS, MAX_PRACTICE_NOTE_LENGTH, createPracticeDraft, projectPracticeDraft, pausePracticeDraft, resumePracticeDraft, finishPracticeDraft, updatePracticeNote, practiceRemainingMs, formatPracticeTime, type PracticeDraft, type PracticeTopicId } from '@/domain/practice'
import { createPracticeRepository, MAX_PRACTICE_RECORDS, type PracticeRecord } from '@/domain/practice/repository'
import { exportJson } from '@/utils/export-json'

const repository = createPracticeRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const selectedTopicId = ref<PracticeTopicId>('quiet-seat'), selectedMinutes = ref(5), draft = ref<PracticeDraft | null>(null), noteInput = ref('')
const records = ref<PracticeRecord[]>([]), viewedRecord = ref<PracticeRecord | null>(null), storageError = ref(''), actionError = ref(''), notice = ref(''), unsaved = ref(false), restored = ref(false)
const durationLabels = Array.from({ length: 60 }, (_, index) => `${index + 1} 分钟`)
const activeTopic = computed(() => draft.value?.topic || PRACTICE_TOPICS.find(topic => topic.id === selectedTopicId.value) || PRACTICE_TOPICS[0])
const remainingLabel = computed(() => formatPracticeTime(draft.value ? practiceRemainingMs(draft.value) : selectedMinutes.value * 60000))
const statusLabels = { running: '进行中', paused: '已暂停', completed: '已结束' }
let timer: ReturnType<typeof setInterval> | undefined
let restoringNote = false
let pageVisible = false
function errorText(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试。' }
function displayDate(value: number) { const date = new Date(value); const two = (part: number) => String(part).padStart(2, '0'); return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}` }
function setNote(value: string) { restoringNote = true; noteInput.value = value; restoringNote = false }
function persistDraft(): boolean {
  if (!draft.value) return true
  try { repository.saveDraft(draft.value); unsaved.value = false; actionError.value = ''; storageError.value = ''; return true }
  catch (error) { unsaved.value = true; actionError.value = errorText(error); return false }
}
function applyDraft(value: PracticeDraft) { draft.value = value; persistDraft() }
function tick() {
  if (!draft.value || draft.value.status !== 'running') return
  try {
    const previousStatus = draft.value.status
    draft.value = projectPracticeDraft(draft.value)
    if (draft.value.status !== previousStatus) persistDraft()
  } catch (error) { actionError.value = errorText(error) }
}
function checkpoint(): boolean {
  if (!draft.value) return true
  try { draft.value = updatePracticeNote(projectPracticeDraft(draft.value), noteInput.value); return persistDraft() }
  catch (error) { unsaved.value = true; actionError.value = errorText(error); return false }
}
function restoreState() {
  // A failed write must not be replaced by the older on-disk draft when returning to the page.
  if (draft.value && unsaved.value) { checkpoint(); return }
  try {
    const state = repository.load()
    records.value = state.records; draft.value = state.active; storageError.value = ''; actionError.value = ''
    setNote(state.active?.note || '')
    if (draft.value) { selectedTopicId.value = draft.value.topic.id; selectedMinutes.value = draft.value.durationMinutes; restored.value = true; checkpoint() }
  } catch (error) { storageError.value = errorText(error) }
}
function retryStorage() { if (draft.value && unsaved.value) checkpoint(); else restoreState() }
function startTicker() { if (!timer) timer = setInterval(tick, 250) }
function stopTicker() { if (timer) clearInterval(timer); timer = undefined }
function startPractice() {
  if (draft.value || storageError.value) return
  notice.value = ''; actionError.value = ''
  try { const next = createPracticeDraft({ topicId: selectedTopicId.value, durationMinutes: selectedMinutes.value }); draft.value = next; restored.value = false; setNote(''); persistDraft(); startTicker() }
  catch (error) { actionError.value = errorText(error) }
}
function pausePractice() { if (draft.value) applyDraft(pausePracticeDraft(draft.value)) }
function resumePractice() { if (draft.value) applyDraft(resumePracticeDraft(draft.value)) }
function finishPractice() { if (draft.value) applyDraft(finishPracticeDraft(draft.value)) }
function saveAsRecord() {
  if (!draft.value || draft.value.status !== 'completed' || !checkpoint()) return
  try {
    const record = repository.saveRecord(draft.value.id, noteInput.value)
    draft.value = null; setNote(''); unsaved.value = false; restored.value = false; viewedRecord.value = record
    records.value = repository.load().records; actionError.value = ''; notice.value = '已保存这次练习记录，可在下方原样回看。'
  } catch (error) { actionError.value = errorText(error) }
}
function confirmDiscard() {
  if (!draft.value) return
  const id = draft.value.id
  uni.showModal({ title: '删除这份练习草稿？', content: '当前计时与尚未保存为记录的笔记会一起删除。', confirmText: '删除', cancelText: '保留', success: response => {
    if (!response.confirm) return
    try { repository.discardDraft(id); draft.value = null; setNote(''); unsaved.value = false; restored.value = false; actionError.value = ''; notice.value = '已删除这份练习草稿。' }
    catch (error) { actionError.value = errorText(error) }
  } })
}
function confirmDelete(record: PracticeRecord) {
  uni.showModal({ title: '删除这条练习记录？', content: `${displayDate(record.snapshot.startedAt)} · ${record.snapshot.topic.title}`, confirmText: '删除', cancelText: '保留', success: response => {
    if (!response.confirm) return
    try { repository.removeRecord(record.id); records.value = repository.load().records; if (viewedRecord.value?.id === record.id) viewedRecord.value = null; actionError.value = ''; notice.value = '已删除这条练习记录。' }
    catch (error) { actionError.value = errorText(error) }
  } })
}
async function exportValue(value: unknown, filename: string) {
  try { const method = await exportJson(value, filename); notice.value = method === 'download' ? '已发起 JSON 文件下载，请在浏览器下载目录确认。' : 'JSON 已复制，请粘贴到文件或笔记中保存。' }
  catch (error) { actionError.value = errorText(error) }
}
function exportDraft() { if (draft.value) { checkpoint(); return exportValue({ kind: 'oasis-practice-draft', draft: draft.value }, `oasis-practice-draft-${draft.value.id}.json`) } }
function exportRecord(record: PracticeRecord) { return exportValue({ kind: 'oasis-practice-record', record }, `oasis-practice-${record.id}.json`) }
function exportAll() { if (!checkpoint()) return; try { return exportValue(JSON.parse(repository.exportJSON()), 'oasis-practice-sessions.json') } catch (error) { actionError.value = errorText(error) } }

watch(noteInput, value => { if (restoringNote || !draft.value) return; try { applyDraft(updatePracticeNote(projectPracticeDraft(draft.value), value)) } catch (error) { unsaved.value = true; actionError.value = errorText(error) } }, { flush: 'sync' })
onShow(() => { pageVisible = true; restoreState(); startTicker() })
onHide(() => { pageVisible = false; checkpoint(); stopTicker() })
onUnload(() => { pageVisible = false; checkpoint(); stopTicker() })
// #ifdef H5
function visibilityChanged() { if (!pageVisible) return; if (document.hidden) { checkpoint(); stopTicker() } else { restoreState(); startTicker() } }
function beforeUnload() { checkpoint() }
onMounted(() => { document.addEventListener('visibilitychange', visibilityChanged); window.addEventListener('beforeunload', beforeUnload) })
// #endif
onUnmounted(() => {
  stopTicker()
  // #ifdef H5
  document.removeEventListener('visibilitychange', visibilityChanged); window.removeEventListener('beforeunload', beforeUnload)
  // #endif
})
</script>

<style scoped>
.practice-page { padding-bottom: 100px; }
.intro { display: flex; align-items: center; gap: 8px; margin-bottom: 22px; }
.intro-copy { flex: 1; min-width: 0; }
.intro-cat { flex-shrink: 0; width: 86px; }
.eyebrow, .page-heading, .page-caption, .panel-title, .small-copy, .form-label { display: block; }
.eyebrow { color: #8d729d; font-size: 11px; line-height: 1.7; letter-spacing: 1px; }
.page-heading { color: #493b53; font-size: 28px; line-height: 1.4; font-weight: 700; margin: 8px 0; }
.page-caption { color: #8b7e94; font-size: 12px; line-height: 1.8; }
.panel { min-width: 0; padding: 20px; margin-bottom: 18px; background: #fff; border: 1px solid #eee7f4; border-radius: 22px; }
.panel-title { font-size: 18px; color: #55415f; font-weight: 650; line-height: 1.6; margin-bottom: 12px; }
.small-copy { font-size: 12px; color: #877a90; line-height: 1.85; overflow-wrap: anywhere; }
.topic-options { display: flex; flex-direction: column; gap: 8px; }
.topic-option { margin: 0; padding: 10px 14px; min-height: 44px; background: #f8f4fb; border: 1px solid #eee5f3; border-radius: 12px; text-align: left; color: #897295; font-size: 13px; line-height: 1.7; }
.topic-option.selected { color: #70507f; border-color: #cdb6d9; background: #f0e7f6; }
.topic-option::after { border: 0; }
.topic-option[disabled] { opacity: .7; }
.topic-option.selected[disabled] { opacity: 1; }
.topic-introduction { display: block; margin: 20px 0 14px; color: #6b5777; font-size: 14px; line-height: 1.8; }
.guidance { padding: 14px; background: #fcfaf7; border-radius: 14px; }
.guidance-row { display: flex; gap: 10px; color: #93826e; font-size: 12px; line-height: 1.85; margin-bottom: 10px; }
.guidance-row:last-child { margin-bottom: 0; }
.guidance-number { color: #b8a089; flex-shrink: 0; }
.duration-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 22px 0 14px; }
.form-label { font-size: 13px; color: #6d5878; line-height: 1.8; }
.duration-picker { display: flex; justify-content: space-between; gap: 16px; align-items: center; min-height: 42px; border: 1px solid #e6dcec; border-radius: 11px; padding: 0 13px; font-size: 14px; color: #755d81; }
.start-button, .save-button, .export-button { width: 100%; margin: 18px 0 10px; }
.timer-panel { text-align: center; }
.restored-note { display: block; font-size: 11px; color: #9a8266; margin-bottom: 12px; }
.timer-ring { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 208px; height: 208px; border: 7px solid #eee5f5; border-radius: 50%; box-sizing: border-box; margin: 24px auto 14px; background: radial-gradient(circle, #fff 30%, #fcf8fe 100%); }
.timer-ring.paused { border-color: #eee8df; background: #fffdf9; }
.timer-ring.completed { border-color: #e6eee5; background: #fbfdf9; }
.timer-status { color: #997fa8; font-size: 12px; }
.timer-value { color: #72527f; font-size: 43px; line-height: 1.65; font-variant-numeric: tabular-nums; letter-spacing: 1px; font-weight: 600; }
.timer-caption { color: #a594ae; font-size: 11px; }
.elapsed-copy { display: block; color: #9a87a5; font-size: 12px; line-height: 1.8; }
.timer-actions { display: flex; gap: 10px; margin: 20px 0; }
.timer-actions > button { flex: 1; min-width: 0; margin: 0; padding: 0 12px; font-size: 14px; }
.completed-copy { display: block; margin: 18px 0; color: #728869; font-size: 13px; line-height: 1.9; }
.clock-note { display: block; color: #a18459; background: #fbf6ed; padding: 12px; border-radius: 12px; font-size: 12px; line-height: 1.85; margin: 15px 0; text-align: left; }
.note-group { text-align: left; margin-top: 20px; }
.note-input { width: 100%; box-sizing: border-box; height: 130px; min-height: 110px; border: 1px solid #e8deee; border-radius: 13px; padding: 12px; margin-top: 10px; color: #6d5679; font-size: 13px; line-height: 1.85; background: #fdfbff; }
.note-meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-top: 7px; }
.note-meta .small-copy { font-size: 10px; }
.draft-links { display: flex; justify-content: space-between; gap: 8px; align-items: center; margin: 12px 0; }
.text-button { display: block; padding: 8px 0; margin: 0; background: transparent; border: 0; color: #8b689b; font-size: 12px; line-height: 1.7; text-align: left; white-space: normal; overflow-wrap: anywhere; }
.text-button::after, .record-open::after { border: 0; }
.delete-button { color: #ac7f87; }
.record-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.record-heading .panel-title { margin-bottom: 6px; }
.empty-note { padding: 22px 0 10px; }
.record-row { display: flex; align-items: center; gap: 12px; padding: 15px 0; border-bottom: 1px solid #f0e9f4; }
.record-open { flex: 1; min-width: 0; padding: 0; margin: 0; background: transparent; text-align: left; white-space: normal; }
.record-title { display: block; color: #765d84; font-size: 14px; line-height: 1.8; }
.record-preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.record-row > .delete-button { flex-shrink: 0; padding: 8px; }
.saved-note { display: block; color: #6f5b7a; line-height: 1.9; font-size: 14px; white-space: pre-wrap; overflow-wrap: anywhere; padding: 16px 0; }
.saved-guidance { margin-top: 8px; }
.error-panel { background: #fcf0f1; border: 1px solid #ecd5d9; border-radius: 16px; padding: 14px 16px; color: #a26773; font-size: 12px; line-height: 1.85; margin-bottom: 18px; overflow-wrap: anywhere; }
.error-detail { display: block; margin-top: 6px; }
.notice { display: block; padding: 0 10px 16px; color: #8a7299; font-size: 12px; line-height: 1.85; }
.footer-note { display: block; color: #a18cac; text-align: center; font-size: 11px; line-height: 1.85; padding: 4px 0 20px; }
@media (max-width: 350px) { .panel { padding: 16px; } .intro-cat { width: 66px; } .page-heading { font-size: 25px; } .timer-ring { width: 188px; height: 188px; } .timer-value { font-size: 39px; } .draft-links .text-button { font-size: 11px; } .guidance { padding: 12px; } }
</style>
