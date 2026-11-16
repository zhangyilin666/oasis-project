<template>
 <view class="page-container lodge-page">
  <view class="intro"><view class="intro-copy"><text class="eyebrow">历象考成 · 黄道二十八宿</text><text class="page-heading">清历宿度查算</text><text class="page-caption">给一处黄道宫度，在古籍宿表中找到它的位置。以康熙甲子表为底本，保留每一宿原本不同的宽度。</text></view><CatCompanion class="intro-cat" mood="thinking" small /></view>
  <view class="panel">
   <text class="panel-title">输入明确的宫度</text><text class="small-copy">本页接受古法宿钤年标号与黄道宫度。初宫初度是冬至点，每宫30°；不从生日或现代星历自动换算。</text>
   <text class="field-label">查算对象</text><input v-model="form.label" class="form-input" maxlength="30" placeholder="如太阳、月亮或研究位置" aria-label="查算对象名称" />
   <text class="field-label">宿钤年标号</text><input v-model="form.year" class="form-input" inputmode="numeric" maxlength="4" placeholder="明确填写1684–2099" aria-label="宿钤年标号" /><text class="cell-note">1684对应康熙二十三年甲子。本页支持1684–2099，不自动推定古历年界。</text>
   <text class="field-label">从冬至点起算的黄道宫数</text>
   <!-- #ifdef H5 -->
   <select v-model="form.palace" class="form-input native-select" aria-label="黄道宫数"><option value="">请选择宫数</option><option v-for="(label, index) in palaceNames" :key="index" :value="String(index)">{{ label }}</option></select>
   <!-- #endif -->
   <!-- #ifndef H5 -->
   <picker :range="['请选择宫数', ...palaceNames]" :value="form.palace === '' ? 0 : Number(form.palace) + 1" @change="choosePalace"><view class="form-input picker-value">{{ form.palace === '' ? '请选择宫数' : palaceNames[Number(form.palace)] }}</view></picker>
   <!-- #endif -->
   <view class="angle-fields"><view><text class="field-label">度 · 0–29</text><input v-model="form.degree" class="form-input" inputmode="numeric" maxlength="2" placeholder="必填" aria-label="黄道宫内度数" /></view><view><text class="field-label">分 · 0–59</text><input v-model="form.minute" class="form-input" inputmode="numeric" maxlength="2" aria-label="黄道角分" /></view><view><text class="field-label">秒 · 0–59</text><input v-model="form.second" class="form-input" inputmode="numeric" maxlength="2" aria-label="黄道角秒" /></view></view>
   <text class="cell-note">分、秒初填为0，可据资料修改；度、分、秒均按六十进位。</text><AppButton class="example-button" @click="fillExample">填入原书太阳算例：1684年 · 初宫8°</AppButton>
   <text v-if="error" class="error" role="alert">{{ error }}</text><AppButton class="primary-button" @click="calculate">查算入宿度</AppButton>
  </view>
  <template v-if="result">
   <view class="panel result-panel">
    <text v-if="historyName" class="notice">正在回看「{{ historyName }}」的保存快照</text><text class="eyebrow">{{ result.input.label }} · {{ result.input.yearLabel }} 年标号</text><text class="result-mansion">{{ result.result.mansion }}宿 <text class="result-degree">{{ formatLodgeArcseconds(result.result.withinArcseconds) }}</text></text><text class="small-copy">输入：{{ formatPalaceArcseconds(result.angleArcseconds) }}</text><text v-if="result.result.atBoundary" class="notice">恰在{{ result.result.referenceStar }}的起点，计入本宿0度。</text>
    <view class="result-details"><text class="small-copy">本宿起点：{{ formatPalaceArcseconds(result.result.startArcseconds) }}</text><text class="small-copy">下一宿：{{ result.result.nextMansion }} · {{ formatPalaceArcseconds(result.result.endArcseconds) }}</text><text class="small-copy">距下一宿：{{ formatLodgeArcseconds(result.result.remainingArcseconds) }}</text><text class="small-copy">本宿全宽：{{ formatLodgeArcseconds(result.result.widthArcseconds) }}</text></view>
    <text class="small-copy">距基准年{{ result.yearsFromEpoch }}年，宿表统一移{{ formatLodgeArcseconds(result.shiftArcseconds) }}（每年51角秒）。</text><text class="notice">{{ result.limitations[1] }}</text><text class="cell-note">秒为计算位数；原始宿表只列到分，不能解释为秒级测量精度。</text>
   </view>
   <view class="panel"><AppButton class="section-toggle" :aria-expanded="showTable" @click="showTable = !showTable">二十八宿原表与本年表 <text>{{ showTable ? '−' : '＋' }}</text></AppButton><text class="small-copy">每宿以原书第一星为起点。本底本参前觜后；宿界包含起点，不包含下一宿起点。</text><view v-if="showTable"><view v-for="row in result.table" :key="row.name" class="lodge-row" :class="{ active: row.name === result.result.mansion }"><view class="lodge-row-title"><text class="body-name">{{ row.referenceStar }}</text><text class="cell-note">宿宽 {{ formatLodgeArcseconds(row.widthArcseconds) }}</text></view><text class="small-copy">基准：{{ formatPalaceArcseconds(row.baseStartArcseconds) }}</text><text class="small-copy">本年：{{ formatPalaceArcseconds(row.startArcseconds) }}</text></view></view></view>
   <view class="panel"><text class="panel-title">保存这次查算</text><input v-model="recordName" class="form-input" maxlength="40" placeholder="档案名称" aria-label="清历宿度档案名称" /><textarea v-model="recordNote" class="note-input" maxlength="2000" placeholder="记下宫度出处或自己的观察" aria-label="清历宿度查算笔记" /><text class="cell-note">{{ recordNote.length }} / 2000</text><view class="action-row"><AppButton class="secondary-button" @click="save">保存到本机</AppButton><AppButton class="secondary-button" @click="exportCurrent">导出当前快照</AppButton></view><text class="small-copy">最多20份，保存输入、完整宿表、规则、结果与笔记。回看读取原快照；修改笔记后保存为新档案。</text></view>
   <view class="panel"><AppButton class="section-toggle" :aria-expanded="showRules" @click="showRules = !showRules">口径、异文与参考资料 <text>{{ showRules ? '−' : '＋' }}</text></AppButton><view v-if="showRules"><text v-for="line in result.conventions" :key="line" class="rule-copy">{{ line }}</text><text class="rule-copy">只作坐标零点换算时，输入相当于从春分点起算 {{ formatLodgeArcseconds(result.vernalOriginArcseconds) }}；这不代表现代星历测得的位置。</text><text v-for="line in result.limitations" :key="line" class="notice">{{ line }}</text><AppButton v-for="source in result.sources" :key="source.id" class="source-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton><text class="cell-note">规则版本：{{ result.ruleVersion }}</text></view></view>
  </template>
  <view class="panel scope-panel"><text class="panel-title">这一页的范围</text><text class="small-copy">这是古法黄道宿钤查算。现代七政位置、赤道入宿度、立命与运限不在本页计算。</text><text class="notice">四余传统位置：罗睺未核 · 计都未核 · 月孛未核 · 紫气未核。</text><text class="small-copy">《清史稿》十二宫初度对照有10项吻合；室宿相差4分，房宿相差10分。本页保留《历象考成》底本，不拼合异文。</text></view>
  <view class="panel"><text class="panel-title">本机清历宿度档案</text><text v-if="storageError" class="error" role="alert">{{ storageError }}</text><text v-if="notice" class="notice" role="status">{{ notice }}</text><text v-if="!records.length && !storageError" class="small-copy">还没有保存的查算。填写资料或使用原书算例即可开始。</text><view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" @click="openRecord(record)"><text class="body-name">{{ record.name }}</text><text class="cell-note">{{ record.snapshot.input.yearLabel }}年 · {{ record.snapshot.result.mansion }}宿 · {{ record.savedAt.slice(0, 10) }} UTC保存</text></AppButton><AppButton class="delete-button" :aria-label="'删除清历宿度档案' + record.name" @click="removeRecord(record)">删除</AppButton></view><AppButton v-if="records.length" class="secondary-button export-all" @click="exportAll">导出全部清历宿度档案</AppButton></view>
 </view>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { calculateQizhengLodges, formatLodgeArcseconds, formatPalaceArcseconds, type QizhengLodgesSnapshot } from '@/domain/qizheng-lodges'
