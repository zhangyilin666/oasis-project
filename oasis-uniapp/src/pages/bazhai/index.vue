<template>
  <view class="page-shell bazhai-page">
    <view class="hero"><view><text class="eyebrow">空间 · 八宅游年对照</text><text class="page-heading">先记清方向，<br />再读懂卦变。</text><text class="page-caption">坐山起伏位 · 八方文化对照 · 本机独立快照</text></view><CatCompanion small mood="thinking" /></view>
    <view class="panel">
      <text class="panel-title">这次采用的测量资料</text><text class="hint">只接收已确认的真北读数。坐山是朝向的反向；这里保留测量依据，不自动换算磁偏角。</text>
      <text class="label">从本机空间档案填写 · 可选</text>
      <!-- #ifdef H5 -->
      <select class="field native-select" :value="sourceIndex" aria-label="读取空间档案" @change="fillFromArchive(inputValue($event))"><option value="">选择一份空间档案</option><option v-for="(record,index) in spaces" :key="record.id" :value="String(index)">{{ record.snapshot.facts.name }}</option></select>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <picker :range="spaces.map(record => record.snapshot.facts.name)" @change="fillFromArchive(String($event.detail.value))" aria-label="读取空间档案"><view class="field">{{ sourceIndex === '' ? '选择一份空间档案' : spaces[Number(sourceIndex)]?.snapshot.facts.name }}</view></picker>
      <!-- #endif -->
      <text v-if="sourceError" class="error" role="alert">{{ sourceError }}</text><text v-if="sourceIndex !== ''" class="hint">已只读填入原始事实。坐向含义与不确定度仍须确认；原档案不改动。</text>
      <text class="label">记录名称</text><input v-model="facts.name" class="field" maxlength="40" placeholder="给这份对照记录起个名字" aria-label="八宅记录名称" />
      <view class="two-col"><view><text class="label">原始读数 · 度</text><input v-model="bearing" class="field" maxlength="12" placeholder="0至小于360" aria-label="八宅方向度数" /></view><view><text class="label">不确定度 · ±度</text><input v-model="uncertainty" class="field" maxlength="12" placeholder="如1；未知请先核实" aria-label="八宅测量不确定度" /></view></view>
      <text class="label">这条读数代表什么</text>
      <!-- #ifdef H5 -->
      <select v-model="bearingRole" class="field native-select" aria-label="八宅坐向含义"><option value="">请选择坐山或朝向</option><option value="sitting">坐山方向（朝向的反向）</option><option value="facing">朝向方向</option></select>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <picker :range="['坐山方向（朝向的反向）','朝向方向']" @change="bearingRole = Number($event.detail.value) === 0 ? 'sitting' : 'facing'" aria-label="八宅坐向含义"><view class="field">{{ bearingRole === '' ? '请选择坐山或朝向' : bearingRole === 'sitting' ? '坐山方向' : '朝向方向' }}</view></picker>
      <!-- #endif -->
      <text class="label">北向基准</text>
      <!-- #ifdef H5 -->
      <select v-model="facts.northReference" class="field native-select" aria-label="八宅北向基准"><option value="unknown">尚不确定</option><option value="magnetic">磁北原始读数</option><option value="true">已确认真北</option></select>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <picker :range="['尚不确定','磁北原始读数','已确认真北']" @change="setNorth(Number($event.detail.value))" aria-label="八宅北向基准"><view class="field">{{ facts.northReference === 'true' ? '已确认真北' : facts.northReference === 'magnetic' ? '磁北原始读数' : '尚不确定' }}</view></picker>
      <!-- #endif -->
      <text class="label">测量对象与轴线</text><input v-model="facts.directionTarget" class="field" maxlength="120" placeholder="如：已确认的房屋朝向轴线" aria-label="八宅测量对象" />
      <text class="label">测量日期 · YYYY-MM-DD</text><input v-model="facts.measuredAt" class="field" maxlength="10" placeholder="公历测量日期" aria-label="八宅测量日期" />
      <text class="label">测量工具或资料</text><input v-model="facts.measurementTool" class="field" maxlength="100" placeholder="填写实际使用的工具或测绘资料" aria-label="八宅测量工具" />
      <text class="label">测量依据与真北确认过程</text><textarea v-model="facts.measurementBasis" class="field note-field" maxlength="500" placeholder="记录读数来源、真北基准和精度依据" aria-label="八宅测量依据" />
      <text class="label">补充笔记 · 选填</text><textarea v-model="facts.notes" class="field note-field" maxlength="1500" placeholder="自己的观察与待核对问题" aria-label="八宅补充笔记" />
      <text class="hint">不确定范围触及方位边界时会停止出盘。现代真北和45°分区是本版约定；缺失精度不会默认为0。</text>
      <text v-if="error" class="error" role="alert">{{ error }}</text><AppButton class="primary" @click="calculate">查看八方游年对照</AppButton>
    </view>

    <view v-if="result" class="panel">
      <text class="eyebrow">{{ saved ? '保存时的原始快照' : '本次文化对照' }}</text><text class="result-title">{{ result.baseTrigram }}宅 · {{ result.group }}</text><text class="hint">坐山 {{ formatAngle(result.sittingDegrees) }}° · 朝向 {{ formatAngle(result.facingDegrees) }}° · 真北基准</text>
      <text v-if="stale" class="notice">表单已修改；下方仍是上次结果，请重新计算后保存。</text>
      <text class="board-caption">北在上 · 每格为方位对应，不是户型图</text>
      <view class="board" role="group" aria-label="八宅八方游年对照图">
        <view v-for="(sector,index) in board" :key="index" :class="['palace', { center: !sector }]">
          <template v-if="sector"><text class="direction">{{ sector.direction }} · {{ sector.trigram }}</text><text class="star">{{ sector.star }}</text><text class="hint">{{ sector.traditionalStar }}</text></template>
          <template v-else><text class="center-title">{{ result.baseTrigram }}宅</text><text class="hint">坐山起伏位</text></template>
        </view>
      </view>
      <text class="hint">“生气、天医、绝命”等是底本术语，不是现实效果或风险等级。本页不给住宅评分。</text>
      <text class="section-title">怎样得到这张对照</text><view v-for="(step,index) in result.steps" :key="index" class="step"><text class="step-number">{{ index + 1 }}</text><text>{{ step }}</text></view>
      <view class="line-list"><view v-for="sector in result.sectors" :key="sector.trigram" class="line-item"><text>{{ sector.direction }} · {{ sector.star }}</text><text class="hint">{{ sector.explanation }}</text></view></view>
      <view class="actions"><AppButton class="primary" :disabled="stale || Boolean(saved)" @click="save">{{ saved ? '这份对照已保存' : '保存测量与对照快照' }}</AppButton><AppButton :disabled="stale" @click="exportCurrent">导出当前对照 JSON</AppButton></view>
      <text v-if="notice" class="success" role="status">{{ notice }}</text><text v-if="recordError" class="error" role="alert">{{ recordError }}</text>
      <text class="section-title">规则与出处</text><text class="hint">{{ result.ruleVersion }}</text><view v-for="source in result.sources" :key="source.url" class="source"><text>{{ source.title }}</text><text class="hint">{{ source.locator }}</text><text class="hint">{{ source.rights }} 复核 {{ source.reviewedAt }}</text><AppButton class="text-button" @click="openSource(source.url)">打开固定版本原文 ↗</AppButton></view><text v-for="limit in result.limitations" :key="limit" class="hint limitation">{{ limit }}</text>
    </view>

    <view class="panel"><view class="record-heading"><text class="panel-title">本机八宅对照</text><text class="hint">{{ records.length }} / 30</text></view><text class="hint">完整保留输入、八方事实、规则与出处；打开记录不重新计算。清理本机数据会移除记录。</text><text v-if="storageError" class="error" role="alert">{{ storageError }}</text><AppButton v-if="storageError" @click="refresh">重读本机记录</AppButton><text v-if="!records.length && !storageError" class="empty">还没有保存的对照记录。先确认测量资料，再保存一次观察。</text><view v-for="record in records" :key="record.id" class="record"><AppButton class="record-open" @click="openRecord(record)"><text>{{ record.snapshot.input.facts.name }}</text><text class="hint">{{ record.snapshot.baseTrigram }}宅 · {{ record.snapshot.input.facts.measuredAt }} · 原样回看 ↗</text></AppButton><AppButton class="delete-button" :aria-label="`删除八宅记录：${record.snapshot.input.facts.name}`" @click="remove(record)">删除</AppButton></view><AppButton :disabled="!records.length || Boolean(storageError)" @click="exportAll">导出全部八宅对照 JSON</AppButton><text class="hint">浏览器发起下载；其他端复制JSON后请自行保存到文件。</text></view>
    <text class="footer-note">把测量事实和传统解释分别留下。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { emptySpaceFacts, parseBearing, type NorthReference } from '@/domain/space'
