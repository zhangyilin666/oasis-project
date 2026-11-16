<template>
  <view class="page-shell space-page">
    <view class="intro"><view class="intro-copy"><text class="eyebrow">五术探索 · 相</text><text class="page-heading">住处的细节，<br />慢慢记下来。</text><text class="page-caption">空间事实档案 · 手动记录与本机保存</text></view><CatCompanion class="intro-cat" :mood="selectedRecord ? 'complete' : 'thinking'" /></view>
    <text class="privacy-note">不需要精确地址 · 点击保存才存到本机 · 不上传、不发送给 AI</text>
    <view class="scope-note"><text class="scope-title">先留下一份可以核对的记录</text><text>记录户型描述、原始方向读数和测量依据。资料确认后，可进入独立的八宅游年页作文化对照。</text></view>
    <navigator url="/pages/bazhai/index" class="text-button archive-link" hover-class="none">八宅游年对照 · 明确测量后再起盘 ↗</navigator>
    <AppButton class="text-button archive-link" @click="scrollToArchive">查看本机空间档案 · {{ records.length }} / 30 ↗</AppButton>

    <view id="space-form" class="panel">
      <view class="panel-heading"><text class="panel-title">这处空间</text><text class="optional-tag">名称必填，其余可留空</text></view>
      <view class="form-group"><text class="form-label">档案名称</text><input v-model="facts.name" class="form-input" maxlength="40" placeholder="例如：现在的小家、书房" aria-label="空间档案名称，必填，最多40个字符" /></view>
      <view class="form-group"><text class="form-label">地点备注 <text class="optional">可选</text></text><input v-model="facts.locationNote" class="form-input" maxlength="200" placeholder="城市、区域或你熟悉的称呼即可" aria-label="地点备注，不需要精确地址" /></view>
      <view class="form-group"><text class="form-label">户型或房间描述 <text class="optional">可选</text></text><textarea v-model="facts.layoutDescription" class="form-textarea" :maxlength="1500" placeholder="例如：一室一厅，书桌在窗边。只写你实际了解的情况。" aria-label="户型或房间文字描述，最多1500个字符" /><text class="small-copy">文字只作原始记录，不从描述猜测朝向、尺寸或方位。</text></view>

      <view class="form-divider"><text class="section-title">方向测量</text><text class="small-copy">没有测量也可以保存。留空和 0° 是两种不同情况。</text></view>
      <view class="form-group"><text class="form-label">测量对象 <text class="optional">可选</text></text><input v-model="facts.directionTarget" class="form-input" maxlength="120" placeholder="例如：站在客厅内向窗外看" aria-label="方向测量对象或观察姿势" /></view>
      <view class="form-group"><text class="form-label">原始方向读数 <text class="optional">可选</text></text><view class="bearing-field"><input v-model="bearingInput" class="form-input" type="digit" maxlength="16" placeholder="未测量请留空，例如 182.5" aria-label="原始方向度数，大于等于0且小于360，可留空" /><text class="degree-unit" aria-hidden="true">°</text></view><text class="small-copy">以所选北向为 0°，顺时针记角度，范围 0° ≤ 读数 &lt; 360°。若工具显示 360°，请确认后改填 0°。</text></view>
      <view class="form-group"><text class="form-label">读数的北向基准</text><view class="reference-options" role="group" aria-label="选择方向读数的北向基准"><AppButton v-for="reference in northReferences" :key="reference" :class="{ selected: facts.northReference === reference }" :aria-pressed="facts.northReference === reference" @click="facts.northReference = reference">{{ NORTH_REFERENCE_LABELS[reference] }}</AppButton></view><text class="small-copy">不确定工具以哪种北向为准时，请选“尚不确定”。磁北读数在本版保持原值，不自动转换成真北。</text></view>
      <view class="form-group"><text class="form-label">测量工具 <text class="optional">可选</text></text><input v-model="facts.measurementTool" class="form-input" maxlength="100" placeholder="例如：指南针、某款手机应用、图纸" aria-label="测量工具" /></view>
      <view class="form-group"><text class="form-label">测量日期 <text class="optional">可选</text></text><picker mode="date" :value="facts.measuredAt || today" start="1900-01-01" end="2099-12-31" @change="facts.measuredAt = $event.detail.value" aria-label="选择公历测量日期，可留空"><view class="form-picker" :class="{ placeholder: !facts.measuredAt }">{{ facts.measuredAt || '尚未记录日期' }}<text aria-hidden="true">⌄</text></view></picker><AppButton v-if="facts.measuredAt" class="text-button compact-button" @click="facts.measuredAt = ''">清空测量日期</AppButton></view>
      <view class="form-group"><text class="form-label">测量依据与误差备注 <text class="optional">可选</text></text><textarea v-model="facts.measurementBasis" class="form-textarea short-textarea" :maxlength="500" placeholder="例如：工具设置为磁北；离开金属家具后测了三次；图纸标有北向。" aria-label="测量依据与误差备注，最多500个字符" /></view>

      <view class="form-divider"><text class="section-title">时间与日常观察</text><text class="small-copy">不清楚时期时可写“不详”，也可以留空；不会据此自动起运盘。</text></view>
      <view class="form-group"><text class="form-label">建筑或建造时期 <text class="optional">可选</text></text><input v-model="facts.buildingPeriod" class="form-input" maxlength="100" placeholder="例如：约 2010 年；仅知道大致年代" aria-label="建筑或建造时期，可写不详" /></view>
      <view class="form-group"><text class="form-label">入住或启用时期 <text class="optional">可选</text></text><input v-model="facts.moveInPeriod" class="form-input" maxlength="100" placeholder="例如：2024 年秋入住" aria-label="入住或启用时期" /></view>
      <view class="form-group"><text class="form-label">补充备注 <text class="optional">可选</text></text><textarea v-model="facts.notes" class="form-textarea" :maxlength="1500" placeholder="记下实际观察到的采光、通风、改造或其他细节。" aria-label="空间补充备注，最多1500个字符" /></view>
      <text v-if="formError" class="error-note" role="alert">{{ formError }}</text>
      <text v-if="storageError" class="error-note" role="alert">档案暂不可读，已停止保存以保护原数据。请到下方重试读取。</text>
      <AppButton class="btn-primary save-button" :disabled="Boolean(storageError) || justSaved" @click="saveRecord">{{ justSaved ? '这份资料已保存' : '保存为新的空间档案' }}</AppButton>
      <text class="small-copy">保存完整快照，后续填写不会覆盖旧档案。最多 30 份，仅在此设备保留。</text>
      <AppButton class="text-button" @click="newDraft">新建空白档案</AppButton>
    </view>

    <view v-if="selectedRecord" id="space-snapshot" class="panel snapshot-panel">
      <text class="eyebrow">保存时的空间快照</text><text class="panel-title snapshot-name" selectable>{{ selectedRecord.snapshot.facts.name }}</text><text class="small-copy">保存于 {{ savedTime(selectedRecord.savedAt) }} · UTC</text>
      <view class="direction-card"><text class="direction-value">{{ selectedRecord.snapshot.facts.bearingDegrees === null ? '方向尚未测量' : `${selectedRecord.snapshot.facts.bearingDegrees}° · ${NORTH_REFERENCE_LABELS[selectedRecord.snapshot.facts.northReference]}` }}</text><text v-if="selectedRecord.snapshot.facts.bearingDegrees === null" class="small-copy">北向基准记录：{{ NORTH_REFERENCE_LABELS[selectedRecord.snapshot.facts.northReference] }}</text><text class="small-copy">{{ selectedRecord.snapshot.directionNote }}</text></view>
      <view class="fact-list"><view v-for="item in snapshotFacts" :key="item.label" class="fact-row"><text class="fact-label">{{ item.label }}</text><text class="fact-value" selectable>{{ item.value || '未记录' }}</text></view></view>
      <text class="small-copy snapshot-note">当前展示保存时的内容，未按新表单重写，也未生成方位推断。</text>
      <view class="action-row"><AppButton class="action-button" @click="fillDraft(selectedRecord)">复制资料到表单</AppButton><AppButton class="action-button" @click="exportOne(selectedRecord)">导出这份 JSON</AppButton></view>
    </view>

    <view id="space-archive" class="panel">
      <view class="panel-heading"><text class="panel-title">本机空间档案</text><text class="small-copy">{{ records.length }} / {{ SPACE_RECORD_LIMIT }}</text></view>
      <text class="small-copy">本机档案与账号分开；清理应用数据会丢失记录，可先导出备份。导出文件包含你填写的地点和空间资料。</text>
      <AppButton class="text-button" @click="loadRecords">刷新档案列表</AppButton>
      <text v-if="storageError" class="error-note" role="alert">{{ storageError }}</text><text v-if="actionError" class="error-note" role="alert">{{ actionError }}</text>
      <text v-if="!records.length && !storageError" class="small-copy empty-note">还没有空间档案。只填写名称，也可以先保存一份待补充的记录。</text>
      <view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" :disabled="Boolean(storageError)" @click="openRecord(record)"><text class="record-name">{{ record.snapshot.facts.name }}</text><text class="small-copy">{{ record.snapshot.facts.locationNote || '地点未记录' }}</text><text class="record-meta">{{ savedTime(record.savedAt) }} UTC · 查看快照 ↗</text></AppButton><AppButton class="text-button delete-button" :disabled="Boolean(storageError)" :aria-label="`删除空间档案：${record.snapshot.facts.name}`" @click="confirmDelete(record)">删除</AppButton></view>
      <AppButton class="btn-secondary export-button" :disabled="!records.length || Boolean(storageError)" @click="exportAll">导出全部空间档案 JSON</AppButton><text class="small-copy">浏览器发起文件下载；其他端复制 JSON 后，请自行粘贴到文件中保存。</text>
    </view>
    <text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>

    <view class="panel source-panel"><AppButton class="disclosure-button" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen"><text>真北、磁北与资料来源</text><text aria-hidden="true">{{ sourcesOpen ? '−' : '＋' }}</text></AppButton><view v-if="sourcesOpen" class="source-content"><text class="small-copy">磁偏角是真北与磁北之间的夹角，会随地点及日期改变。指南针或手机显示的方向，还需核实其设置和测量条件。本版只保存你确认的基准和原始读数，不计算磁偏角、不替换北向基准。</text><view v-for="source in SPACE_SOURCES" :key="source.url"><AppButton class="text-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton><text class="small-copy">{{ source.usage }}</text></view><text class="small-copy source-footer">用户填写的文字和读数仅作本机记录；外部网页内容与本项目说明的授权分别处理。数据格式版本 {{ SPACE_RULE_VERSION }}；未接入传统风水排盘或自动传感器测量。</text></view></view>
    <text class="footer-note">认识环境，从可以核对的事实开始。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { createSpaceSnapshot, emptySpaceFacts, parseBearing, NORTH_REFERENCE_LABELS, SPACE_SOURCES, SPACE_RULE_VERSION, type NorthReference } from '@/domain/space'