import { createQizhengLodgesRepository, type QizhengLodgesRecord } from '@/domain/qizheng-lodges/repository'
import { exportJson } from '@/utils/export-json'

const palaceNames = ['初宫 · 冬至起点', '一宫', '二宫', '三宫 · 春分起点', '四宫', '五宫', '六宫 · 夏至起点', '七宫', '八宫', '九宫 · 秋分起点', '十宫', '十一宫']
const form = reactive({ label: '研究位置', year: '', palace: '', degree: '', minute: '0', second: '0' })
const result = ref<QizhengLodgesSnapshot | null>(null), records = ref<QizhengLodgesRecord[]>([])
const error = ref(''), storageError = ref(''), notice = ref(''), recordName = ref(''), recordNote = ref(''), historyName = ref('')
const showTable = ref(false), showRules = ref(false)
const repository = createQizhengLodgesRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const message = (value: unknown) => value instanceof Error ? value.message : '操作未完成，请重试'
watch(form, () => { result.value = null; historyName.value = ''; error.value = ''; notice.value = ''; showTable.value = false }, { deep: true, flush: 'sync' })
function reloadRecords() { try { records.value = repository.list(); storageError.value = '' } catch (problem) { storageError.value = message(problem) } }
onShow(reloadRecords)
function choosePalace(event: { detail: { value: string | number } }) { const index = Number(event.detail.value); form.palace = index === 0 ? '' : String(index - 1) }
function fillExample() { Object.assign(form, { label: '原书太阳例', year: '1684', palace: '0', degree: '8', minute: '0', second: '0' }) }
function numberField(value: string, name: string) { if (!/^\d+$/.test(value.trim())) throw new Error(`请明确填写${name}的非负整数`); return Number(value) }
function calculate() {
 error.value = ''; notice.value = ''; result.value = null; historyName.value = ''; showTable.value = false
 try {
  result.value = calculateQizhengLodges({ label: form.label, yearLabel: numberField(form.year, '年标号'), palace: numberField(form.palace, '宫数'), degree: numberField(form.degree, '度'), minute: numberField(form.minute, '分'), second: numberField(form.second, '秒') })
  if (!recordName.value.trim()) recordName.value = `${result.value.input.label} · ${result.value.input.yearLabel}`.slice(0, 40)
 } catch (problem) { error.value = message(problem) }
}
function save() { if (!result.value) return; try { const record = repository.save(recordName.value, recordNote.value, result.value); reloadRecords(); historyName.value = record.name; notice.value = '已保存完整宿表快照与笔记到本机。' } catch (problem) { storageError.value = message(problem) } }
function openRecord(record: QizhengLodgesRecord) {
 const input = record.snapshot.input
 Object.assign(form, { label: input.label, year: String(input.yearLabel), palace: String(input.palace), degree: String(input.degree), minute: String(input.minute), second: String(input.second) })
 result.value = JSON.parse(JSON.stringify(record.snapshot)); recordName.value = record.name; recordNote.value = record.note; historyName.value = record.name; error.value = ''; notice.value = '正在阅读保存时的原始快照。'
}
function removeRecord(record: QizhengLodgesRecord) { uni.showModal({ title: '删除本机档案', content: `删除「${record.name}」？建议先导出备份。`, success: response => { if (response.confirm) { try { records.value = repository.remove(record.id); storageError.value = ''; notice.value = '已删除这份本机档案。' } catch (problem) { storageError.value = message(problem) } } } }) }
async function sendExport(value: unknown, filename: string) { try { const exportMode = await exportJson(value, filename); notice.value = exportMode === 'download' ? '已发起JSON文件下载。' : 'JSON已复制，请自行保存到文件。' } catch (problem) { notice.value = message(problem) } }
function exportCurrent() { if (result.value) void sendExport({ format: 'oasis-qizheng-lodges', formatVersion: 1, exportedAt: new Date().toISOString(), name: recordName.value.trim(), note: recordNote.value, snapshot: result.value }, `qizheng-lodges-${result.value.input.yearLabel}.json`) }
function exportAll() { try { void sendExport(repository.exportJSON(), 'qizheng-lodges-archives.json') } catch (problem) { storageError.value = message(problem) } }
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
.lodge-page{padding-bottom:100px}.intro{display:flex;align-items:center;gap:8px;margin-bottom:22px}.intro-copy{flex:1;min-width:0}.intro-cat{flex-shrink:0;width:80px}.eyebrow,.page-heading,.page-caption,.panel-title,.small-copy,.cell-note,.body-name,.notice,.error,.rule-copy,.field-label,.result-mansion{display:block}.eyebrow{font-size:11px;letter-spacing:1px;color:#95753f;line-height:1.8}.page-heading{margin:8px 0;font-size:28px;font-weight:700;color:#493b53}.page-caption,.small-copy{color:#82778a;font-size:12px;line-height:1.85;overflow-wrap:anywhere}.panel{min-width:0;background:#fff;border:1px solid #eee7f4;border-radius:22px;padding:20px;margin-bottom:18px}.panel-title{font-size:18px;font-weight:650;color:#55415f;line-height:1.7;margin-bottom:12px}.field-label{font-size:12px;line-height:1.8;color:#776087;margin:17px 0 7px}.form-input,.note-input{box-sizing:border-box;width:100%;min-width:0;padding:12px;background:#f9f6fb;border:1px solid #eee7f4;border-radius:12px;color:#624e70;font-size:12px;line-height:1.8}.form-input{height:46px}.native-select{font-family:inherit}.picker-value{line-height:20px}.angle-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.cell-note{font-size:11px;line-height:1.85;color:#99899f;overflow-wrap:anywhere;margin-top:5px}.example-button{background:transparent;text-align:left;width:100%;font-size:11px;line-height:1.8;color:#8d6ca4;white-space:normal;min-height:44px;padding:12px 0 0}.primary-button,.secondary-button{min-height:44px;border-radius:12px;line-height:1.65;font-size:13px;padding:12px;white-space:normal}.primary-button{width:100%;background:#a58abe;color:white;margin-top:16px}.secondary-button{background:#f3edf8;color:#73578e;flex:1}.action-row{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}.notice{color:#9a7b45;background:#fcf8f0;padding:10px 12px;border-radius:10px;font-size:11px;line-height:1.85;margin:12px 0;overflow-wrap:anywhere}.error{color:#a95361;font-size:12px;line-height:1.8;margin:12px 0;overflow-wrap:anywhere}.result-mansion{font-size:32px;font-weight:650;color:#735383;margin:15px 0;line-height:1.55}.result-degree{font-size:22px;font-weight:500;white-space:nowrap}.result-details{margin:16px 0;padding:14px 0;border-top:1px solid #eee7f4;border-bottom:1px solid #eee7f4}.body-name{font-weight:650;color:#715b7f;font-size:13px}.lodge-row{padding:14px 10px;border-bottom:1px solid #f1ebf5}.lodge-row.active{background:#f7f0fb;border-radius:10px}.lodge-row-title{display:flex;gap:10px;justify-content:space-between;align-items:baseline}.note-input{height:120px;margin:14px 0 6px}.section-toggle{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:10px 0;min-height:44px;background:transparent;text-align:left;font-size:15px;color:#6b5379;white-space:normal}.rule-copy{margin:12px 0;font-size:12px;color:#86748e;line-height:1.85}.source-button{display:block;background:transparent;width:100%;text-align:left;padding:10px 0;color:#876a9c;font-size:11px;white-space:normal;line-height:1.8}.record-row{display:flex;gap:8px;align-items:center;border-top:1px solid #eee7f4;padding:10px 0}.record-open{flex:1;min-width:0;padding:8px 0;text-align:left;background:transparent;white-space:normal;line-height:1.8;color:#705985;font-size:13px}.delete-button{flex-shrink:0;min-height:44px;font-size:11px;color:#a7828d;background:transparent;padding:8px}.export-all{width:100%;margin-top:12px}@media(max-width:360px){.panel{padding:15px}.intro-cat{width:65px}.page-heading{font-size:25px}.result-degree{font-size:19px}.angle-fields{gap:7px}.lodge-row{padding:12px 5px}.lodge-row-title{gap:5px}}
</style>
