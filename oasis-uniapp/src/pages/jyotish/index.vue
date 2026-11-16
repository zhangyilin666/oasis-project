<template>
 <view class="page-container jyotish-page">
  <view class="intro"><view class="intro-copy"><text class="eyebrow">恒星黄道 · 印度占星</text><text class="page-heading">循星而读</text><text class="page-caption">从七曜位置、月宿与传统周期认识 Jyotish。保留计算规则，让每一次阅读都可回看。</text></view><CatCompanion class="intro-cat" mood="thinking" small /></view>
  <view class="panel">
   <text class="panel-title">出生资料</text>
   <text class="small-copy">本页采用 Lahiri 基准近似模型，提供七曜基础盘。请填写实际出生时刻；时间完全不详时先核实资料。</text>
   
<!-- #ifdef H5 -->
<select v-if="sharedProfiles.length" class="form-picker import-picker" :value="0" @change="fillSharedHtml" aria-label="从本机历史出生档案填写资料"><option v-for="(label, index) in sharedLabels" :key="index" :value="index">{{ label }}</option></select>
<!-- #endif -->
<!-- #ifndef H5 -->
<picker v-if="sharedProfiles.length" :range="sharedLabels" :value="0" @change="fillShared" aria-label="从本机历史出生档案填写资料"><view class="form-picker import-picker">从本机历史出生档案填写资料</view></picker>
<!-- #endif -->

   <text v-if="sharedError" class="notice">{{ sharedError }}</text>
   <view class="form-group"><text class="form-label">出生日期</text><BirthDateField v-model="form.date" :max="today" label-prefix="印度占星出生" /></view>
   <view class="form-group"><text class="form-label">当地出生时间</text><BirthTimeField v-model="form.time" label-prefix="印度占星出生" /></view>
   <view class="form-group"><text class="form-label">出生时间精度</text>
<!-- #ifdef H5 -->
<select v-model.number="form.precisionIndex" class="form-picker" aria-label="印度占星时间精度"><option v-for="(label, index) in precisionLabels" :key="index" :value="index">{{ label }}</option></select>
<!-- #endif -->
<!-- #ifndef H5 -->
<picker :range="precisionLabels" :value="form.precisionIndex" @change="form.precisionIndex = Number($event.detail.value)" aria-label="印度占星时间精度"><view class="form-picker">{{ precisionLabels[form.precisionIndex] }}</view></picker>
<!-- #endif -->
<text class="small-copy">大约时间仅计算所填时刻的七曜与周期，不生成上升点和宫位。</text></view>
   <view class="form-group"><text class="form-label">资料性别</text>
<!-- #ifdef H5 -->
<select v-model.number="form.genderIndex" class="form-picker" aria-label="印度占星资料性别"><option v-for="(label, index) in genderLabels" :key="index" :value="index">{{ label }}</option></select>
<!-- #endif -->
<!-- #ifndef H5 -->
<picker :range="genderLabels" :value="form.genderIndex" @change="form.genderIndex = Number($event.detail.value)" aria-label="印度占星资料性别"><view class="form-picker">{{ genderLabels[form.genderIndex] }}</view></picker>
<!-- #endif -->
   </view>
   <text class="small-copy">性别只随通用出生资料留档，不参与本页计算。</text>
   <view class="form-group"><text class="form-label">出生地区（选填）</text><BirthPlaceField v-model="form.placeName" label-prefix="印度占星出生" @select="selectPlace" /><text class="small-copy">选择地区可填写城市中心坐标与时区；中心坐标是近似位置，可在高级设置中修改。</text><text v-if="regionCoordinates" class="small-copy">本次使用所选城市中心坐标，不代表具体出生地址。</text></view>
   <AppButton class="section-toggle advanced-toggle" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen"><text>时区与精确坐标</text><text aria-hidden="true">{{ advancedOpen ? '−' : '＋' }}</text></AppButton>
   <text class="small-copy">{{ form.timeZone ? '历史时区 · ' + form.timeZone : form.utcOffset.trim() ? '手动 UTC 偏移 · ' + form.utcOffset + ' 小时，请按出生地核对' : '请在高级设置中确认出生时区' }}</text>
   <view v-if="advancedOpen" class="advanced-fields">
    <view class="form-group"><label for="jyotish-zone" class="form-label">历史 IANA 时区（选填）</label><input id="jyotish-zone" v-model="form.timeZone" class="form-input" maxlength="100" placeholder="如 Asia/Kolkata 或 America/New_York" aria-label="印度占星历史时区" /><text class="small-copy">填写后按设备时区资料解析历史夏令时，替代手动偏移。</text></view>
    <view v-if="!form.timeZone.trim()" class="form-group"><label for="jyotish-offset" class="form-label">UTC 偏移（小时）</label><input id="jyotish-offset" v-model="form.utcOffset" class="form-input" maxlength="8" placeholder="如 8、5.5、-4" aria-label="印度占星UTC偏移" /></view>
    <view v-if="form.timeZone.trim()" class="form-group"><text class="form-label">回拨产生的重复时刻</text>
