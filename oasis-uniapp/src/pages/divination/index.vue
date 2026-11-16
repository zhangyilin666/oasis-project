<template>
  <view class="page-shell divination-page">
    <view class="intro"><view><text class="eyebrow">卜 · 理清眼前的事</text><text class="page-heading">问一卦</text><text class="page-caption">一个具体的问题，一份 AI 解读。</text></view><CatCompanion class="intro-cat" :mood="aiBusy ? 'thinking' : result ? 'complete' : 'welcome'" /></view>
    <view class="journey-guide"><text>写下问题</text><text aria-hidden="true">→</text><text>选择方式</text><text aria-hidden="true">→</text><text>阅读解读</text></view>
    <text v-if="DEMO_MODE" class="demo-note">离线体验模式 · 起卦与 AI 解读请使用正式在线版本</text>

    <view id="question-form" class="panel">
      <view class="form-group"><text class="form-label">此刻想问什么</text><text class="small-copy question-hint">一次只问一件事，写清你关心的选择或困惑。</text>
<!-- #ifndef MP-WEIXIN -->
<textarea v-model="question" v-input-label="'记录问题，最多 200 字'" :disabled="aiBusy" class="question-input" :maxlength="200" placeholder="例如：面对这次合作，我有哪些事情需要先确认？" aria-label="记录问题，最多 200 字" />
<!-- #endif -->
<!-- #ifdef MP-WEIXIN -->
<textarea v-model="question" :disabled="aiBusy" class="question-input" :maxlength="200" placeholder="例如：面对这次合作，我有哪些事情需要先确认？" aria-label="记录问题，最多 200 字" />
<!-- #endif -->
<text class="small-copy counter">{{ question.length }} / 200</text></view>
      <AppButton ref="methodTrigger" class="method-selector" :disabled="aiBusy" :aria-expanded="methodsOpen" aria-label="选择起卦方式" @click="methodsOpen = !methodsOpen"><view><text class="selector-label">起卦方式</text><text class="selector-value">{{ methodLabels[method] }}<text v-if="method === 'liuyao-coins'" class="recommended">推荐</text></text></view><text class="selector-action">{{ methodsOpen ? '收起 −' : '更换 ＋' }}</text></AppButton>
      <view v-if="methodsOpen" class="method-tabs" role="group" aria-label="可选起卦方式"><AppButton v-for="option in methodOptions" :key="option.value" :disabled="aiBusy" :class="{ selected: method === option.value }" :aria-pressed="method === option.value" @click="selectMethod(option.value)"><text class="option-title">{{ option.label }}<text v-if="method === option.value" aria-hidden="true"> ✓</text></text><text class="option-hint">{{ methodHints[option.value] }}</text></AppButton></view>
      <text class="small-copy method-brief">{{ methodNotes[method] }}</text>
      <AppButton class="disclosure-button form-disclosure" :disabled="aiBusy" :aria-expanded="timeOpen" @click="timeOpen = !timeOpen"><text>{{ automaticTime ? '按当前时间起卦' : `${questionDate} ${questionTime}` }}</text><text>{{ timeOpen ? '收起 −' : '调整时间 ＋' }}</text></AppButton>
      <view v-if="timeOpen" class="time-settings"><view class="date-time-grid"><view class="form-group"><text class="form-label">问事日期 · 公历</text><picker :disabled="aiBusy" mode="date" :value="questionDate" start="1900-01-01" end="2099-12-31" @change="setDate($event.detail.value)" aria-label="选择问事日期"><view class="form-picker">{{ questionDate }}</view></picker></view><view class="form-group"><text class="form-label">问事时间</text><picker :disabled="aiBusy" mode="time" :value="questionTime" @change="setTime($event.detail.value)" aria-label="选择问事时间"><view class="form-picker">{{ questionTime }}</view></picker></view></view><view class="form-group"><text class="form-label">问事地 UTC 偏移</text><picker :disabled="aiBusy" mode="selector" :range="offsetLabels" :value="offsetValues.indexOf(utcOffset)" @change="setOffset(Number($event.detail.value))" aria-label="选择问事地 UTC 偏移"><view class="form-picker">{{ formatOffset(utcOffset) }}</view></picker><text class="small-copy">默认 UTC+08:00；请选择当时实际偏移，包含夏令时。这里不自动查询历史时区。</text><AppButton class="text-button" :disabled="aiBusy" @click="useCurrentTime">改用当前时刻</AppButton></view></view>

      <view v-if="method === 'liuyao-manual' || method === 'liuyao-najia'" class="line-inputs"><text class="form-label">填入你已投出的六次结果</text><text class="small-copy">从最下面的初爻开始。三枚硬币每次相加：字面计 2、背面计 3。没有实物结果时，改选“自动三钱起卦”即可。</text><view v-for="(line, index) in lineValues" :key="index" class="line-input-row"><text class="line-label">{{ lineLabels[index] }}</text><view class="line-options" role="group" :aria-label="`${lineLabels[index]}爻值`"><AppButton v-for="value in possibleLines" :disabled="aiBusy" :key="value" :class="{ selected: line === value }" :aria-pressed="line === value" :aria-label="`${lineLabels[index]}，${value}，${lineValueLabels[value]}`" @click="lineValues[index] = value">{{ value }}<text class="line-value-name">{{ lineValueLabels[value] }}</text></AppButton></view></view></view>
      <view v-else-if="method === 'meihua-two-numbers'" class="number-inputs"><view class="form-group"><text class="form-label">第一数 · 取上卦</text>