import { createSpaceRepository, exportSpaceRecord, SPACE_RECORD_LIMIT, type SpaceRecord } from '@/domain/space/repository'
import { exportJson } from '@/utils/export-json'

const facts = ref(emptySpaceFacts()), bearingInput = ref(''), records = ref<SpaceRecord[]>([]), selectedRecord = ref<SpaceRecord | null>(null)
const formError = ref(''), storageError = ref(''), actionError = ref(''), notice = ref(''), justSaved = ref(false), sourcesOpen = ref(false)
const northReferences: NorthReference[] = ['true', 'magnetic', 'unknown']
const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const repository = createSpaceRepository({ get: key => uni.getStorageSync(key), set: (key, value) => uni.setStorageSync(key, value) })
const snapshotFacts = computed(() => {
  const data = selectedRecord.value?.snapshot.facts
  return data ? [
    { label: '地点备注', value: data.locationNote }, { label: '户型／房间', value: data.layoutDescription },
    { label: '测量对象', value: data.directionTarget }, { label: '测量工具', value: data.measurementTool },
    { label: '测量日期', value: data.measuredAt }, { label: '测量依据', value: data.measurementBasis },
    { label: '建筑时期', value: data.buildingPeriod }, { label: '入住时期', value: data.moveInPeriod }, { label: '补充备注', value: data.notes },
  ] : []
})
const message = (error: unknown) => error instanceof Error ? error.message : '这次操作未完成，请重试。'
function savedTime(value: string) { return value.replace('T', ' ').slice(0, 19) }
function loadRecords() {
  try { records.value = repository.list(); storageError.value = ''; return true }
  catch (error) { storageError.value = message(error); return false }
}
onShow(loadRecords)
watch([facts, bearingInput], () => { justSaved.value = false; formError.value = '' }, { deep: true, flush: 'sync' })
function saveRecord() {
  if (storageError.value || justSaved.value) return
  formError.value = ''; notice.value = ''; actionError.value = ''
  try {
    const snapshot = createSpaceSnapshot({ ...facts.value, bearingDegrees: parseBearing(bearingInput.value) })
    const saved = repository.save(snapshot)
    selectedRecord.value = saved; justSaved.value = true
    notice.value = loadRecords() ? '已保存这份空间快照。表单以后修改，也不会覆盖它。' : '这份档案已写入，但列表暂未读出；可重试刷新。'
    scrollTo('#space-snapshot')
  } catch (error) { formError.value = message(error) }
}
function scrollTo(selector: string) { nextTick(() => uni.pageScrollTo({ selector, duration: 200 })) }
function newDraft() { facts.value = emptySpaceFacts(); bearingInput.value = ''; justSaved.value = false; formError.value = ''; notice.value = '已建立空白表单，已保存的档案仍在下方。'; scrollTo('#space-form') }
function fillDraft(record: SpaceRecord) { facts.value = JSON.parse(JSON.stringify(record.snapshot.facts)); bearingInput.value = record.snapshot.facts.bearingDegrees === null ? '' : String(record.snapshot.facts.bearingDegrees); justSaved.value = false; notice.value = '资料已复制到表单。再次保存会新增一份档案。'; scrollTo('#space-form') }
function openRecord(record: SpaceRecord) { selectedRecord.value = JSON.parse(JSON.stringify(record)); actionError.value = ''; notice.value = ''; scrollTo('#space-snapshot') }
function scrollToArchive() { scrollTo('#space-archive') }
async function download(value: unknown, filename: string) {
  actionError.value = ''; notice.value = ''
  try { const method = await exportJson(value, filename); notice.value = method === 'download' ? '已发起 JSON 文件下载，请在浏览器下载目录确认。' : '档案 JSON 已复制，请粘贴到文件或笔记中保存。' }
  catch (error) { actionError.value = message(error) }
}
function exportOne(record: SpaceRecord) { try { return download(exportSpaceRecord(record), `oasis-space-${record.id}.json`) } catch (error) { actionError.value = message(error) } }
function exportAll() { try { return download(repository.exportAll(), `oasis-space-collection-${today}.json`) } catch (error) { actionError.value = message(error) } }
function confirmDelete(record: SpaceRecord) {
  uni.showModal({ title: '删除这份空间档案', content: `确定删除「${record.snapshot.facts.name}」？删除后无法撤销，其他档案不受影响。`, confirmText: '删除', cancelText: '保留', success: response => {
    if (!response.confirm) return
    try { records.value = repository.remove(record.id); if (selectedRecord.value?.id === record.id) selectedRecord.value = null; justSaved.value = false; actionError.value = ''; notice.value = '已删除这份本机空间档案。' }
    catch (error) { actionError.value = message(error) }
  }, fail: () => { actionError.value = '未能打开删除确认，请重试；未删除档案。' } })
}
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => { notice.value = '来源链接已复制，可粘贴到浏览器阅读。' }, fail: () => { actionError.value = '来源链接复制失败，请重试。' } })
  // #endif
}
</script>

