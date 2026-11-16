<template>
  <view class="page-shell tarot-page">
    <view class="intro">
      <view><text class="eyebrow">文化探索 · 塔罗</text><text class="page-heading">把牌面留下，<br />把想法写下来。</text><text class="page-caption">78 张文字牌名 · 手动记录与复盘</text></view>
      <CatCompanion class="intro-cat" :mood="preview ? 'complete' : 'thinking'" />
    </view>
    <text class="privacy-note">本机保存 · 无随机抽牌 · 问题与笔记不上传、不发送给 AI</text>

    <view class="panel">
      <text class="panel-title">这次想记录什么</text>
      <text class="small-copy lead-copy">录入你已经选出的牌，留下当时的观察。这里是文化与个人复盘记录，不会生成预测或牌义。</text>
      <view class="form-group">
        <text class="form-label">记录问题</text>
        <textarea v-model="question" class="text-input" :maxlength="200" placeholder="例如：我想怎样整理最近的工作节奏？" aria-label="记录问题，最多 200 字" />
        <text class="small-copy counter">{{ question.length }} / 200</text>
      </view>
      <view class="form-group">
        <text class="form-label">记录日期 · 公历</text>
        <!-- #ifdef H5 -->
        <input v-model="recordDate" class="form-input" maxlength="10" placeholder="YYYY-MM-DD" aria-label="选择塔罗记录日期" />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker mode="date" :value="recordDate" start="1900-01-01" end="2099-12-31" @change="recordDate = $event.detail.value" aria-label="选择塔罗记录日期"><view class="form-picker">{{ recordDate }}</view></picker>
        <!-- #endif -->
        <AppButton class="text-button" @click="recordDate = today()">填入今天的本机日期</AppButton>
      </view>
      <view class="form-group">
        <text class="form-label">牌组说明</text>
        <input v-model="deckDescription" class="form-input" :maxlength="100" placeholder="牌组名称、版本或你的备注" aria-label="牌组说明，最多 100 字" />
        <text class="small-copy">当前选牌表采用韦特–史密斯体系。其他译名可在此备注，本次限一副牌。</text>
      </view>
      <view class="form-group">
        <text class="form-label">抽取过程 · 选填</text>
        <textarea v-model="drawNotes" class="text-input compact-input" :maxlength="200" placeholder="例如：使用自己的实体牌，洗牌后依次抽出。" aria-label="抽取过程，最多 200 字" />
      </view>

      <text class="form-label">选择牌阵</text>
      <view class="spread-tabs" role="group" aria-label="选择塔罗牌阵">
        <AppButton v-for="option in spreadOptions" :key="option.value" :class="{ selected: spreadKind === option.value }" :aria-pressed="spreadKind === option.value" @click="spreadKind = option.value">{{ option.label }}</AppButton>
      </view>
      <text class="small-copy spread-note">{{ spreadKind === 'custom' ? '依你的实际牌阵命名每个位置，保留录入顺序。' : '位置名是本工具提供的复盘提示，可用自定义牌阵填写自己的位置名。' }}</text>
      <view v-if="spreadKind === 'custom'" class="custom-spread">
        <view class="form-group"><text class="form-label">牌阵名称</text><input v-model="customSpreadName" class="form-input" :maxlength="60" placeholder="为这次牌阵取个名字" aria-label="自定义牌阵名称，最多 60 字" /></view>
        <view class="form-group"><text class="form-label">牌的张数</text>
          <!-- #ifdef H5 -->
          <select v-model.number="customCount" class="form-picker native-select" aria-label="选择 1 至 10 张牌"><option v-for="count in 10" :key="count" :value="count">{{ count }} 张</option></select>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <picker mode="selector" :range="countLabels" :value="customCount - 1" @change="customCount = Number($event.detail.value) + 1" aria-label="选择 1 至 10 张牌"><view class="form-picker">{{ customCount }} 张</view></picker>
          <!-- #endif -->
        </view>
      </view>

      <view v-for="(slot, index) in activeSlots" :key="index" class="selection-card">
        <view class="selection-heading"><text class="position-number">{{ String(index + 1).padStart(2, '0') }}</text><text>{{ positionName(index) }}</text></view>
        <view v-if="spreadKind === 'custom'" class="form-group"><text class="form-label">位置名称</text><input v-model="slot.positionName" class="form-input" :maxlength="40" :aria-label="`第 ${index + 1} 个位置名称，最多 40 字`" /></view>
        <view class="form-group">
          <text class="form-label">牌的类别</text>
          <!-- #ifdef H5 -->
          <select class="form-picker native-select" :value="groupIndex(slot.group)" :aria-label="`第 ${index + 1} 张牌的类别`" @change="changeGroup(index, nativeValue($event))"><option v-for="(group, groupPosition) in TAROT_GROUPS" :key="group.id" :value="groupPosition">{{ group.label }}</option></select>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <picker mode="selector" :range="groupLabels" :value="groupIndex(slot.group)" @change="changeGroup(index, Number($event.detail.value))" :aria-label="`第 ${index + 1} 张牌的类别`"><view class="form-picker">{{ groupLabels[groupIndex(slot.group)] }}</view></picker>
          <!-- #endif -->
        </view>
        <view class="form-group">
          <text class="form-label">手动选择牌名</text>
          <!-- #ifdef H5 -->
          <select class="form-picker native-select" :class="{ placeholder: !slot.cardId }" :value="cardOptionIndex(index)" :aria-label="`第 ${index + 1} 张牌的牌名`" @change="selectCard(index, nativeValue($event))"><option v-for="(card, cardPosition) in cardOptions(index)" :key="card.id" :value="cardPosition">{{ card.label }}</option></select>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <picker mode="selector" :range="cardOptions(index)" range-key="label" :value="cardOptionIndex(index)" @change="selectCard(index, Number($event.detail.value))" :aria-label="`第 ${index + 1} 张牌的牌名`"><view class="form-picker card-picker" :class="{ placeholder: !slot.cardId }">{{ slot.cardId ? getTarotCard(slot.cardId).name : '请选择牌名' }}</view></picker>
          <!-- #endif -->
          <text class="small-copy">{{ slot.cardId ? getTarotCard(slot.cardId).english : '已用于其他位置的牌会从列表中隐藏。' }}</text>
        </view>
        <view class="orientation-options" role="group" :aria-label="`第 ${index + 1} 张牌的正逆位`">
          <AppButton :class="{ selected: slot.orientation === 'upright' }" :aria-pressed="slot.orientation === 'upright'" @click="slot.orientation = 'upright'">↑ 正位</AppButton>
          <AppButton :class="{ selected: slot.orientation === 'reversed' }" :aria-pressed="slot.orientation === 'reversed'" @click="slot.orientation = 'reversed'">↓ 逆位</AppButton>
        </view>
        <view class="form-group card-note"><text class="form-label">这张牌的笔记 · 选填</text><textarea v-model="slot.note" class="text-input compact-input" :maxlength="500" placeholder="记下你看到的细节与自己的联想。" :aria-label="`第 ${index + 1} 张牌的个人笔记，最多 500 字`" /></view>
      </view>

      <view class="form-group overall-note"><text class="form-label">整体复盘 · 选填</text><textarea v-model="notes" class="text-input" :maxlength="2000" placeholder="这次记录带来了哪些想法？有哪些可以自己确认的行动？" aria-label="整体复盘，最多 2000 字" /><text class="small-copy counter">{{ notes.length }} / 2000</text></view>
      <text v-if="stale" class="scope-note" role="status">输入已更新，请重新整理牌阵。已保存的记录保持原样。</text>
      <text v-if="errorMessage" class="error-note" role="alert">{{ errorMessage }}</text>
      <AppButton class="btn-primary" @click="prepareRecord">整理这次牌阵</AppButton>
    </view>

    <view v-if="preview" id="tarot-preview" class="panel preview-panel">
      <text class="eyebrow">{{ preview.spread.name }} · 手录快照</text>
      <text class="panel-title question-title" selectable>{{ preview.question }}</text>
      <text class="small-copy">{{ preview.date }} · {{ preview.deckDescription }}</text>
      <text v-if="preview.drawNotes" class="small-copy preserved-text">抽取过程：{{ preview.drawNotes }}</text>
      <view class="text-cards">
        <view v-for="item in preview.cards" :key="item.position" class="text-card" :class="{ reversed: item.orientation === 'reversed' }">
          <view class="text-card-top"><text>{{ String(item.position).padStart(2, '0') }} · {{ item.positionName }}</text><text class="orientation-badge">{{ item.orientation === 'upright' ? '↑ 正位' : '↓ 逆位' }}</text></view>
          <text class="card-name">{{ item.card.name }}</text><text class="card-english">{{ item.card.english }}</text>
          <text class="small-copy">{{ groupLabels[groupIndex(item.card.group)] }}{{ item.card.majorNumber === null ? '' : ` · ${item.card.majorNumber}` }}</text>
          <text v-if="item.note" class="personal-note preserved-text" selectable>{{ item.note }}</text>
          <text v-else class="small-copy no-note">这张牌没有填写笔记。</text>
        </view>
      </view>
      <view v-if="preview.notes" class="reflection"><text class="form-label">我的整体复盘</text><text class="personal-note preserved-text" selectable>{{ preview.notes }}</text></view>
      <text class="small-copy snapshot-version">牌名 {{ preview.nameVersion }} · 记录 {{ preview.ruleVersion }}</text>
      <AppButton class="btn-secondary" :disabled="Boolean(savedRecordId) || Boolean(storageError)" @click="saveRecord">{{ savedRecordId ? '这条快照已保存在本机' : '手动保存这条快照' }}</AppButton>
      <text class="small-copy">保存完整文字快照，最多 50 条。修改输入后可另存新记录；清除本机数据会移除记录。</text>
    </view>

    <view class="panel">
      <view class="record-heading"><text class="panel-title">本机塔罗记录</text><text class="small-copy">{{ records.length }} / 50</text></view>
      <text v-if="storageError" class="error-note" role="alert">{{ storageError }}</text>
      <text v-if="recordActionError" class="error-note" role="alert">{{ recordActionError }}</text>
      <AppButton v-if="storageError" class="text-button" @click="loadRecords">重试读取记录</AppButton>
      <text v-if="!records.length && !storageError" class="small-copy empty-note">还没有保存的牌阵。整理完成后，可手动留下这次记录。</text>
      <view v-for="record in records" :key="record.id" class="record-row">
        <AppButton class="record-open" @click="openRecord(record)"><text class="record-question">{{ record.snapshot.question }}</text><text class="small-copy">{{ record.snapshot.date }} · {{ record.snapshot.spread.name }} · {{ record.snapshot.cards.length }} 张</text><text class="record-caption">{{ record.snapshot.deckDescription }} · 查看快照 ↗</text></AppButton>
        <AppButton class="text-button delete-button" :aria-label="`删除塔罗记录：${record.snapshot.question}`" @click="confirmDelete(record)">删除</AppButton>
      </view>
      <AppButton class="btn-secondary export-button" :disabled="!records.length || Boolean(storageError)" @click="exportRecords">导出全部塔罗记录 JSON</AppButton>
      <text class="small-copy">含问题、日期、牌名、牌阵位置、正逆位与笔记。浏览器下载；其他端复制后请自行粘贴保存。</text>
      <text v-if="notice" class="notice" role="status" aria-live="polite">{{ notice }}</text>
    </view>

    <view class="panel source-panel">
      <AppButton class="disclosure-button" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen"><text>牌目约定与来源</text><text aria-hidden="true">{{ sourcesOpen ? '−' : '＋' }}</text></AppButton>
      <view v-if="sourcesOpen"><text v-for="convention in TAROT_CONVENTIONS" :key="convention" class="small-copy">{{ convention }}</text><text class="small-copy">本版使用文字牌面，未接入其他牌组体系、多副重复牌、自动牌义或随机抽取。</text><view v-for="source in TAROT_SOURCES" :key="source.url" class="source-link"><AppButton class="text-button" @click="openSource(source.url)">{{ source.title }} ↗</AppButton></view></view>
    </view>
    <text class="footer-note">牌面留作参照，想法由你书写，行动由你选择。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { createTarotSnapshot, getTarotCard, inputFromTarotSnapshot, validateTarotSnapshot, TAROT_CARDS, TAROT_CONVENTIONS, TAROT_GROUPS, TAROT_PRESETS, TAROT_SOURCES, type TarotCardGroup, type TarotOrientation, type TarotSnapshot, type TarotSpreadKind } from '@/domain/tarot'
