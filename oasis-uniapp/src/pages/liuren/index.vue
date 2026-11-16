<template>
  <view class="page-shell liuren-page">
    <view class="intro"><view class="intro-copy"><text class="eyebrow">卜 · 问事与记录</text><text class="page-heading">月将加时，<br />循四课看三传。</text><text class="page-caption">大六壬 · 本机排课与古例核对</text></view><CatCompanion class="intro-cat" :mood="snapshot ? 'complete' : 'thinking'" /></view>
    <text class="privacy-note">排课只在本机计算 · 点击保存才留档 · 不上传、不发送给 AI</text>
    <view class="scope-note"><text class="scope-title">从一套可核对的规则开始</text><text>展示十二天地盘、四课、三传、天将与日旬空。九宗门依《六壬大全》固定取法，供规则学习，不生成吉凶、应期或行动建议。</text></view>
    <AppButton class="text-button archive-link" @click="scrollTo('#liuren-archive')">查看本机六壬档案 · {{ records.length }} / 30 ↗</AppButton>

    <view id="liuren-form" class="panel">
      <text class="panel-title">留下这次起课的资料</text>
      <view class="mode-row" aria-label="选择起课方式"><AppButton class="mode-button" :class="{ active: input.mode === 'calendar' }" :aria-pressed="input.mode === 'calendar'" @click="input.mode = 'calendar'">公历起课</AppButton><AppButton class="mode-button" :class="{ active: input.mode === 'manual' }" :aria-pressed="input.mode === 'manual'" @click="input.mode = 'manual'">古例核对</AppButton></view>
      <view class="form-group"><text class="form-label">记录名称</text><input v-model="input.name" class="form-input" maxlength="40" placeholder="例如：一次九宗门练习" aria-label="六壬记录名称，必填" /></view>
      <template v-if="input.mode === 'calendar'">
        <view class="form-group"><text class="form-label">公历日期</text><input v-model="input.date" class="form-input" maxlength="10" placeholder="YYYY-MM-DD，例如 2024-01-01" aria-label="起课公历日期，YYYY-MM-DD，必填" /></view>
        <view class="form-group"><text class="form-label">当地钟表时间</text><input v-model="input.time" class="form-input" maxlength="8" placeholder="HH:mm 或 HH:mm:ss，例如 12:00" aria-label="当地钟表时间，24小时制，必填" /><text class="small-copy">未填秒时按 00 秒处理；支持 1900–2099 年。中气交接附近请保留准确的时分秒。</text></view>
        <view class="form-group"><text class="form-label">上述时间的 UTC 偏移</text>
          <!-- #ifdef H5 -->
          <select class="form-picker native-select" :value="offsetConfirmed ? String(input.utcOffsetMinutes) : ''" @change="chooseNativeOffset" aria-label="确认起课时间的UTC时区偏移，必选"><option disabled value="">请选择并确认 UTC 偏移</option><option v-for="offset in offsets" :key="offset" :value="String(offset)">{{ formatLiurenOffset(offset) }}</option></select>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <picker :range="offsetLabels" :value="offsetIndex" @change="chooseOffset" aria-label="确认起课时间的UTC时区偏移，必选"><view class="form-picker">{{ offsetConfirmed ? formatLiurenOffset(input.utcOffsetMinutes) : '请选择并确认 UTC 偏移' }}<text aria-hidden="true">⌄</text></view></picker>
          <!-- #endif -->
          <AppButton v-if="!offsetConfirmed" class="text-button compact-button" @click="confirmChinaOffset">使用 UTC+08:00（北京时间）</AppButton>
          <text class="small-copy">历史夏令时须自行核实。统一换算 UTC+08:00 起课，23:00 子初换日，中气瞬间换月将；不校正真太阳时。</text>
        </view>
      </template>
      <template v-else>
        <text class="small-copy">按古籍明确记载的日干支、月将与占时核对，不推测对应的公历日期。</text>
        <view v-for="field in manualFields" :key="field.key" class="form-group"><text class="form-label">{{ field.label }}</text>
          <!-- #ifdef H5 -->
          <select v-model="input[field.key]" class="form-picker native-select" :aria-label="`${field.label}，必选`"><option disabled value="">请选择{{ field.label }}</option><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <picker :range="field.options" :value="Math.max(0, field.options.indexOf(input[field.key]))" @change="chooseManual(field.key, field.options, $event)" :aria-label="`${field.label}，必选`"><view class="form-picker">{{ input[field.key] || `请选择${field.label}` }}<text aria-hidden="true">⌄</text></view></picker>
          <!-- #endif -->
        </view>
        <AppButton class="text-button" @click="fillAncientExample">填入《六壬大全》甲子日子将卯时例</AppButton>
      </template>
      <view class="form-group"><text class="form-label">地点备注 <text class="optional">可选</text></text><input v-model="input.locationNote" class="form-input" maxlength="200" placeholder="仅作记录，不据此推断时区或经度" aria-label="地点备注，仅记录，不影响排课" /></view>
      <view class="form-group"><text class="form-label">所记事项 <text class="optional">可选</text></text><textarea v-model="input.question" class="form-textarea" :maxlength="500" placeholder="记下正在核对的规则，或当时的想法。" aria-label="所记事项，最多500字" /></view>
      <text v-if="formError" class="error-note" role="alert">{{ formError }}</text>
      <AppButton class="btn-primary full-button" @click="generate">按这份资料起课</AppButton><text class="small-copy">起课后可查看取传依据，再选择是否保存。</text>
      <AppButton class="text-button" @click="newDraft">新建空白表单</AppButton>
    </view>

    <view v-if="snapshot" id="liuren-result" class="panel result-panel">
      <view class="panel-heading"><text class="eyebrow">{{ savedRecord ? '保存时的完整快照' : '本次生成 · 尚未保存' }}</text><text class="result-method">{{ snapshot.board.method }}</text></view>
      <text class="panel-title record-title" selectable>{{ snapshot.input.name }}</text>
      <template v-if="snapshot.calendar"><text class="small-copy">输入 {{ snapshot.input.date }} {{ snapshot.input.time }} · {{ formatLiurenOffset(snapshot.input.utcOffsetMinutes) }}</text><text class="reference-time">起课钟表 {{ snapshot.calendar.referenceTime }} · UTC+08:00</text><text class="small-copy">{{ snapshot.calendar.year }}年 · {{ snapshot.calendar.month }}月 · {{ snapshot.board.day }}日 · {{ snapshot.calendar.hour }}时</text></template>
      <text v-else class="reference-time">古例核对 · {{ snapshot.board.day }}日 · {{ snapshot.board.general }}将 · {{ snapshot.board.hour }}时</text>
      <view class="summary-strip"><text>月将 {{ snapshot.board.general }} 加 {{ snapshot.board.hour }} 时</text><text>{{ snapshot.board.xun }}旬 · 空亡 {{ snapshot.board.voids.join('、') }}</text><text>{{ snapshot.board.dayPeriod }}贵 {{ snapshot.board.noble }} · 十二天将{{ snapshot.board.nobleDirection }}布</text></view>

      <text class="section-label">十二天地盘</text><text class="small-copy board-hint">上南下北 · 外框按地盘定位 · 空标记所临的天盘旬空支</text>
      <view class="twelve-palaces" aria-label="十二天地盘，上南下北">
        <view v-for="cell in displayPalaces" :key="cell.earth" class="palace" :style="{ gridArea: cell.area }" :aria-label="`地盘${cell.earth}，天盘${cell.heaven}，${cell.god}${cell.empty ? '，旬空' : ''}`"><text class="palace-god">{{ cell.god }}</text><text class="palace-heaven">{{ cell.heaven }}<text v-if="cell.empty" class="empty-tag">空</text></text><text class="palace-earth">地 {{ cell.earth }}</text></view>
        <view class="board-center"><text class="center-day">{{ snapshot.board.day }}日</text><text>{{ snapshot.board.general }}将 · {{ snapshot.board.hour }}时</text><text>{{ snapshot.board.method }}</text></view>
      </view>

      <text class="section-label">四课</text><text class="small-copy board-hint">按一课至四课从左向右展示，上为天盘，下为日干支及前课上神。</text>
      <view class="lessons"><view v-for="(lesson, i) in snapshot.board.lessons" :key="i" class="lesson"><text class="lesson-label">{{ ['一课', '二课', '三课', '四课'][i] }}</text><text class="lesson-upper">{{ lesson.upper }}</text><text class="lesson-lower">{{ lesson.lower }}</text><text class="lesson-relation">{{ lesson.relation }}</text></view></view>

      <text class="section-label">三传</text>
      <view v-if="snapshot.board.status === 'complete'" class="transmissions"><view v-for="(branch, i) in snapshot.board.transmissions" :key="i" class="transmission"><text class="lesson-label">{{ ['初传', '中传', '末传'][i] }}</text><text class="transmission-branch">{{ branch }}</text><text class="small-copy">{{ godFor(branch) }}{{ snapshot.board.voids.includes(branch) ? ' · 空' : '' }}</text></view></view>
      <text v-else class="error-note" role="status">本版未核实此组合的唯一取传，暂不生成三传。天地盘、四课与输入仍可留档。</text>
      <view class="rule-trace"><text class="scope-title">本盘取传依据</text><text v-for="line in snapshot.board.explanation" :key="line" class="small-copy">{{ line }}</text></view>
      <view v-if="snapshot.calendar" class="facts-list"><view><text class="fact-label">本月中气</text><text>{{ snapshot.calendar.qi }} {{ snapshot.calendar.qiAt }}</text></view><view><text class="fact-label">下次换将</text><text>{{ snapshot.calendar.nextQi }} {{ snapshot.calendar.nextQiAt }}</text></view></view>
      <text v-if="snapshot.calendar" class="small-copy">中气时刻为 UTC+08:00；每个中气交接瞬间换月将，节气不换将。</text>
      <view class="facts-list"><view><text class="fact-label">地点备注</text><text selectable>{{ snapshot.input.locationNote || '未记录' }}</text></view><view><text class="fact-label">所记事项</text><text selectable>{{ snapshot.input.question || '未记录' }}</text></view></view>
      <text v-if="formChanged" class="small-copy changed-note">上方表单与此快照不同；这里展示原盘，使用新资料请重新起课。</text>
      <text v-if="saveError" class="error-note" role="alert">{{ saveError }}</text><text v-if="storageError" class="error-note" role="alert">档案暂不可读，已停止保存，请在下方重试读取。</text>
      <AppButton class="btn-primary full-button" :disabled="Boolean(savedRecord) || Boolean(storageError)" @click="saveCurrent">{{ savedRecord ? '这张课已保存' : '保存当前显示的课' }}</AppButton>
      <view class="action-row"><AppButton class="action-button" @click="copyToForm">复制资料到表单</AppButton><AppButton v-if="savedRecord" class="action-button" @click="exportOne(savedRecord)">导出这份 JSON</AppButton></view>
      <text class="small-copy rule-footer">{{ snapshot.method }} · {{ snapshot.ruleVersion }}<br />{{ savedRecord ? `保存于 ${displayTime(savedRecord.savedAt)} UTC；读取未重排。` : '保留完整输入、盘面、取法及规则版本；后续表单修改不覆盖快照。' }}</text>
    </view>

    <view id="liuren-archive" class="panel"><view class="panel-heading"><text class="panel-title">本机六壬档案</text><text class="small-copy">{{ records.length }} / {{ LIUREN_RECORD_LIMIT }}</text></view>
      <text class="small-copy">与账号分开存放。清理应用数据会丢失记录，导出可作备份；文件包含你填写的事项与地点备注。</text>
      <AppButton class="text-button" @click="loadRecords">刷新档案列表</AppButton><text v-if="storageError" class="error-note" role="alert">{{ storageError }}</text><text v-if="actionError" class="error-note" role="alert">{{ actionError }}</text>
      <text v-if="!records.length && !storageError" class="small-copy empty-note">还没有六壬档案。起课后，点击保存即可留下完整快照。</text>
      <view v-for="record in records" :key="record.id" class="record-row"><AppButton class="record-open" :disabled="Boolean(storageError)" @click="openRecord(record)"><text class="record-name">{{ record.snapshot.input.name }}</text><text class="small-copy">{{ record.snapshot.calendar ? `${record.snapshot.calendar.referenceTime} · UTC+08:00` : '古例核对 · 无公历日期' }}</text><text class="record-meta">{{ record.snapshot.board.day }}日 · {{ record.snapshot.board.general }}将{{ record.snapshot.board.hour }}时 · {{ record.snapshot.board.method }} · 查看快照 ↗</text></AppButton><AppButton class="text-button delete-button" :disabled="Boolean(storageError)" :aria-label="`删除六壬档案：${record.snapshot.input.name}`" @click="confirmDelete(record)">删除</AppButton></view>
      <AppButton class="btn-secondary full-button" :disabled="!records.length || Boolean(storageError)" @click="exportAll">导出全部六壬档案 JSON</AppButton><text class="small-copy">浏览器发起下载；其他端复制 JSON 后，请粘贴到文件中保存。</text>
    </view>
    <text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>

    <view class="panel source-panel"><AppButton class="disclosure-button" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen"><text>本版取法、古例与支持范围</text><text aria-hidden="true">{{ sourcesOpen ? '−' : '＋' }}</text></AppButton><view v-if="sourcesOpen" class="source-content">
      <text class="small-copy">已核对 22 个独立古例，覆盖九宗门。天地盘、四课与三传由本项目实现；尚未以外部参考逐项核对全部 720 组合，也不代表所有流派一致。</text>
      <text class="small-copy">涉害按《六壬大全·订讹》途中计数，不计出发与归家位，地支及寄干分别计算；同深依孟、仲、季，再阳取干课、阴取支课。阴别责取日支三合前位地支。贵人昼夜固定卯至申为昼，酉至寅为夜，不用当地日出日落。</text>
      <text class="small-copy">本版只展示盘面、取传步骤及旬空，不含其他神煞、年命、行年、课体细格、吉凶解释或自动断语。遇无法唯一取传的规则分支时，三传留空并说明原因。</text>
      <view v-for="source in LIUREN_SOURCES" :key="source.url"><AppButton class="text-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton><text class="small-copy">{{ source.usage }}</text></view>
      <text class="small-copy rule-footer">历算 lunar-typescript@1.8.6（MIT）。地点只作备注，时区由输入者明确指定；不随设备时区变化。</text>
    </view></view>
    <text class="footer-note">让每一步有依据，让每一课可重读。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { createLiurenSnapshot, emptyLiurenInput, formatLiurenOffset, LIUREN_BRANCHES, LIUREN_DAYS, LIUREN_SOURCES, type LiurenSnapshot } from '@/domain/liuren'
