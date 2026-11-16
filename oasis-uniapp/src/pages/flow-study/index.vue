<template>
  <view class="page-shell flow-page">
    <view class="intro"><view><text class="eyebrow">流年流月研习</text><text class="page-heading">同一时刻，<br />读懂不同历法。</text><text class="page-caption">八字节月 · 紫微运限 · 分层四化</text></view><CatCompanion class="intro-cat" mood="thinking" /></view>
    <text class="privacy-note">计算和记录都在本机完成。这里展示规则与盘面事实，不作事件预测。</text>
    <view class="panel">
      <text class="panel-title">准备一份研习资料</text>
      <AppButton class="source-link" @click="loadExample">载入 iztro 公开核对示例</AppButton>
      <text v-if="archiveError" class="error-note" role="alert">{{ archiveError }}</text>
      <view v-if="archives.length" class="form-group"><text class="form-label">从历史出生档案复制出生资料</text>
        <!-- #ifdef H5 -->
        <select v-model="archiveId" class="form-picker native-select" aria-label="选择历史出生档案"><option value="">请选择档案</option><option v-for="item in archives" :key="item.id" :value="item.id">{{ item.name }} · {{ item.result.profile.date }}</option></select>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker :range="archiveLabels" @change="archiveId = archives[Number($event.detail.value)].id"><view class="form-picker">{{ archives.find(item => item.id === archiveId)?.name || '请选择档案' }}</view></picker>
        <!-- #endif -->
        <AppButton class="source-link" :disabled="!archiveId" @click="copyArchive">复制所选出生资料</AppButton><text class="small-copy">复制后可修改；原历史出生档案保留原样。</text>
      </view>
      <view class="form-group"><text class="form-label">研习名称</text><input v-model="name" class="form-input" maxlength="40" placeholder="例如：立春前后的规则对照" aria-label="研习名称，最多 40 字" /></view>
      <text class="subheading">出生资料</text>
      <view class="form-group"><text class="form-label">出生日期</text><BirthDateField v-model="birthDate" :max="birthMax" /></view>
      <view class="form-group"><text class="form-label">当地出生时间</text><BirthTimeField v-model="birthTime" /></view>
      <view class="form-group"><text class="form-label">传统排盘性别</text><view class="choices"><AppButton v-for="item in ['男', '女']" :key="item" :class="{ selected: gender === item }" :aria-pressed="gender === item" @click="gender = item as '男' | '女'">{{ item }}</AppButton></view></view>
      <view class="form-group"><text class="form-label">出生时间精度</text><view class="choices"><AppButton :class="{ selected: precision === 'minute' }" :aria-pressed="precision === 'minute'" @click="precision = 'minute'">记录到分钟</AppButton><AppButton :class="{ selected: precision === 'approximate' }" :aria-pressed="precision === 'approximate'" @click="precision = 'approximate'">大致时间</AppButton></view><text class="small-copy">时间不详时请勿填一个假定时刻。大致时间可能跨越时辰或交节边界。</text></view>
      <view v-for="section in timeSections" :key="section.id" class="time-section">
        <template v-if="section.id === 'observation'"><text class="subheading">观测时刻</text><view class="form-group"><text class="form-label">观察日期</text><BirthDateField v-model="observationDate" label-prefix="观察" max="2099-12-31" :allow-lunar="false" /></view><view class="form-group"><text class="form-label">当地观察时间</text><BirthTimeField v-model="observationTime" label-prefix="观察" /></view></template>
        <view class="form-group"><text class="form-label">{{ section.label }}时区处理</text><view class="choices"><AppButton :class="{ selected: section.mode === 'manual' }" :aria-pressed="section.mode === 'manual'" @click="setMode(section.id, 'manual')">手动 UTC 偏移</AppButton><AppButton :class="{ selected: section.mode === 'iana' }" :aria-pressed="section.mode === 'iana'" @click="setMode(section.id, 'iana')">IANA 历史时区</AppButton></view></view>
        <view v-if="section.mode === 'manual'" class="form-group"><text class="form-label">{{ section.label }} UTC 偏移小时</text><input :value="section.offset" class="form-input" type="text" placeholder="例如 8、5.5、-5" :aria-label="`${section.label} UTC 偏移小时`" @input="setOffset(section.id, inputValue($event))" /><text class="small-copy">请计入当年的夏令时，支持 −12 至 +14，步长 0.25。</text></view>
        <view v-else class="form-group"><text class="form-label">{{ section.label }} IANA 时区名</text><input :value="section.zone" class="form-input" maxlength="100" placeholder="Asia/Shanghai" :aria-label="`${section.label} IANA 时区名`" @input="setZone(section.id, inputValue($event))" /><view class="choices fold-choices"><AppButton v-for="option in foldOptions" :key="option.value" :class="{ selected: section.choice === option.value }" :aria-pressed="section.choice === option.value" @click="setChoice(section.id, option.value)">{{ option.label }}</AppButton></view><text class="small-copy">仅遇到重复当地时刻时需选择较早／较晚；不存在的时刻会提示错误。</text></view>
      </view>
      <view class="form-group"><text class="form-label">研习笔记 · 选填</text><textarea v-model="note" class="note-input" maxlength="2000" placeholder="记下你要核对的规则，或两套历法之间的差别。" aria-label="研习笔记，最多 2000 字" /></view>
      <text v-if="queryError" class="error-note" role="alert">{{ queryError }}</text><text v-if="stale" class="small-copy">资料已修改，请重新生成结果。</text><AppButton class="btn-primary" @click="calculate">生成流年流月研习</AppButton>
    </view>

    <view v-if="result" id="flow-result">
      <view class="panel time-panel"><text class="eyebrow">{{ result.input.name }}</text><text class="panel-title">{{ result.observationTime.beijingTime }}</text><text class="small-copy">观测统一至 UTC+08:00 · 原输入 {{ result.input.observation.date }} {{ result.input.observation.time }}<br />{{ result.observationTime.timeZone || '手动时区' }} · 解析偏移 {{ offsetLabel(result.observationTime.resolvedUtcOffset) }}<br />UTC {{ result.observationTime.utcTime }}</text><text class="small-copy">出生 {{ result.birthTime.beijingTime }} UTC+08:00<br />原输入 {{ result.input.birth.date }} {{ result.input.birth.time }} · {{ result.birthTime.timeZone || '手动时区' }} · {{ offsetLabel(result.birthTime.resolvedUtcOffset) }}</text><text v-if="result.input.birth.timePrecision === 'approximate'" class="scope-note">出生时间标注为“大致时间”；当前盘面只对应所填时刻，未计算时间误差区间。</text></view>
      <view class="panel">
        <text class="eyebrow">八字 · 以节定月</text><text class="panel-title">{{ result.bazi.solarYear }} 节气年 · {{ result.bazi.yearly.ganZhi }}</text><text class="small-copy">出生四柱 {{ result.bazi.birthPillars.join(' · ') }}<br />日主 {{ result.bazi.dayMaster }} · 观测四柱 {{ result.bazi.observationPillars.join(' · ') }}</text>
        <view class="year-fact"><text>流年天干 · {{ result.bazi.yearly.stemGod }}</text><text class="small-copy">藏干 {{ hiddenLabel(result.bazi.yearly.hidden) }}<br />{{ result.bazi.yearStart }} 起<br />至 {{ result.bazi.yearEnd }} 前 · UTC+08:00</text></view>
        <text class="subheading">{{ allMonths ? '这一节气年的十二流月' : '观测时刻所在流月' }}</text>
        <view v-for="month in displayedMonths" :key="month.order" class="month-card" :class="{ active: month.current }"><view class="month-top"><text class="month-pillar">{{ month.pillar.ganZhi }}</text><text class="month-label">{{ month.jie }} → {{ month.nextJie }}{{ month.current ? ' · 当前' : '' }}</text></view><text class="small-copy">天干 {{ month.pillar.stemGod }} · 藏干 {{ hiddenLabel(month.pillar.hidden) }}</text><text class="small-copy">{{ month.start }} 起<br />至 {{ month.end }} 前 · UTC+08:00</text></view>
        <AppButton class="source-link" :aria-expanded="allMonths" @click="allMonths = !allMonths">{{ allMonths ? '收起其他流月 −' : '展开十二节月的完整区间 ＋' }}</AppButton><text class="small-copy">交节时间显示至秒是计算分辨率，不代表绝对天文精度。</text>
      </view>

      <view class="panel">
        <text class="eyebrow">紫微 · 按层查看</text><text class="panel-title">{{ result.ziwei.lunarDate }} · {{ result.ziwei.nominalAge }} 虚岁</text><text class="small-copy">流年以春节为界；流月按农历与闰月半月规则。本次时辰索引 {{ result.ziwei.inputTimeIndex }} → 生效 {{ result.ziwei.effectiveTimeIndex }}（0 为早子，12 为晚子）。</text>
        <view class="scope-tabs"><AppButton v-for="scope in result.ziwei.scopes" :key="scope.id" :class="{ selected: scopeId === scope.id }" :aria-pressed="scopeId === scope.id" @click="scopeId = scope.id; allPalaces = false">{{ scope.label }}</AppButton></view>
        <view v-if="activeScope" class="scope-result"><text class="scope-title">{{ activeScope.label }}{{ activeScope.ganZhi ? ' · ' + activeScope.ganZhi : '' }}</text><text class="small-copy">{{ activeScope.note }}</text>
          <template v-if="activeScope.status === 'ready' && activePalace"><text class="scope-location">命宫落在 {{ activePalace.branch }} · 本命{{ palaceLabel(activePalace.name) }}</text><text class="small-copy">该宫本命主辅星：{{ activePalace.stars.join('、') || '无' }}</text>
            <view class="mutations"><view v-for="mutation in activeScope.mutations" :key="mutation.kind" class="mutation-row"><text class="mutation-kind">化{{ mutation.kind }}</text><view><text class="mutation-star">{{ mutation.star }}</text><text class="small-copy">本命{{ palaceLabel(mutation.natalPalace) }} · {{ mutation.branch }}</text></view></view></view>
            <text class="small-copy">本层命宫流曜：{{ activeScope.flowStars[activePalace.index].join('、') || (activeScope.id === 'age' || activeScope.id === 'origin' ? '本层不设流曜' : '无') }}</text>
            <AppButton class="source-link" :aria-expanded="allPalaces" @click="allPalaces = !allPalaces">{{ allPalaces ? '收起十二宫对应 −' : '查看十二宫对应与流曜 ＋' }}</AppButton>
            <view v-if="allPalaces" class="palace-list"><view v-for="palace in result.ziwei.palaces" :key="palace.index" class="palace-row"><text>{{ palace.branch }} · 本层{{ palaceLabel(activeScope.palaceNames[palace.index]) }}</text><text class="small-copy">本命{{ palaceLabel(palace.name) }} · {{ palace.stem }}{{ palace.branch }}<br />流曜 {{ activeScope.flowStars[palace.index].join('、') || '无' }}</text></view></view>
          </template>
        </view>
      </view>
      <view class="panel"><text class="panel-title">保留这次研习</text><text v-if="result.input.note" class="reading-note" selectable>{{ result.input.note }}</text><text v-if="viewingSavedAt" class="small-copy">{{ viewingSavedAt.slice(0, 10) }} 保存的原样快照 · {{ result.ruleVersion }}</text><text v-if="recordError" class="error-note" role="alert">{{ recordError }}</text><AppButton class="btn-secondary" :disabled="Boolean(savedId) || Boolean(storageError)" @click="save">{{ savedId ? '这份快照已保存' : '保存输入、规则与各层事实' }}</AppButton><text class="small-copy">最多 20 份；不覆盖历史出生档案，查看旧快照不重新排盘。</text></view>
    </view>

    <view class="panel"><view class="record-heading"><text class="panel-title">本机研习记录</text><text class="small-copy">{{ records.length }} / 20</text></view><text v-if="storageError" class="error-note" role="alert">{{ storageError }}</text><text v-if="recordError && !result" class="error-note" role="alert">{{ recordError }}</text><AppButton v-if="storageError" class="source-link" @click="loadRecords">重试读取</AppButton><text v-if="!records.length && !storageError" class="small-copy">还没有保存的研习记录。</text>
      <view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="openRecord(record)"><text class="record-title">{{ record.snapshot.input.name }}</text><text class="small-copy">{{ record.snapshot.observationTime.beijingTime }} · UTC+08:00<br />查看原样快照 ↗</text></AppButton><AppButton class="source-link delete-button" :aria-label="`删除研习记录：${record.snapshot.input.name}`" @click="remove(record)">删除</AppButton></view>
      <AppButton class="btn-secondary export-button" :disabled="!records.length || Boolean(storageError)" @click="exportRecords">导出全部研习记录 JSON</AppButton><text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>
    </view>
    <view class="panel"><AppButton class="disclosure" :aria-expanded="rulesOpen" @click="rulesOpen = !rulesOpen"><text>规则与来源</text><text>{{ rulesOpen ? '−' : '＋' }}</text></AppButton><view v-if="rulesOpen"><text v-for="rule in result?.conventions || FLOW_STUDY_CONVENTIONS" :key="rule" class="small-copy">{{ rule }}</text><AppButton v-for="source in result?.sources || FLOW_STUDY_SOURCES" :key="source.url" class="source-link" @click="openSource(source.url)">{{ source.title }} ↗<text class="small-copy">{{ source.version }} · {{ source.license }}</text></AppButton></view></view>
    <text class="footer-note">把时间规则说清楚，给自己的理解留空间。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import BirthDateField from '@/components/birth/BirthDateField.vue'
