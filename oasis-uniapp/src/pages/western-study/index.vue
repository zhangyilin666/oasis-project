<template>
 <view class="page-container western-study-page">
  <view class="intro"><view class="intro-copy"><text class="eyebrow">宫制对照 · 双人相位</text><text class="page-heading">星图之间</text><text class="page-caption">同一片星空，用两种宫制观察；也可以并列两份出生资料，查看两盘天体之间的角度。</text></view><CatCompanion class="intro-cat" mood="thinking" small /></view>
  <view class="panel">
   <text class="panel-title">选择研究方式</text><view class="mode-row"><AppButton class="mode-button" :class="{ selected: mode === 'house-comparison' }" :aria-pressed="mode === 'house-comparison'" @click="mode = 'house-comparison'">单人宫制对照</AppButton><AppButton class="mode-button" :class="{ selected: mode === 'synastry' }" :aria-pressed="mode === 'synastry'" @click="mode = 'synastry'">双人相位比较</AppButton></view>
   <text class="small-copy">{{ mode === 'house-comparison' ? '比较整宫制与从上升点起算的等宫制。请添加出生地点并确认时刻，以生成宫头和落宫。' : 'Synastry：检查A、B两盘的十天体交叉相位。每人分别填写时区和地点；本页不生成组合中点盘。' }}</text>
   <text v-if="sharedError" class="error" role="alert">{{ sharedError }}</text>
   <BirthForm :form="formA" role="A" :shared-profiles="sharedProfiles" />
   <view v-if="mode === 'synastry'" class="second-person"><BirthForm :form="formB" role="B" :shared-profiles="sharedProfiles" /></view>
   <text v-if="error" class="error" role="alert">{{ error }}</text><AppButton class="primary-button" @click="calculate">{{ mode === 'synastry' ? '生成双人相位比较' : '生成宫制对照' }}</AppButton>
  </view>
  <template v-if="result">
   <view class="panel result-summary"><text class="panel-title">{{ result.mode === 'synastry' ? '两张本命盘的相位' : '同一张盘，两种宫制' }}</text><text v-if="historyName" class="notice">正在回看「{{ historyName }}」的保存快照</text><text class="small-copy">{{ result.mode === 'synastry' ? '保留A、B身份，逐一比较100种天体组合；按与准确相位的偏差从小到大排列。' : '天体黄经不随宫制改变；宫头起点的不同，会使部分天体落入不同宫位。' }}</text><text class="notice">本页记录位置与角度，不将相位数量转换为关系评分。</text></view>
   <view v-for="person in result.participants" :key="person.role" class="panel person-result">
    <text class="panel-title">{{ person.role }} · {{ person.name }}</text>
    <text class="small-copy">当地出生：{{ person.profile.date }} {{ person.profile.time }} · {{ person.profile.gender }}（留档）</text>
    <text class="small-copy">{{ person.profile.timeZone || '手动时区' }} · UTC{{ person.profile.utcOffset >= 0 ? '+' : '' }}{{ person.profile.utcOffset }} · {{ person.profile.timePrecision === 'approximate' ? '大约时间' : '分钟资料' }}</text>
    <text class="small-copy">出生 UTC：{{ person.utcTime }}</text>
    <text class="small-copy">{{ person.profile.place ? `${person.profile.place.name || '已填写坐标'} · 纬度${person.profile.place.latitude} / 经度${person.profile.place.longitude}` : '未填写出生地点' }}</text>
    <text v-for="line in person.limitations" :key="line" class="notice">{{ line }}</text>
    <view class="position-row table-heading"><text>天体</text><text>热带黄道位置</text><text>整宫</text><text>等宫</text></view>
    <view v-for="position in person.positions" :key="position.body" class="position-row"><text class="body-name">{{ position.name }}</text><view><text>{{ position.sign }} {{ position.degree.toFixed(2) }}°</text><text class="cell-note">{{ position.motion }}</text></view><text>{{ position.wholeSignHouse ?? '—' }}</text><text>{{ position.equalAscendantHouse ?? '—' }}</text></view>
    <view v-if="person.houses.status === 'ready'" class="angle-box"><text class="small-copy">ASC 上升点：{{ longitudeText(person.houses.ascendant) }}</text><text class="small-copy">MC 天顶：{{ longitudeText(person.houses.midheaven) }}</text><text class="small-copy">MC 所在宫：整宫第 {{ person.houses.wholeSign.midheavenHouse }} 宫 / 等宫第 {{ person.houses.equalAscendant.midheavenHouse }} 宫</text><AppButton class="section-toggle" :aria-expanded="Boolean(expandedCusps[person.role])" @click="expandedCusps[person.role] = !expandedCusps[person.role]">查看12宫宫头 <text>{{ expandedCusps[person.role] ? '−' : '＋' }}</text></AppButton><view v-if="expandedCusps[person.role]"><view class="cusp-row table-heading"><text>宫位</text><text>整宫制</text><text>ASC等宫制</text></view><view v-for="(cusp, index) in person.houses.wholeSign.cusps" :key="index" class="cusp-row"><text>{{ index + 1 }}</text><text>{{ longitudeText(cusp) }}</text><text>{{ longitudeText(person.houses.equalAscendant.cusps[index]) }}</text></view></view></view>
   </view>
   <view v-if="result.synastry" class="panel"><text class="panel-title">{{ result.synastry.aspects.length }} 个主要相位</text><text class="small-copy">合相0° / 六合60° / 刑相90° / 拱相120° / 对冲180°。统一容许度6°，包含边界；显示值四舍五入，实际判断使用原始数值。</text><text v-if="!result.synastry.aspects.length" class="notice">这两组资料在本页固定规则下没有落入容许度的主要相位。</text><view v-for="aspect in result.synastry.aspects" :key="aspect.aBody + '/' + aspect.bBody" class="aspect-row"><view><text class="body-name">A {{ aspect.aName }} · B {{ aspect.bName }}</text><text class="cell-note">两天体夹角 {{ aspect.separation.toFixed(2) }}°</text></view><view class="aspect-angle"><text>{{ aspect.name }} {{ aspect.angle }}°</text><text class="cell-note">偏差 {{ aspect.orb.toFixed(2) }}°</text></view></view></view>
   <view class="panel"><text class="panel-title">为这次研究留一页笔记</text><input v-model="recordName" class="form-input" maxlength="40" placeholder="档案名称" aria-label="星盘研究档案名称" /><textarea v-model="recordNote" class="note-input" maxlength="2000" placeholder="记录自己的观察，也可以先留空" aria-label="星盘研究笔记" /><text class="cell-note">{{ recordNote.length }} / 2000</text><view class="action-row"><AppButton class="secondary-button" @click="save">保存到本机</AppButton><AppButton class="secondary-button" @click="exportCurrent">导出当前快照</AppButton></view><text class="small-copy">最多保存20份完整快照。保存包含两种宫制、相位规则、各自资料与笔记；打开历史记录时不会重算。修改笔记后保存会创建新档案。</text></view>
   <view class="panel"><AppButton class="section-toggle" :aria-expanded="showRules" @click="showRules = !showRules">规则、边界与参考资料 <text>{{ showRules ? '−' : '＋' }}</text></AppButton><view v-if="showRules"><text v-for="line in result.conventions" :key="line" class="rule-copy">{{ line }}</text><text v-for="line in result.limitations" :key="line" class="notice">{{ line }}</text><AppButton v-for="source in result.sources" :key="source.url" class="source-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton><text class="small-copy">计算规则版本：{{ result.ruleVersion }}</text></view></view>
  </template>
  <view class="panel archive-panel"><text class="panel-title">本机星盘研究档案</text><text v-if="storageError" class="error" role="alert">{{ storageError }}</text><text v-if="notice" class="notice" role="status">{{ notice }}</text><text v-if="!records.length && !storageError" class="small-copy">还没有保存的研究。生成结果后可以保存，稍后继续阅读。</text><view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="openRecord(record)"><text class="body-name">{{ record.name }}</text><text class="cell-note">{{ record.snapshot.mode === 'synastry' ? '双人相位' : '宫制对照' }} · {{ record.savedAt.slice(0, 10) }} UTC 保存</text></AppButton><AppButton class="delete-button" :aria-label="'删除星盘研究档案' + record.name" @click="removeRecord(record)">删除</AppButton></view><AppButton v-if="records.length" class="secondary-button export-all" @click="exportAll">导出全部星盘研究档案</AppButton></view>
 </view>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import BirthForm from './BirthForm.vue'
