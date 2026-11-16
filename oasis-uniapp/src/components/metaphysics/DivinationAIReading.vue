<template>
  <view class="ai-reading">
    <view class="ai-heading"><view><text class="ai-title">AI 解读</text><text class="small-copy">依据这次固定卦象与《周易》经文</text></view><text v-if="state.reading" class="cloud-badge">云端记录</text></view>
    <text v-if="demo" class="info-note">起卦与 AI 解读请使用正式在线版本。</text>
    <template v-else>
      <view v-if="state.phase === 'idle'" class="reading-action"><text class="small-copy">发送本次问题、起卦资料与卦象，生成并保存 AI 解读。不自动上传其他本机档案。</text><AppButton class="btn-primary" :disabled="disabled" @click="$emit('request')">请 AI 解读这次卦象</AppButton></view>
      <view v-else-if="waiting" class="reading-wait" role="status" aria-live="polite"><CatCompanion small mood="thinking" /><view><text class="waiting-title">{{ state.phase === 'submitting' ? '正在提交这次卦象' : state.phase === 'loading' ? '正在读取云端记录' : '正在结合经文整理解读' }}</text><text class="small-copy">卦象已固定。可以先离开，稍后在本页「我的问卦记录」回看。</text></view></view>
      <view v-if="state.error" class="error-note" role="alert"><text>{{ state.error }}</text></view>
      <AppButton v-if="state.phase === 'submit-error'" class="btn-secondary action-button" :disabled="disabled" @click="$emit('retry')">继续确认这次提交</AppButton>
      <AppButton v-else-if="state.phase === 'failed'" class="btn-secondary action-button" :disabled="disabled" @click="$emit('retry')">保留这卦，重试 AI 解读</AppButton>
      <AppButton v-else-if="state.phase === 'read-error' || state.phase === 'paused'" class="btn-secondary action-button" :disabled="disabled" @click="$emit('refresh')">刷新这条解读</AppButton>
      <text v-if="state.phase === 'failed'" class="small-copy">重试沿用同一问题、时刻与爻值，会创建一条新的解读任务并计入每日次数。</text>
      <template v-if="state.reading?.status === 'completed' && state.reading.analysis">
        <view v-for="section in readingSections" :key="section.title" class="reading-section"><text class="reading-section-title">{{ section.title }}</text><text class="reading-prose" selectable>{{ section.content.text }}</text><view class="citations"><AppButton v-for="id in section.content.evidence_ids" :key="id" class="citation-button" @click="showEvidence(id)">{{ evidenceTitle(id) }} ↗</AppButton></view></view>
        <view class="reading-section"><text class="reading-section-title">可以尝试的行动</text><view v-for="(action, index) in state.reading.analysis.actions" :key="index" class="action-item"><text class="reading-prose" selectable>{{ index + 1 }}. {{ action.text }}</text><view class="citations"><AppButton v-for="id in action.evidence_ids" :key="id" class="citation-button" @click="showEvidence(id)">{{ evidenceTitle(id) }} ↗</AppButton></view></view></view>
        <view class="reflection-box"><text class="reading-section-title">留给自己的问题</text><text v-for="(question, index) in state.reading.analysis.reflection_questions" :key="index" class="reflection-question" selectable>{{ index + 1 }}. {{ question }}</text></view>
        <text class="limits-copy" selectable>{{ state.reading.analysis.limits }}</text>
      </template>
      <template v-if="state.reading">
        <view class="evidence-panel"><AppButton class="disclosure-button" :aria-expanded="evidenceOpen" @click="evidenceOpen = !evidenceOpen"><text>查看经文依据 · {{ state.reading.facts.evidence.length }} 条</text><text aria-hidden="true">{{ evidenceOpen ? '−' : '＋' }}</text></AppButton><view v-if="evidenceOpen"><view v-for="(item, index) in state.reading.facts.evidence" :id="`divination-evidence-${index}`" :key="item.id" class="evidence-card" :class="{ focused: focusedEvidence === item.id }"><text class="evidence-title">{{ item.title }}</text><text class="evidence-text" selectable>{{ item.text }}</text><text class="small-copy">{{ item.sourceTitle }}</text><AppButton v-if="isAllowedSource(item.url)" class="source-button" @click="openSource(item.url)">查看固定版本原文 ↗</AppButton></view><text class="small-copy">{{ state.reading.facts.sourceLicense?.attribution || '《周易》古代原文，维基文库贡献者转录；本项目提取与整理。' }}</text><text v-if="state.reading.facts.sourceLicense?.changes" class="small-copy">{{ state.reading.facts.sourceLicense.changes }}</text><AppButton class="source-button" @click="openSource('https://creativecommons.org/licenses/by-sa/4.0/')">经文资料许可 · CC BY-SA 4.0 ↗</AppButton><text class="small-copy">AI 解释与经文原文分别展示。</text><text class="version-note">经文版本：{{ state.reading.facts.sourceVersion }}</text><view class="reading-scope"><text v-for="scope in state.reading.facts.readingScope" :key="scope" class="small-copy">{{ scope }}</text></view></view></view>
        <view class="cloud-receipt"><text class="small-copy">已自动保存到「我的问卦记录」 · {{ displayDate(state.reading.created_at) }}</text></view>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import type { ReadingSessionState } from '@/domain/divination/reading-session'