import BirthTimeField from '@/components/birth/BirthTimeField.vue'
import { calculateFlowStudy, validateFlowStudySnapshot, FLOW_STUDY_CONVENTIONS, FLOW_STUDY_SOURCES, type FlowStudySnapshot, type FlowStudyInput, type FlowScopeId, type ObservationTime } from '@/domain/flow-study'
import { createFlowStudyRepository, type FlowStudyRecord } from '@/domain/flow-study/repository'
import { createChartArchive, type SavedChart } from '@/domain/metaphysics/archive'
import type { BirthProfile } from '@/domain/metaphysics/types'
import { exportJson } from '@/utils/export-json'

type Side = 'birth' | 'observation'
type Mode = 'manual' | 'iana'
type Choice = '' | 'earlier' | 'later'
const now = new Date(Date.now() + 28_800_000).toISOString()
const birthMax = new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10)
const name = ref(''), birthDate = ref(''), birthTime = ref(''), gender = ref<'男' | '女'>('女'), precision = ref<'minute' | 'approximate'>('minute'), birthMode = ref<Mode>('manual'), birthOffset = ref('8'), birthZone = ref('Asia/Shanghai'), birthChoice = ref<Choice>('')
const observationDate = ref(now.slice(0, 10)), observationTime = ref(now.slice(11, 16)), observationMode = ref<Mode>('manual'), observationOffset = ref('8'), observationZone = ref('Asia/Shanghai'), observationChoice = ref<Choice>(''), note = ref('')
const result = ref<FlowStudySnapshot | null>(null), records = ref<FlowStudyRecord[]>([]), archives = ref<SavedChart[]>([]), archiveId = ref(''), archiveError = ref(''), queryError = ref(''), storageError = ref(''), recordError = ref(''), notice = ref(''), stale = ref(false), savedId = ref(''), viewingSavedAt = ref('')
const allMonths = ref(false), allPalaces = ref(false), rulesOpen = ref(false), scopeId = ref<FlowScopeId>('daily'), copiedPlace = ref<BirthProfile['place']>()
const archiveLabels = computed(() => archives.value.map(item => `${item.name} · ${item.result.profile.date}`))
const timeSections = computed(() => [
  { id: 'birth' as Side, label: '出生', mode: birthMode.value, offset: birthOffset.value, zone: birthZone.value, choice: birthChoice.value },
  { id: 'observation' as Side, label: '观测', mode: observationMode.value, offset: observationOffset.value, zone: observationZone.value, choice: observationChoice.value },
])
const foldOptions: { value: Choice; label: string }[] = [{ value: '', label: '尚未选择' }, { value: 'earlier', label: '较早一次' }, { value: 'later', label: '较晚一次' }]
const displayedMonths = computed(() => result.value?.bazi.months.filter(item => allMonths.value || item.current) || [])
const activeScope = computed(() => result.value?.ziwei.scopes.find(scope => scope.id === scopeId.value))
const activePalace = computed(() => activeScope.value?.palaceIndex !== null && activeScope.value?.palaceIndex !== undefined ? result.value?.ziwei.palaces[activeScope.value.palaceIndex] : undefined)
const repository = createFlowStudyRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const archive = createChartArchive({ get: key => uni.getStorageSync(key), set: () => { throw new Error('此页面仅复制出生资料，不写入历史出生档案。') } })
function setMode(side: Side, value: Mode) { (side === 'birth' ? birthMode : observationMode).value = value }
function inputValue(event: unknown): string { const e = event as { detail?: { value?: unknown }; target?: { value?: unknown } }; const value = e.detail?.value ?? e.target?.value; return typeof value === 'string' ? value : '' }
function setOffset(side: Side, value: string) { (side === 'birth' ? birthOffset : observationOffset).value = value }
function setZone(side: Side, value: string) { (side === 'birth' ? birthZone : observationZone).value = value }
function setChoice(side: Side, value: Choice) { (side === 'birth' ? birthChoice : observationChoice).value = value }
function message(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试。' }
function palaceLabel(value: string) { return value.endsWith('宫') ? value : value + '宫' }
function offsetLabel(value: number) { return `UTC${value >= 0 ? '+' : ''}${Math.round(value * 1000000) / 1000000}` }
function hiddenLabel(hidden: { stem: string; god: string }[]) { return hidden.map(item => `${item.stem} ${item.god}`).join('、') }
function timeInput(side: Side): ObservationTime {
  const part = timeSections.value.find(item => item.id === side)!
  if (part.mode === 'iana' && !part.zone.trim()) throw new Error(`请填写${part.label} IANA 时区名。`)
  return { date: side === 'birth' ? birthDate.value : observationDate.value, time: side === 'birth' ? birthTime.value : observationTime.value, utcOffset: part.offset.trim() ? Number(part.offset) : NaN, ...(part.mode === 'iana' ? { timeZone: part.zone.trim() } : {}), ...(part.choice ? { timeChoice: part.choice } : {}) }
}
function scrollToResult() { nextTick(() => uni.pageScrollTo({ selector: '#flow-result', duration: 250 })) }
function calculate() {
  queryError.value = ''; recordError.value = ''; notice.value = ''; result.value = null; savedId.value = ''; viewingSavedAt.value = ''
  try { result.value = calculateFlowStudy({ name: name.value, birth: { ...timeInput('birth'), gender: gender.value, timePrecision: precision.value, ...(copiedPlace.value ? { place: { ...copiedPlace.value } } : {}) }, observation: timeInput('observation'), note: note.value }); stale.value = false; allMonths.value = false; scrollToResult() } catch (error) { queryError.value = message(error) }
}
function fillBirth(profile: BirthProfile) {
  birthDate.value = profile.date; birthTime.value = profile.time; gender.value = profile.gender; precision.value = profile.timePrecision || 'minute'; birthMode.value = profile.timeZone ? 'iana' : 'manual'; birthOffset.value = String(profile.utcOffset); birthZone.value = profile.timeZone || 'Asia/Shanghai'; birthChoice.value = profile.timeChoice || ''; copiedPlace.value = profile.place ? { ...profile.place } : undefined
}
function fillInput(input: FlowStudyInput) { name.value = input.name; fillBirth(input.birth); observationDate.value = input.observation.date; observationTime.value = input.observation.time; observationMode.value = input.observation.timeZone ? 'iana' : 'manual'; observationOffset.value = String(input.observation.utcOffset); observationZone.value = input.observation.timeZone || 'Asia/Shanghai'; observationChoice.value = input.observation.timeChoice || ''; note.value = input.note }
function loadExample() { fillInput({ name: 'iztro 公开示例核对', birth: { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 }, observation: { date: '2023-08-28', time: '00:30', utcOffset: 8 }, note: '公开示例固定为寅时出生、2023 年 8 月 28 日子时观测。虚岁采用本版春节换年规则。' }); notice.value = '已载入公开核对资料，请点击生成。' }
function copyArchive() { const item = archives.value.find(record => record.id === archiveId.value); if (!item) return; fillBirth(item.result.profile); if (!name.value) name.value = item.name.slice(0, 32) + ' · 运限'; notice.value = '已复制出生资料，原档案未改动。' }
function loadRecords() { try { records.value = repository.list(); storageError.value = '' } catch (error) { records.value = []; storageError.value = message(error) } }
function save() { if (!result.value || savedId.value || storageError.value) return; recordError.value = ''; try { const record = repository.save(result.value); savedId.value = record.id; viewingSavedAt.value = record.savedAt; loadRecords(); notice.value = '已保存独立研习快照。' } catch (error) { recordError.value = message(error) } }
function openRecord(record: FlowStudyRecord) { try { const snapshot = validateFlowStudySnapshot(record.snapshot); fillInput(snapshot.input); result.value = snapshot; savedId.value = record.id; viewingSavedAt.value = record.savedAt; stale.value = false; queryError.value = ''; recordError.value = ''; notice.value = ''; allMonths.value = false; allPalaces.value = false; scrollToResult() } catch (error) { recordError.value = message(error) } }
function remove(record: FlowStudyRecord) { uni.showModal({ title: '删除这份研习记录？', content: record.snapshot.input.name, confirmText: '删除', cancelText: '保留', success: response => { if (!response.confirm) return; try { repository.remove(record.id); if (savedId.value === record.id) { savedId.value = ''; viewingSavedAt.value = '' }; loadRecords(); notice.value = '已删除这份记录。' } catch (error) { recordError.value = message(error) } } }) }
async function exportRecords() { try { const outcome = await exportJson(JSON.parse(repository.exportJSON()), 'oasis-flow-study.json'); notice.value = outcome === 'download' ? '已发起 JSON 下载，请在浏览器下载目录确认。' : '记录已复制，请粘贴至文件保存。' } catch (error) { recordError.value = message(error) } }
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer'); return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => { notice.value = '来源链接已复制。' } })
  // #endif
}
watch([name, birthDate, birthTime, gender, precision, birthMode, birthOffset, birthZone, birthChoice, observationDate, observationTime, observationMode, observationOffset, observationZone, observationChoice, note], () => { if (result.value) stale.value = true; result.value = null; savedId.value = ''; viewingSavedAt.value = ''; queryError.value = ''; recordError.value = ''; notice.value = '' }, { flush: 'sync' })
loadRecords()
try { archives.value = archive.list() } catch (error) { archiveError.value = message(error) }
</script>