import { createLiurenRepository, exportLiurenRecord, LIUREN_RECORD_LIMIT, type LiurenRecord } from '@/domain/liuren/repository'
import { exportJson } from '@/utils/export-json'

const input = ref(emptyLiurenInput()), snapshot = ref<LiurenSnapshot | null>(null), savedRecord = ref<LiurenRecord | null>(null), records = ref<LiurenRecord[]>([])
const offsetConfirmed = ref(false), formChanged = ref(false), sourcesOpen = ref(false)
const formError = ref(''), saveError = ref(''), storageError = ref(''), actionError = ref(''), notice = ref('')
const offsets = Array.from({ length: 105 }, (_, i) => i * 15 - 720), offsetLabels = offsets.map(formatLiurenOffset)
const offsetIndex = computed(() => offsets.indexOf(input.value.utcOffsetMinutes))
const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const manualFields = [{ key: 'day', label: '日干支', options: LIUREN_DAYS }, { key: 'general', label: '月将', options: LIUREN_BRANCHES }, { key: 'hour', label: '占时地支', options: LIUREN_BRANCHES }] as const
const positions: Record<string, string> = { 巳: '1 / 1', 午: '1 / 2', 未: '1 / 3', 申: '1 / 4', 辰: '2 / 1', 酉: '2 / 4', 卯: '3 / 1', 戌: '3 / 4', 寅: '4 / 1', 丑: '4 / 2', 子: '4 / 3', 亥: '4 / 4' }
const displayPalaces = computed(() => snapshot.value?.board.palaces.map(cell => ({ ...cell, area: positions[cell.earth] })) || [])
const repository = createLiurenRepository({ get: key => uni.getStorageSync(key), set: (key, value) => uni.setStorageSync(key, value) })
const message = (error: unknown) => error instanceof Error ? error.message : '本次操作未完成，请重试。'
function displayTime(value: string) { return value.replace('T', ' ').slice(0, 19) }
function godFor(branch: string) { return snapshot.value?.board.palaces.find(cell => cell.heaven === branch)?.god || '' }
function scrollTo(selector: string) { nextTick(() => uni.pageScrollTo({ selector, duration: 200 })) }
watch(input, () => { formChanged.value = Boolean(snapshot.value); formError.value = '' }, { deep: true, flush: 'sync' })
function chooseOffset(event: { detail: { value: string | number } }) { input.value.utcOffsetMinutes = offsets[Number(event.detail.value)]; offsetConfirmed.value = true }
function chooseNativeOffset(event: Event) { const value = Number((event.target as HTMLSelectElement).value); if (!offsets.includes(value)) return; input.value.utcOffsetMinutes = value; offsetConfirmed.value = true }
function confirmChinaOffset() { input.value.utcOffsetMinutes = 480; offsetConfirmed.value = true }
function chooseManual(key: 'day' | 'general' | 'hour', options: readonly string[], event: { detail: { value: string | number } }) { input.value[key] = options[Number(event.detail.value)] }
function fillAncientExample() { input.value.day = '甲子'; input.value.general = '子'; input.value.hour = '卯'; if (!input.value.name) input.value.name = '《六壬大全》元首例' }
function loadRecords() { try { records.value = repository.list(); storageError.value = ''; return true } catch (error) { storageError.value = message(error); return false } }
onShow(loadRecords)
function generate() {
  formError.value = ''; saveError.value = ''; notice.value = ''
  if (input.value.mode === 'calendar' && !offsetConfirmed.value) { formError.value = '请先明确选择输入时间的 UTC 偏移。'; return }
  try { snapshot.value = createLiurenSnapshot(input.value); savedRecord.value = null; formChanged.value = false; scrollTo('#liuren-result') } catch (error) { formError.value = message(error) }
}
function saveCurrent() {
  if (!snapshot.value || savedRecord.value || storageError.value) return
  saveError.value = ''; notice.value = ''
  try { savedRecord.value = repository.save(snapshot.value); notice.value = loadRecords() ? '已保存当前显示的完整课盘。' : '快照已写入，但列表暂未读出；请重试刷新。' } catch (error) { saveError.value = message(error) }
}
function newDraft() { snapshot.value = null; savedRecord.value = null; input.value = emptyLiurenInput(); offsetConfirmed.value = false; formChanged.value = false; formError.value = ''; saveError.value = ''; notice.value = '已建立空白表单，已保存的档案仍在下方。'; scrollTo('#liuren-form') }
function copyToForm() { if (!snapshot.value) return; input.value = JSON.parse(JSON.stringify(snapshot.value.input)); offsetConfirmed.value = input.value.mode === 'calendar'; formChanged.value = false; notice.value = '资料已复制到表单，修改后可重新起课。'; scrollTo('#liuren-form') }
function openRecord(record: LiurenRecord) { savedRecord.value = JSON.parse(JSON.stringify(record)); snapshot.value = JSON.parse(JSON.stringify(record.snapshot)); formChanged.value = JSON.stringify(input.value) !== JSON.stringify(record.snapshot.input); saveError.value = ''; actionError.value = ''; notice.value = ''; scrollTo('#liuren-result') }
async function download(data: unknown, filename: string) { actionError.value = ''; notice.value = ''; try { const method = await exportJson(data, filename); notice.value = method === 'download' ? '已发起 JSON 文件下载，请在下载目录确认。' : '档案 JSON 已复制，请粘贴到文件中保存。' } catch (error) { actionError.value = message(error) } }
function exportOne(record: LiurenRecord) { try { return download(exportLiurenRecord(record), `oasis-liuren-${record.id}.json`) } catch (error) { actionError.value = message(error) } }
function exportAll() { try { return download(repository.exportAll(), `oasis-liuren-collection-${today}.json`) } catch (error) { actionError.value = message(error) } }
function confirmDelete(record: LiurenRecord) {
  uni.showModal({ title: '删除这份六壬档案', content: `确定删除「${record.snapshot.input.name}」？删除后无法撤销，其他档案不受影响。`, confirmText: '删除', cancelText: '保留', success: response => {
    if (!response.confirm) return
    try { records.value = repository.remove(record.id); if (savedRecord.value?.id === record.id) { savedRecord.value = null; snapshot.value = null }; actionError.value = ''; notice.value = '已删除这份本机六壬档案。' } catch (error) { actionError.value = message(error) }
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
.liuren-page { padding-bottom: 100px; }.intro { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }.intro-copy { flex: 1; min-width: 0; }.intro-cat { flex-shrink: 0; width: 90px; }.eyebrow, .page-heading, .page-caption, .panel-title, .small-copy, .privacy-note, .scope-title, .form-label, .reference-time, .section-label { display: block; }.eyebrow { color: #94729f; font-size: 11px; line-height: 1.8; letter-spacing: 1px; }.page-heading { color: #4a3755; font-size: 28px; line-height: 1.45; font-weight: 700; margin: 7px 0; }.page-caption { color: #86748e; font-size: 12px; line-height: 1.9; }.privacy-note { font-size: 11px; line-height: 1.9; color: #8c7996; margin: 0 0 14px; }.scope-note { background: #fbf3e7; border: 1px solid #f0e4d2; border-radius: 16px; padding: 14px 16px; color: #8b755e; font-size: 12px; line-height: 1.9; }.scope-title { color: #796043; font-size: 12px; font-weight: 600; margin-bottom: 5px; }.panel { min-width: 0; padding: 20px; border: 1px solid #eee6f3; background: #fff; border-radius: 22px; margin-bottom: 18px; }.panel-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 10px; margin-bottom: 14px; }.panel-title { color: #594368; font-size: 18px; font-weight: 650; line-height: 1.65; }.record-title { overflow-wrap: anywhere; }.optional { color: #9b87a5; font-size: 10px; font-weight: 400; margin-left: 5px; }.small-copy { color: #8c7a96; font-size: 11px; line-height: 1.9; margin-top: 7px; overflow-wrap: anywhere; }.form-group { min-width: 0; margin-top: 20px; }.form-label { color: #705780; font-size: 13px; line-height: 1.8; margin-bottom: 7px; }.form-input, .form-textarea { display: block; width: 100%; box-sizing: border-box; background: #fcfafd; border: 1px solid #e9dfef; border-radius: 12px; color: #594266; font-size: 13px; padding: 12px; }.form-input { height: 46px; }.form-textarea { height: 100px; line-height: 1.8; }.form-picker { min-height: 46px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border: 1px solid #e9dfef; border-radius: 12px; color: #594266; font-size: 13px; background: #fcfafd; }.native-select { display: block; width: 100%; font-family: inherit; }.full-button { width: 100%; font-size: 13px; margin-top: 18px; }.text-button { min-height: 42px; margin: 4px 0 0; padding: 8px 0; background: transparent; color: #9068a4; text-align: left; font-size: 12px; line-height: 1.8; white-space: normal; overflow-wrap: anywhere; }.text-button::after, .record-open::after, .disclosure-button::after { border: 0; }.compact-button { min-height: 36px; font-size: 11px; }.archive-link { padding-bottom: 16px; }.mode-row { display: flex; gap: 8px; margin-top: 14px; }.mode-button { flex: 1; margin: 0; border: 1px solid #ebdff1; border-radius: 12px; color: #8b7298; background: #fcfafd; font-size: 12px; min-height: 44px; padding: 10px 6px; }.mode-button.active { background: #eee1f6; color: #735085; border-color: #cfb7dc; }.result-panel { background: linear-gradient(150deg, #fff, #fdfaff); }.result-method { font-size: 18px; color: #856199; font-weight: 650; }.reference-time { font-size: 12px; line-height: 1.8; margin-top: 9px; color: #755985; overflow-wrap: anywhere; }.summary-strip { padding: 12px; margin-top: 15px; background: #f7f1fa; border-radius: 12px; color: #80658e; font-size: 11px; line-height: 1.9; }.summary-strip > text { display: block; }.section-label { color: #785e88; font-size: 14px; margin-top: 22px; font-weight: 600; }.board-hint { margin: 8px 0 10px; }.twelve-palaces { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(76px, auto)); gap: 1px; border: 1px solid #dfcee8; background: #e8dcef; border-radius: 12px; overflow: hidden; }.palace { min-width: 0; background: #fff; padding: 8px 3px; text-align: center; }.palace-god, .palace-heaven, .palace-earth { display: block; line-height: 1.75; }.palace-god { color: #9a7b9c; font-size: 10px; }.palace-heaven { position: relative; color: #795789; font-size: 18px; font-weight: 600; }.palace-earth { color: #ad99b6; font-size: 10px; }.empty-tag { position: absolute; margin-left: 2px; font-size: 8px; font-weight: 400; color: #b69285; }.board-center { grid-area: 2 / 2 / 4 / 4; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #faf5fc; gap: 8px; color: #a187af; font-size: 11px; }.center-day { color: #80608e; font-size: 21px; letter-spacing: 3px; }.lessons { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #e8ddef; border-radius: 12px; overflow: hidden; }.lesson { text-align: center; padding: 10px 2px; border-right: 1px solid #eee6f3; }.lesson:last-child { border-right: 0; }.lesson-label, .lesson-upper, .lesson-lower, .lesson-relation { display: block; line-height: 1.8; }.lesson-label { color: #a58db1; font-size: 10px; }.lesson-upper { color: #795789; font-size: 20px; margin-top: 5px; }.lesson-lower { color: #9b83a7; font-size: 17px; }.lesson-relation { color: #aa90a6; font-size: 9px; margin-top: 5px; }.transmissions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }.transmission { padding: 12px 2px; text-align: center; background: #f6effa; border-radius: 12px; }.transmission-branch { display: block; font-size: 27px; line-height: 1.6; color: #785589; margin-top: 5px; }.transmission .small-copy { font-size: 10px; margin-top: 3px; }.rule-trace { margin-top: 16px; padding: 13px; background: #fbf7ee; border-radius: 12px; }.facts-list { margin: 15px 0; }.facts-list > view { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 8px; border-bottom: 1px solid #f0e8f5; padding: 9px 0; color: #80688e; font-size: 11px; line-height: 1.9; overflow-wrap: anywhere; white-space: pre-wrap; }.fact-label { color: #aa95b4; }.changed-note { padding: 10px; background: #fbf4e9; border-radius: 10px; color: #9b7e57; }.action-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }.action-button { min-width: 0; margin: 0; min-height: 44px; padding: 9px 12px; background: #f0e7f7; color: #78558e; font-size: 11px; line-height: 1.9; white-space: normal; }.rule-footer { border-top: 1px solid #eee5f3; padding-top: 12px; margin-top: 16px; }.record-row { display: flex; gap: 8px; align-items: center; border-top: 1px solid #eee7f3; padding-top: 15px; margin-top: 14px; }.record-open { flex: 1; min-width: 0; margin: 0; padding: 0; text-align: left; white-space: normal; background: transparent; line-height: 1.8; }.record-name { display: block; color: #765887; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }.record-meta { display: block; color: #a28bad; font-size: 10px; margin-top: 4px; overflow-wrap: anywhere; }.delete-button { flex-shrink: 0; color: #a56b79; padding: 9px 3px; }.empty-note { padding: 13px 0; }.error-note { display: block; padding: 12px; margin: 12px 0; border-radius: 12px; background: #fcf0f3; color: #a35f75; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }.notice { display: block; padding: 14px; margin: 0 0 18px; color: #687e5f; background: #f1f6ee; border-radius: 14px; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }.disclosure-button { display: flex; width: 100%; justify-content: space-between; gap: 10px; min-height: 44px; margin: 0; padding: 0; background: transparent; text-align: left; color: #735480; font-size: 13px; line-height: 1.8; white-space: normal; }.source-panel { padding-top: 12px; padding-bottom: 12px; }.source-content { padding-bottom: 8px; }.footer-note { display: block; text-align: center; padding: 4px 0 24px; color: #a28cad; font-size: 11px; line-height: 1.9; }
@media (max-width: 350px) { .panel { padding: 14px; }.page-heading { font-size: 24px; }.intro-cat { width: 68px; }.palace { padding: 8px 2px; }.palace-god { font-size: 9px; }.form-input, .form-textarea { padding: 10px; font-size: 12px; }.lesson-relation { font-size: 8px; } }
</style>
