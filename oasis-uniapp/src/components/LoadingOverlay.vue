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
  display: grid;
  grid-template-columns: minmax(0, 280px);
  grid-template-rows: 1fr 38px auto 1fr;
  row-gap: 16px;
  justify-content: center;
  padding: 40px;
  box-sizing: border-box;
  overflow: auto;
  overscroll-behavior: contain;
  background: #30223f66;
  z-index: 1000;

  &::before {
    content: '';
    grid-column: 1;
    grid-row: 2 / 4;
    margin: -24px;
    border: 1px solid var(--color-border, #e6def0);
    border-radius: 24px;
    background: #faf8fc;
    box-shadow: 0 18px 60px #38274d26, 0 4px 16px #38274d0d;
  }

  &__spinner {
    position: relative;
    grid-column: 1;
    grid-row: 2;
    justify-self: center;
    width: 38px;
    height: 38px;
    box-sizing: border-box;
    border: 3px solid var(--color-border, #e6def0);
    border-top-color: var(--color-primary, #7760b2);
    border-radius: 50%;
    animation: overlay-spin 0.8s linear infinite;
  }

  &__text {
    position: relative;
    grid-column: 1;
    grid-row: 3;
    min-width: 0;
    font-size: var(--font-sm, 14px);
    color: var(--color-text-secondary, #625b72);
    text-align: center;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-overlay__spinner { animation: none; }
}

@keyframes overlay-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