<style scoped>
.space-page { padding-bottom: 100px; }.intro { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }.intro-copy { flex: 1; min-width: 0; }.intro-cat { flex-shrink: 0; width: 90px; }.eyebrow, .page-heading, .page-caption, .panel-title, .small-copy, .privacy-note, .scope-title, .section-title, .direction-value, .fact-label, .fact-value { display: block; }.eyebrow { color: #94729f; font-size: 11px; line-height: 1.8; letter-spacing: 1px; }.page-heading { color: #4a3755; font-size: 28px; line-height: 1.45; font-weight: 700; margin: 7px 0; }.page-caption { color: #86748e; font-size: 12px; line-height: 1.9; }.privacy-note { font-size: 11px; line-height: 1.9; color: #8c7996; margin: 0 0 14px; }.scope-note { background: #fbf3e7; border: 1px solid #f0e4d2; border-radius: 16px; padding: 14px 16px; color: #8b755e; font-size: 12px; line-height: 1.9; }.scope-title { color: #796043; font-weight: 600; margin-bottom: 5px; }.panel { min-width: 0; padding: 20px; border: 1px solid #eee6f3; background: #fff; border-radius: 22px; margin-bottom: 18px; }.panel-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 10px; margin-bottom: 16px; }.panel-title { color: #594368; font-size: 18px; font-weight: 650; line-height: 1.65; }.optional-tag, .optional { color: #9b87a5; font-size: 10px; font-weight: 400; }.optional { margin-left: 5px; }.small-copy { color: #8c7a96; font-size: 11px; line-height: 1.9; margin-top: 7px; overflow-wrap: anywhere; }.form-group { min-width: 0; margin-bottom: 20px; }.form-label { display: block; color: #705780; font-size: 13px; line-height: 1.8; margin-bottom: 7px; }.form-input, .form-textarea { display: block; width: 100%; box-sizing: border-box; background: #fcfafd; border: 1px solid #e9dfef; border-radius: 12px; color: #594266; font-size: 13px; padding: 12px; }.form-input { height: 46px; }.form-textarea { height: 112px; line-height: 1.8; }.short-textarea { height: 96px; }.form-picker { min-height: 46px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border: 1px solid #e9dfef; border-radius: 12px; color: #594266; font-size: 13px; background: #fcfafd; }.placeholder { color: #ae9fb7; }.form-divider { border-top: 1px solid #f0e8f5; margin: 26px 0 18px; padding-top: 20px; }.section-title { color: #694f7d; font-size: 15px; font-weight: 600; }.bearing-field { position: relative; }.bearing-field .form-input { padding-right: 28px; }.degree-unit { position: absolute; right: 12px; top: 11px; color: #967ba6; font-size: 18px; }.reference-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }.reference-options button { min-width: 0; min-height: 44px; margin: 0; padding: 10px 3px; background: #faf6fc; border: 1px solid #e7dced; border-radius: 12px; color: #947c9f; font-size: 12px; line-height: 1.75; white-space: normal; }.reference-options button.selected { background: #efe4f7; border-color: #c5a9d9; color: #775291; }.save-button, .export-button { width: 100%; font-size: 13px; margin-top: 16px; }.text-button { min-height: 42px; margin: 4px 0 0; padding: 8px 0; background: transparent; color: #9068a4; text-align: left; font-size: 12px; line-height: 1.8; white-space: normal; overflow-wrap: anywhere; }.text-button::after, .record-open::after, .disclosure-button::after { border: 0; }.compact-button { min-height: 36px; font-size: 11px; }.archive-link { padding-bottom: 16px; }.snapshot-panel { background: linear-gradient(150deg, #fff, #fdfaff); }.snapshot-name { overflow-wrap: anywhere; }.direction-card { margin: 18px 0; padding: 14px; border: 1px solid #eadff2; border-radius: 14px; background: #f9f4fc; }.direction-value { color: #73518b; font-size: 18px; line-height: 1.65; }.fact-row { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 10px; border-bottom: 1px solid #f1e9f5; padding: 12px 0; }.fact-label { color: #9b86a7; font-size: 11px; line-height: 1.9; }.fact-value { color: #6d587a; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; white-space: pre-wrap; }.snapshot-note { margin-top: 16px; }.action-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }.action-button { min-width: 0; margin: 0; min-height: 44px; padding: 9px 12px; background: #f0e7f7; color: #78558e; font-size: 11px; line-height: 1.9; white-space: normal; }.record-row { display: flex; gap: 8px; align-items: center; border-top: 1px solid #eee7f3; padding-top: 15px; margin-top: 14px; }.record-open { flex: 1; min-width: 0; margin: 0; padding: 0; text-align: left; white-space: normal; background: transparent; line-height: 1.8; }.record-name { display: block; color: #765887; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }.record-meta { display: block; color: #a28bad; font-size: 10px; margin-top: 4px; overflow-wrap: anywhere; }.delete-button { flex-shrink: 0; color: #a56b79; padding: 9px 3px; }.empty-note { padding: 13px 0; }.error-note { display: block; padding: 12px; margin: 12px 0; border-radius: 12px; background: #fcf0f3; color: #a35f75; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }.notice { display: block; padding: 14px; margin: 0 0 18px; color: #687e5f; background: #f1f6ee; border-radius: 14px; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }.disclosure-button { display: flex; width: 100%; justify-content: space-between; gap: 10px; min-height: 44px; margin: 0; padding: 0; background: transparent; text-align: left; color: #735480; font-size: 13px; line-height: 1.8; white-space: normal; }.source-panel { padding-top: 12px; padding-bottom: 12px; }.source-content { padding-bottom: 8px; }.source-footer { border-top: 1px solid #eee5f3; padding-top: 12px; margin-top: 14px; }.footer-note { display: block; text-align: center; padding: 4px 0 24px; color: #a28cad; font-size: 11px; line-height: 1.9; }
@media (max-width: 350px) { .panel { padding: 16px; }.page-heading { font-size: 24px; }.intro-cat { width: 68px; }.reference-options { gap: 4px; }.reference-options button { font-size: 11px; }.fact-row { grid-template-columns: 64px minmax(0, 1fr); gap: 8px; }.form-input, .form-textarea { padding: 10px; font-size: 12px; } }
</style>