import { createTarotRepository, type TarotRecord } from '@/domain/tarot/repository'
import { exportJson } from '@/utils/export-json'

interface CardDraft { positionName: string; group: TarotCardGroup; cardId: string; orientation: TarotOrientation; note: string }
const question = ref(''), recordDate = ref(today()), deckDescription = ref('韦特体系牌组'), drawNotes = ref(''), notes = ref('')
const spreadKind = ref<TarotSpreadKind>('single'), customSpreadName = ref('自定义牌阵'), customCount = ref(3)
const spreadOptions: { value: TarotSpreadKind; label: string }[] = [{ value: 'single', label: '单张' }, { value: 'three', label: '三张' }, { value: 'custom', label: '自定义' }]
const countLabels = Array.from({ length: 10 }, (_, index) => `${index + 1} 张`)
const groupLabels = TAROT_GROUPS.map(group => group.label)
const slots = ref<CardDraft[]>(emptySlots())
const activeSlots = computed(() => slots.value.slice(0, spreadKind.value === 'single' ? 1 : spreadKind.value === 'three' ? 3 : customCount.value))
const preview = ref<TarotSnapshot | null>(null), savedRecordId = ref(''), stale = ref(false), errorMessage = ref(''), storageError = ref(''), recordActionError = ref(''), notice = ref(''), sourcesOpen = ref(false)
const records = ref<TarotRecord[]>([])
const repository = createTarotRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })

