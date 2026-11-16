<template>
  <view class="page-shell qimen-page">
    <view class="intro"><view class="intro-copy"><text class="eyebrow">卜 · 问事与记录</text><text class="page-heading">一刻一盘，<br />从规则读起。</text><text class="page-caption">时家转盘奇门 · 本机计算与留档</text></view><CatCompanion class="intro-cat" :mood="snapshot ? 'complete' : 'thinking'" /></view>
    <text class="privacy-note">点击排盘只在本机计算 · 点击保存才留档 · 不上传、不发送给 AI</text>
    <view class="scope-note"><text class="scope-title">本版固定一种排法</text><text>{{ QIMEN_METHOD }}。展示天地干、九星、八门、八神与值符值使，供规则学习；不生成吉凶、应期或行动建议。</text></view>
    <AppButton class="text-button archive-link" @click="scrollTo('#qimen-archive')">查看本机奇门档案 · {{ records.length }} / 30 ↗</AppButton>

    <view id="qimen-form" class="panel">
      <text class="panel-title">留下这次起盘的资料</text>
      <view class="form-group"><text class="form-label">记录名称</text><input v-model="input.name" class="form-input" maxlength="40" placeholder="例如：一次排盘练习" aria-label="奇门记录名称，必填" /></view>
      <view class="form-group"><text class="form-label">公历日期</text>
        <!-- #ifdef H5 -->
        <input v-model="input.date" class="form-input" maxlength="10" placeholder="YYYY-MM-DD，例如 2024-01-01" aria-label="起盘公历日期，YYYY-MM-DD，必填" />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker mode="date" :value="input.date || today" start="1900-01-01" end="2099-12-31" @change="input.date = $event.detail.value" aria-label="选择起盘公历日期，必填"><view class="form-picker" :class="{ placeholder: !input.date }">{{ input.date || '请选择日期' }}<text aria-hidden="true">⌄</text></view></picker>
        <!-- #endif -->
      </view>
      <view class="form-group"><text class="form-label">当地钟表时间</text><input v-model="input.time" class="form-input" maxlength="8" placeholder="HH:mm 或 HH:mm:ss，例如 09:30" aria-label="当地钟表时间，24小时制，必填" /><text class="small-copy">按 24 小时制填写；不写秒时按 00 秒处理。时间不确定时，先核对后再排盘。</text></view>
      <view class="form-group"><text class="form-label">上述时间的 UTC 偏移</text>
        <!-- #ifdef H5 -->
        <select class="form-picker native-select" :value="offsetConfirmed ? String(input.utcOffsetMinutes) : ''" @change="chooseNativeOffset" aria-label="确认起盘时间的UTC时区偏移，必选"><option disabled value="">请选择并确认 UTC 偏移</option><option v-for="offset in offsets" :key="offset" :value="String(offset)">{{ formatOffset(offset) }}</option></select>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker :range="offsetLabels" :value="offsetIndex" @change="chooseOffset" aria-label="确认起盘时间的UTC时区偏移，必选"><view class="form-picker" :class="{ placeholder: !offsetConfirmed }">{{ offsetConfirmed ? formatOffset(input.utcOffsetMinutes) : '请选择并确认 UTC 偏移' }}<text aria-hidden="true">⌄</text></view></picker>
        <!-- #endif -->
        <AppButton v-if="!offsetConfirmed" class="text-button compact-button" @click="confirmChinaOffset">使用 UTC+08:00（北京时间）</AppButton><text class="small-copy">偏移须与你填写的日期相符，历史夏令时需自行核实。排盘会统一换算至 UTC+08:00，采用 23:00 子初换日；不校正真太阳时。</text></view>
      <view class="form-group"><text class="form-label">地点备注 <text class="optional">可选</text></text><input v-model="input.locationNote" class="form-input" maxlength="200" placeholder="城市或你熟悉的称呼即可" aria-label="地点备注，仅记录，不用于时区或经度推断" /><text class="small-copy">地点仅作记录，不据此猜时区、经度或改动盘面。</text></view>
      <view class="form-group"><text class="form-label">所记事项 <text class="optional">可选</text></text><textarea v-model="input.question" class="form-textarea" :maxlength="500" placeholder="记下你想核对的规则，或当时的想法。" aria-label="所记事项，最多500字" /></view>
      <text v-if="formError" class="error-note" role="alert">{{ formError }}</text>
      <AppButton class="btn-primary full-button" @click="generate">按这份资料排盘</AppButton><text class="small-copy">生成后可以核对全部九宫，再选择是否保存。支持 1900–2099 年。</text>
      <AppButton class="text-button" @click="newDraft">新建空白表单</AppButton>
    </view>

    <view v-if="snapshot" id="qimen-result" class="panel result-panel">
      <view class="panel-heading"><text class="eyebrow">{{ savedRecord ? '保存时的完整快照' : '本次生成 · 尚未保存' }}</text><text class="result-ju">{{ snapshot.board.dun === 'yang' ? '阳遁' : '阴遁' }}{{ snapshot.board.ju }}局</text></view>
      <text class="panel-title record-title" selectable>{{ snapshot.input.name }}</text>
      <text class="small-copy">{{ snapshot.input.date }} {{ snapshot.input.time }} · 输入 {{ formatOffset(snapshot.input.utcOffsetMinutes) }}</text>
      <text class="reference-time">排盘钟表：{{ snapshot.referenceTime }} · UTC+08:00</text>
      <text class="small-copy">{{ snapshot.year }}年 · {{ snapshot.month }}月 · {{ snapshot.day }}日 · {{ snapshot.board.hour }}时</text>
      <view class="summary-strip"><text>{{ snapshot.term }} · {{ snapshot.yuan }}</text><text>符头 {{ snapshot.fuTou }} · {{ snapshot.board.xun }}旬（{{ snapshot.board.hiddenStem }}）</text><text>值符 {{ snapshot.board.chiefStar }} → {{ palaceName(snapshot.board.chiefPalace) }}</text><text>值使 {{ snapshot.board.chiefGate }} → {{ palaceName(snapshot.board.gatePalace) }}{{ snapshot.board.gateRawPalace === 5 ? '（中五寄二）' : '' }}</text></view>
      <text class="small-copy board-hint">上南下北 · 左东右西 · “寄”字保留中五干的来源</text>
      <view class="nine-palaces" aria-label="九宫盘，上南下北、左东右西">
        <view v-for="cell in displayPalaces" :key="cell.palace" class="palace" :class="{ 'center-palace': cell.palace === 5, 'chief-palace': cell.palace === snapshot.board.chiefPalace }" :aria-label="cellDescription(cell)">
          <view class="palace-heading"><text>{{ cell.name }}</text><text>{{ cell.direction }}</text></view>
          <template v-if="cell.palace !== 5"><text class="palace-god">{{ cell.god }}</text><text class="palace-star">{{ cell.star }}</text><text class="palace-gate">{{ cell.gate }}</text><text class="palace-stem">天 {{ cell.heaven }}<text v-if="cell.heavenGuest" class="guest"> · 寄{{ cell.heavenGuest }}</text></text></template>
          <text class="palace-earth">地 {{ cell.earth }}<text v-if="cell.earthGuest" class="guest"> · 寄{{ cell.earthGuest }}</text></text>
          <text v-if="cell.palace === 5" class="center-explanation">地干寄坤二<br />天禽与天寄干<br />随天芮转动</text>
        </view>
      </view>
      <view class="facts-list"><view><text class="fact-label">所用节气</text><text>{{ snapshot.term }} {{ snapshot.termAt }}</text></view><view><text class="fact-label">下个节气</text><text>{{ snapshot.nextTerm }} {{ snapshot.nextTermAt }}</text></view><view><text class="fact-label">地点备注</text><text selectable>{{ snapshot.input.locationNote || '未记录' }}</text></view><view><text class="fact-label">所记事项</text><text selectable>{{ snapshot.input.question || '未记录' }}</text></view></view>
      <text class="small-copy">节气时刻均为 UTC+08:00；交节瞬间换气，甲／己符头定三元。{{ snapshot.board.xunPalace === 5 ? '本盘旬首原在中五；值使从原五宫计数，再处理寄宫。' : '' }}</text>
      <text v-if="formChanged" class="small-copy changed-note">上方表单与此快照不同；这里展示原盘，使用新资料请重新排盘。</text>
      <text v-if="saveError" class="error-note" role="alert">{{ saveError }}</text>
      <text v-if="storageError" class="error-note" role="alert">档案暂不可读，已停止保存以保护原数据，请在下方重试读取。</text>
      <AppButton class="btn-primary full-button" :disabled="Boolean(savedRecord) || Boolean(storageError)" @click="saveCurrent">{{ savedRecord ? '这张盘已保存' : '保存当前显示的盘' }}</AppButton>
      <view class="action-row"><AppButton class="action-button" @click="copyToForm">复制盘面资料到表单</AppButton><AppButton v-if="savedRecord" class="action-button" @click="exportOne(savedRecord)">导出这份 JSON</AppButton></view>
      <text class="small-copy rule-footer">{{ snapshot.method }} · {{ snapshot.ruleVersion }}<br />{{ savedRecord ? `保存于 ${displayTime(savedRecord.savedAt)} UTC；读取未重排。` : '保存完整输入、盘面与规则版本，之后修改表单不会覆盖。' }}</text>
    </view>

    <view id="qimen-archive" class="panel">
      <view class="panel-heading"><text class="panel-title">本机奇门档案</text><text class="small-copy">{{ records.length }} / {{ QIMEN_RECORD_LIMIT }}</text></view>
      <text class="small-copy">与账号分开存放。清理应用数据会丢失记录，导出可作备份；文件包含你填写的事项与地点备注。</text>
      <AppButton class="text-button" @click="loadRecords">刷新档案列表</AppButton>
      <text v-if="storageError" class="error-note" role="alert">{{ storageError }}</text><text v-if="actionError" class="error-note" role="alert">{{ actionError }}</text>
      <text v-if="!records.length && !storageError" class="small-copy empty-note">还没有奇门档案。排盘后，点击保存即可留下完整快照。</text>
      <view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" :disabled="Boolean(storageError)" @click="openRecord(record)"><text class="record-name">{{ record.snapshot.input.name }}</text><text class="small-copy">{{ record.snapshot.referenceTime }} · UTC+08:00</text><text class="record-meta">{{ record.snapshot.board.dun === 'yang' ? '阳遁' : '阴遁' }}{{ record.snapshot.board.ju }}局 · {{ record.snapshot.term }}{{ record.snapshot.yuan }} · 查看快照 ↗</text></AppButton><AppButton class="text-button delete-button" :disabled="Boolean(storageError)" :aria-label="`删除奇门档案：${record.snapshot.input.name}`" @click="confirmDelete(record)">删除</AppButton></view>
      <AppButton class="btn-secondary full-button" :disabled="!records.length || Boolean(storageError)" @click="exportAll">导出全部奇门档案 JSON</AppButton><text class="small-copy">浏览器发起下载；其他端复制 JSON 后，请自行粘贴到文件中保存。</text>
    </view>
    <text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>

    <view class="panel source-panel"><AppButton class="disclosure-button" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen"><text>排法、参考盘与支持范围</text><text aria-hidden="true">{{ sourcesOpen ? '−' : '＋' }}</text></AppButton><view v-if="sourcesOpen" class="source-content"><text class="small-copy">此处为固定的时家转盘拆补法：中五永寄坤二、天禽随天芮；值符随时干，值使由旬首原宫按阳顺阴逆计数；星门沿外八宫转动，八神阳顺阴逆。</text><text class="small-copy">已核对两份公开的完整九宫教学盘；夏至前后样例用香港天文台历法与传统规则手算校验。验证只覆盖本版规则，不能视作所有流派一致。本版不含置闰、飞盘、真太阳时、暗干、空亡、驿马或吉凶解释。</text><view v-for="source in QIMEN_SOURCES" :key="source.url"><AppButton class="text-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton><text class="small-copy">{{ source.usage }}</text></view><text class="small-copy rule-footer">历算 {{ snapshot?.calendarVersion || 'lunar-typescript@1.8.6' }}（MIT）；奇门布盘为本项目独立实现。节气附近请保留准确时分秒；历史时区由输入者明确指定，不随设备时区变动。</text></view></view>
    <text class="footer-note">让盘面可核对，也让每次记录有来处。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { createQimenSnapshot, emptyQimenInput, formatOffset, QIMEN_METHOD, QIMEN_SOURCES, type QimenPalace, type QimenSnapshot } from '@/domain/qimen'
