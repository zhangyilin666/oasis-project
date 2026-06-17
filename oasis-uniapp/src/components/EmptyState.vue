<!--
  空状态组件 — 从小程序 components/empty-state 移植
  Props: message, hint
-->
<template>
  <view class="empty-state">
    <text class="empty-state__icon">📭</text>
    <text class="empty-state__message">{{ message }}</text>
    <text v-if="hint" class="empty-state__hint">{{ hint }}</text>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
  hint?: string
}>(), {
  message: '暂无数据',
  hint: '',
})
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;

  &__icon {
    font-size: 80rpx;
    margin-bottom: var(--spacing-md);
  }

  &__message {
    font-size: var(--font-md);
    color: var(--color-text-muted);
  }

  &__hint {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin-top: var(--spacing-sm);
  }
}
</style>