function today() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
function emptySlots(): CardDraft[] { return Array.from({ length: 10 }, (_, index) => ({ positionName: `位置 ${index + 1}`, group: 'major', cardId: '', orientation: 'upright', note: '' })) }
function positionName(index: number) { return spreadKind.value === 'custom' ? slots.value[index].positionName : TAROT_PRESETS[spreadKind.value].positions[index] }
function groupIndex(group: TarotCardGroup) { return TAROT_GROUPS.findIndex(item => item.id === group) }
function nativeValue(event: Event) { return Number((event.target as HTMLSelectElement).value) }
function cardOptions(index: number) {
  const selected = new Set(activeSlots.value.filter((_, position) => position !== index).map(slot => slot.cardId))
  return [{ id: '', label: '请选择牌名' }, ...TAROT_CARDS.filter(card => card.group === slots.value[index].group && !selected.has(card.id)).map(card => ({ id: card.id, label: `${card.majorNumber === null ? '' : `${card.majorNumber} · `}${card.name}` }))]
}
function cardOptionIndex(index: number) { return Math.max(0, cardOptions(index).findIndex(card => card.id === slots.value[index].cardId)) }
function changeGroup(index: number, selectedIndex: number) {
  const group = TAROT_GROUPS[selectedIndex]
  if (!group || slots.value[index].group === group.id) return
  slots.value[index].group = group.id; slots.value[index].cardId = ''
}
function selectCard(index: number, selectedIndex: number) { const option = cardOptions(index)[selectedIndex]; if (option) slots.value[index].cardId = option.id }
function message(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试。' }
function scrollToPreview() { nextTick(() => uni.pageScrollTo({ selector: '#tarot-preview', duration: 250 })) }
function loadRecords() { try { records.value = repository.list(); storageError.value = '' } catch (error) { records.value = []; storageError.value = message(error) } }
function prepareRecord() {
  errorMessage.value = ''; recordActionError.value = ''; notice.value = ''; savedRecordId.value = ''; preview.value = null
  try {
    preview.value = createTarotSnapshot({
      question: question.value, date: recordDate.value, deckDescription: deckDescription.value, drawNotes: drawNotes.value,
      spreadKind: spreadKind.value, spreadName: spreadKind.value === 'custom' ? customSpreadName.value : TAROT_PRESETS[spreadKind.value].name,
      selections: activeSlots.value.map((slot, index) => ({ positionName: positionName(index), cardId: slot.cardId, orientation: slot.orientation, note: slot.note })), notes: notes.value,
    })
    stale.value = false; scrollToPreview()
  } catch (error) { errorMessage.value = message(error) }
}
function saveRecord() {
  if (!preview.value || savedRecordId.value) return
  recordActionError.value = ''
  try { const record = repository.save(preview.value); savedRecordId.value = record.id; loadRecords(); notice.value = '完整牌阵快照已保存在当前设备。' }
  catch (error) { recordActionError.value = message(error); notice.value = '' }
}
function openRecord(record: TarotRecord) {
  try {
    const input = inputFromTarotSnapshot(record.snapshot)
    question.value = input.question; recordDate.value = input.date; deckDescription.value = input.deckDescription; drawNotes.value = input.drawNotes; notes.value = input.notes
    spreadKind.value = input.spreadKind
    if (input.spreadKind === 'custom') { customSpreadName.value = input.spreadName; customCount.value = input.selections.length }
    const restored = emptySlots()
    input.selections.forEach((selection, index) => { restored[index] = { ...selection, group: getTarotCard(selection.cardId).group } })
    slots.value = restored
    preview.value = validateTarotSnapshot(record.snapshot); savedRecordId.value = record.id; stale.value = false; errorMessage.value = ''; recordActionError.value = ''; notice.value = ''
    scrollToPreview()
  } catch (error) { recordActionError.value = message(error) }
}
function confirmDelete(record: TarotRecord) {
  uni.showModal({ title: '删除这条塔罗记录？', content: record.snapshot.question.slice(0, 80), confirmText: '删除', cancelText: '保留', success: response => {
    if (!response.confirm) return
    recordActionError.value = ''
    try { repository.remove(record.id); if (savedRecordId.value === record.id) savedRecordId.value = ''; loadRecords(); notice.value = '已删除这条塔罗记录。' }
    catch (error) { recordActionError.value = message(error) }
  } })
}
async function exportRecords() {
  recordActionError.value = ''
  try { const result = await exportJson(JSON.parse(repository.exportJSON()), `oasis-tarot-${today()}.json`); notice.value = result === 'download' ? '已发起 JSON 文件下载，请在浏览器下载目录确认。' : '记录 JSON 已复制，请粘贴到文件或笔记中保存。' }
  catch (error) { recordActionError.value = message(error); notice.value = '' }
}
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => { notice.value = '来源链接已复制，可粘贴到浏览器阅读。' }, fail: () => { notice.value = '链接复制失败，请稍后重试。' } })
  // #endif
}
watch([question, recordDate, deckDescription, drawNotes, notes, spreadKind, customSpreadName, customCount, slots], () => {
  if (preview.value) stale.value = true
  preview.value = null; savedRecordId.value = ''; errorMessage.value = ''; recordActionError.value = ''; notice.value = ''
}, { deep: true, flush: 'sync' })
loadRecords()
</script>