<!-- #ifdef H5 -->
<select v-model.number="form.choiceIndex" class="form-picker" aria-label="印度占星重复时刻选择"><option v-for="(label, index) in choiceLabels" :key="index" :value="index">{{ label }}</option></select>
<!-- #endif -->
<!-- #ifndef H5 -->
<picker :range="choiceLabels" :value="form.choiceIndex" @change="form.choiceIndex = Number($event.detail.value)" aria-label="印度占星重复时刻选择"><view class="form-picker">{{ choiceLabels[form.choiceIndex] }}</view></picker>
<!-- #endif -->
    </view>
    <AppButton class="toggle" :aria-pressed="form.placeEnabled" @click="form.placeEnabled = !form.placeEnabled">{{ form.placeEnabled ? '✓ 已启用地点坐标，可计算宫位' : '＋ 手动填写地点坐标' }}</AppButton>
    <view v-if="form.placeEnabled" class="place-fields"><view class="form-grid"><view><label for="jyotish-lat" class="form-label">纬度</label><input id="jyotish-lat" v-model="form.latitude" class="form-input" maxlength="14" placeholder="如 31.2304" aria-label="印度占星出生纬度" @input="regionCoordinates = false" /></view><view><label for="jyotish-lon" class="form-label">经度</label><input id="jyotish-lon" v-model="form.longitude" class="form-input" maxlength="14" placeholder="如 121.4737" aria-label="印度占星出生经度" @input="regionCoordinates = false" /></view></view><text class="small-copy">北纬、东经为正；南纬、西经为负。宫位支持纬度绝对值小于 66°。</text></view>
   </view>
   <view class="form-group"><text class="form-label">周期观察日期</text>
    <BirthDateField v-model="form.observationDate" label-prefix="观察" max="2099-12-31" :allow-lunar="false" />
