<template>
  <view class="page-shell cross-page">
    <view class="intro"><view><text class="eyebrow">主题同读</text><text class="page-heading">带着一个主题，<br />读几份不同记录。</text><text class="page-caption">保留事实 · 看见差异 · 写下自己的理解</text></view><CatCompanion class="intro-cat" mood="thinking" /></view>
    <text class="privacy-note">本机整理，不调用 AI。主题是你选定的阅读线索，不自动认定档案属于同一人或同一件事。</text>
    <view class="panel">
      <text class="panel-title">这次想读什么</text><view class="form-group"><text class="form-label">同读主题</text><input v-model="topic" class="form-input" maxlength="100" placeholder="例如：不同历法怎样描述同一个时刻" aria-label="同读主题，最多 100 字" /></view>
      <view class="form-group"><text class="form-label">自己的观察与问题 · 选填</text><textarea v-model="note" class="note-input" maxlength="4000" placeholder="记下已知的现实情况、想核对的词语，或仍然存疑的地方。" aria-label="同读个人笔记，最多 4000 字" /></view>
      <view class="selection-heading"><text class="subheading">已选 {{ selected.length }} / 8 份</text><text class="small-copy">至少选择 2 份</text></view>
      <text v-if="!selected.length" class="empty-note">从下方本机档案中选择。不同体系、不同日期都可以并列阅读。</text>
      <view v-for="(item, index) in selected" :key="item.key" class="selected-row"><view class="selected-text"><text class="selected-title">{{ index + 1 }}. {{ sourceTitle(item) }}</text><text class="small-copy">{{ CROSS_SOURCE_LABELS[item.kind] }} · {{ sourceSavedAt(item).slice(0, 10) }}</text></view><AppButton class="remove-button" :aria-label="`取消选择：${sourceTitle(item)}`" @click="toggleSelection(item)">移除</AppButton></view>
      <text v-if="selected.length" class="small-copy">已选的是选择时的副本。重新打开同读时，完整来源副本仍保留，即使原档案后来被删除。</text>
      <text v-if="selectionNotice" class="notice" role="status">{{ selectionNotice }}</text>
      <text v-if="queryError" class="error-note" role="alert">{{ queryError }}</text><text v-if="stale" class="small-copy">主题、笔记或选项已变更，请重新整理。</text><AppButton class="btn-primary" :disabled="selected.length < 2" @click="buildReading">整理这次同读</AppButton>
    </view>

    <view class="panel source-picker">
      <view class="selection-heading"><text class="panel-title">选择本机已存档案</text><AppButton class="refresh-button" @click="loadSources">刷新</AppButton></view>
      <view class="form-group"><text class="form-label">按来源查看</text>
        <!-- #ifdef H5 -->
        <select v-model="kindFilter" class="form-picker native-select" aria-label="按来源筛选同读档案"><option value="all">所有来源 · {{ catalog.selections.length }} 份</option><option v-for="kind in ACTIVE_CROSS_SOURCE_KINDS" :key="kind" :value="kind">{{ CROSS_SOURCE_LABELS[kind] }} · {{ catalog.counts[kind] || 0 }} 份</option></select>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker :range="kindOptions" :value="kindIndex" @change="setKind(Number($event.detail.value))"><view class="form-picker">{{ kindOptions[kindIndex] }}</view></picker>
        <!-- #endif -->
      </view>
      <view v-for="error in catalog.errors" :key="error.kind" class="error-note" role="alert"><text>{{ error.label }}：{{ error.message }}</text><text class="small-copy">该类暂不列入，其他有效来源仍可选择；没有改写原数据。</text></view>
      <text v-if="!visibleSources.length" class="empty-note">这个范围内还没有可选档案。先去对应页面生成并保存，再回来刷新。</text>
      <AppButton v-for="item in visibleSources" :key="item.key" class="source-row" :class="{ selected: isSelected(item.key) }" :aria-pressed="isSelected(item.key)" :aria-label="`${isSelected(item.key) ? '取消选择' : '选择'}${CROSS_SOURCE_LABELS[item.kind]}：${sourceTitle(item)}`" @click="toggleSelection(item)"><view class="checkmark" aria-hidden="true">{{ isSelected(item.key) ? '✓' : '＋' }}</view><view class="source-text"><text class="source-type">{{ CROSS_SOURCE_LABELS[item.kind] }}</text><text class="source-title">{{ sourceTitle(item) }}</text><text class="small-copy">保存于 {{ sourceSavedAt(item).slice(0, 10) }}{{ item.kind === 'divination' ? ' · 整理时依原规则重建' : '' }}</text></view></AppButton>
      <AppButton class="source-link" :aria-expanded="sourceLinksOpen" @click="sourceLinksOpen = !sourceLinksOpen">{{ sourceLinksOpen ? '收起各体系入口 −' : '打开各体系页面，新增自己的记录 ＋' }}</AppButton><view v-if="sourceLinksOpen" class="source-routes"><AppButton v-for="kind in ACTIVE_CROSS_SOURCE_KINDS" :key="kind" class="source-link" @click="goToSource(kind)">{{ CROSS_SOURCE_LABELS[kind] }} ↗</AppButton></view>
    </view>

    <view v-if="reading" id="cross-reading-result">
      <view class="panel reading-heading"><text class="eyebrow">{{ reading.entries.length }} 份来源 · {{ cardCount }} 张事实卡</text><text class="reading-title">{{ reading.topic }}</text><text class="small-copy">{{ reading.createdAt.slice(0, 10) }} 整理 · {{ reading.ruleVersion }}</text><text v-if="reading.note" class="personal-note" selectable>{{ reading.note }}</text></view>
      <view class="panel difference-panel"><text class="panel-title">先看这些差异</text><view v-for="difference in reading.differences" :key="difference.id" class="difference-row"><text class="difference-title">{{ difference.title }}</text><text class="small-copy" selectable>{{ difference.detail }}</text></view></view>
      <view v-for="entry in reading.entries" :key="entry.selection.key" class="entry-group">
        <view class="entry-heading"><text class="source-type">{{ CROSS_SOURCE_LABELS[entry.selection.kind] }} · 原记录 {{ entry.sourceSavedAt.slice(0, 10) }}</text><text class="entry-title">{{ entry.title }}</text><text class="provenance" :class="{ reconstructed: entry.representation === 'reconstructed-from-input' }">{{ entry.provenance }}</text></view>
        <view class="reading-cards"><view v-for="card in entry.cards" :key="card.id" class="panel fact-card"><view class="card-header"><text class="context-label">{{ READING_CONTEXT_LABELS[card.context] }}</text><text class="card-title">{{ card.title }}</text></view><text class="version-label">规则 {{ card.ruleVersion }}</text>
          <view class="time-summary"><view v-for="item in card.times" :key="item.label" class="time-row"><text>{{ item.label }}</text><text selectable>{{ item.value }}</text></view></view>
          <view class="facts-list"><view v-for="(item, index) in shownFacts(entry.selection.key, card)" :key="index" class="fact-row"><text class="fact-label">{{ item.label }}</text><text class="fact-value" selectable>{{ item.value }}</text></view></view>
          <AppButton class="source-link details-button" :aria-expanded="isExpanded(entry.selection.key, card.id)" @click="toggleDetails(entry.selection.key, card.id)">{{ isExpanded(entry.selection.key, card.id) ? '收起事实、口径与出处 −' : `展开${card.facts.length > 6 ? '其余事实、' : ''}口径与出处 ＋` }}</AppButton>
          <view v-if="isExpanded(entry.selection.key, card.id)" class="card-details"><text class="details-label">原记录的规则与边界</text><view v-for="(rule, index) in card.rules" :key="index" class="detail-row"><text class="detail-title">{{ rule.label }}</text><text class="small-copy" selectable>{{ rule.value }}</text></view><text v-for="(text, index) in card.notes" :key="index" class="small-copy source-note" selectable>{{ text }}</text><text class="details-label source-label">原记录保留的来源</text><view v-for="(source, index) in card.sources" :key="index" class="detail-row"><AppButton v-if="source.url" class="source-link" @click="openSource(source.url)">{{ source.title }} ↗</AppButton><text v-else class="detail-title">{{ source.title }}</text><text v-if="source.detail" class="small-copy">{{ source.detail }}</text></view></view>
        </view></view>
      </view>
      <view class="panel prompt-panel"><text class="eyebrow">原创阅读提示</text><text class="panel-title">把理解留给自己</text><view v-for="prompt in reading.readingPrompts" :key="prompt.id" class="prompt-row"><text class="difference-title">{{ prompt.title }}</text><text class="small-copy">{{ prompt.text }}</text></view><text class="small-copy">提示为本应用固定原创阅读框架，没有根据档案生成运势或模拟个人解读。</text></view>
      <view class="panel"><text class="panel-title">保存本次同读</text><text class="small-copy">一并保存选中原记录、事实小结、差异和提示。易卦保留原输入与本次重建结果。不会覆盖来源记录。</text><text v-if="viewingSavedAt" class="small-copy">本份同读保存于 {{ viewingSavedAt.slice(0, 10) }}，当前查看原样快照。</text><text v-if="recordError" class="error-note" role="alert">{{ recordError }}</text><AppButton class="btn-secondary" :disabled="Boolean(savedId) || Boolean(storageError)" @click="saveReading">{{ savedId ? '本次同读已保存' : '保存同读与完整来源副本' }}</AppButton></view>
    </view>

    <view class="panel"><view class="selection-heading"><text class="panel-title">本机主题同读</text><text class="small-copy">{{ records.length }} / 10</text></view><text v-if="storageError" class="error-note" role="alert">{{ storageError }}</text><text v-if="recordError && !reading" class="error-note" role="alert">{{ recordError }}</text><AppButton v-if="storageError" class="source-link" @click="loadReadings">重试读取</AppButton><text v-if="!records.length && !storageError" class="empty-note">还没有保存的同读。每份保留 2–8 个完整来源副本。</text>
      <view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="openReading(record)"><text class="record-title">{{ record.snapshot.topic }}</text><text class="small-copy">{{ record.snapshot.entries.length }} 份来源 · {{ record.savedAt.slice(0, 10) }}<br />查看原样同读 ↗</text></AppButton><AppButton class="remove-button" :aria-label="`删除主题同读：${record.snapshot.topic}`" @click="deleteReading(record)">删除</AppButton></view>
      <AppButton class="btn-secondary export-button" :disabled="!records.length || Boolean(storageError)" @click="exportReadings">导出全部同读 JSON</AppButton><text class="small-copy">导出包含所选原记录与个人笔记。浏览器下载后请自行保存；清理本机数据会移除本机记录。</text><text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>
    </view>
    <text class="footer-note">让不同的记录并排放着，不急着把它们说成同一个答案。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { CROSS_SOURCE_LABELS, READING_CONTEXT_LABELS, createCrossReading, listCrossReadingSources, validateCrossReadingSnapshot, sourceTitle, sourceSavedAt, copy, type CrossSourceKind, type CrossSourceSelection, type CrossSourceCatalog, type CrossReadingSnapshot, type ReadingCard } from '@/domain/cross-reading'
