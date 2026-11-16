<template><image :src="'/static/ui/' + name + '.svg'" mode="aspectFit" class="app-icon" aria-hidden="true" /></template>
<script setup lang="ts">
defineProps<{ name: string }>()
</script>
<style scoped>.app-icon { width: 24px; height: 24px; display: inline-block; flex-shrink: 0; vertical-align: middle; }</style>