<text class="small-copy">固定观察该日北京时间 12:00。出生前或本次 120 年周期之外会显示无可用周期。</text></view>
   <text v-if="error" class="error" role="alert">{{ error }}</text>
   <AppButton class="primary-button" @click="calculate">生成印度占星基础盘</AppButton>
  </view>

  <template v-if="result">
   <view class="panel result-intro"><text class="eyebrow">{{ historyName ? '已保存快照 · ' + historyName : '当前计算结果' }}</text><text class="panel-title">七曜 D1 · 九分盘 D9</text><text class="small-copy">出生：{{ result.profile.date }} {{ result.profile.time }} · UTC{{ result.profile.utcOffset >= 0 ? '+' : '' }}{{ result.profile.utcOffset }}{{ result.profile.timeZone ? ' · ' + result.profile.timeZone : '' }}</text><text class="small-copy">Lahiri-P03 近似岁差值：{{ result.ayanamsa.trueDegrees.toFixed(5) }}°（含章动）</text><text class="notice">{{ result.profile.timePrecision === 'approximate' ? '大约时刻的盘面，边界结果可能变化。' : '使用已确认到分钟的出生时刻。' }} 度数与周期日期均为模型计算约值。</text>
    <view class="position-row table-heading"><text>七曜</text><text>D1 恒星黄道</text><text>D9 九分盘</text></view>
    <view v-for="position in result.positions" :key="position.body" class="position-row"><view><text class="body-name">{{ position.name }}</text><text v-if="position.house" class="cell-note">第 {{ position.house }} 宫</text></view><text>{{ position.d1.sign }}<text class="cell-note">{{ position.d1.degreeInSign.toFixed(2) }}°</text></text><text>{{ position.d9.sign }}<text class="cell-note">{{ position.d9.degreeInSign.toFixed(2) }}°</text></text></view>
    <view v-if="result.houses.status === 'ready'" class="angle-box"><text class="small-copy">上升点：{{ formatPosition(result.houses.ascendant) }}</text><text class="small-copy">D9 上升：{{ formatPosition(result.houses.navamsaAscendant) }}</text><text class="small-copy">天顶：{{ formatPosition(result.houses.midheaven) }}</text><text class="small-copy">整宫制第一宫从{{ result.houses.ascendant.sign }} 0° 开始，天顶不固定为第十宫宫头。</text></view><text v-else class="notice">{{ result.houses.reason }}</text>
   </view>
   <view class="panel"><text class="eyebrow">月亮所处的 27 等分月宿</text><text class="panel-title">{{ result.nakshatra.name }} · 第 {{ result.nakshatra.pada }} 足</text><text class="small-copy">第 {{ result.nakshatra.number }} 月宿 · 运主 {{ DASHA_NAMES[result.nakshatra.lord] }}</text><text class="small-copy">出生时所在大运余额约 {{ result.nakshatra.remainingYears.toFixed(4) }} 年；本版一年固定 365.25 日。</text></view>
   <view class="panel"><text class="eyebrow">VIMSHOTTARI · 大运与分运</text><text class="panel-title">{{ result.observation.date }} 的周期</text><template v-if="result.vimshottari.active"><text class="period-summary">{{ DASHA_NAMES[result.vimshottari.active.maha] }}大运 · {{ DASHA_NAMES[result.vimshottari.active.antar] }}分运</text><text class="small-copy">当前分运约 {{ displayDate(result.vimshottari.active.antarStartUtc) }} — {{ displayDate(result.vimshottari.active.antarEndUtc) }}</text></template><text v-else class="notice">观察时刻在出生之前，或超出本次计算的首个 120 年周期，暂无对应大运。</text><text class="small-copy period-caption">以下日期按北京时间展示，含起点、不含终点；完整 UTC 交界保存在导出文件。首个大运从出生前开始，分运按完整大运划分。</text>
    <view v-for="(period, index) in result.vimshottari.periods" :key="period.startUtc" class="period" :class="{ active: period.lord === result.vimshottari.active?.maha }"><AppButton class="period-toggle" :aria-expanded="expandedPeriod === index" @click="expandedPeriod = expandedPeriod === index ? null : index"><view><text class="period-name">{{ DASHA_NAMES[period.lord] }}大运 · {{ period.years }} 年</text><text class="cell-note">{{ displayDate(period.startUtc) }} — {{ displayDate(period.endUtc) }}</text></view><text>{{ expandedPeriod === index ? '−' : '＋' }}</text></AppButton><view v-if="expandedPeriod === index" class="sub-periods"><view v-for="sub in period.antardashas" :key="sub.startUtc" class="sub-period" :class="{ current: sub.startUtc === result.vimshottari.active?.antarStartUtc }"><text>{{ DASHA_NAMES[sub.lord] }}分运</text><text class="cell-note">{{ displayDate(sub.startUtc) }} — {{ displayDate(sub.endUtc) }}</text></view></view></view>
   </view>
   <view class="panel"><text class="panel-title">保存这一次阅读</text><input v-model="recordName" class="form-input" maxlength="40" placeholder="为这份基础盘命名" aria-label="印度占星档案名称" /><view class="action-row"><AppButton class="secondary-button" @click="save">保存到本机</AppButton><AppButton class="secondary-button" @click="exportCurrent">导出当前快照</AppButton></view><text class="small-copy">本机最多保存 20 份完整快照。历史记录保留原始模型、输入和结果，打开时不会重新计算。</text></view>
   <view class="panel"><AppButton class="section-toggle" :aria-expanded="showRules" @click="showRules = !showRules">规则、边界与参考资料 <text>{{ showRules ? '−' : '＋' }}</text></AppButton><view v-if="showRules"><text v-for="line in result.conventions" :key="line" class="rule-copy">{{ line }}</text><text v-for="line in result.limitations" :key="line" class="notice">{{ line }}</text><AppButton v-for="source in result.sources" :key="source.url" class="source-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton><text class="small-copy">计算规则版本：{{ result.ruleVersion }}</text></view></view>
  </template>
  <view class="panel archive-panel"><text class="panel-title">本机印度占星档案</text><text v-if="storageError" class="error" role="alert">{{ storageError }}</text><text v-if="notice" class="notice" role="status">{{ notice }}</text><text v-if="!records.length && !storageError" class="small-copy">还没有保存的基础盘。生成结果后可保存，再次打开时继续阅读。</text><view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="openRecord(record)"><text class="period-name">{{ record.name }}</text><text class="cell-note">{{ record.snapshot.profile.date }} · 保存于 {{ displayDate(record.savedAt) }}</text></AppButton><AppButton class="delete-button" :aria-label="'删除印度占星档案' + record.name" @click="removeRecord(record)">删除</AppButton></view><AppButton v-if="records.length" class="secondary-button export-all" @click="exportAll">导出全部印度占星档案</AppButton></view>
 </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import BirthDateField from '@/components/birth/BirthDateField.vue'
