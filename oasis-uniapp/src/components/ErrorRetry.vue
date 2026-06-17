<!--
  错误重试组件 — 从小程序 components/error-retry 移植
  Props: message
  Events: retry
-->
<template>
  <view class="error-retry">
    <text class="error-retry__icon">⚠️</text>
    <text class="error-retry__message">{{ message }}</text>
    <view class="error-retry__btn" @click="emit('retry')">
      <text class="error-retry__btn-text">重新加载</text>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
}>(), {
  message: '加载失败',
})

const emit = defineEmits<{
  retry: []
}>()
</script>

<style lang="scss" scoped>
.error-retry {
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
    margin-bottom: var(--spacing-lg);
  }

  &__btn {
    padding: 16rpx 48rpx;
    background: var(--color-primary);
    border-radius: 40rpx;
  }

  &__btn-text {
    color: #fff;
    font-size: var(--font-md);
  }
}
</style>