import { fillPersonForm, newPersonForm, readPersonForm } from './form'
import { calculateWesternStudy, type WesternStudySnapshot } from '@/domain/western-study'
import { createWesternStudyRepository, type WesternStudyRecord } from '@/domain/western-study/repository'
import { createChartArchive, type SavedChart } from '@/domain/metaphysics/archive'
import { SIGNS } from '@/domain/metaphysics/positions'
import { exportJson } from '@/utils/export-json'

const formA = reactive(newPersonForm('本人')), formB = reactive(newPersonForm('对照人'))
const mode = ref<'house-comparison' | 'synastry'>('house-comparison')
const result = ref<WesternStudySnapshot | null>(null), records = ref<WesternStudyRecord[]>([]), sharedProfiles = ref<SavedChart[]>([])
const error = ref(''), storageError = ref(''), sharedError = ref(''), notice = ref(''), recordName = ref(''), recordNote = ref(''), historyName = ref('')
const showRules = ref(false), expandedCusps = reactive({ A: false, B: false })
const repository = createWesternStudyRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const sharedArchive = createChartArchive({ get: key => uni.getStorageSync(key), set: () => { throw new Error('本页仅读取通用出生资料') } })
const message = (value: unknown) => value instanceof Error ? value.message : '操作未完成，请重试'
watch([formA, formB, mode], () => { result.value = null; historyName.value = ''; error.value = ''; notice.value = ''; expandedCusps.A = false; expandedCusps.B = false }, { deep: true, flush: 'sync' })
function reloadRecords() { try { records.value = repository.list(); storageError.value = '' } catch (problem) { storageError.value = message(problem) } }
onShow(() => { reloadRecords(); try { sharedProfiles.value = sharedArchive.list(); sharedError.value = '' } catch (problem) { sharedError.value = message(problem) } })
function calculate() {
 error.value = ''; notice.value = ''; result.value = null; historyName.value = ''; expandedCusps.A = false; expandedCusps.B = false
 try {
  result.value = calculateWesternStudy(readPersonForm(formA, 'A'), mode.value === 'synastry' ? readPersonForm(formB, 'B') : undefined)
  if (!recordName.value.trim()) recordName.value = (mode.value === 'synastry' ? `${formA.name} × ${formB.name}` : `${formA.name} · 宫制对照`).slice(0, 40)
 } catch (problem) { error.value = message(problem) }
}
function longitudeText(value: number) { return `${SIGNS[Math.floor(value / 30)]} ${(value % 30).toFixed(2)}°` }
function save() { if (!result.value) return; try { const record = repository.save(recordName.value, recordNote.value, result.value); reloadRecords(); historyName.value = record.name; notice.value = '已保存完整快照与笔记到本机。' } catch (problem) { storageError.value = message(problem) } }
function openRecord(record: WesternStudyRecord) {
 mode.value = record.snapshot.mode
 const [a, b] = record.snapshot.participants
 fillPersonForm(formA, a.name, a.profile); if (b) fillPersonForm(formB, b.name, b.profile)
 result.value = JSON.parse(JSON.stringify(record.snapshot)); recordName.value = record.name; recordNote.value = record.note; historyName.value = record.name; error.value = ''; notice.value = '正在阅读保存时的原始快照。'
}
function removeRecord(record: WesternStudyRecord) { uni.showModal({ title: '删除本机档案', content: `删除「${record.name}」？建议先导出备份。`, success: response => { if (response.confirm) { try { records.value = repository.remove(record.id); storageError.value = ''; notice.value = '已删除这份本机档案。' } catch (problem) { storageError.value = message(problem) } } } }) }
async function sendExport(value: unknown, filename: string) { try { const exportMode = await exportJson(value, filename); notice.value = exportMode === 'download' ? '已发起JSON文件下载。' : 'JSON已复制，请自行保存到文件。' } catch (problem) { notice.value = message(problem) } }
function exportCurrent() { if (result.value) void sendExport({ format: 'oasis-western-study', formatVersion: 1, exportedAt: new Date().toISOString(), name: recordName.value.trim(), note: recordNote.value, snapshot: result.value }, `western-study-${result.value.participants[0].profile.date}.json`) }
function exportAll() { try { void sendExport(repository.exportJSON(), 'western-study-archives.json') } catch (problem) { storageError.value = message(problem) } }
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
.western-study-page{padding-bottom:100px}.intro{display:flex;align-items:center;gap:8px;margin-bottom:22px}.intro-copy{flex:1;min-width:0}.intro-cat{flex-shrink:0;width:80px}.eyebrow,.page-heading,.page-caption,.panel-title,.small-copy,.cell-note,.body-name,.notice,.error,.rule-copy{display:block}.eyebrow{font-size:11px;letter-spacing:1px;color:#95753f;line-height:1.8}.page-heading{margin:8px 0;font-size:28px;font-weight:700;color:#493b53}.page-caption,.small-copy{color:#82778a;font-size:12px;line-height:1.85;overflow-wrap:anywhere}.panel{min-width:0;background:#fff;border:1px solid #eee7f4;border-radius:22px;padding:20px;margin-bottom:18px}.panel-title{font-size:18px;font-weight:650;color:#55415f;line-height:1.7;margin-bottom:12px}.mode-row{display:flex;gap:8px;margin:14px 0}.mode-button{flex:1;min-width:0;min-height:44px;padding:10px 8px;background:#f8f5fa;border:1px solid #eee7f4;border-radius:12px;color:#9883a5;font-size:12px;line-height:1.7;white-space:normal}.mode-button.selected{background:#ebe1f3;border-color:#ccb5de;color:#705183}.second-person{margin-top:24px;padding-top:6px;border-top:1px solid #ece3f3}.primary-button,.secondary-button{min-height:44px;border-radius:12px;line-height:1.65;font-size:13px;padding:12px;white-space:normal}.primary-button{width:100%;background:#a58abe;color:white;margin-top:20px}.secondary-button{background:#f3edf8;color:#73578e;flex:1}.action-row{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}.notice{color:#9a7b45;background:#fcf8f0;padding:10px 12px;border-radius:10px;font-size:11px;line-height:1.85;margin:12px 0;overflow-wrap:anywhere}.error{color:#a95361;font-size:12px;line-height:1.8;margin:12px 0;overflow-wrap:anywhere}.position-row{display:grid;grid-template-columns:44px minmax(0,1fr) 32px 32px;gap:8px;padding:12px 0;border-bottom:1px solid #f1ebf5;font-size:12px;line-height:1.7;color:#705c80}.table-heading{font-size:11px;color:#a194aa}.body-name{font-weight:650}.cell-note{font-size:11px;line-height:1.85;color:#99899f;overflow-wrap:anywhere}.angle-box{margin-top:16px}.cusp-row{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(0,1fr);gap:8px;padding:10px 0;border-bottom:1px solid #f1ebf5;font-size:11px;line-height:1.8;color:#79648b}.aspect-row{display:flex;gap:10px;justify-content:space-between;padding:13px 0;border-bottom:1px solid #f1ebf5;font-size:13px;line-height:1.8;color:#776184}.aspect-angle{text-align:right;flex-shrink:0}.form-input,.note-input{box-sizing:border-box;width:100%;min-width:0;padding:12px;background:#f9f6fb;border:1px solid #eee7f4;border-radius:12px;color:#624e70;font-size:12px;line-height:1.8}.form-input{height:46px}.note-input{height:120px;margin:14px 0 6px}.section-toggle{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:10px 0;min-height:44px;background:transparent;text-align:left;font-size:15px;color:#6b5379;white-space:normal}.rule-copy{margin:12px 0;font-size:12px;color:#86748e;line-height:1.85}.source-button{display:block;background:transparent;width:100%;text-align:left;padding:10px 0;color:#876a9c;font-size:11px;white-space:normal;line-height:1.8}.record-row{display:flex;gap:8px;align-items:center;border-top:1px solid #eee7f4;padding:10px 0}.record-open{flex:1;min-width:0;padding:8px 0;text-align:left;background:transparent;white-space:normal;line-height:1.8;color:#705985;font-size:13px}.delete-button{flex-shrink:0;min-height:44px;font-size:11px;color:#a7828d;background:transparent;padding:8px}.export-all{width:100%;margin-top:12px}@media(max-width:360px){.panel{padding:15px}.intro-cat{width:65px}.page-heading{font-size:25px}.position-row{grid-template-columns:37px minmax(0,1fr) 26px 26px;gap:5px;font-size:11px}.table-heading{font-size:10px}.aspect-row{font-size:12px}.cusp-row{gap:5px;font-size:10px}}
</style>
