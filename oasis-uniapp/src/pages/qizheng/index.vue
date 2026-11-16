<template>
 <view class="page-container qizheng-page">
  <view class="intro"><view class="intro-copy"><text class="eyebrow">七政四余 · 天文基础</text><text class="page-heading">七政天文对照</text><text class="page-caption">把日月五星放进两套坐标，认识黄道、赤道与去极度。本页保留现代天文口径。</text></view><CatCompanion class="intro-cat" mood="thinking" small /></view>
  <view class="panel"><text class="panel-title">另读一套古法宿表</text><text class="small-copy">清《历象考成》的黄道二十八宿，按明确的年标号和宫度查算。古表与现代位置分别记录，不能直接套算。</text><AppButton class="source-button" @click="openLodges">打开清历宿度查算 ↗</AppButton></view>
  <view class="panel">
   <text class="panel-title">选一个采样时刻</text><text class="small-copy">可填出生时刻或研究时刻，支持 1900–2099 年。本页使用地心坐标，不需要性别或观测地点。</text>
   <view v-if="sharedProfiles.length" class="form-group"><text class="form-label">从本机出生资料填写</text>
    <!-- #ifdef H5 -->
    <select v-model.number="profileIndex" class="native-select" aria-label="七政读取本机出生资料" @change="fillShared(profileIndex)"><option v-for="(label, index) in sharedLabels" :key="index" :value="index">{{ label }}</option></select>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <picker :range="sharedLabels" :value="0" @change="fillShared(Number($event.detail.value))" aria-label="七政读取本机出生资料"><view class="form-picker">选择本机出生资料</view></picker>
    <!-- #endif -->
   </view>
   <text v-if="sharedError" class="notice">{{ sharedError }}</text>
   <view class="form-grid">
    <view><text class="form-label">采样日期</text><BirthDateField v-model="form.date" max="2099-12-31" label-prefix="七政采样" /></view>
    <view><text class="form-label">当地时刻</text><BirthTimeField v-model="form.time" label-prefix="七政采样" /></view>
   </view>
   <text class="small-copy">未知出生时刻时先核实资料，不以默认中午替代。</text>
   <view class="form-group"><text class="form-label">时刻精度</text>
    <!-- #ifdef H5 -->
    <select v-model.number="form.precisionIndex" class="native-select" aria-label="七政时刻精度"><option v-for="(label, index) in precisionLabels" :key="index" :value="index">{{ label }}</option></select>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <picker :range="precisionLabels" :value="form.precisionIndex" @change="form.precisionIndex = Number($event.detail.value)" aria-label="七政时刻精度"><view class="form-picker">{{ precisionLabels[form.precisionIndex] }}</view></picker>
    <!-- #endif -->
   </view>
   <view class="form-group"><label for="qizheng-offset" class="form-label">UTC 偏移（小时）</label><input id="qizheng-offset" v-model="form.utcOffset" class="form-input" maxlength="8" placeholder="例如 8、5.5、-4" aria-label="七政UTC偏移" /></view>
   <view class="form-group"><label for="qizheng-zone" class="form-label">历史 IANA 时区（选填）</label><input id="qizheng-zone" v-model="form.timeZone" class="form-input" maxlength="100" placeholder="例如 Asia/Shanghai" aria-label="七政历史时区" /><text class="small-copy">填写后按设备时区资料解析该年的夏令时，替代手动偏移。</text></view>
   <view v-if="form.timeZone.trim()" class="form-group"><text class="form-label">回拨产生的重复时刻</text>
    <!-- #ifdef H5 -->
    <select v-model.number="form.choiceIndex" class="native-select" aria-label="七政重复时刻选择"><option v-for="(label, index) in choiceLabels" :key="index" :value="index">{{ label }}</option></select>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <picker :range="choiceLabels" :value="form.choiceIndex" @change="form.choiceIndex = Number($event.detail.value)" aria-label="七政重复时刻选择"><view class="form-picker">{{ choiceLabels[form.choiceIndex] }}</view></picker>
    <!-- #endif -->
   </view>
   <text v-if="error" class="error" role="alert">{{ error }}</text>
   <view class="action-row"><AppButton class="primary-button" @click="calculate">查看七政坐标</AppButton><AppButton class="secondary-button" @click="useNow">使用此刻 · UTC+8</AppButton></view>
  </view>

  <template v-if="result">
   <view class="panel"><text class="eyebrow">{{ historyName ? '原始快照 · ' + historyName : '当前采样结果' }}</text><text class="panel-title">{{ result.moment.date }} {{ result.moment.time }}</text><text class="small-copy">UTC{{ result.moment.utcOffset >= 0 ? '+' : '' }}{{ result.moment.utcOffset }}{{ result.moment.timeZone ? ' · ' + result.moment.timeZone : '' }}</text><text class="small-copy">UTC 时刻：{{ result.utcTime }}</text><text class="notice">现代一周 360°，日期真坐标，近似地心视位置。此表尚未生成四余、宿度或命宫。</text><text v-if="result.moment.timePrecision === 'approximate'" class="notice">大约时刻：坐标仅对应所填时间，不能视为确定的出生位置。</text>
    <view class="coordinate-tabs"><AppButton :aria-pressed="coordinateView === 'ecliptic'" :class="{ selected: coordinateView === 'ecliptic' }" @click="coordinateView = 'ecliptic'">黄道坐标</AppButton><AppButton :aria-pressed="coordinateView === 'equatorial'" :class="{ selected: coordinateView === 'equatorial' }" @click="coordinateView = 'equatorial'">赤道与去极度</AppButton></view>
    <text class="small-copy view-caption">{{ coordinateView === 'ecliptic' ? '黄经从日期真春分点起算；黄纬为相对黄道的南北角距离，北为正。' : '赤经沿日期真赤道起算，一周24小时；赤纬北正南负。去极度从北天极量起，按现代角度为90°−赤纬。' }}</text>
    <view v-for="position in result.positions" :key="position.body" class="body-card"><view class="body-title"><text class="body-name">{{ position.name }}</text><text class="body-alias">{{ position.modernName }}</text></view><view v-if="coordinateView === 'ecliptic'" class="coordinate-grid"><view><text class="value-label">黄经</text><text class="value">{{ position.longitude.toFixed(4) }}°</text></view><view><text class="value-label">黄纬</text><text class="value">{{ signedAngle(position.latitude) }}</text></view></view><view v-else><view class="coordinate-grid"><view><text class="value-label">赤经</text><text class="value ra-value">{{ formatRightAscension(position.rightAscensionHours) }}</text><text class="small-copy">{{ position.rightAscensionDegrees.toFixed(4) }}°</text></view><view><text class="value-label">赤纬</text><text class="value">{{ signedAngle(position.declination) }}</text></view></view><text class="polar-distance">去极度（现代） {{ position.northPolarDistance.toFixed(4) }}°</text></view></view>
    <text class="small-copy">显示小数位用于对照，并不代表同等精度保证。赤经的“时分秒”是角度单位，不是采样的钟表时间。</text>
   </view>
   <view class="panel"><text class="panel-title">记下这次观察</text><label for="qizheng-record-name" class="form-label">记录名称</label><input id="qizheng-record-name" v-model="recordName" class="form-input" maxlength="40" placeholder="为这次采样命名" aria-label="七政记录名称" /><label for="qizheng-note" class="form-label note-label">对照笔记（选填）</label><textarea id="qizheng-note" v-model="recordNote" class="note-input" maxlength="2000" placeholder="记录所比较的文献、时刻与自己的问题" aria-label="七政对照笔记" /><view class="action-row"><AppButton class="secondary-button" @click="save">保存到本机</AppButton><AppButton class="secondary-button" @click="exportCurrent">导出当前结果</AppButton></view><text class="small-copy">保存完整输入、数值、笔记和规则版本。最多20份；历史快照打开时不会重新计算。</text></view>
  </template>

  <view class="panel"><text class="panel-title">本天文页未计算的项目</text><text class="small-copy">古籍提供了不同历元、度量和数表。本页不从现代七政坐标推算以下项目；清代黄道宿表查算使用上方独立入口。回看时保留原快照的范围说明。</text><view v-for="gap in displayedGaps" :key="gap.id" class="gap-card"><text class="gap-name">{{ gap.name }} <text class="gap-status">本页未算</text></text><text class="small-copy">{{ gap.description }}</text><text class="gap-reason">{{ gap.reason }}</text></view><text class="notice">《七政算内篇》记载的周天单位与现代360°不同，且赤道宿度和黄道宿度分列。这里展示的现代去极度不能直接读作古籍入宿度。</text></view>
  <view class="panel"><AppButton class="section-toggle" :aria-expanded="showSources" @click="showSources = !showSources">规则与参考资料 <text>{{ showSources ? '−' : '＋' }}</text></AppButton><view v-if="showSources"><template v-if="result"><text v-for="line in result.conventions" :key="line" class="rule-copy">{{ line }}</text><text v-for="line in result.limitations" :key="line" class="notice">{{ line }}</text></template><AppButton v-for="source in displayedSources" :key="source.id" class="source-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton><text v-if="result" class="small-copy">规则版本：{{ result.ruleVersion }}</text></view></view>
  <view class="panel"><text class="panel-title">本机七政记录</text><text v-if="storageError" class="error" role="alert">{{ storageError }}</text><text v-if="notice" class="notice" role="status">{{ notice }}</text><text v-if="!records.length && !storageError" class="small-copy">尚无保存记录。查看坐标后，可附上笔记并保存。</text><view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="openRecord(record)"><text class="record-title">{{ record.name }}</text><text class="small-copy">{{ record.snapshot.moment.date }} {{ record.snapshot.moment.time }} · {{ record.snapshot.moment.timePrecision === 'approximate' ? '大约时刻' : '确认到分钟' }}</text></AppButton><AppButton class="delete-button" :aria-label="'删除七政记录' + record.name" @click="removeRecord(record)">删除</AppButton></view><AppButton v-if="records.length" class="secondary-button export-all" @click="exportAll">导出全部七政记录</AppButton></view>
 </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import BirthDateField from '@/components/birth/BirthDateField.vue'