<!-- #ifndef MP-WEIXIN -->
<input v-model="firstNumber" v-input-label="'第一数，1 至 999999 的整数'" :disabled="aiBusy" class="form-input" type="number" :maxlength="6" placeholder="1 至 999999" aria-label="第一数，1 至 999999 的整数" />
<!-- #endif -->
<!-- #ifdef MP-WEIXIN -->
<input v-model="firstNumber" :disabled="aiBusy" class="form-input" type="number" :maxlength="6" placeholder="1 至 999999" aria-label="第一数，1 至 999999 的整数" />
<!-- #endif -->
</view><view class="form-group"><text class="form-label">第二数 · 取下卦</text>
<!-- #ifndef MP-WEIXIN -->
<input v-model="secondNumber" v-input-label="'第二数，1 至 999999 的整数'" :disabled="aiBusy" class="form-input" type="number" :maxlength="6" placeholder="1 至 999999" aria-label="第二数，1 至 999999 的整数" />
<!-- #endif -->
<!-- #ifdef MP-WEIXIN -->
<input v-model="secondNumber" :disabled="aiBusy" class="form-input" type="number" :maxlength="6" placeholder="1 至 999999" aria-label="第二数，1 至 999999 的整数" />
<!-- #endif -->
</view></view>
      <text v-if="errorMessage" class="error-note" role="alert">{{ errorMessage }}</text>
      <AppButton class="btn-primary" :disabled="aiBusy || DEMO_MODE || aiState.phase === 'completed'" @click="startWithAI">{{ primaryLabel }}</AppButton>
      <text class="small-copy submit-copy">{{ result ? '解读自动保存在下方「我的问卦记录」，重试会沿用这次卦象。' : '起卦后自动生成解读，稍后可在本页回看。' }}</text>
      <text class="privacy-note">提交会将本次问题、起卦资料与卦象发送给 AI，并保存到当前账号。</text>
    </view>

    <view v-if="result" id="divination-result" class="panel result-panel">
      <text class="eyebrow">{{ methodLabels[result.input.method] }} · 卦象结果</text><text class="panel-title question-title" selectable>{{ result.input.question }}</text>
      <text class="small-copy receipt">{{ result.input.date }} {{ result.input.time }} · {{ formatOffset(result.input.utcOffset) }}</text><text class="small-copy">{{ result.movingLines.length ? `动爻：${result.movingLines.map(line => lineLabels[line - 1]).join('、')}` : '无动爻，本卦与变卦相同。' }}</text>
      <view class="result-summary"><text>{{ result.original.name }}</text><text class="small-copy">{{ result.movingLines.length ? `变卦 · ${result.changed.name}` : '本次无动爻' }}</text></view>
      <DivinationAIReading :state="aiState" :demo="DEMO_MODE" :disabled="aiBusy" @request="requestAI" @retry="retryAI" @refresh="refreshAI" />
      <AppButton class="disclosure-button result-disclosure" :aria-expanded="detailsOpen" @click="detailsOpen = !detailsOpen"><text>卦象与起卦细节</text><text aria-hidden="true">{{ detailsOpen ? '−' : '＋' }}</text></AppButton>
      <view v-if="detailsOpen" class="result-details">
      <view v-if="result.input.method === 'liuyao-coins'" class="coin-receipt"><text class="form-label">这次模拟的六次三钱</text><text class="small-copy">由下而上；字面计 2、背面计 3，相加为爻值。这是软件模拟，不是实物投币。</text><view v-for="(coins, index) in result.input.coins" :key="index" class="coin-row"><text>{{ lineLabels[index] }}</text><text>{{ coins.join(' + ') }} = {{ result.input.lines[index] }}</text></view></view>
      <view v-if="result.calendar" class="calendar-receipt"><text class="small-copy">演算时间：{{ result.calendar.beijingTime }}</text><text class="small-copy">农历：{{ result.calendar.lunar.label }} · {{ result.calendar.timeBranch }}时</text><text v-if="result.calendar.lunar.isLeapMonth" class="small-copy">本次为闰月，按同名月份取 {{ result.calendar.numbers.month }} 数。</text></view>
      <view class="hexagram-grid"><view v-for="item in resultHexagrams" :key="item.label" class="hexagram-card"><text class="hexagram-label">{{ item.label }}</text><text class="hexagram-name">{{ item.hexagram.name }} <text class="hexagram-number">第 {{ item.hexagram.number }} 卦</text></text><view class="hexagram-drawing" role="img" :aria-label="`${item.label}${item.hexagram.name}，自下而上${item.hexagram.lines.map(line => line ? '阳' : '阴').join('、')}`"><view v-for="line in displayedLines(item.hexagram)" :key="line.position" class="drawn-line"><text class="line-position">{{ line.position }}</text><view class="line-strokes" :class="{ yin: line.value === 0, moving: item.label === '本卦' && result.movingLines.includes(line.position) }"><view /><view /></view><text class="moving-mark" aria-hidden="true">{{ item.label === '本卦' && result.movingLines.includes(line.position) ? '动' : '' }}</text></view></view><text class="trigram-copy">上 {{ item.hexagram.upper.name }}·{{ item.hexagram.upper.image }}<br />下 {{ item.hexagram.lower.name }}·{{ item.hexagram.lower.image }}</text></view></view>
      <view v-if="result.najia" class="najia-result">
        <view class="najia-summary">
          <text class="panel-title">{{ result.najia.palace.name }}宫 · {{ result.najia.palace.element }} · {{ result.najia.palace.stage }}</text>
          <text class="small-copy">世 {{ lineLabels[result.najia.palace.shiPosition - 1] }} · 应 {{ lineLabels[result.najia.palace.yingPosition - 1] }}</text>
          <text class="najia-date">{{ result.najia.calendar.monthBranch }}月建 · {{ result.najia.calendar.dayGanzhi }}日</text>
          <text class="small-copy">{{ result.najia.xun }}旬 · 旬空 {{ result.najia.voidBranches.join('、') }}</text>
          <text class="small-copy">演算时间：{{ result.najia.calendar.beijingTime }}</text>
          <text class="small-copy">本月起于{{ result.najia.calendar.monthStart.name }}：{{ result.najia.calendar.monthStart.beijingTime }}</text>
          <text class="small-copy">下月起于{{ result.najia.calendar.nextMonthStart.name }}：{{ result.najia.calendar.nextMonthStart.beijingTime }}</text>
        </view>
        <text class="section-title calculation-title">逐爻装卦</text>
        <text class="small-copy">由上爻向下排列。变出只列动爻；变爻六亲仍依本卦宫五行。</text>
        <view v-for="line in displayedNajiaLines" :key="line.position" class="najia-line-card" :class="{ 'has-move': line.isMoving }">
          <view class="najia-line-heading"><text>{{ lineLabels[line.position - 1] }} · {{ line.spirit }}</text><text v-if="line.role" class="najia-role">{{ line.role }}</text><text v-if="line.isMoving" class="najia-moving">动</text></view>
          <view class="najia-line-identity"><text>{{ line.kin }} {{ line.ganzhi }}{{ line.element }}</text><text class="najia-polarity">{{ line.value ? '阳' : '阴' }}</text><text v-if="line.isVoid" class="najia-void">旬空</text></view>
          <text v-if="line.changed" class="najia-detail">变出 → {{ line.changed.kin }} {{ line.changed.ganzhi }}{{ line.changed.element }} · {{ line.changed.value ? '阳' : '阴' }}{{ line.changed.isVoid ? ' · 旬空' : '' }}</text>
          <text v-if="line.hidden" class="najia-detail hidden-detail">伏神候选：{{ line.hidden.kin }} {{ line.hidden.ganzhi }}{{ line.hidden.element }}{{ line.hidden.isVoid ? ' · 旬空' : '' }}<br />同位飞神：{{ line.kin }} {{ line.ganzhi }}{{ line.element }}</text>
        </view>
        <text class="small-copy">{{ result.najia.missingKin.length ? `本卦缺${result.najia.missingKin.join('、')}，以上按同位列出全部候选，尚未选用神。` : '本卦五类六亲俱全，按缺亲规则不列伏神候选。' }}</text>
      </view>
      <view v-if="result.bodyUse" class="body-use"><text class="panel-title">{{ result.bodyUse.relation }}</text><text>体：{{ result.bodyUse.bodyPosition }} {{ result.bodyUse.body.name }} · {{ result.bodyUse.body.element }}</text><text>用：{{ result.bodyUse.usePosition }} {{ result.bodyUse.use.name }} · {{ result.bodyUse.use.element }}</text><text class="small-copy">显示传统五行的关系方向，留给你对照与记录，不据此自动判断现实成败。</text></view>
      <text class="section-title calculation-title">这次是怎样算出的</text><text v-for="step in result.calculation" :key="step" class="calculation-step">{{ step }}</text>
      <view v-if="result.calendar" class="calendar-result-rules"><text class="section-title calculation-title">本次规则与出处</text><text v-for="convention in result.calendar.conventions" :key="convention" class="small-copy">{{ convention }}</text><text class="small-copy">规则 {{ result.ruleVersion }} · 历法 {{ result.calendar.engine.name }} {{ result.calendar.engine.version }}</text><view v-for="source in result.calendar.sources" :key="source.url" class="source-link"><AppButton class="text-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton></view></view>
      <view v-if="result.najia" class="calendar-result-rules"><text class="section-title calculation-title">本次规则与出处</text><text v-for="convention in result.najia.conventions" :key="convention" class="small-copy">{{ convention }}</text><text class="small-copy">规则 {{ result.ruleVersion }} · 历法 {{ result.najia.calendar.engine.name }} {{ result.najia.calendar.engine.version }}</text><view v-for="source in result.najia.sources" :key="source.url" class="source-link"><AppButton class="text-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton></view></view>
      </view>
      <AppButton class="btn-secondary new-question" :disabled="aiBusy" @click="startNewQuestion">再问一件事</AppButton>
    </view>

    <view id="cloud-reading-history" class="panel cloud-history">
      <AppButton class="disclosure-button history-heading" :aria-expanded="historyOpen" @click="historyOpen = !historyOpen"><view><text class="panel-title">我的问卦记录</text><text class="small-copy">{{ cloudLoading ? '正在读取…' : cloudError ? '记录暂未加载，展开后重试' : cloudTotal ? `${cloudTotal} 条解读 · 自动保存，可随时回看` : '解读完成后会出现在这里' }}</text></view><text aria-hidden="true">{{ historyOpen ? '−' : '＋' }}</text></AppButton>
      <view v-if="historyOpen" class="history-content">
      <AppButton class="text-button" :disabled="cloudLoading || DEMO_MODE" @click="loadCloudHistory()">刷新记录</AppButton>
      <text v-if="DEMO_MODE" class="small-copy empty-note">离线体验模式不请求云端历史，也不提供示例 AI 解读。</text>
      <template v-else>
        <text v-if="dailyLimit !== null" class="cloud-quota">{{ remainingToday === null ? '今日解读次数不限' : `今日还可提交 ${remainingToday} 次 · 每日 ${dailyLimit} 次` }}</text>
        <text v-if="cloudLoading" class="small-copy" role="status" aria-live="polite">正在读取云端记录…</text>
        <text v-if="cloudError" class="error-note" role="alert">{{ cloudError }}</text>
        <text v-if="!cloudRecords.length && !cloudLoading && !cloudError" class="small-copy empty-note">还没有云端记录。点击 AI 解读后，可在这里回看处理进度和结果。</text>
        <view v-for="record in cloudRecords" :key="record.reading_id" class="record-row"><AppButton class="record-open" :disabled="aiState.phase === 'submitting'" @click="openCloudRecord(record.reading_id)"><text class="record-question">{{ record.question }}</text><text class="small-copy">{{ record.original_name }} → {{ record.changed_name }} · {{ statusLabels[record.status] }}</text><text class="record-method">{{ displayDate(record.created_at) }} · 回看 ↗</text></AppButton><AppButton v-if="record.status === 'completed' || record.status === 'failed'" class="text-button delete-button" :disabled="cloudActionId !== null" :aria-label="`删除云端解读：${record.question}`" @click="confirmDeleteCloud(record)">{{ cloudActionId === record.reading_id ? '删除中' : '删除' }}</AppButton></view>
        <view v-if="cloudTotal > 20" class="history-pages"><AppButton class="text-button" :disabled="cloudLoading || cloudSkip === 0" @click="loadCloudHistory(Math.max(0, cloudSkip - 20))">上一页</AppButton><text>{{ Math.floor(cloudSkip / 20) + 1 }} / {{ Math.ceil(cloudTotal / 20) }}</text><AppButton class="text-button" :disabled="cloudLoading || cloudSkip + 20 >= cloudTotal" @click="loadCloudHistory(cloudSkip + 20)">下一页</AppButton></view>

      </template>
      <text v-if="cloudNotice" class="notice" role="status" aria-live="polite">{{ cloudNotice }}</text>
      </view>
    </view>

    <view class="panel source-panel"><AppButton class="disclosure-button" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen"><text>计算约定与古籍来源</text><text aria-hidden="true">{{ sourcesOpen ? '−' : '＋' }}</text></AppButton><view v-if="sourcesOpen"><text class="small-copy">先天卦数：乾 1、兑 2、离 3、震 4、巽 5、坎 6、艮 7、坤 8。除 8 余 0 取坤，除 6 余 0 取上爻。</text><text class="small-copy">两数简化法为本工具的明确约定；不是古籍所有起例的统一规则。问事时间不参与此法的计算。</text><text class="small-copy">互卦统一取本卦 2、3、4 爻为下互，3、4、5 爻为上互；乾坤同样取本卦结构，不采用“乾坤无互，互其变卦”的另一约定。体用仅取本卦。</text><text class="small-copy">六爻手录保留基础卦象；另选“六爻纳甲”可装八宫、世应、纳甲、六亲、缺亲伏神候选、月建日辰、六神与旬空。程序未自动选用神、判断旺衰或推定应期；AI 区结合经文提供独立的文化解读。</text><view v-for="source in DIVINATION_SOURCES" :key="source.url" class="source-link"><AppButton class="text-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton></view><text class="small-copy">卦名采用简体字；第 33 卦“遯”显示为“遁”。爻画直接绘制，避免字体缺字。六爻与两数法规则版本 divination-v1；纳甲规则版本 liuyao-najia-v1（十二节交接换月、00:00 换日）；梅花时间法规则版本 meihua-calendar-v1，按固定 UTC+8、农历春节换年、00:00 换日，闰月取同月数。</text></view></view>
    <text class="footer-note">以传统文化为参照，把问题留给思考，把决定留给自己。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import DivinationAIReading from '@/components/metaphysics/DivinationAIReading.vue'