<style scoped>
.flow-page { padding-bottom: 40px; }.intro { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 18px; }.intro > view { min-width: 0; }.intro .page-heading { font-size: 25px; line-height: 1.6; }.intro .page-caption { font-size: 11px; line-height: 1.8; }.intro-cat { width: 116px; height: 156px; flex-shrink: 0; }.privacy-note { display: block; color: #7b7d91; font-size: 11px; line-height: 1.9; margin-bottom: 20px; }.panel { background: #fff; border: 1px solid #e7e4ef; border-radius: 22px; padding: 20px; margin-bottom: 20px; }.panel-title { display: block; color: #645d7d; font-size: 17px; line-height: 1.8; font-weight: 600; overflow-wrap: anywhere; }.small-copy { display: block; color: #8a869b; font-size: 11px; line-height: 1.9; margin-top: 7px; overflow-wrap: anywhere; }.form-group { margin: 16px 0; }.form-label { font-size: 13px; }.form-input, .form-picker { padding: 0 10px; font-size: 13px; }.native-select { appearance: auto; font-family: inherit; }.form-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 10px; }.subheading { display: block; color: #716282; font-size: 14px; line-height: 1.8; margin-top: 24px; font-weight: 600; }.choices { display: flex; gap: 8px; }.choices button { flex: 1; min-width: 0; margin: 0; min-height: 44px; padding: 8px 5px; border-radius: 11px; border: 1px solid #e4e0ed; background: #fbfafc; color: #8d849c; font-size: 11px; line-height: 1.8; white-space: normal; }.choices button.selected, .scope-tabs button.selected { color: #765783; background: #f2e8f6; border-color: #c7aad1; }.fold-choices { margin-top: 12px; }.note-input { width: 100%; box-sizing: border-box; padding: 12px; min-height: 118px; height: 118px; border: 1px solid #e8e2ec; border-radius: 12px; background: #fdfbfe; color: #766b82; font-size: 13px; line-height: 1.9; }.source-link { display: block; padding: 5px 0; margin: 5px 0; min-height: 36px; background: transparent; color: #927399; font-size: 11px; line-height: 1.8; text-align: left; white-space: normal; }.time-panel { background: #f5f2f9; }.scope-note, .year-fact { display: block; background: #f7f4fa; border-radius: 12px; padding: 13px; margin-top: 16px; color: #796881; font-size: 12px; line-height: 1.9; }.month-card { padding: 14px; margin-top: 12px; border: 1px solid #eeebf0; border-radius: 14px; }.month-card.active { background: #f4f0f9; border-color: #d6c8e2; }.month-top { display: flex; align-items: baseline; gap: 12px; justify-content: space-between; }.month-pillar { color: #786089; font-size: 22px; font-family: serif; }.month-label { font-size: 11px; color: #99879e; }.scope-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 20px; }.scope-tabs button { width: 100%; margin: 0; min-height: 44px; padding: 6px 3px; border: 1px solid #e9e2ed; border-radius: 10px; background: #fcfafc; color: #95829b; font-size: 12px; line-height: 1.8; }.scope-result { padding-top: 20px; }.scope-title { display: block; color: #796185; font-size: 20px; line-height: 1.8; }.scope-location { display: block; color: #897190; font-size: 13px; line-height: 1.9; margin-top: 14px; }.mutations { margin-top: 18px; }.mutation-row { display: flex; gap: 16px; padding: 12px 0; border-top: 1px solid #efeaf2; }.mutation-kind { display: flex; align-items: center; color: #9b7b9e; font-size: 12px; width: 42px; }.mutation-star { color: #776181; font-size: 15px; }.mutation-row .small-copy { margin-top: 3px; }.palace-list { margin-top: 12px; }.palace-row { border-top: 1px solid #efeaf2; padding: 12px 0; color: #83748e; font-size: 12px; line-height: 1.9; }.reading-note { display: block; white-space: pre-wrap; font-size: 13px; color: #81738b; line-height: 1.9; margin: 14px 0; overflow-wrap: anywhere; }.record-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }.record-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #ede8f0; }.record-open { flex: 1; min-width: 0; background: transparent; color: #81728d; text-align: left; padding: 0; margin: 0; line-height: 1.8; white-space: normal; }.record-title { display: block; font-size: 14px; overflow-wrap: anywhere; }.delete-button { flex-shrink: 0; color: #ac758e; }.export-button { margin-top: 18px; font-size: 13px; }.disclosure { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 44px; margin: 0; padding: 0; color: #8a7397; background: transparent; font-size: 13px; }.error-note { display: block; padding: 12px; margin: 12px 0; border-radius: 12px; color: #9c4964; background: #fcf0f4; font-size: 12px; line-height: 1.9; }.notice { display: block; margin-top: 12px; padding: 10px; color: #826690; background: #f5eff9; border-radius: 10px; font-size: 12px; line-height: 1.9; }
@media (max-width: 360px) { .panel { padding: 16px; }.intro .page-heading { font-size: 22px; }.intro-cat { width: 85px; height: 130px; }.scope-tabs { gap: 5px; }.form-grid { gap: 8px; }.month-top { gap: 8px; } }
</style>