import { createQimenRepository, exportQimenRecord, QIMEN_RECORD_LIMIT, type QimenRecord } from '@/domain/qimen/repository'
import { exportJson } from '@/utils/export-json'

const input = ref(emptyQimenInput()), snapshot = ref<QimenSnapshot | null>(null), savedRecord = ref<QimenRecord | null>(null), records = ref<QimenRecord[]>([])
const offsetConfirmed = ref(false), formChanged = ref(false), sourcesOpen = ref(false)
const formError = ref(''), saveError = ref(''), storageError = ref(''), actionError = ref(''), notice = ref('')
const offsets = Array.from({ length: 105 }, (_, index) => index * 15 - 720), offsetLabels = offsets.map(formatOffset)
const offsetIndex = computed(() => offsets.indexOf(input.value.utcOffsetMinutes))
const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const displayPalaces = computed(() => snapshot.value ? [4, 9, 2, 3, 5, 7, 8, 1, 6].map(palace => snapshot.value!.board.palaces[palace - 1]) : [])
const repository = createQimenRepository({ get: key => uni.getStorageSync(key), set: (key, value) => uni.setStorageSync(key, value) })
const message = (error: unknown) => error instanceof Error ? error.message : '本次操作未完成，请重试。'
function displayTime(value: string) { return value.replace('T', ' ').slice(0, 19) }
function palaceName(palace: number) { return snapshot.value?.board.palaces[palace - 1].name || '' }
function cellDescription(cell: QimenPalace) { return `${cell.name} ${cell.direction}，地盘${cell.earth}${cell.earthGuest ? `，地寄${cell.earthGuest}` : ''}${cell.star ? `，${cell.star}，${cell.gate}，${cell.god}，天盘${cell.heaven}${cell.heavenGuest ? `，天寄${cell.heavenGuest}` : ''}` : '，中五天禽随天芮'}` }
function scrollTo(selector: string) { nextTick(() => uni.pageScrollTo({ selector, duration: 200 })) }
watch(input, () => { formChanged.value = Boolean(snapshot.value); formError.value = '' }, { deep: true, flush: 'sync' })
function chooseOffset(event: { detail: { value: string | number } }) { input.value.utcOffsetMinutes = offsets[Number(event.detail.value)]; offsetConfirmed.value = true }
function chooseNativeOffset(event: Event) { const value = Number((event.target as HTMLSelectElement).value); if (!offsets.includes(value)) return; input.value.utcOffsetMinutes = value; offsetConfirmed.value = true }
function confirmChinaOffset() { input.value.utcOffsetMinutes = 480; offsetConfirmed.value = true }
function loadRecords() {
  try { records.value = repository.list(); storageError.value = ''; return true }
  catch (error) { storageError.value = message(error); return false }
}
onShow(loadRecords)
function generate() {
  formError.value = ''; saveError.value = ''; notice.value = ''
  if (!offsetConfirmed.value) { formError.value = '请先明确选择输入时间的 UTC 偏移。'; return }
  try { snapshot.value = createQimenSnapshot(input.value); savedRecord.value = null; formChanged.value = false; scrollTo('#qimen-result') }
  catch (error) { formError.value = message(error) }
}
function saveCurrent() {
  if (!snapshot.value || savedRecord.value || storageError.value) return
  saveError.value = ''; notice.value = ''
  try { savedRecord.value = repository.save(snapshot.value); notice.value = loadRecords() ? '已保存当前显示的完整盘面。' : '快照已写入，但列表暂未读出；请重试刷新。' }
  catch (error) { saveError.value = message(error) }
}
function newDraft() { snapshot.value = null; savedRecord.value = null; input.value = emptyQimenInput(); offsetConfirmed.value = false; formChanged.value = false; formError.value = ''; saveError.value = ''; notice.value = '已建立空白表单，已保存的档案仍在下方。'; scrollTo('#qimen-form') }
function copyToForm() { if (!snapshot.value) return; input.value = JSON.parse(JSON.stringify(snapshot.value.input)); offsetConfirmed.value = true; formChanged.value = false; notice.value = '资料已复制到表单，修改后可重新排盘。'; scrollTo('#qimen-form') }
function openRecord(record: QimenRecord) { savedRecord.value = JSON.parse(JSON.stringify(record)); snapshot.value = JSON.parse(JSON.stringify(record.snapshot)); formChanged.value = JSON.stringify(input.value) !== JSON.stringify(record.snapshot.input); saveError.value = ''; actionError.value = ''; notice.value = ''; scrollTo('#qimen-result') }
async function download(data: unknown, filename: string) {
  actionError.value = ''; notice.value = ''
  try { const method = await exportJson(data, filename); notice.value = method === 'download' ? '已发起 JSON 文件下载，请在下载目录确认。' : '档案 JSON 已复制，请粘贴到文件中保存。' }
  catch (error) { actionError.value = message(error) }
}
function exportOne(record: QimenRecord) { try { return download(exportQimenRecord(record), `oasis-qimen-${record.id}.json`) } catch (error) { actionError.value = message(error) } }
function exportAll() { try { return download(repository.exportAll(), `oasis-qimen-collection-${today}.json`) } catch (error) { actionError.value = message(error) } }
function confirmDelete(record: QimenRecord) {
  uni.showModal({ title: '删除这份奇门档案', content: `确定删除「${record.snapshot.input.name}」？删除后无法撤销，其他档案不受影响。`, confirmText: '删除', cancelText: '保留', success: response => {
    if (!response.confirm) return
    try { records.value = repository.remove(record.id); if (savedRecord.value?.id === record.id) { savedRecord.value = null; snapshot.value = null }; actionError.value = ''; notice.value = '已删除这份本机奇门档案。' }
    catch (error) { actionError.value = message(error) }
  }, fail: () => { actionError.value = '未能打开删除确认，请重试；未删除档案。' } })
}
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => { notice.value = '来源链接已复制，可在浏览器阅读。' }, fail: () => { actionError.value = '来源链接复制失败，请重试。' } })
  // #endif
}
</script>