import { DEMO_MODE } from '@/config/env'
import { createDivinationReading, getDivinationReading, getDivinationHistory, deleteDivinationReading, type DivinationReadingSummary } from '@/api/divination'
import { createReadingSession, createDivinationRequestId, type ReadingSessionState } from '@/domain/divination/reading-session'
import { calculateDivination, DIVINATION_SOURCES, parseMeihuaNumber, type DivinationInput, type DivinationMethod, type DivinationResult, type Hexagram, type LineValue } from '@/domain/divination'
import { generateCoinInput } from '@/domain/divination/coins'

const method = ref<DivinationMethod>('liuyao-coins'), question = ref(''), questionDate = ref(''), questionTime = ref(''), utcOffset = ref(8)
const methodTrigger = ref<{ $el?: HTMLElement } | null>(null)
const methodsOpen = ref(false), timeOpen = ref(false), automaticTime = ref(true)
const detailsOpen = ref(false), historyOpen = ref(false)
const methodLabels: Record<DivinationMethod, string> = { 'liuyao-coins': '自动三钱起卦', 'liuyao-manual': '六爻手录', 'liuyao-najia': '六爻纳甲', 'meihua-two-numbers': '梅花两数', 'meihua-calendar': '梅花时间' }
const methodOptions = (['liuyao-coins', 'meihua-calendar', 'meihua-two-numbers', 'liuyao-manual', 'liuyao-najia'] as DivinationMethod[]).map(value => ({ value, label: methodLabels[value] }))
const methodHints: Record<DivinationMethod, string> = {
  'liuyao-coins': '不用准备，系统模拟投币',
  'meihua-calendar': '按问事时刻自动起卦',
  'meihua-two-numbers': '用你想到的两个数字',
  'liuyao-manual': '已有六次投币结果时选',
  'liuyao-najia': '熟悉六爻装卦时选',
}
const methodNotes: Record<DivinationMethod, string> = {
  'liuyao-coins': '第一次使用选这个即可：系统模拟六次投币，自动起卦并解读。',
  'liuyao-manual': '填入六次爻值，AI 会结合问题解读卦意；无需自己排卦。',
  'liuyao-najia': '填入六次爻值，附加世应、六亲等装卦信息。AI 仍以卦象与经文解读为主。',
  'meihua-two-numbers': '想好两个 1–999999 的整数，依次填入；我们按两数法起卦。',
  'meihua-calendar': '无需准备数字，按起卦时的年月日时自动生成卦象。',
}
function selectMethod(value: DivinationMethod) {
  method.value = value; methodsOpen.value = false
  // #ifdef H5
  nextTick(() => methodTrigger.value?.$el?.focus?.({ preventScroll: true }))
  // #endif
}
function startNewQuestion() {
  if (aiBusy.value) return
  readingSession.invalidate(); result.value = null; question.value = ''
  errorMessage.value = ''; detailsOpen.value = false; timeOpen.value = false
  methodsOpen.value = false; firstNumber.value = ''; secondNumber.value = ''; lineValues.value = [null, null, null, null, null, null]
  useCurrentTime()
  nextTick(() => uni.pageScrollTo({ selector: '#question-form', duration: 250 }))
}
const firstNumber = ref(''), secondNumber = ref(''), lineValues = ref<(LineValue | null)[]>([null, null, null, null, null, null])
const possibleLines: LineValue[] = [6, 7, 8, 9]
const lineLabels = ['初爻（下）', '二爻', '三爻', '四爻', '五爻', '上爻（上）']
const lineValueLabels = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' }
const offsetValues = Array.from({ length: 105 }, (_, index) => -12 + index / 4)
const offsetLabels = offsetValues.map(formatOffset)
const result = ref<DivinationResult | null>(null), errorMessage = ref(''), sourcesOpen = ref(false)
const aiState = ref<ReadingSessionState>({ phase: 'idle', reading: null, error: '' })
const aiBusy = computed(() => ['submitting', 'loading', 'watching'].includes(aiState.value.phase))
const primaryLabel = computed(() => {
  if (DEMO_MODE) return 'AI 解读仅在正式在线版本中可用'
  if (aiBusy.value) return '正在为这次卦象准备解读…'
  if (aiState.value.phase === 'completed') return '这次 AI 解读已完成'
  if (aiState.value.phase === 'failed') return '保留这卦，重试 AI 解读'
  if (aiState.value.phase === 'submit-error') return '继续确认这次提交'
  if (aiState.value.phase === 'read-error' || aiState.value.phase === 'paused') return '刷新这条解读'
  return result.value ? '请 AI 解读这次卦象' : '一键起卦并解读'
})
const cloudRecords = ref<DivinationReadingSummary[]>([]), cloudLoading = ref(false), cloudError = ref(''), cloudNotice = ref('')
const cloudSkip = ref(0), cloudTotal = ref(0), dailyLimit = ref<number | null>(null), remainingToday = ref<number | null>(null)
const cloudActionId = ref<number | null>(null)
const statusLabels = { pending: '等待解读', processing: '解读中', completed: '已完成', failed: '未完成' }
let historyGeneration = 0, pageVisible = true, restoring = false, lastCloudSignal = ''
const readingSession = createReadingSession({
  create: createDivinationReading, read: getDivinationReading, newRequestId: createDivinationRequestId,
  onChange(state) {
    aiState.value = state
    const signal = state.reading ? `${state.reading.reading_id}:${state.reading.status}` : ''
    if (signal && signal !== lastCloudSignal && pageVisible && !DEMO_MODE) { lastCloudSignal = signal; void loadCloudHistory() }
  },
})
const resultHexagrams = computed(() => result.value ? [
  { label: '本卦', hexagram: result.value.original }, { label: '变卦', hexagram: result.value.changed },
  ...(result.value.mutual ? [{ label: '互卦', hexagram: result.value.mutual }] : []),
] : [])

