<!--
  全屏加载遮罩组件 — 从小程序 components/loading-overlay 移植
  Props: text
-->
<template>
  <view class="loading-overlay">
    <view class="loading-overlay__spinner"></view>
    <text class="loading-overlay__text">{{ text }}</text>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
}>(), {
  text: '加载中...',
})
</script>

<style lang="scss" scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 1000;

  &__spinner {
    width: 60rpx;
    height: 60rpx;
    border: 4rpx solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: overlay-spin 0.8s linear infinite;
  }

  &__text {
    margin-top: var(--spacing-md);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }
}

@keyframes overlay-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
