<template>
 <view class="report-prose"><template v-for="(line, index) in lines" :key="index"><text v-if="line.text" :class="['prose-line', line.kind]" selectable>{{ line.text }}</text><view v-else class="prose-space"></view></template></view>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ content: string }>()
// 只渲染文本，不执行 AI 返回的 HTML；兼容常见 Markdown 标题与列表。
const lines = computed(() => props.content.split('\n').map(raw => {
 const heading = /^#{1,6}\s+/.test(raw)
 const bullet = /^\s*[-*]\s+/.test(raw)
 const text = raw.replace(/^#{1,6}\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/^\s*[-*]\s+/, '· ')
 return { text, kind: heading ? 'prose-heading' : bullet ? 'prose-bullet' : 'prose-paragraph' }
}))
</script>
<style scoped>
.prose-line { display: block; font-size: 16px; line-height: 1.95; color: #4e465c; overflow-wrap: anywhere; white-space: pre-wrap; }.prose-heading { font-weight: 600; color: #3b304c; margin: 20px 0 8px; }.prose-heading:first-child { margin-top: 0; }.prose-bullet { padding-left: 12px; text-indent: -10px; margin: 8px 0; }.prose-space { height: 12px; }
</style>
