<template>
  <view class="page-shell names-page">
    <view class="names-hero"><view><text class="eyebrow">姓名文化 · 字形与出处</text><text class="page-heading">读一个名字，<br />也读它的来处。</text><text class="page-caption">查字库资料，留下你确认的读音和寓意。</text></view><CatCompanion small mood="thinking" /></view>
    <view class="panel">
      <text class="panel-title">姓名或候选名字</text>
      <input v-model="name" class="field" :maxlength="80" placeholder="例如：林清和、歐陽明" aria-label="姓名或候选名字" />
      <text class="hint">逐字保留简繁字形；不自动拆分复姓。最多 40 个字符。</text>
      <text class="label">我确认的读音（选填）</text>
      <input v-model="pronunciation" class="field" :maxlength="240" placeholder="人名多音字以本人确认为准" aria-label="确认的姓名读音" />
      <text class="label">寓意与核对笔记（选填）</text>
      <textarea v-model="notes" class="field note-field" :maxlength="4000" placeholder="记录自己的理解、家人说法或另外查到的出处" aria-label="姓名文化笔记" />
      <text v-if="error" class="error" role="alert">{{ error }}</text>
      <AppButton class="btn-primary" @click="inspect">查看字形与来源 ↗</AppButton>
      <text class="hint">本机收录 {{ NAME_CHARACTER_COUNT }} 个字。未收录的字仍可保存笔记；不会补造释义、读音或笔画。</text>
    </view>

    <view v-if="snapshot" class="result-area">
      <view class="panel">
        <text class="eyebrow">{{ saved ? '已保存的原样快照' : '本次查询' }}</text><text class="name-title" selectable>{{ snapshot.input.name }}</text>
        <text v-if="saved" class="hint">{{ saved.savedAt.slice(0, 10) }} 保存 · {{ snapshot.ruleVersion }} · 未重新查询字库</text>
        <text class="hint">已收录 {{ knownCount }} / {{ contentCount }} 个非分隔字符 · 数据 {{ snapshot.data.version }}</text>
        <text class="label">确认读音</text><text class="body-copy">{{ snapshot.input.confirmedPronunciation || '尚未填写；下方常用读音不能替代姓名读音确认。' }}</text>
        <text class="label">我的笔记</text><text class="body-copy" selectable>{{ snapshot.input.notes || '还没有笔记，可以填入表单后另存一份。' }}</text>
        <view class="actions"><AppButton :disabled="Boolean(saved)" @click="save">{{ saved ? '这份笔记已保存' : '保存这份笔记' }}</AppButton><AppButton @click="exportCurrent">导出当前 JSON</AppButton><AppButton v-if="saved" @click="fill(saved)">填入表单另存</AppButton></view>
      </view>
      <view v-for="(item, index) in snapshot.characters" :key="index" class="panel character-card">
        <view class="character-heading"><text class="character" selectable>{{ item.character === ' ' ? '空格' : item.character }}</text><view><text class="codepoint" selectable>{{ item.codePoint }}</text><text class="hint">{{ item.status === 'available' ? 'Unihan 字库资料' : item.status === 'separator' ? '姓名分隔符' : '本机字库未收录' }}</text></view></view>
        <template v-if="item.status === 'available'">
          <text class="label">常用普通话读音 · kMandarin</text><text class="body-copy" selectable>{{ item.mandarin || '该字的收录数据无此字段' }}</text>
          <text class="hint">不列全部多音字读法；如果有两个值，依次为简体中文／繁体中文惯用读音。</text>
          <text class="label">笔画原值 · kTotalStrokes</text><text class="body-copy" selectable>{{ item.totalStrokes || '该字的收录数据无此字段' }}</text><text class="hint">说明性字库数据，不是姓名数理用的笔画规则。</text>
          <text class="label">字义摘要 · kDefinition（英文原文）</text><text class="body-copy" selectable>{{ item.definition || '该字的收录数据无此字段' }}</text>
          <text class="label">简体候选</text><text class="body-copy" selectable>{{ variantText(item.simplified) }}</text>
          <text class="label">繁体候选</text><text class="body-copy" selectable>{{ variantText(item.traditional) }}</text>
          <text class="hint">保留字库原始映射；含自身或多候选时不自动取舍。</text>
        </template>
        <text v-else class="body-copy">{{ item.status === 'separator' ? '按原样保存，不给分隔符分配读音或笔画。' : '此字尚无本机词条。请自行核对读音、字形和出处，不按相似字补全。设备缺少字形时可用上方码位核对。' }}</text>
      </view>
      <view class="panel"><text class="panel-title">资料版本与使用范围</text><text v-for="(item, i) in snapshot.conventions" :key="i" class="hint">· {{ item }}</text><text class="hint">{{ snapshot.data.title }} · {{ snapshot.data.version }} · {{ snapshot.data.license }}</text><AppButton v-for="source in snapshot.sources" :key="source.url" class="source-link" @click="openSource(source.url)">{{ source.title }} ↗</AppButton></view>
    </view>

    <view class="panel"><view class="record-heading"><text class="panel-title">本机姓名文化笔记</text><text class="hint">{{ records.length }} / 50</text></view><text class="hint">独立于出生档案，不随账号同步。清除应用数据前请自行导出备份。</text><text v-if="storageError" class="error" role="alert">{{ storageError }}</text><AppButton v-if="storageError" class="source-link" @click="refresh">重新读取</AppButton><text v-if="!records.length && !storageError" class="empty">还没有保存的笔记。输入一个名字，先看看每个字的资料。</text><view v-for="record in records" :key="record.id" class="record"><AppButton class="record-open" @click="openRecord(record)"><text>{{ record.snapshot.input.name }}</text><text class="hint">{{ record.snapshot.input.confirmedPronunciation || '读音未确认' }} · {{ record.savedAt.slice(0, 10) }} · 原样回看 ↗</text></AppButton><AppButton class="delete-button" :aria-label="`删除姓名笔记：${record.snapshot.input.name}`" @click="remove(record)">删除</AppButton></view><AppButton :disabled="!records.length || Boolean(storageError)" @click="exportAll">导出全部笔记 JSON</AppButton></view>
    <text class="footer-note">字形、读音与家人的心意，都可以慢慢核对；本页不提供姓名命运评分。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { createNameRepository, inspectName, NAME_CHARACTER_COUNT, type NameSnapshot } from '@/domain/names'
