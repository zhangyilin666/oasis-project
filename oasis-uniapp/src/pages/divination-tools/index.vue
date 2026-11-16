<template><view class="page-shell"><text class="page-caption" role="status">正在打开解读页面…</text></view></template>
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
onLoad(query => { uni.redirectTo({ url: '/pages/divination/index' }) })
</script>