import BirthTimeField from '@/components/birth/BirthTimeField.vue'
import { calculateQizheng, formatRightAscension, QIZHENG_GAPS, QIZHENG_SOURCES, type QizhengMoment, type QizhengSnapshot } from '@/domain/qizheng'
import { createQizhengRepository, type QizhengRecord } from '@/domain/qizheng/repository'
import { createChartArchive, type SavedChart } from '@/domain/metaphysics/archive'
import { exportJson } from '@/utils/export-json'

const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const form = reactive({ date: '', time: '', utcOffset: '8', precisionIndex: 0, timeZone: '', choiceIndex: 0 })
const precisionLabels = ['请选择时刻精度', '已确认到分钟', '大约时间']
const choiceLabels = ['需要时提醒我确认', '较早的一次（回拨前）', '较晚的一次（回拨后）']
const result = ref<QizhengSnapshot | null>(null)
const error = ref(''), storageError = ref(''), sharedError = ref(''), notice = ref(''), recordName = ref(''), recordNote = ref(''), historyName = ref('')
const showSources = ref(false), coordinateView = ref<'ecliptic' | 'equatorial'>('ecliptic'), profileIndex = ref(0)
const records = ref<QizhengRecord[]>([]), sharedProfiles = ref<SavedChart[]>([])
const sharedLabels = computed(() => ['选择本机出生资料', ...sharedProfiles.value.map(record => `${record.name} · ${record.result.profile.date}`)])
const displayedGaps = computed(() => result.value?.unavailable || QIZHENG_GAPS)
const displayedSources = computed(() => result.value?.sources || QIZHENG_SOURCES)
const repository = createQizhengRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const sharedArchive = createChartArchive({ get: key => uni.getStorageSync(key), set: () => { throw new Error('本页仅读取通用出生资料') } })
const message = (value: unknown) => value instanceof Error ? value.message : '操作未完成，请重试'
watch(form, () => { result.value = null; historyName.value = ''; error.value = ''; notice.value = '' }, { deep: true, flush: 'sync' })
function reloadRecords() { try { records.value = repository.list(); storageError.value = '' } catch (error) { storageError.value = message(error) } }
onShow(() => { reloadRecords(); try { sharedProfiles.value = sharedArchive.list(); sharedError.value = '' } catch (error) { sharedError.value = message(error) } })
function fillMoment(moment: QizhengMoment) { Object.assign(form, { date: moment.date, time: moment.time, utcOffset: String(moment.utcOffset), precisionIndex: moment.timePrecision === 'approximate' ? 2 : 1, timeZone: moment.timeZone || '', choiceIndex: moment.timeChoice === 'earlier' ? 1 : moment.timeChoice === 'later' ? 2 : 0 }) }
function fillShared(index: number) {
 const record = sharedProfiles.value[index - 1]
 if (record) {
  fillMoment({ ...record.result.profile, timePrecision: record.result.profile.timePrecision || 'minute' })
  const suffix = ' · 七政', prefix = [...record.name]
  // Keep complete Unicode characters while satisfying the archive's UTF-16 length limit.
  while (prefix.join('').length + suffix.length > 40) prefix.pop()
  recordName.value = prefix.join('') + suffix
  recordNote.value = ''; notice.value = '已填入出生时刻，请核对后查看坐标。'
 }
 profileIndex.value = 0
}
function calculate() {
 error.value = ''; notice.value = ''; result.value = null; historyName.value = ''
 try {
  if (!form.precisionIndex) throw new Error('请明确选择采样时刻精度')
  if (!form.utcOffset.trim() && !form.timeZone.trim()) throw new Error('请填写 UTC 偏移或历史 IANA 时区')
  const moment: QizhengMoment = { date: form.date.trim(), time: form.time.trim(), utcOffset: Number(form.utcOffset), timePrecision: form.precisionIndex === 2 ? 'approximate' : 'minute', ...(form.timeZone.trim() ? { timeZone: form.timeZone.trim(), ...(form.choiceIndex ? { timeChoice: form.choiceIndex === 1 ? 'earlier' as const : 'later' as const } : {}) } : {}) }
  result.value = calculateQizheng(moment)
  if (!recordName.value.trim()) recordName.value = `${moment.date} · 七政对照`
 } catch (problem) { error.value = message(problem) }
}
function useNow() { const now = new Date(Date.now() + 8 * 3600000).toISOString(); Object.assign(form, { date: now.slice(0, 10), time: now.slice(11, 16), utcOffset: '8', precisionIndex: 1, timeZone: '', choiceIndex: 0 }); recordName.value = ''; recordNote.value = ''; calculate() }
function signedAngle(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(4)}°` }
function save() { if (!result.value) return; try { const record = repository.save(recordName.value, recordNote.value, result.value); reloadRecords(); historyName.value = record.name; notice.value = '已保存七政坐标与笔记到本机。' } catch (error) { storageError.value = message(error) } }
function openRecord(record: QizhengRecord) { fillMoment(record.snapshot.moment); result.value = JSON.parse(JSON.stringify(record.snapshot)); recordName.value = record.name; recordNote.value = record.note; historyName.value = record.name; notice.value = '正在阅读保存时的原始坐标快照。' }
function removeRecord(record: QizhengRecord) { uni.showModal({ title: '删除本机七政记录', content: `删除「${record.name}」？建议先导出备份。`, success: response => { if (response.confirm) { try { records.value = repository.remove(record.id); storageError.value = ''; notice.value = '已删除这份七政记录。' } catch (error) { storageError.value = message(error) } } } }) }
async function sendExport(value: unknown, filename: string) { try { const mode = await exportJson(value, filename); notice.value = mode === 'download' ? '已发起 JSON 文件下载。' : 'JSON 已复制，请自行保存到文件。' } catch (error) { notice.value = message(error) } }
function exportCurrent() { if (result.value) void sendExport({ format: 'oasis-qizheng-reference', formatVersion: 1, name: recordName.value.trim(), note: recordNote.value, exportedAt: new Date().toISOString(), snapshot: result.value }, `qizheng-${result.value.moment.date}.json`) }
function exportAll() { try { void sendExport(repository.exportJSON(), 'qizheng-records.json') } catch (error) { storageError.value = message(error) } }
function openLodges() { uni.navigateTo({ url: '/pages/qizheng-lodges/index' }) }
function openSource(url: string) {
 // #ifdef H5
 window.open(url, '_blank', 'noopener,noreferrer')
 // #endif
 // #ifndef H5
 uni.setClipboardData({ data: url, success: () => { notice.value = '参考链接已复制。' } })
 // #endif
}
</script>

<style scoped>
.qizheng-page { padding-bottom:100px; }.intro { display:flex; align-items:center; gap:8px; margin-bottom:22px; }.intro-copy { flex:1; min-width:0; }.intro-cat { width:80px; flex-shrink:0; }.eyebrow,.page-heading,.page-caption,.panel-title,.small-copy,.form-label,.notice,.error,.body-name,.body-alias,.value-label,.value,.polar-distance,.gap-name,.gap-reason,.rule-copy,.record-title { display:block; }.eyebrow { color:#748896; font-size:11px; letter-spacing:1px; line-height:1.8; }.page-heading { font-size:27px; font-weight:700; color:#493b53; margin:8px 0; }.page-caption,.small-copy { font-size:12px; color:#82778a; line-height:1.85; overflow-wrap:anywhere; }.panel { min-width:0; padding:20px; border:1px solid #eee7f4; border-radius:22px; background:#fff; margin-bottom:18px; }.panel-title { color:#55415f; font-size:18px; font-weight:650; line-height:1.7; margin-bottom:12px; }.form-group { margin:18px 0; }.form-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:12px; margin:16px 0 8px; }.form-grid>view { min-width:0; }.form-label { color:#786780; font-size:12px; margin-bottom:8px; line-height:1.8; }.form-input,.form-picker,.native-select { box-sizing:border-box; width:100%; min-width:0; min-height:44px; padding:11px; background:#f9f6fb; border:1px solid #eee7f4; border-radius:12px; color:#624e70; font-size:12px; line-height:1.6; }.form-input { height:46px; }.native-select { height:46px; appearance:auto; }.action-row { display:flex; gap:10px; flex-wrap:wrap; margin:16px 0 8px; }.primary-button,.secondary-button { flex:1; min-height:44px; white-space:normal; padding:12px 10px; border-radius:12px; font-size:12px; line-height:1.7; }.primary-button { color:white; background:#a58abe; }.secondary-button { color:#775c8a; background:#f1eaf7; }.notice { color:#8c774c; background:#fbf7ef; padding:10px 12px; border-radius:10px; line-height:1.85; font-size:11px; margin:12px 0; overflow-wrap:anywhere; }.error { color:#a95361; font-size:12px; line-height:1.8; margin:12px 0; }.coordinate-tabs { display:flex; background:#f5f0f8; border-radius:12px; padding:4px; gap:4px; margin:18px 0 12px; }.coordinate-tabs>button { flex:1; min-width:0; min-height:44px; color:#927e9d; font-size:12px; background:transparent; padding:9px 6px; line-height:1.8; border-radius:9px; white-space:normal; }.coordinate-tabs>button.selected { background:#fff; color:#735488; box-shadow:0 2px 8px #6b498b0c; }.view-caption { margin-bottom:14px; }.body-card { border:1px solid #eee7f4; border-radius:14px; padding:14px; margin:12px 0; background:#fdfcfe; }.body-title { display:flex; gap:8px; align-items:baseline; margin-bottom:12px; }.body-name { color:#6c567c; font-size:15px; font-weight:650; }.body-alias { color:#a191aa; font-size:11px; }.coordinate-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }.coordinate-grid>view { min-width:0; }.value-label { color:#a091aa; font-size:11px; margin-bottom:5px; }.value { color:#796586; font-size:14px; line-height:1.8; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }.ra-value { font-size:12px; }.polar-distance { margin-top:10px; color:#8e7b98; font-size:11px; line-height:1.8; }.note-label { margin-top:16px; }.note-input { width:100%; box-sizing:border-box; min-height:116px; padding:12px; background:#f9f6fb; border:1px solid #eee7f4; border-radius:12px; font-size:12px; color:#725f7d; line-height:1.85; }.gap-card { padding:14px 0; border-bottom:1px solid #f0eaf4; }.gap-name { font-size:13px; font-weight:650; color:#796386; line-height:1.8; margin-bottom:8px; }.gap-status { font-size:10px; font-weight:400; color:#a693a8; margin-left:8px; }.gap-reason { font-size:11px; line-height:1.85; color:#a18eaa; margin-top:8px; }.section-toggle { display:flex; justify-content:space-between; width:100%; gap:8px; padding:0; min-height:44px; font-size:15px; color:#6b5379; background:transparent; text-align:left; white-space:normal; }.rule-copy { font-size:12px; line-height:1.85; color:#8b7995; margin:12px 0; }.source-button { display:block; width:100%; padding:10px 0; text-align:left; color:#876a9c; font-size:11px; background:transparent; white-space:normal; line-height:1.85; }.record-row { display:flex; gap:8px; align-items:center; border-top:1px solid #eee7f4; padding:10px 0; }.record-open { flex:1; min-width:0; text-align:left; background:transparent; padding:8px 0; white-space:normal; line-height:1.8; }.record-title { color:#745b82; font-size:13px; font-weight:650; }.delete-button { flex-shrink:0; min-height:44px; font-size:11px; color:#a7828d; background:transparent; padding:8px; }.export-all { width:100%; margin-top:12px; }@media(max-width:360px){.panel { padding:15px; }.form-grid { gap:8px; }.intro-cat { width:65px; }.page-heading { font-size:24px; }.body-card { padding:12px; }.value { font-size:12px; }.ra-value { font-size:11px; }}
</style>
