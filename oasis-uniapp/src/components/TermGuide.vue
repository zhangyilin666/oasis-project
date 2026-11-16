<template>
 <view class="term-guide">
  <text class="guide-title">小猫词典 · 点一下就懂</text>
  <view class="term-list" role="group" aria-label="术语解释">
   <AppButton v-for="term in visibleTerms" :key="term" class="term-chip" :class="{ selected: active === term }" :aria-expanded="active === term" @click="active = active === term ? '' : term">{{ term }}</AppButton>
   <AppButton v-if="terms.length > 8" class="term-chip more" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起词条' : '更多词条 ＋' }}</AppButton>
  </view>
  <view v-if="active" class="term-answer" role="status" aria-live="polite">
   <view class="answer-heading"><CatCompanion small mood="thinking" /><text>小猫说：{{ active }}</text><AppButton class="close-term" aria-label="收起术语解释" @click="active = ''">×</AppButton></view>
   <text class="answer-text">{{ termExplanations[active] }}</text>
   <text class="answer-note">项目编写的白话解释 · 传统文化学习参考</text>
  </view>
 </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CatCompanion from './CatCompanion.vue'
import { termExplanations, termsInContent } from '@/utils/terms'
const props = defineProps<{ content: string }>()
const active = ref('')
const expanded = ref(false)
const terms = computed(() => termsInContent(props.content))
const visibleTerms = computed(() => expanded.value ? terms.value : terms.value.slice(0, 8))
watch(() => props.content, () => { active.value = ''; expanded.value = false })
</script>
<style scoped>
.term-guide { margin: 24px 0 20px; padding-top: 20px; border-top: 1px solid #eee8f4; }
.guide-title { display: block; font-size: 14px; font-weight: 600; color: #665180; margin-bottom: 12px; }
.term-list { display: flex; flex-wrap: wrap; gap: 8px; }
.term-chip { margin: 0; padding: 0 14px; min-height: 44px; line-height: 44px; font-size: 14px; background: #f5f0fa; color: #65507f; border-radius: 14px; }
.term-chip.selected { background: #7760b2; color: white; }.term-chip.more { background: transparent; }
.term-answer { margin-top: 12px; padding: 16px; border-radius: 20px; background: #faf6ee; }
.answer-heading { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: #594b3e; }
.close-term { margin: 0 0 0 auto; min-width: 44px; min-height: 44px; padding: 0; background: transparent; color: #65507f; font-size: 24px; }
.answer-text { display: block; font-size: 16px; line-height: 1.8; color: #514739; overflow-wrap: anywhere; }
.answer-note { display: block; margin-top: 12px; font-size: 12px; line-height: 1.6; color: #746858; }
</style>