<style scoped>
.native-select { display: block; appearance: auto; font-family: inherit; cursor: pointer; }.native-select:focus-visible { outline: 2px solid #a88bc5; outline-offset: 3px; }
.tarot-page { padding-bottom: 42px; }.intro { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 20px; }.intro > view { min-width: 0; }.intro .page-heading { font-size: 25px; line-height: 1.55; }.intro .page-caption { font-size: 12px; line-height: 1.8; }.intro-cat { width: 108px; height: 108px; flex-shrink: 0; }.privacy-note { display: block; font-size: 11px; line-height: 1.8; color: #61705e; margin-bottom: 20px; }
.panel { background: #fff; border: 1px solid #eee7f4; border-radius: 22px; padding: 20px; margin-bottom: 20px; }.panel-title { display: block; font-size: 17px; line-height: 1.65; font-weight: 600; color: #473b58; }.small-copy { display: block; font-size: 11px; line-height: 1.9; color: #776b83; margin-top: 6px; overflow-wrap: anywhere; }.lead-copy { margin: 8px 0 22px; }.form-label { font-size: 13px; }.form-group { margin-bottom: 20px; }.form-input, .form-picker { font-size: 14px; min-width: 0; padding: 0 12px; }.text-input { display: block; width: 100%; min-height: 94px; height: 94px; box-sizing: border-box; padding: 12px; border: 1px solid #e7dfee; background: #fbf9fd; border-radius: 14px; font-size: 14px; line-height: 1.8; color: #51445e; }.compact-input { height: 80px; min-height: 80px; }.counter { text-align: right; }.placeholder { color: #9a8aa5; }
.spread-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }.spread-tabs button, .orientation-options button { width: 100%; margin: 0; min-height: 44px; padding: 10px 4px; border-radius: 12px; background: #faf7fc; border: 1px solid #ece5f1; color: #786687; font-size: 13px; line-height: 1.7; }.spread-tabs button.selected, .orientation-options button.selected { color: #61428b; background: #ece3f7; border-color: #a88bc5; }.spread-note { margin-bottom: 18px; }.selection-card { border: 1px solid #eae2f0; border-radius: 16px; padding: 16px; margin-top: 16px; background: #fefcff; }.selection-heading { display: flex; align-items: baseline; gap: 9px; font-size: 15px; line-height: 1.6; font-weight: 600; color: #74598c; margin-bottom: 18px; overflow-wrap: anywhere; }.position-number { font-size: 12px; font-weight: 400; color: #a28cad; flex-shrink: 0; }.orientation-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }.card-note { margin-top: 18px; margin-bottom: 0; }.overall-note { margin-top: 24px; }
.scope-note { display: block; background: #f7f3fa; color: #73637f; padding: 12px; margin: 16px 0; border-radius: 12px; font-size: 12px; line-height: 1.9; }.error-note { display: block; color: #98425b; background: #fcf0f3; border-radius: 12px; padding: 12px; font-size: 12px; line-height: 1.9; margin: 12px 0; overflow-wrap: anywhere; }.question-title { overflow-wrap: anywhere; }.text-cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; margin: 20px 0; }.text-card { border: 1px solid #e8dcf1; border-radius: 16px; padding: 18px; background: #faf6fd; }.text-card.reversed { background: #fbf8f2; border-color: #eadfc9; }.text-card-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; color: #8a739b; font-size: 11px; line-height: 1.7; }.text-card-top > text:first-child { min-width: 0; overflow-wrap: anywhere; }.orientation-badge { flex-shrink: 0; color: #76558e; }.reversed .orientation-badge { color: #947747; }.card-name { display: block; color: #5c406f; font-size: 23px; line-height: 1.6; margin-top: 16px; letter-spacing: 1px; }.card-english { display: block; color: #8e799b; font-size: 11px; line-height: 1.8; margin-top: 4px; overflow-wrap: anywhere; }.personal-note { display: block; color: #6e5c7a; font-size: 13px; line-height: 1.9; margin-top: 14px; }.preserved-text { white-space: pre-wrap; overflow-wrap: anywhere; }.no-note { margin-top: 14px; color: #a091a8; }.reflection { border-left: 3px solid #ceb8df; padding-left: 14px; margin-bottom: 20px; }.snapshot-version { margin-bottom: 16px; }
.record-heading { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }.empty-note { padding: 16px 0; }.record-row { display: flex; align-items: center; gap: 8px; border-top: 1px solid #f1eaf6; margin-top: 12px; padding-top: 12px; }.record-open { display: block; min-width: 0; flex: 1; margin: 0; padding: 4px 0; text-align: left; white-space: normal; background: transparent; line-height: 1.7; }.record-question { display: block; font-size: 14px; color: #655073; overflow-wrap: anywhere; }.record-caption { display: block; color: #947eaa; font-size: 11px; margin-top: 6px; overflow-wrap: anywhere; }.delete-button { font-size: 12px; color: #a36177; flex-shrink: 0; }.export-button { margin-top: 18px; font-size: 13px; }.notice { display: block; color: #60785b; background: #f0f5ef; padding: 10px; margin-top: 12px; border-radius: 10px; font-size: 12px; line-height: 1.85; }.source-panel { padding-top: 12px; padding-bottom: 12px; }.disclosure-button { display: flex; justify-content: space-between; gap: 12px; width: 100%; padding: 0; min-height: 44px; background: transparent; color: #6b5683; font-size: 13px; line-height: 1.8; }.source-link { margin-top: 7px; }.source-link button { justify-content: flex-start; white-space: normal; text-align: left; font-size: 11px; padding-left: 0; }
@media (max-width: 360px) { .panel { padding: 16px; }.intro .page-heading { font-size: 23px; }.intro-cat { width: 82px; height: 82px; }.selection-card { padding: 12px; }.text-card { padding: 14px; }.form-input, .form-picker { font-size: 13px; }.text-card-top { flex-wrap: wrap; } }
</style>