import { createSpaceRepository, type SpaceRecord } from '@/domain/space/repository'
import { calculateBazhai, createBazhaiRepository, type BazhaiSnapshot } from '@/domain/bazhai'
import type { SnapshotRecord } from '@/domain/records/snapshot-store'
import { exportJson } from '@/utils/export-json'

const facts = ref(emptySpaceFacts()), bearing = ref(''), uncertainty = ref(''), bearingRole = ref(''), sourceIndex = ref('')
const spaces = ref<SpaceRecord[]>([]), sourceError = ref(''), result = ref<BazhaiSnapshot | null>(null), saved = ref<SnapshotRecord<BazhaiSnapshot> | null>(null)
const error = ref(''), notice = ref(''), storageError = ref(''), recordError = ref(''), stale = ref(false), records = ref<SnapshotRecord<BazhaiSnapshot>[]>([])
const repo = createBazhaiRepository({ getItem: key => uni.getStorageSync(key), setItem: (key,value) => uni.setStorageSync(key,value) })
const spaceRepo = createSpaceRepository({ get: key => uni.getStorageSync(key), set: (key,value) => uni.setStorageSync(key,value) })
const message = (value: unknown) => value instanceof Error ? value.message : '操作未完成，请重试。'
const inputValue = (event: Event | { detail?: { value?: string } }) => 'detail' in event && event.detail?.value !== undefined ? event.detail.value : (event as Event).target ? ((event as Event).target as HTMLInputElement).value : ''
const formatAngle = (value: number) => Number(value.toFixed(6))
const board = computed(() => [7,0,1,6,-1,2,5,4,3].map(index => index < 0 ? null : result.value?.sectors[index]))
watch([facts,bearing,uncertainty,bearingRole], () => { if(result.value) stale.value = true; saved.value = null; error.value = ''; notice.value = ''; recordError.value = '' }, { deep:true, flush:'sync' })
function setNorth(index:number) { facts.value.northReference = (['unknown','magnetic','true'] as NorthReference[])[index] ?? 'unknown' }
function refresh() {
  try { records.value = repo.list(); storageError.value = '' } catch(e) { storageError.value = message(e) }
  try { spaces.value = spaceRepo.list(); sourceError.value = '' } catch(e) { sourceError.value = message(e) }
}
onShow(refresh)
function fillFromArchive(index: string) {
  sourceIndex.value = index
  const record = spaces.value[Number(index)]
  if (index === '' || !record) return
  facts.value = JSON.parse(JSON.stringify(record.snapshot.facts))
  bearing.value = facts.value.bearingDegrees === null ? '' : String(facts.value.bearingDegrees)
  uncertainty.value = ''; bearingRole.value = ''
}
function calculate() {
  try {
    if (!uncertainty.value.trim() || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(uncertainty.value.trim())) throw new Error('请明确填写测量不确定度；未知时请先核实。')
    result.value = calculateBazhai({ facts: { ...facts.value, bearingDegrees: parseBearing(bearing.value) }, bearingRole: bearingRole.value, uncertaintyDegrees: Number(uncertainty.value.trim()) })
    stale.value = false; saved.value = null; error.value = ''; recordError.value = ''; notice.value = ''
  } catch(e) { error.value = message(e) }
}
function save() { if(!result.value || stale.value) return; try { saved.value = repo.save(result.value); refresh(); notice.value = '测量事实、八方对照和来源已保存在本机。'; recordError.value = '' } catch(e) { recordError.value = message(e) } }
function openRecord(record: SnapshotRecord<BazhaiSnapshot>) {
  const snapshot = JSON.parse(JSON.stringify(record.snapshot)) as BazhaiSnapshot
  facts.value = snapshot.input.facts; bearing.value = String(facts.value.bearingDegrees); uncertainty.value = String(snapshot.input.uncertaintyDegrees); bearingRole.value = snapshot.input.bearingRole; sourceIndex.value = ''
  result.value = snapshot; stale.value = false; saved.value = record; notice.value = ''; recordError.value = ''
}
async function exportCurrent() { if(!result.value || stale.value) return; try { const method = await exportJson({ schemaVersion:1,kind:'bazhai',snapshot:result.value },`oasis-bazhai-${result.value.input.facts.measuredAt}.json`); notice.value = method === 'download' ? '已发起JSON下载，请在下载列表确认。' : 'JSON已复制，请粘贴保存到文件。' } catch(e) { recordError.value = message(e) } }
async function exportAll() { try { await exportJson(JSON.parse(repo.exportJSON()),'oasis-bazhai-records.json'); notice.value = '已发起导出，请确认下载或粘贴保存的文件。' } catch(e) { storageError.value = message(e) } }
function remove(record: SnapshotRecord<BazhaiSnapshot>) { uni.showModal({ title:'删除这份本机对照？',content:`仅移除“${record.snapshot.input.facts.name}”，原空间档案保留。建议先导出。`,success: answer=> {if(answer.confirm) { try { repo.remove(record.id); if(saved.value?.id === record.id) saved.value = null; refresh() } catch(e) { storageError.value = message(e) } } } }) }
function openSource(url: string) {
  // #ifdef H5
  window.open(url,'_blank','noopener,noreferrer')
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data:url })
  // #endif
}
</script>