import BirthTimeField from '@/components/birth/BirthTimeField.vue'
import BirthPlaceField from '@/components/birth/BirthPlaceField.vue'
import { calculateJyotish, jyotishToday, type JyotishSnapshot } from '@/domain/jyotish'
import { DASHA_NAMES } from '@/domain/jyotish/rules'
import { createJyotishRepository, type JyotishRecord } from '@/domain/jyotish/repository'
import { createChartArchive, type SavedChart } from '@/domain/metaphysics/archive'
import type { BirthProfile } from '@/domain/metaphysics/types'
import { exportJson } from '@/utils/export-json'

const today = jyotishToday()
const form = reactive({ date: '', time: '', utcOffset: '8', genderIndex: 0, precisionIndex: 0, timeZone: '', choiceIndex: 0, placeEnabled: false, placeName: '', latitude: '', longitude: '', observationDate: today })
const precisionLabels = ['请选择时间精度', '已确认到分钟', '大约时间']
const genderLabels = ['请选择', '女', '男']
const choiceLabels = ['需要时提醒我确认', '较早的一次（回拨前）', '较晚的一次（回拨后）']
const result = ref<JyotishSnapshot | null>(null)
const error = ref(''), storageError = ref(''), sharedError = ref(''), notice = ref(''), recordName = ref(''), historyName = ref('')
const showRules = ref(false), expandedPeriod = ref<number | null>(null)
const advancedOpen = ref(false), regionCoordinates = ref(false)
const records = ref<JyotishRecord[]>([]), sharedProfiles = ref<SavedChart[]>([])
const sharedLabels = computed(() => ['选择出生资料', ...sharedProfiles.value.map(record => `${record.name} · ${record.result.profile.date}`)])
const repository = createJyotishRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const sharedArchive = createChartArchive({ get: key => uni.getStorageSync(key), set: () => { throw new Error('本页仅读取通用出生资料') } })
const message = (value: unknown) => value instanceof Error ? value.message : '操作未完成，请重试'
watch(form, () => { result.value = null; historyName.value = ''; error.value = ''; notice.value = ''; expandedPeriod.value = null }, { deep: true, flush: 'sync' })
function reloadRecords() { try { records.value = repository.list(); storageError.value = '' } catch (error) { storageError.value = message(error) } }
onShow(() => { reloadRecords(); try { sharedProfiles.value = sharedArchive.list(); sharedError.value = '' } catch (error) { sharedError.value = message(error) } })
function fillProfile(profile: BirthProfile, observationDate = form.observationDate) {
 regionCoordinates.value = false
 Object.assign(form, { date: profile.date, time: profile.time, utcOffset: String(profile.utcOffset), genderIndex: profile.gender === '女' ? 1 : 2, precisionIndex: profile.timePrecision === 'approximate' ? 2 : 1, timeZone: profile.timeZone || '', choiceIndex: profile.timeChoice === 'earlier' ? 1 : profile.timeChoice === 'later' ? 2 : 0, placeEnabled: Boolean(profile.place), placeName: profile.place?.name || '', latitude: profile.place ? String(profile.place.latitude) : '', longitude: profile.place ? String(profile.place.longitude) : '', observationDate })
}
function selectPlace(place: { name: string; latitude?: number; longitude?: number; timeZone?: string } | null) {
 const hasCoordinates = typeof place?.latitude === 'number' && Number.isFinite(place.latitude) && typeof place.longitude === 'number' && Number.isFinite(place.longitude)
 form.placeEnabled = hasCoordinates
 form.latitude = hasCoordinates ? String(place!.latitude) : ''
 form.longitude = hasCoordinates ? String(place!.longitude) : ''
 regionCoordinates.value = hasCoordinates
 if (place) form.placeName = place.name
 if (place?.timeZone) form.timeZone = place.timeZone
 else {
  if (form.timeZone) form.utcOffset = ''
  form.timeZone = ''; advancedOpen.value = true
 }
 form.choiceIndex = 0
}
function fillSharedHtml(event: Event) { fillShared({ detail: { value: (event.target as HTMLSelectElement).value } }) }
function fillShared(event: { detail: { value: string | number } }) {
 const record = sharedProfiles.value[Number(event.detail.value) - 1]
 if (!record) return
 fillProfile(record.result.profile)
 const suffix = ' · 印占', prefix = [...record.name]
 // Keep complete Unicode characters while satisfying the archive's UTF-16 length limit.
 while (prefix.join('').length + suffix.length > 40) prefix.pop()
 recordName.value = prefix.join('') + suffix
 notice.value = '已填写本机出生资料，请核对后生成。'
}
function calculate() {
 error.value = ''; notice.value = ''; result.value = null; historyName.value = ''
 try {
  if (!form.precisionIndex) throw new Error('请明确选择出生时间精度')
  if (!form.genderIndex) throw new Error('请选择通用出生资料的性别')
  if (!form.utcOffset.trim() && !form.timeZone.trim()) throw new Error('请填写出生时的 UTC 偏移或历史 IANA 时区')
  if (form.placeEnabled && (!form.latitude.trim() || !form.longitude.trim())) throw new Error('启用出生地点后，请同时填写纬度和经度')
  const profile: BirthProfile = { date: form.date, time: form.time, gender: form.genderIndex === 1 ? '女' : '男', utcOffset: Number(form.utcOffset), timePrecision: form.precisionIndex === 2 ? 'approximate' : 'minute', ...(form.timeZone.trim() ? { timeZone: form.timeZone.trim(), ...(form.choiceIndex ? { timeChoice: form.choiceIndex === 1 ? 'earlier' as const : 'later' as const } : {}) } : {}), ...(form.placeEnabled ? { place: { name: form.placeName.trim(), latitude: Number(form.latitude), longitude: Number(form.longitude) } } : {}) }
  result.value = calculateJyotish(profile, { observationDate: form.observationDate })
  if (!recordName.value.trim()) recordName.value = `${form.date} · 印度占星`
  expandedPeriod.value = result.value.vimshottari.active ? result.value.vimshottari.periods.findIndex(period => period.lord === result.value?.vimshottari.active?.maha) : null
 } catch (problem) { error.value = message(problem) }
}
function displayDate(utc: string) { return new Date(Date.parse(utc) + 8 * 3600000).toISOString().slice(0, 10) }
function formatPosition(position: { sign: string; degreeInSign: number }) { return `${position.sign} ${position.degreeInSign.toFixed(2)}°` }
function save() { if (!result.value) return; try { const record = repository.save(recordName.value, result.value); reloadRecords(); historyName.value = record.name; notice.value = '已保存完整快照到本机。' } catch (error) { storageError.value = message(error) } }
function openRecord(record: JyotishRecord) { fillProfile(record.snapshot.profile, record.snapshot.observation.date); result.value = JSON.parse(JSON.stringify(record.snapshot)); recordName.value = record.name; historyName.value = record.name; expandedPeriod.value = null; notice.value = '正在阅读保存时的原始快照。' }
function removeRecord(record: JyotishRecord) { uni.showModal({ title: '删除本机档案', content: `删除「${record.name}」？建议先导出备份。`, success: response => { if (response.confirm) { try { records.value = repository.remove(record.id); storageError.value = ''; notice.value = '已删除这份本机档案。' } catch (error) { storageError.value = message(error) } } } }) }
async function sendExport(value: unknown, filename: string) { try { const mode = await exportJson(value, filename); notice.value = mode === 'download' ? '已发起 JSON 文件下载。' : 'JSON 已复制，请自行保存到文件。' } catch (error) { notice.value = message(error) } }
function exportCurrent() { if (result.value) void sendExport({ format: 'oasis-jyotish', formatVersion: 1, name: recordName.value.trim(), exportedAt: new Date().toISOString(), snapshot: result.value }, `jyotish-${result.value.profile.date}.json`) }
function exportAll() { try { void sendExport(repository.exportJSON(), 'jyotish-archives.json') } catch (error) { storageError.value = message(error) } }
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
.section-toggle.advanced-toggle { align-items: center; margin-top: 14px; padding-top: 8px; border-top: 1px solid #eee7f4; font-size: 13px; line-height: 1.7; }
.jyotish-page { padding-bottom: 100px; }.intro { display:flex; align-items:center; gap:8px; margin-bottom:22px; }.intro-copy { flex:1; min-width:0; }.intro-cat { flex-shrink:0; width:80px; }.eyebrow,.page-heading,.page-caption,.panel-title,.small-copy,.form-label,.cell-note,.body-name,.period-name,.notice,.error,.rule-copy,.period-summary { display:block; }.eyebrow { font-size:11px; letter-spacing:1px; color:#95753f; line-height:1.8; }.page-heading { margin:8px 0; font-size:28px; font-weight:700; color:#493b53; }.page-caption,.small-copy { color:#82778a; font-size:12px; line-height:1.85; overflow-wrap:anywhere; }.panel { min-width:0; background:#fff; border:1px solid #eee7f4; border-radius:22px; padding:20px; margin-bottom:18px; }.panel-title { font-size:18px; font-weight:650; color:#55415f; line-height:1.7; margin-bottom:12px; }.form-group { margin:18px 0; }.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:16px 0 8px; }.form-grid>view { min-width:0; }.form-label { font-size:12px; color:#73627e; margin-bottom:8px; }.form-input,.form-picker { box-sizing:border-box; width:100%; min-width:0; min-height:44px; height:auto; padding:12px; background:#f9f6fb; border:1px solid #eee7f4; border-radius:12px; color:#624e70; font-size:12px; line-height:1.6; }.form-input { height:46px; }.import-picker { margin-top:16px; }.toggle,.primary-button,.secondary-button { min-height:44px; border-radius:12px; line-height:1.65; font-size:13px; padding:12px; white-space:normal; }.toggle { width:100%; margin-top:18px; background:#f3edf8; color:#725989; }.place-fields { margin-top:18px; }.primary-button { width:100%; background:#a58abe; color:white; margin-top:16px; }.secondary-button { background:#f3edf8; color:#73578e; flex:1; }.action-row { display:flex; gap:10px; margin:14px 0; flex-wrap:wrap; }.notice { color:#9a7b45; background:#fcf8f0; padding:10px 12px; border-radius:10px; font-size:11px; line-height:1.85; margin:12px 0; overflow-wrap:anywhere; }.error { color:#a95361; font-size:12px; line-height:1.8; margin:12px 0; overflow-wrap:anywhere; }.position-row { display:grid; grid-template-columns:52px minmax(0,1fr) minmax(0,1fr); gap:8px; padding:12px 0; border-bottom:1px solid #f1ebf5; font-size:13px; line-height:1.6; color:#705c80; }.table-heading { font-size:11px; color:#a194aa; }.body-name { font-weight:650; }.cell-note { font-size:11px; line-height:1.85; color:#99899f; overflow-wrap:anywhere; }.angle-box { margin-top:16px; }.period-summary { color:#947540; font-size:17px; line-height:1.8; margin-bottom:8px; }.period-caption { margin:14px 0; }.period { border:1px solid #eee7f4; border-radius:12px; margin-top:10px; overflow:hidden; }.period.active { border-color:#d1bd94; background:#fdfaf4; }.period-toggle { display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; padding:12px; margin:0; text-align:left; background:transparent; color:#806692; font-size:13px; line-height:1.75; white-space:normal; }.period-name { font-size:13px; font-weight:650; color:#6e567d; }.sub-periods { padding:0 12px 12px; }.sub-period { padding:10px; font-size:12px; color:#897394; border-top:1px solid #eee7f4; }.sub-period.current { background:#f0e9f7; border-radius:8px; }.section-toggle { display:flex; justify-content:space-between; gap:8px; width:100%; padding:0; min-height:44px; background:transparent; text-align:left; font-size:15px; color:#6b5379; white-space:normal; }.rule-copy { margin:12px 0; font-size:12px; color:#86748e; line-height:1.85; }.source-button { display:block; background:transparent; width:100%; text-align:left; padding:10px 0; color:#876a9c; font-size:11px; white-space:normal; line-height:1.8; }.record-row { display:flex; gap:8px; align-items:center; border-top:1px solid #eee7f4; padding:10px 0; }.record-open { flex:1; min-width:0; padding:8px 0; text-align:left; background:transparent; white-space:normal; line-height:1.8; }.delete-button { flex-shrink:0; min-height:44px; font-size:11px; color:#a7828d; background:transparent; padding:8px; }.export-all { width:100%; margin-top:12px; }@media(max-width:360px){.panel { padding:15px; }.form-grid { gap:8px; }.intro-cat { width:65px; }.page-heading { font-size:25px; }.position-row { grid-template-columns:42px minmax(0,1fr) minmax(0,1fr); gap:6px; font-size:12px; }.table-heading { font-size:10px; }}
</style>