import type { SnapshotRecord } from '@/domain/records/snapshot-store'
import { exportJson } from '@/utils/export-json'

const name = ref(''), pronunciation = ref(''), notes = ref(''), error = ref(''), storageError = ref('')
const snapshot = ref<NameSnapshot | null>(null), saved = ref<SnapshotRecord<NameSnapshot> | null>(null)
const records = ref<SnapshotRecord<NameSnapshot>[]>([])
const repo = createNameRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const knownCount = computed(() => snapshot.value?.characters.filter(item => item.status === 'available').length || 0)
const contentCount = computed(() => snapshot.value?.characters.filter(item => item.status !== 'separator').length || 0)
watch([name, pronunciation, notes], () => { snapshot.value = null; saved.value = null; error.value = '' }, { flush: 'sync' })
function message(e: unknown) { return e instanceof Error ? e.message : '操作未完成，请重试。' }
function refresh() { try { records.value = repo.list(); storageError.value = '' } catch (e) { storageError.value = message(e) } }
onShow(refresh)
function inspect() { try { snapshot.value = inspectName({ name: name.value, confirmedPronunciation: pronunciation.value, notes: notes.value }); saved.value = null; error.value = '' } catch (e) { error.value = message(e) } }
function save() { if (!snapshot.value) return; try { saved.value = repo.save(snapshot.value); refresh(); uni.showToast({ title: '姓名笔记已保存', icon: 'success' }) } catch (e) { error.value = message(e) } }
function fill(record: SnapshotRecord<NameSnapshot>) { name.value = record.snapshot.input.name; pronunciation.value = record.snapshot.input.confirmedPronunciation; notes.value = record.snapshot.input.notes; snapshot.value = null; saved.value = null; uni.pageScrollTo({ scrollTop: 0, duration: 0 }) }
function openRecord(record: SnapshotRecord<NameSnapshot>) { fill(record); snapshot.value = JSON.parse(JSON.stringify(record.snapshot)); saved.value = record }
function variantText(items: { character: string; codePoint: string }[]) { return items.map(item => `${item.character}（${item.codePoint}）`).join('、') || '无收录映射；不据此断言不存在其他字形' }
async function download(value: unknown, filename: string) { try { const mode = await exportJson(value, filename); uni.showToast({ title: mode === 'download' ? '已发起导出，请检查下载' : 'JSON 已复制', icon: 'none' }) } catch (e) { error.value = message(e) } }
function exportCurrent() { if (snapshot.value) void download({ schemaVersion: 1, kind: 'name-culture-snapshot', snapshot: snapshot.value }, 'oasis-name-culture.json') }
function exportAll() { try { void download(JSON.parse(repo.exportJSON()), 'oasis-name-culture-records.json') } catch (e) { storageError.value = message(e) } }
function remove(record: SnapshotRecord<NameSnapshot>) { uni.showModal({ title: '删除这份本机笔记？', content: `仅删除「${record.snapshot.input.name}」这份笔记。如需保留，请先导出。`, success: response => { if (!response.confirm) return; try { repo.remove(record.id); if (saved.value?.id === record.id) saved.value = null; refresh() } catch (e) { storageError.value = message(e) } } }) }
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(url)
  // #endif
  // #ifdef MP-WEIXIN
  uni.setClipboardData({ data: url })
  // #endif
}
</script>

