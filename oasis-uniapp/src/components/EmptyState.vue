<template>
 <view class="empty-state"><CatCompanion mood="comfort" /><text class="empty-title">{{ message }}</text><text v-if="hint" class="empty-hint">{{ hint }}</text><AppButton v-if="actionLabel" class="btn-secondary" @click="emit('action')">{{ actionLabel }}</AppButton></view>
</template>
<script setup lang="ts">
import CatCompanion from './CatCompanion.vue'
withDefaults(defineProps<{ message?: string; hint?: string; actionLabel?: string }>(), { message: '这里还在等你的故事', hint: '', actionLabel: '' })
const emit = defineEmits<{ action: [] }>()
</script>
<style scoped>
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 40px 16px; text-align: center; }
.empty-title { font-size: 18px; font-weight: 600; margin-top: 16px; }.empty-hint { font-size: 14px; color: var(--color-text-secondary); margin-top: 8px; line-height: 1.8; max-width: 280px; }.empty-state .btn-secondary { width: auto; margin-top: 24px; }
</style>