import { ACTIVE_CROSS_SOURCE_KINDS } from '@/domain/metaphysics/navigation'
import { createCrossReadingRepository, type CrossReadingRecord } from '@/domain/cross-reading/repository'
import { exportJson } from '@/utils/export-json'

const topic = ref(''), note = ref(''), selected = ref<CrossSourceSelection[]>([]), kindFilter = ref<CrossSourceKind | 'all'>('all'), catalog = ref<CrossSourceCatalog>({ selections: [], errors: [], counts: {} as Record<CrossSourceKind, number> })
const reading = ref<CrossReadingSnapshot | null>(null), records = ref<CrossReadingRecord[]>([]), expanded = ref<string[]>([]), queryError = ref(''), selectionNotice = ref(''), recordError = ref(''), storageError = ref(''), notice = ref(''), stale = ref(false), savedId = ref(''), viewingSavedAt = ref(''), sourceLinksOpen = ref(false)
const repository = createCrossReadingRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const visibleSources = computed(() => catalog.value.selections.filter(item => kindFilter.value === 'all' || item.kind === kindFilter.value))
const kindOptions = computed(() => ['所有来源', ...ACTIVE_CROSS_SOURCE_KINDS.map(kind => `${CROSS_SOURCE_LABELS[kind]} · ${catalog.value.counts[kind] || 0} 份`)])
const kindIndex = computed(() => kindFilter.value === 'all' ? 0 : ACTIVE_CROSS_SOURCE_KINDS.findIndex(kind => kind === kindFilter.value) + 1)
const cardCount = computed(() => reading.value?.entries.reduce((sum, entry) => sum + entry.cards.length, 0) || 0)
function setKind(index: number) { kindFilter.value = ACTIVE_CROSS_SOURCE_KINDS[index - 1] || 'all' }
function message(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试。' }
function loadSources() { catalog.value = listCrossReadingSources({ getItem: key => uni.getStorageSync(key) }, ACTIVE_CROSS_SOURCE_KINDS); if (selected.value.length) selectionNotice.value = '来源列表已更新；已选项保留选择时的完整副本。' }
function isSelected(key: string) { return selected.value.some(item => item.key === key) }
function toggleSelection(item: CrossSourceSelection) {
  selectionNotice.value = ''
  if (isSelected(item.key)) selected.value = selected.value.filter(s => s.key !== item.key)
  else if (selected.value.length >= 8) selectionNotice.value = '每次最多 8 份，请先移除一份再选择。'
  else selected.value = [...selected.value, copy(item)]
}
function scrollToReading() { nextTick(() => uni.pageScrollTo({ selector: '#cross-reading-result', duration: 250 })) }
function buildReading() {
  queryError.value = ''; recordError.value = ''; notice.value = ''; reading.value = null; savedId.value = ''; viewingSavedAt.value = ''; expanded.value = []
  try { reading.value = createCrossReading({ topic: topic.value, note: note.value, selections: selected.value }); stale.value = false; scrollToReading() } catch (error) { queryError.value = message(error) }
}
const detailKey = (key: string, id: string) => `${key}/${id}`
function isExpanded(key: string, id: string) { return expanded.value.includes(detailKey(key, id)) }
function toggleDetails(key: string, id: string) { const token = detailKey(key, id); expanded.value = expanded.value.includes(token) ? expanded.value.filter(item => item !== token) : [...expanded.value, token] }
function shownFacts(key: string, card: ReadingCard) { return isExpanded(key, card.id) ? card.facts : card.facts.slice(0, 6) }
function loadReadings() { try { records.value = repository.list(); storageError.value = '' } catch (error) { records.value = []; storageError.value = message(error) } }
function saveReading() {
  if (!reading.value || savedId.value || storageError.value) return
  recordError.value = ''
  try { const record = repository.save(reading.value); savedId.value = record.id; viewingSavedAt.value = record.savedAt; loadReadings(); notice.value = '已保存同读与完整来源副本，原档案未改动。' } catch (error) { recordError.value = message(error) }
}
function openReading(record: CrossReadingRecord) {
  try { const snapshot = validateCrossReadingSnapshot(record.snapshot); topic.value = snapshot.topic; note.value = snapshot.note; selected.value = snapshot.entries.map(entry => copy(entry.selection)); reading.value = snapshot; savedId.value = record.id; viewingSavedAt.value = record.savedAt; stale.value = false; expanded.value = []; queryError.value = ''; recordError.value = ''; notice.value = ''; selectionNotice.value = '已恢复这份同读保存的来源副本，不要求原档案仍然存在。'; scrollToReading() } catch (error) { recordError.value = message(error) }
}
function deleteReading(record: CrossReadingRecord) { uni.showModal({ title: '删除这份主题同读？', content: `${record.snapshot.topic}。只删除本份同读，其他体系的原记录不受影响。`, confirmText: '删除', cancelText: '保留', success: response => { if (!response.confirm) return; try { repository.remove(record.id); if (savedId.value === record.id) { savedId.value = ''; viewingSavedAt.value = '' }; loadReadings(); notice.value = '已删除这份同读；来源记录未改动。' } catch (error) { recordError.value = message(error) } } }) }
async function exportReadings() { try { const result = await exportJson(JSON.parse(repository.exportJSON()), 'oasis-cross-reading.json'); notice.value = result === 'download' ? '已发起 JSON 下载，请在浏览器下载目录确认。' : '同读 JSON 已复制，请粘贴到文件中保存。' } catch (error) { recordError.value = message(error) } }
const sourcePaths: Record<CrossSourceKind, string> = { 'birth-charts': 'explore', 'flow-study': 'flow-study', jyotish: 'jyotish', 'western-study': 'western-study', qizheng: 'qizheng', 'qizheng-lodges': 'qizheng-lodges', qimen: 'qimen', liuren: 'liuren', taiyi: 'taiyi', divination: 'divination', 'date-selection': 'date-selection', tarot: 'tarot', almanac: 'almanac', space: 'space', bazhai: 'bazhai', 'seasonal-care': 'seasonal-care', practice: 'practice', 'name-culture': 'names', 'physiognomy-culture': 'physiognomy' }
function goToSource(kind: CrossSourceKind) { if (ACTIVE_CROSS_SOURCE_KINDS.some(active => active === kind)) uni.navigateTo({ url: `/pages/${sourcePaths[kind]}/index` }) }
function openSource(url: string) {
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer'); return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => { notice.value = '来源链接已复制。' } })
  // #endif
}
watch([topic, note, selected], () => { if (reading.value) stale.value = true; reading.value = null; savedId.value = ''; viewingSavedAt.value = ''; queryError.value = ''; recordError.value = ''; notice.value = '' }, { flush: 'sync' })
loadSources(); loadReadings()
</script>

<style scoped>
.cross-page { padding-bottom: 42px; }.intro { display: flex; align-items: center; justify-content: space-between; gap: 5px; margin-bottom: 18px; }.intro > view { min-width: 0; }.intro .page-heading { font-size: 24px; line-height: 1.65; }.intro .page-caption { font-size: 10px; line-height: 1.9; }.intro-cat { width: 110px; height: 150px; flex-shrink: 0; }.privacy-note { display: block; font-size: 11px; line-height: 1.95; color: #7c8191; margin-bottom: 20px; }.panel { background: #fff; border: 1px solid #e5e7ef; border-radius: 22px; padding: 20px; margin-bottom: 20px; }.panel-title { display: block; color: #636781; font-size: 17px; line-height: 1.8; font-weight: 600; }.form-group { margin: 18px 0; }.form-label { font-size: 13px; }.form-input, .form-picker { font-size: 13px; padding: 0 12px; }.native-select { appearance: auto; font-family: inherit; }.note-input { width: 100%; min-height: 125px; height: 125px; box-sizing: border-box; padding: 12px; border: 1px solid #e2e4ee; border-radius: 13px; background: #fafbfe; font-size: 13px; line-height: 1.95; color: #757b92; }.small-copy { display: block; font-size: 11px; line-height: 1.95; color: #9295a6; margin-top: 6px; overflow-wrap: anywhere; }.selection-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }.subheading { font-size: 14px; line-height: 1.8; color: #76819b; font-weight: 600; }.empty-note { display: block; font-size: 12px; line-height: 1.9; color: #a0a3b1; margin: 16px 0; }.selected-row { display: flex; align-items: center; gap: 10px; background: #f4f6fb; border-radius: 12px; padding: 12px; margin-top: 10px; }.selected-text { min-width: 0; flex: 1; }.selected-title { display: block; color: #75819b; font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }.remove-button { flex-shrink: 0; color: #a78ba0; font-size: 11px; min-height: 40px; padding: 6px 4px; margin: 0; background: transparent; line-height: 1.8; }.refresh-button { color: #8694b0; font-size: 12px; min-height: 40px; padding: 6px 0; margin: 0; background: transparent; line-height: 1.8; }.source-row { display: flex; gap: 12px; align-items: center; width: 100%; margin: 10px 0 0; padding: 14px 12px; background: #fafbfe; border: 1px solid #e9ebf2; border-radius: 14px; color: #828a9f; text-align: left; white-space: normal; line-height: 1.8; }.source-row.selected { background: #edf2fb; border-color: #b9cae4; }.checkmark { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 23px; height: 23px; border-radius: 50%; background: #eef0f7; color: #9aa8bd; font-size: 14px; }.selected .checkmark { background: #cddcf3; color: #6b83a9; }.source-text { flex: 1; min-width: 0; }.source-type { display: block; color: #9ca6bb; font-size: 10px; line-height: 1.8; letter-spacing: .5px; }.source-title { display: block; font-size: 13px; line-height: 1.9; color: #79849d; overflow-wrap: anywhere; }.source-link { display: block; color: #8a92b0; font-size: 11px; padding: 6px 0; margin: 6px 0; min-height: 36px; line-height: 1.8; text-align: left; white-space: normal; background: transparent; }.source-routes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 14px; }.reading-heading { background: #f2f5fb; }.reading-title { display: block; color: #687996; font-size: 23px; line-height: 1.75; margin-top: 10px; overflow-wrap: anywhere; }.personal-note { display: block; font-size: 13px; color: #7f8b9f; line-height: 1.95; margin-top: 15px; white-space: pre-wrap; overflow-wrap: anywhere; }.difference-panel { background: #fffdf7; border-color: #ede6d5; }.difference-row, .prompt-row { border-top: 1px solid #efece3; margin-top: 15px; padding-top: 15px; }.difference-title { display: block; color: #9b8c6c; font-size: 13px; line-height: 1.85; }.difference-row .small-copy { color: #9f998c; }.entry-group { margin-top: 30px; }.entry-heading { padding: 0 3px 15px; }.entry-title { display: block; color: #73839b; font-size: 18px; font-weight: 600; line-height: 1.8; margin-top: 4px; overflow-wrap: anywhere; }.provenance { display: block; color: #9ba5b4; font-size: 10px; line-height: 1.95; margin-top: 7px; }.provenance.reconstructed { color: #a89065; background: #fcf7e9; padding: 10px; border-radius: 10px; }.reading-cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; }.card-header { display: flex; flex-direction: column; gap: 7px; }.context-label { align-self: flex-start; color: #859aba; background: #eef3fa; border-radius: 7px; padding: 4px 8px; font-size: 10px; line-height: 1.6; }.card-title { display: block; color: #6d7e99; font-size: 17px; line-height: 1.8; }.version-label { display: block; font-size: 10px; color: #aab0be; line-height: 1.8; margin-top: 6px; overflow-wrap: anywhere; }.time-summary { background: #f8fafc; border-radius: 12px; padding: 12px; margin: 16px 0; }.time-row { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; color: #8996ab; font-size: 10px; line-height: 1.9; overflow-wrap: anywhere; }.time-row:first-child { margin-top: 0; }.time-row text:first-child { color: #a3adbd; }.fact-row { border-top: 1px solid #edf0f4; padding: 13px 0; }.fact-label { display: block; color: #9aa4b5; font-size: 11px; line-height: 1.8; }.fact-value { display: block; color: #6e7e94; font-size: 13px; line-height: 1.95; margin-top: 5px; overflow-wrap: anywhere; white-space: pre-wrap; }.details-button { width: 100%; margin-bottom: 0; }.card-details { border-top: 1px solid #e9edf3; margin-top: 10px; padding-top: 16px; }.details-label { display: block; color: #7c8da6; font-size: 12px; line-height: 1.8; }.detail-row { margin-top: 12px; }.detail-title { display: block; color: #8f9aaf; font-size: 11px; line-height: 1.9; }.source-note { margin-top: 12px; }.source-label { margin-top: 22px; }.prompt-panel { background: #f5f8f4; border-color: #e1e9df; }.prompt-panel .difference-title { color: #819579; }.prompt-panel .small-copy { color: #95a28f; }.prompt-row { border-color: #e8eee5; }.record-row { display: flex; align-items: center; gap: 10px; border-top: 1px solid #edf0f3; margin-top: 12px; padding-top: 12px; }.record-open { flex: 1; min-width: 0; background: transparent; padding: 0; margin: 0; color: #7d8ba1; font-size: 13px; line-height: 1.9; text-align: left; white-space: normal; }.record-title { display: block; overflow-wrap: anywhere; }.export-button { margin-top: 18px; font-size: 13px; }.notice { display: block; padding: 10px; border-radius: 10px; color: #8195ae; background: #f1f5fb; font-size: 11px; line-height: 1.9; margin-top: 12px; }.error-note { display: block; color: #a05d74; background: #fcf2f5; padding: 12px; margin: 12px 0; border-radius: 12px; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }
@media (max-width: 360px) { .panel { padding: 16px; }.intro .page-heading { font-size: 21px; }.intro-cat { width: 80px; height: 122px; }.source-row { gap: 9px; padding: 12px 10px; }.reading-title { font-size: 21px; }.selected-row { padding: 10px; gap: 8px; } }
</style>