const displayedNajiaLines = computed(() => result.value?.najia ? [...result.value.najia.lines].reverse() : [])

function formatOffset(value: number) { const minutes = Math.round(Math.abs(value) * 60); return `UTC${value < 0 ? '−' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` }
function fillCurrentTime() { const local = new Date(Date.now() + utcOffset.value * 3600000).toISOString(); questionDate.value = local.slice(0, 10); questionTime.value = local.slice(11, 16) }
function useCurrentTime() { automaticTime.value = true; fillCurrentTime() }
function setDate(value: string) { automaticTime.value = false; questionDate.value = value }
function setTime(value: string) { automaticTime.value = false; questionTime.value = value }
function setOffset(index: number) { if (offsetValues[index] !== undefined) utcOffset.value = offsetValues[index]; if (automaticTime.value) fillCurrentTime() }
function displayedLines(hexagram: Hexagram) { return hexagram.lines.map((value, index) => ({ value, position: index + 1 })).reverse() }
function message(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试。' }
function calculate() {
  if (aiBusy.value) return null
  readingSession.invalidate()
  errorMessage.value = ''; result.value = null
  try {
    if (automaticTime.value) fillCurrentTime()
    const context = { question: question.value, date: questionDate.value, time: questionTime.value, utcOffset: utcOffset.value }
    const input = method.value === 'liuyao-coins' ? generateCoinInput(context)
      : (method.value === 'liuyao-manual' || method.value === 'liuyao-najia') ? { ...context, method: method.value, lines: lineValues.value }
      : method.value === 'meihua-two-numbers' ? { ...context, method: method.value, numbers: [parseMeihuaNumber(firstNumber.value), parseMeihuaNumber(secondNumber.value)] }
        : { ...context, method: method.value }
    result.value = calculateDivination(input)
    nextTick(() => uni.pageScrollTo({ selector: '#divination-result', duration: 250 }))
    return result.value
  } catch (error) { errorMessage.value = message(error); return null }
}
async function startWithAI() {
  if (DEMO_MODE || aiBusy.value) return
  if (aiState.value.phase === 'failed' || aiState.value.phase === 'submit-error') { await retryAI(); return }
  if (aiState.value.phase === 'read-error' || aiState.value.phase === 'paused') { await refreshAI(); return }
  if (!result.value && !calculate()) return
  await requestAI()
}
async function requestAI() {
  if (!result.value || aiBusy.value || DEMO_MODE) return
  await readingSession.submit(result.value.input, result.value.ruleVersion)
}
async function retryAI() {
  if (aiState.value.phase === 'submit-error') { await requestAI(); return }
  await readingSession.retry()
}
async function refreshAI() { await readingSession.refresh() }
function restoreInput(input: DivinationInput) {
  restoring = true
  try {
    method.value = input.method; question.value = input.question; questionDate.value = input.date; questionTime.value = input.time; utcOffset.value = input.utcOffset
    automaticTime.value = false
    if (input.method === 'liuyao-manual' || input.method === 'liuyao-najia') lineValues.value = [...input.lines]
    else if (input.method === 'meihua-two-numbers') { firstNumber.value = String(input.numbers[0]); secondNumber.value = String(input.numbers[1]) }
    methodsOpen.value = false; detailsOpen.value = false
  } finally { restoring = false }
}
async function loadCloudHistory(skip = cloudSkip.value) {
  if (DEMO_MODE) return
  const generation = ++historyGeneration
  cloudLoading.value = true; cloudError.value = ''
  try {
    const response = await getDivinationHistory(skip, 20)
    if (generation !== historyGeneration || !pageVisible) return
    cloudRecords.value = response.readings; cloudSkip.value = response.skip; cloudTotal.value = response.total
    dailyLimit.value = response.daily_limit; remainingToday.value = response.remaining_today
  } catch (error) { if (generation === historyGeneration && pageVisible) cloudError.value = message(error) }
  finally { if (generation === historyGeneration) cloudLoading.value = false }
}
async function openCloudRecord(id: number) {
  cloudError.value = ''; cloudNotice.value = ''; result.value = null
  const reading = await readingSession.open(id)
  if (!reading) {
    if (aiState.value.phase === 'read-error' && !aiState.value.reading) {
      cloudError.value = aiState.value.error
      readingSession.invalidate()
    }
    return
  }
  try {
    const restored = calculateDivination(reading.input, reading.rule_version)
    restoreInput(restored.input)
    result.value = restored; errorMessage.value = ''
    nextTick(() => uni.pageScrollTo({ selector: '#divination-result', duration: 250 }))
  } catch (error) { cloudError.value = message(error); readingSession.invalidate() }
}
function confirmDeleteCloud(record: DivinationReadingSummary) {
  if (record.status === 'pending' || record.status === 'processing' || cloudActionId.value !== null) return
  uni.showModal({ title: '删除这条云端解读？', content: '将清除这条问题、卦象和 AI 解读，删除后无法恢复。', confirmText: '删除', cancelText: '保留', success: async response => {
    if (!response.confirm) return
    cloudActionId.value = record.reading_id; cloudError.value = ''
    try {
      await deleteDivinationReading(record.reading_id)
      if (aiState.value.reading?.reading_id === record.reading_id) { readingSession.invalidate(); result.value = null }
      cloudNotice.value = '这条云端解读已删除。'
      await loadCloudHistory(cloudRecords.value.length === 1 && cloudSkip.value >= 20 ? cloudSkip.value - 20 : cloudSkip.value)
    } catch (error) { cloudError.value = message(error) }
    finally { cloudActionId.value = null }
  } })
}
function displayDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN') }
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, fail: () => { uni.showToast({ title: '链接复制失败，请稍后重试', icon: 'none' }) } })
  // #endif
}
watch([method, question, questionDate, questionTime, utcOffset, automaticTime, firstNumber, secondNumber, lineValues], () => {
  if (restoring) return
  result.value = null; errorMessage.value = ''; detailsOpen.value = false
  readingSession.invalidate()
}, { deep: true, flush: 'sync' })
onLoad(query => {
  const selected = query?.method
  if (typeof selected === 'string' && methodOptions.some(item => item.value === selected)) { method.value = selected as DivinationMethod; methodsOpen.value = false }
})
onShow(() => { pageVisible = true; readingSession.resume(); void loadCloudHistory() })
onHide(() => { pageVisible = false; historyGeneration++; cloudLoading.value = false; readingSession.pause() })
onUnmounted(() => { pageVisible = false; historyGeneration++; readingSession.dispose() })
fillCurrentTime()
</script>

