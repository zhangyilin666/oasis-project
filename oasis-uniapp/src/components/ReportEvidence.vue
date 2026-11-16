<template>
 <view class="evidence">
  <text class="evidence-title">解读依据</text>
  <text class="evidence-note">{{ verification?.status === 'structured_checked' ? 'AI 返回的四柱、日主、五行数量与大运字段已和本次排盘核对。此核对不代表全部文字或预测正确。' : '这份报告没有结构化字段核对记录；请以四柱命盘表为准。' }}</text>
  <AppButton class="evidence-toggle" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起参考资料 −' : `查看参考资料（${references.length}）＋` }}</AppButton>
  <view v-if="expanded">
   <text class="evidence-note" v-if="!references.length">这份报告未保存参考资料快照。旧报告不会补记成已核验的新报告。</text>
   <text class="evidence-note" v-else>以下为生成时提供给 AI 的资料片段，不代表古籍权威结论。“AI 标注使用”只表示模型返回了该资料的编号。</text>
   <view v-for="source in references" :key="source.id" class="source-card">
    <text class="source-title">{{ source.title }} · 第 {{ source.paragraph }} 段</text>
    <text class="source-kind">{{ source.kind }}</text>
    <text class="source-snippet" selectable>{{ source.snippet }}</text>
    <text class="source-kind">{{ verification?.reference_ids?.includes(source.id) ? 'AI 标注使用' : '提供给 AI 的参考片段' }} · 已保存本次片段</text>
   </view>
  </view>
 </view>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import type { ReportReference, ReportVerification } from '@/api/xiaoyi'
withDefaults(defineProps<{ references?: ReportReference[]; verification?: ReportVerification }>(), { references: () => [] })
const expanded = ref(false)
</script>
<style scoped>
.evidence { margin-top: 24px; padding: 20px; border-radius: 20px; background: #f7f4fa; }
.evidence-title { display: block; color: #4f405f; font-size: 16px; font-weight: 600; margin-bottom: 10px; }
.evidence-note,.source-kind { display: block; font-size: 13px; line-height: 1.8; color: #716579; overflow-wrap: anywhere; }
.evidence-toggle { text-align: left; margin: 10px 0 0; padding: 4px 0; min-height: 44px; line-height: 36px; background: transparent; color: #705598; font-size: 14px; }
.source-card { background: white; border: 1px solid #eae3f0; border-radius: 14px; padding: 16px; margin-top: 12px; }
.source-title { display: block; font-size: 15px; color: #4f405f; font-weight: 600; margin-bottom: 6px; }
.source-snippet { display: block; margin: 12px 0; font-size: 15px; line-height: 1.8; color: #504657; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
