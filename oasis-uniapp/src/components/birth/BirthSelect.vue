<template>
 <view class="birth-select" :class="{ invalid }">
  <!-- #ifdef H5 -->
  <select :value="modelValue" :aria-label="label" :aria-invalid="invalid || undefined" :disabled="disabled" @change="nativeChange">
   <option value="">{{ placeholder }}</option><option v-for="option in options" :key="String(option.value)" :value="String(option.value)">{{ option.label }}</option>
  </select>
  <!-- #endif -->
  <!-- #ifndef H5 -->
  <picker :range="labels" :value="selectedIndex" :disabled="disabled" :aria-label="label" @change="pickerChange"><view class="picker-value" :class="{ empty: !modelValue, disabled }">{{ labels[selectedIndex] }}</view></picker>
  <!-- #endif -->
 </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ modelValue: string; options: { value: string | number; label: string }[]; label: string; placeholder: string; disabled?: boolean; invalid?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const labels = computed(() => [props.placeholder, ...props.options.map(option => option.label)])
const selectedIndex = computed(() => props.options.findIndex(option => String(option.value) === props.modelValue) + 1)
function nativeChange(event: Event) { emit('update:modelValue', (event.target as HTMLSelectElement).value) }
function pickerChange(event: { detail: { value: string | number } }) { const option = props.options[Number(event.detail.value) - 1]; emit('update:modelValue', option ? String(option.value) : '') }
</script>
<style scoped>
.birth-select{min-width:0;width:100%;}select,.picker-value{display:block;box-sizing:border-box;width:100%;min-width:0;height:48px;padding:0 10px;border:1px solid #e6dced;border-radius:12px;background:#faf7fc;color:#614c71;font-size:14px;line-height:48px;}select{appearance:auto;}select:focus-visible{outline:2px solid #9c7bb7;outline-offset:2px;}select:disabled,.disabled{opacity:.5;}.empty{color:#9b8ba5;}.invalid select,.invalid .picker-value{border-color:#be6c7a;}
</style>