<style scoped>
.history-jump { font-size: 12px; padding-left: 0; margin: -10px 0 16px; }
.demo-note { display: block; margin-bottom: 18px; padding: 11px 13px; background: #fbf1df; color: #96764b; border-radius: 12px; font-size: 11px; line-height: 1.9; }.current-method { margin: 5px 0 12px; padding: 12px 14px; border-radius: 12px; background: #f4eef9; color: #826591; font-size: 13px; line-height: 1.8; }.form-disclosure { text-align: left; align-items: center; margin: 5px 0; white-space: normal; }.method-brief { margin: 0 0 12px; }.time-settings { padding-top: 16px; }.submit-copy { text-align: center; font-size: 10px; }.coin-receipt { margin-top: 18px; padding: 14px; background: #f8f4fa; border-radius: 13px; }.coin-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 8px; font-size: 11px; color: #8e749b; line-height: 1.8; }.coin-row text:last-child { color: #705581; font-variant-numeric: tabular-nums; }.cloud-quota { display: block; color: #978063; font-size: 11px; line-height: 1.8; margin: 12px 0; }.cloud-history .record-heading { align-items: flex-start; }.cloud-history .record-heading > view { min-width: 0; }.cloud-history .record-heading > button { flex-shrink: 0; font-size: 12px; }.history-pages { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; color: #9a84a7; margin-top: 14px; }.history-pages button { font-size: 12px; }.divination-page .btn-primary { font-size: 14px; white-space: normal; }
.divination-page { padding-bottom: 42px; }.intro { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 20px; }.intro > view { min-width: 0; }.intro .page-heading { font-size: 25px; line-height: 1.55; }.intro .page-caption { font-size: 12px; line-height: 1.8; }.intro-cat { width: 110px; height: 110px; }.privacy-note { display: block; font-size: 11px; line-height: 1.8; color: #61705e; margin-bottom: 20px; }
.panel { background: #fff; border: 1px solid #eee7f4; border-radius: 22px; padding: 20px; margin-bottom: 20px; }.panel-title { display: block; font-size: 17px; line-height: 1.65; font-weight: 600; color: #473b58; }.small-copy { display: block; font-size: 11px; line-height: 1.9; color: #776b83; margin-top: 6px; }.scope-note { display: block; background: #f7f3fa; color: #73637f; padding: 12px; margin: 16px 0 22px; border-radius: 12px; font-size: 12px; line-height: 1.9; }.method-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }.method-tabs button { margin: 0; width: 100%; min-height: 46px; border-radius: 13px; font-size: 14px; color: #786687; background: #faf7fc; line-height: 1.7; padding: 10px 4px; }.method-tabs button.selected, .line-options button.selected { color: #61428b; background: #ece3f7; border-color: #a88bc5; }
.question-input { display: block; width: 100%; min-height: 94px; height: 94px; box-sizing: border-box; padding: 12px 14px; border: 1px solid #e7dfee; background: #fbf9fd; border-radius: 14px; font-size: 14px; line-height: 1.8; color: #51445e; }.counter { text-align: right; }.date-time-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 10px; }.date-time-grid .form-picker { font-size: 14px; padding: 0 10px; }.form-group { margin-bottom: 20px; }.form-label { font-size: 13px; }.line-inputs { margin: 4px 0 24px; }.line-input-row { display: flex; align-items: center; gap: 8px; padding-top: 10px; }.line-label { flex: 0 0 64px; font-size: 12px; color: #756182; }.line-options { display: grid; flex: 1; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }.line-options button { width: 100%; min-height: 44px; line-height: 1.5; margin: 0; padding: 10px 0; border: 1px solid #e9e1ef; background: #faf8fc; color: #7c6b8b; font-size: 14px; border-radius: 10px; }.number-inputs { margin-top: 6px; }.error-note { display: block; color: #98425b; background: #fcf0f3; border-radius: 12px; padding: 12px; font-size: 12px; line-height: 1.9; margin: 12px 0; }
.question-title { overflow-wrap: anywhere; }.receipt { margin-top: 14px; }.hexagram-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 22px 0; }.hexagram-card { background: #faf7fc; border: 1px solid #f0e9f6; border-radius: 16px; padding: 14px 8px; }.hexagram-label { display: block; text-align: center; font-size: 11px; color: #8b749c; margin-bottom: 6px; }.hexagram-name { display: block; text-align: center; font-size: 18px; font-weight: 600; color: #56406c; }.hexagram-number { display: block; font-size: 10px; font-weight: 400; margin-top: 4px; color: #8a7c97; }.hexagram-drawing { margin: 16px auto 12px; max-width: 128px; }.drawn-line { display: flex; align-items: center; justify-content: center; gap: 5px; height: 20px; }.line-position { width: 12px; text-align: right; color: #9a8aa6; font-size: 9px; }.line-strokes { display: flex; gap: 0; flex: 1; max-width: 72px; height: 6px; }.line-strokes > view { height: 6px; flex: 1; background: #76618b; }.line-strokes.yin { gap: 10px; }.line-strokes.moving > view { background: #b77d41; }.moving-mark { width: 12px; color: #a06e39; font-size: 10px; }.trigram-copy { display: block; font-size: 11px; line-height: 1.85; text-align: center; color: #7c6b88; }.body-use { padding: 14px; background: #f5effa; border-radius: 14px; margin-bottom: 20px; }.body-use > text { display: block; font-size: 13px; line-height: 1.9; color: #735980; }.body-use .panel-title { font-size: 17px; margin-bottom: 5px; }.body-use .small-copy { font-size: 11px; color: #8b7595; }.calculation-title { font-size: 14px; margin: 4px 0 12px; }.calculation-step { display: block; font-size: 12px; line-height: 1.9; color: #786984; margin-bottom: 8px; }.save-button { margin-top: 20px; font-size: 14px; }
.record-heading { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }.empty-note { padding: 16px 0; }.record-row { display: flex; align-items: center; gap: 8px; border-top: 1px solid #f1eaf6; margin-top: 12px; padding-top: 12px; }.record-open { display: block; min-width: 0; flex: 1; margin: 0; padding: 4px 0; text-align: left; white-space: normal; background: transparent; line-height: 1.7; }.record-question { display: block; font-size: 14px; color: #655073; overflow-wrap: anywhere; }.record-method { display: block; color: #947eaa; font-size: 11px; margin-top: 6px; }.delete-button { font-size: 12px; color: #a36177; flex-shrink: 0; }.export-button { margin-top: 18px; font-size: 13px; }.notice { display: block; color: #60785b; background: #f0f5ef; padding: 10px; margin-top: 12px; border-radius: 10px; font-size: 12px; line-height: 1.85; }.source-panel { padding-top: 12px; padding-bottom: 12px; }.disclosure-button { display: flex; justify-content: space-between; gap: 12px; width: 100%; padding: 0; min-height: 44px; background: transparent; color: #6b5683; font-size: 13px; line-height: 1.8; }.source-link { margin-top: 7px; }.source-link button { justify-content: flex-start; white-space: normal; text-align: left; font-size: 11px; padding-left: 0; }
@media (max-width: 360px) { .panel { padding: 16px; }.intro .page-heading { font-size: 23px; }.intro-cat { width: 86px; height: 86px; }.line-label { flex-basis: 60px; }.line-options { gap: 4px; }.hexagram-grid { gap: 8px; }.hexagram-card { padding: 12px 5px; } }
.calendar-conventions { margin: 0 0 24px; }.calendar-receipt { border-left: 3px solid #cfbcdf; padding: 4px 0 4px 12px; margin-top: 14px; }.calendar-result-rules { padding: 14px; border-radius: 14px; background: #faf7fc; margin-top: 20px; }.calendar-result-rules .small-copy, .calculation-step { overflow-wrap: anywhere; }
.najia-result { margin: 22px 0; }.najia-summary { padding: 16px; border-radius: 16px; background: #f5f0f9; margin-bottom: 22px; }.najia-summary .small-copy { overflow-wrap: anywhere; }.najia-date { display: block; font-size: 17px; color: #655078; margin: 10px 0 3px; }.najia-line-card { margin: 10px 0; padding: 14px; border: 1px solid #ebe2f0; border-radius: 14px; background: #fdfbfe; }.najia-line-card.has-move { border-color: #dbc5a6; background: #fffcf6; }.najia-line-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: #8c759d; }.najia-role, .najia-moving, .najia-void { padding: 2px 7px; border-radius: 6px; background: #ece3f4; color: #705385; font-size: 11px; }.najia-moving { background: #f6e6cb; color: #976a2c; }.najia-void { background: #edf0f5; color: #6d7483; }.najia-line-identity { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 9px; font-size: 16px; color: #604b70; }.najia-polarity { font-size: 12px; color: #9a889f; }.najia-detail { display: block; font-size: 12px; line-height: 1.9; color: #8d6b40; margin-top: 8px; overflow-wrap: anywhere; }.hidden-detail { border-top: 1px dashed #e8deed; padding-top: 8px; color: #7e698f; }
.intro { margin-bottom: 16px; }.intro .page-heading { font-size: 26px; }.intro-cat { width: 84px; height: 84px; }
.question-hint { margin: 0 0 10px; }.method-selector { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; margin: 0; padding: 14px; border: 1px solid #e5dcee; border-radius: 14px; background: #faf8fc; text-align: left; line-height: 1.7; }.selector-label { display: block; color: #776b83; font-size: 11px; }.selector-value { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: #59428e; font-size: 15px; font-weight: 600; }.recommended { padding: 1px 6px; border-radius: 6px; background: #ede5f7; font-size: 10px; font-weight: 400; }.selector-action { flex-shrink: 0; color: #7760b2; font-size: 12px; }
.method-tabs { grid-template-columns: minmax(0, 1fr); gap: 8px; margin-top: 10px; }.method-tabs button { padding: 12px 14px; text-align: left; border: 1px solid #e7dfee; border-radius: 14px; color: #625b72; background: #fff; }.method-tabs button.selected { border-color: #a18abb; background: #f0ebfa; color: #59428e; }.option-title { display: block; font-size: 14px; font-weight: 600; }.option-hint { display: block; font-size: 12px; margin-top: 3px; }.method-brief { margin: 8px 0 16px; font-size: 12px; }.line-value-name { display: block; font-size: 10px; }.line-options button { line-height: 1.6; }
.disclosure-button { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 48px; padding: 12px 14px; margin: 0; box-sizing: border-box; border: 1px solid #e7dfee; border-radius: 14px; color: #59428e; background: #faf8fc; text-align: left; white-space: normal; font-size: 12px; line-height: 1.8; }.form-disclosure { margin: 0 0 20px; }.form-disclosure > text:last-child { flex-shrink: 0; }.privacy-note { margin: 12px 0 0; color: #776b83; font-size: 11px; line-height: 1.8; }.submit-copy { font-size: 11px; }.result-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 18px 0; padding: 14px; border-radius: 14px; background: #f0ebfa; color: #59428e; font-size: 22px; font-weight: 600; }.result-summary .small-copy { margin: 0; font-weight: 400; }.result-disclosure { margin-top: 24px; }.result-details { padding-top: 14px; }.new-question { margin-top: 18px; font-size: 14px; }.history-heading { border: 0; background: transparent; padding: 0; }.history-heading .panel-title { font-size: 16px; }.history-heading > text { font-size: 18px; }.history-content { border-top: 1px solid #eee7f4; margin-top: 14px; padding-top: 10px; }.source-panel { border: 0; padding: 0; background: transparent; }.source-panel > view { padding: 14px; }
@media (max-width: 360px) { .line-input-row { flex-direction: column; align-items: stretch; gap: 6px; }.line-label { flex: none; }.line-options { width: 100%; } }
</style>