const props = withDefaults(defineProps<{ state: ReadingSessionState; demo?: boolean; disabled?: boolean }>(), { demo: false, disabled: false })
defineEmits<{ request: []; retry: []; refresh: [] }>()
const evidenceOpen = ref(false), focusedEvidence = ref('')
const waiting = computed(() => ['submitting', 'loading', 'watching'].includes(props.state.phase))
const readingSections = computed(() => props.state.reading?.analysis ? [
  { title: '先看卦象', content: props.state.reading.analysis.overview },
  { title: '回到你的问题', content: props.state.reading.analysis.question_reading },
] : [])
watch(() => props.state.reading?.reading_id, () => { evidenceOpen.value = false; focusedEvidence.value = '' })
function evidenceTitle(id: string) { return props.state.reading?.facts.evidence.find(item => item.id === id)?.title || '查看经文依据' }
function showEvidence(id: string) {
  const index = props.state.reading?.facts.evidence.findIndex(item => item.id === id) ?? -1
  if (index < 0) return
  focusedEvidence.value = id
  evidenceOpen.value = true
  nextTick(() => uni.pageScrollTo({ selector: `#divination-evidence-${index}`, duration: 200 }))
}
function isAllowedSource(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'zh.wikisource.org' || url.href === 'https://creativecommons.org/licenses/by-sa/4.0/') }
  catch { return false }
}
function openSource(url: string) {
  if (!isAllowedSource(url)) return
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url })
  // #endif
}
function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}
</script>

<style scoped>
.ai-reading { border-top: 1px solid #e9dff0; padding-top: 24px; margin-top: 26px; }.ai-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 14px; }.ai-title { display: block; font-size: 20px; line-height: 1.6; color: #614878; font-weight: 600; }.cloud-badge { flex-shrink: 0; padding: 4px 7px; border-radius: 7px; background: #edf3ed; color: #6a856a; font-size: 10px; line-height: 1.7; margin-top: 4px; }.small-copy { display: block; font-size: 11px; line-height: 1.9; color: #88778f; margin-top: 5px; overflow-wrap: anywhere; }.info-note { display: block; border-radius: 12px; background: #f7f2e9; padding: 12px; font-size: 12px; line-height: 1.9; color: #8c7656; }.reading-action .btn-primary { margin-top: 16px; font-size: 14px; white-space: normal; }.reading-wait { display: flex; align-items: center; gap: 8px; background: #f9f5fc; border-radius: 15px; padding: 12px 8px; }.reading-wait > view { min-width: 0; }.waiting-title { color: #795c90; font-size: 13px; line-height: 1.8; }.error-note { background: #fcf0f3; border-radius: 12px; color: #a1556b; font-size: 12px; line-height: 1.9; padding: 12px; margin: 12px 0; overflow-wrap: anywhere; }.action-button { font-size: 13px; white-space: normal; margin: 12px 0; }.reading-section { margin: 24px 0; }.reading-section-title { display: block; color: #725180; font-size: 15px; font-weight: 600; line-height: 1.7; margin-bottom: 10px; }.reading-prose { display: block; font-size: 14px; line-height: 2; white-space: pre-wrap; color: #63536c; overflow-wrap: anywhere; }.citations { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 5px; }.citation-button { padding: 4px 0; margin: 0; min-height: 36px; color: #9675a8; background: transparent; font-size: 10px; line-height: 1.8; text-align: left; white-space: normal; }.action-item + .action-item { margin-top: 16px; }.reflection-box { padding: 16px; background: #f6f1f9; border-radius: 14px; }.reflection-question { display: block; font-size: 13px; line-height: 1.95; color: #7d638a; margin: 10px 0; overflow-wrap: anywhere; }.limits-copy { display: block; font-size: 11px; line-height: 1.9; color: #97839d; margin-top: 20px; overflow-wrap: anywhere; white-space: pre-wrap; }.evidence-panel { margin-top: 22px; padding: 12px; border: 1px solid #ebe1f1; border-radius: 14px; background: #fdfbff; }.disclosure-button { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 44px; width: 100%; padding: 0; margin: 0; background: transparent; color: #8c6f9c; font-size: 12px; line-height: 1.8; text-align: left; white-space: normal; }.evidence-card { padding: 14px 0; border-top: 1px solid #eee6f3; scroll-margin-top: 58px; }.evidence-card.focused { background: #f6eefb; border-radius: 8px; padding-left: 8px; padding-right: 8px; }.evidence-title { display: block; color: #82638e; font-size: 13px; font-weight: 600; line-height: 1.8; }.evidence-text { display: block; margin-top: 8px; white-space: pre-wrap; font-size: 14px; line-height: 2; color: #65516d; overflow-wrap: anywhere; }.source-button { min-height: 40px; margin: 0; padding: 6px 0; background: transparent; color: #927399; font-size: 11px; line-height: 1.8; text-align: left; }.version-note { display: block; color: #a492ab; font-size: 10px; line-height: 1.8; margin-top: 10px; overflow-wrap: anywhere; }.reading-scope { padding: 10px 0; }.cloud-receipt { padding-top: 12px; border-top: 1px solid #eee6f4; margin-top: 12px; }.export-reading { font-size: 12px; padding-left: 0; }
@media(max-width:350px) { .reading-prose, .evidence-text { font-size: 13px; }.reflection-box { padding: 12px; }.reading-wait { flex-direction: column; align-items: flex-start; }.reading-wait :deep(.cat-companion) { align-self: center; } }
.ai-reading { margin-top: 18px; padding-top: 18px; }.ai-title { color: #59428e; }.reading-prose { color: #51465e; }.small-copy { color: #776b83; }.citation-button, .source-button { min-height: 44px; color: #7760b2; font-size: 12px; }.disclosure-button { color: #59428e; }.cloud-badge { background: #f0ebfa; color: #59428e; }.evidence-panel { border-color: #e7dfee; background: #faf8fc; }
</style>
