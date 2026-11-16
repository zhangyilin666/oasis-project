<template>
 <view class="error-retry" role="status"><CatCompanion small mood="comfort" /><text class="error-title">{{ message }}</text><text class="error-hint">可以检查网络后再试一次，已有报告仍会保留。</text><AppButton class="btn-secondary" @click="emit('retry')">再试一次</AppButton></view>
</template>
<script setup lang="ts">
import CatCompanion from './CatCompanion.vue'
withDefaults(defineProps<{ message?: string }>(), { message: '暂时没能连接上' })
const emit = defineEmits<{ retry: [] }>()
</script>
<style scoped>
.error-retry { display: flex; align-items: center; flex-direction: column; text-align: center; padding: 28px 20px; background: #f3eef9; border-radius: 20px; margin: 16px 0; }.error-title { margin-top: 12px; font-size: 16px; font-weight: 600; }.error-hint { margin-top: 8px; font-size: 12px; color: #726580; }.error-retry .btn-secondary { margin-top: 20px; width: auto; background: white; }
</style>