<style scoped>
.names-page { padding-bottom: 36px; }.names-hero { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 22px; }.names-hero > view { min-width: 0; }.names-hero .page-heading { font-size: 26px; line-height: 1.55; }.panel { padding: 20px; border: 1px solid #eee7f4; border-radius: 20px; background: #fff; margin-bottom: 18px; }.panel-title { display: block; font-size: 16px; font-weight: 600; color: #514161; line-height: 1.7; }.label { display: block; font-size: 12px; color: #7b638d; margin: 16px 0 8px; line-height: 1.8; }.field { display: block; box-sizing: border-box; width: 100%; height: 48px; padding: 11px 12px; background: #f8f5fb; border: 1px solid #e9e1f0; border-radius: 12px; margin: 10px 0; font-size: 13px; color: #544560; }.note-field { height: 116px; line-height: 1.8; }.hint { display: block; font-size: 11px; line-height: 1.9; color: #88768f; margin-top: 7px; overflow-wrap: anywhere; }.error { display: block; color: #a74760; background: #fbf0f3; padding: 10px; margin: 12px 0; border-radius: 10px; font-size: 12px; line-height: 1.9; }.btn-primary { margin-top: 18px; font-size: 14px; }.name-title { display: block; font-size: 26px; color: #65467a; line-height: 1.8; overflow-wrap: anywhere; margin-top: 8px; }.body-copy { display: block; font-size: 13px; color: #5e5069; line-height: 1.95; overflow-wrap: anywhere; white-space: pre-wrap; }.character-heading { display: flex; gap: 16px; align-items: center; }.character { font-size: 38px; line-height: 1.5; color: #74549b; flex-shrink: 0; }.codepoint { font-size: 12px; color: #6e5e7b; }.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }.actions button, .panel > button:not(.btn-primary), .delete-button { background: #f3edf9; color: #775b91; font-size: 12px; border-radius: 10px; padding: 10px 12px; margin: 0; line-height: 1.8; white-space: normal; }.actions button[disabled], .panel > button[disabled] { opacity: .5; }.source-link { display: block; width: 100%; text-align: left; margin-top: 10px !important; overflow-wrap: anywhere; }.record-heading { display: flex; justify-content: space-between; gap: 10px; align-items: center; }.record { display: flex; gap: 8px; align-items: center; border-top: 1px solid #efe9f4; padding: 12px 0; }.record-open { flex: 1; min-width: 0; padding: 4px 0; margin: 0; text-align: left; white-space: normal; line-height: 1.8; background: transparent; color: #655071; font-size: 14px; overflow-wrap: anywhere; }.record-open > text { display: block; }.delete-button { flex-shrink: 0; background: #faf0f2; color: #9a6175; }.empty { display: block; padding: 20px 0; color: #978aa0; font-size: 12px; line-height: 1.9; }.footer-note { display: block; font-size: 10px; line-height: 1.9; }
@media (max-width: 350px) { .panel { padding: 15px; }.names-hero .page-heading { font-size: 23px; }.names-hero .page-caption { font-size: 11px; }.character-heading { gap: 10px; } }
</style>