<style scoped>
.qimen-page { padding-bottom: 100px; }.intro { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }.intro-copy { flex: 1; min-width: 0; }.intro-cat { flex-shrink: 0; width: 90px; }.eyebrow, .page-heading, .page-caption, .panel-title, .small-copy, .privacy-note, .scope-title, .form-label, .reference-time { display: block; }.eyebrow { color: #94729f; font-size: 11px; line-height: 1.8; letter-spacing: 1px; }.page-heading { color: #4a3755; font-size: 28px; line-height: 1.45; font-weight: 700; margin: 7px 0; }.page-caption { color: #86748e; font-size: 12px; line-height: 1.9; }.privacy-note { font-size: 11px; line-height: 1.9; color: #8c7996; margin: 0 0 14px; }.scope-note { background: #fbf3e7; border: 1px solid #f0e4d2; border-radius: 16px; padding: 14px 16px; color: #8b755e; font-size: 12px; line-height: 1.9; }.scope-title { color: #796043; font-weight: 600; margin-bottom: 5px; }.panel { min-width: 0; padding: 20px; border: 1px solid #eee6f3; background: #fff; border-radius: 22px; margin-bottom: 18px; }.panel-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 10px; margin-bottom: 14px; }.panel-title { color: #594368; font-size: 18px; font-weight: 650; line-height: 1.65; }.record-title { overflow-wrap: anywhere; }.optional { color: #9b87a5; font-size: 10px; font-weight: 400; margin-left: 5px; }.small-copy { color: #8c7a96; font-size: 11px; line-height: 1.9; margin-top: 7px; overflow-wrap: anywhere; }.form-group { min-width: 0; margin-top: 20px; }.form-label { color: #705780; font-size: 13px; line-height: 1.8; margin-bottom: 7px; }.form-input, .form-textarea { display: block; width: 100%; box-sizing: border-box; background: #fcfafd; border: 1px solid #e9dfef; border-radius: 12px; color: #594266; font-size: 13px; padding: 12px; }.form-input { height: 46px; }.form-textarea { height: 100px; line-height: 1.8; }.form-picker { min-height: 46px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border: 1px solid #e9dfef; border-radius: 12px; color: #594266; font-size: 13px; background: #fcfafd; }.placeholder { color: #ae9fb7; }.full-button { width: 100%; font-size: 13px; margin-top: 18px; }.text-button { min-height: 42px; margin: 4px 0 0; padding: 8px 0; background: transparent; color: #9068a4; text-align: left; font-size: 12px; line-height: 1.8; white-space: normal; overflow-wrap: anywhere; }.text-button::after, .record-open::after, .disclosure-button::after { border: 0; }.compact-button { min-height: 36px; font-size: 11px; }.archive-link { padding-bottom: 16px; }.result-panel { background: linear-gradient(150deg, #fff, #fdfaff); }.result-ju { font-size: 17px; color: #856199; font-weight: 650; }.reference-time { font-size: 12px; line-height: 1.8; margin-top: 9px; color: #755985; overflow-wrap: anywhere; }.summary-strip { padding: 12px; margin-top: 15px; background: #f7f1fa; border-radius: 12px; color: #80658e; font-size: 11px; line-height: 1.9; }.summary-strip > text { display: block; }.board-hint { margin: 15px 0 7px; }.nine-palaces { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid #decee9; border-radius: 12px; overflow: hidden; background: #fff; }.palace { min-width: 0; padding: 10px 6px; min-height: 152px; box-sizing: border-box; border-right: 1px solid #e8ddef; border-bottom: 1px solid #e8ddef; }.palace:nth-child(3n) { border-right: 0; }.palace:nth-child(n + 7) { border-bottom: 0; }.palace-heading { display: flex; flex-wrap: wrap; gap: 1px 5px; justify-content: space-between; color: #a58eb0; font-size: 9px; line-height: 1.5; margin-bottom: 8px; }.palace-god, .palace-star, .palace-gate, .palace-stem, .palace-earth, .center-explanation { display: block; line-height: 1.9; }.palace-god { color: #9a778f; font-size: 10px; }.palace-star { color: #866991; font-size: 10px; }.palace-gate { color: #72598a; font-size: 13px; font-weight: 650; margin: 2px 0; }.palace-stem, .palace-earth { font-size: 11px; color: #8c7895; }.guest { font-size: 9px; color: #b08899; }.chief-palace { background: #f8f1fc; }.center-palace { background: #fcfafc; }.center-explanation { color: #b19cba; font-size: 9px; margin-top: 12px; }.facts-list { margin: 15px 0; }.facts-list > view { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 8px; border-bottom: 1px solid #f0e8f5; padding: 9px 0; color: #80688e; font-size: 11px; line-height: 1.9; overflow-wrap: anywhere; white-space: pre-wrap; }.fact-label { color: #aa95b4; }.changed-note { padding: 10px; background: #fbf4e9; border-radius: 10px; color: #9b7e57; }.action-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }.action-button { min-width: 0; margin: 0; min-height: 44px; padding: 9px 12px; background: #f0e7f7; color: #78558e; font-size: 11px; line-height: 1.9; white-space: normal; }.rule-footer { border-top: 1px solid #eee5f3; padding-top: 12px; margin-top: 16px; }.record-row { display: flex; gap: 8px; align-items: center; border-top: 1px solid #eee7f3; padding-top: 15px; margin-top: 14px; }.record-open { flex: 1; min-width: 0; margin: 0; padding: 0; text-align: left; white-space: normal; background: transparent; line-height: 1.8; }.record-name { display: block; color: #765887; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }.record-meta { display: block; color: #a28bad; font-size: 10px; margin-top: 4px; overflow-wrap: anywhere; }.delete-button { flex-shrink: 0; color: #a56b79; padding: 9px 3px; }.empty-note { padding: 13px 0; }.error-note { display: block; padding: 12px; margin: 12px 0; border-radius: 12px; background: #fcf0f3; color: #a35f75; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }.notice { display: block; padding: 14px; margin: 0 0 18px; color: #687e5f; background: #f1f6ee; border-radius: 14px; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }.disclosure-button { display: flex; width: 100%; justify-content: space-between; gap: 10px; min-height: 44px; margin: 0; padding: 0; background: transparent; text-align: left; color: #735480; font-size: 13px; line-height: 1.8; white-space: normal; }.source-panel { padding-top: 12px; padding-bottom: 12px; }.source-content { padding-bottom: 8px; }.footer-note { display: block; text-align: center; padding: 4px 0 24px; color: #a28cad; font-size: 11px; line-height: 1.9; }
@media (max-width: 350px) { .panel { padding: 14px; }.page-heading { font-size: 24px; }.intro-cat { width: 68px; }.palace { padding: 8px 4px; }.palace-heading { font-size: 8px; }.palace-star { font-size: 9px; }.palace-stem, .palace-earth { font-size: 10px; }.guest { font-size: 8px; }.form-input, .form-textarea { padding: 10px; font-size: 12px; } }
.native-select { display: block; width: 100%; font-family: inherit; }
</style>