<style scoped>
.bazhai-page{max-width:760px;margin:0 auto;padding:24px 20px 48px;color:var(--text-primary,#382f49);box-sizing:border-box}.hero{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px}.hero>view{min-width:0}.eyebrow{display:block;font-size:12px;color:#8b789e;letter-spacing:1px;margin-bottom:10px}.page-heading{display:block;font-size:28px;font-weight:700;line-height:1.45}.page-caption{display:block;font-size:13px;color:#8a7e98;line-height:1.8;margin-top:10px}.panel{background:#fff;border:1px solid #eee9f3;border-radius:20px;padding:20px;margin:0 0 18px;min-width:0;box-sizing:border-box}.panel-title{display:block;font-size:18px;font-weight:650;margin-bottom:10px}.hint{display:block;font-size:12px;line-height:1.8;color:#8b8094;overflow-wrap:anywhere}.label{display:block;font-size:13px;color:#71617f;margin:16px 0 8px}.field{width:100%;min-height:44px;background:#f8f5fc;border:1px solid transparent;border-radius:12px;padding:10px 12px;box-sizing:border-box;font-size:14px;color:#493f55;max-width:100%}.native-select{height:44px}.note-field{height:95px;line-height:1.7}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}.two-col>view{min-width:0}.primary{background:#8068ad!important;color:white!important;margin-top:16px}.error,.notice,.success{display:block;line-height:1.8;font-size:13px;margin:12px 0;padding:10px 12px;border-radius:10px;overflow-wrap:anywhere}.error{background:#fff0f2;color:#a14761}.notice{background:#fff8e8;color:#8c713a}.success{background:#f1f6ed;color:#59784b}.result-title{display:block;font-size:25px;font-weight:650;margin-bottom:8px}.board-caption{display:block;text-align:center;font-size:12px;color:#8e809e;margin:20px 0 8px}.board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:16px}.palace{min-height:104px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f7f4fb;border:1px solid #ece6f4;border-radius:12px;padding:6px;box-sizing:border-box;min-width:0}.direction{font-size:12px;color:#95849f}.star{font-size:20px;font-weight:600;margin:7px 0 3px;color:#695386}.center{background:#fffaf0;border-color:#f1e5c7}.center-title{font-size:22px;color:#a18245}.section-title{display:block;font-weight:600;margin:24px 0 12px}.step{display:flex;gap:10px;line-height:1.9;font-size:13px;margin:12px 0;overflow-wrap:anywhere}.step-number{color:#9a85b5;flex:none}.line-list{border-top:1px solid #eee8f5;margin-top:16px}.line-item{padding:12px 0;border-bottom:1px solid #f1edf6;font-size:13px}.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.actions .primary{margin-top:0}.source{background:#f9f7fc;border-radius:12px;margin:12px 0;padding:14px;font-size:13px;line-height:1.7}.text-button{font-size:12px!important;color:#876caa!important}.limitation{margin-top:10px}.record-heading{display:flex;justify-content:space-between;gap:12px}.empty{display:block;color:#9e91a8;font-size:13px;padding:20px 0;line-height:1.8}.record{display:flex;align-items:center;border-bottom:1px solid #f0ebf6;margin:10px 0;gap:8px}.record-open{flex:1;min-width:0;display:flex!important;flex-direction:column!important;align-items:flex-start!important;text-align:left!important;background:transparent!important;padding:12px 0!important;white-space:normal!important}.record-open>text{overflow-wrap:anywhere}.delete-button{flex:none;color:#aa7888!important;font-size:12px!important}.footer-note{text-align:center;display:block;color:#a99cb3;font-size:12px;line-height:1.8;margin-top:28px}@media(max-width:360px){.bazhai-page{padding:18px 12px 40px}.panel{padding:16px}.page-heading{font-size:25px}.two-col{grid-template-columns:1fr}.palace{min-height:96px}.star{font-size:18px}}
</style>
