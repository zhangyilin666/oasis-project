<template>
 <view class="birth-time-field"><view class="time-grid"><BirthSelect :model-value="hour" :options="hours" :label="labelPrefix + '小时'" placeholder="选择时" :invalid="invalid" @update:model-value="change('hour', $event)" /><text class="separator">:</text><BirthSelect :model-value="minute" :options="minutes" :label="labelPrefix + '分钟'" placeholder="选择分" :invalid="invalid" @update:model-value="change('minute', $event)" /></view><text class="time-hint">24 小时制，凌晨 0 时、下午 1 时为 13 时。</text></view>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import BirthSelect from './BirthSelect.vue'
import { parseBirthTime, formatBirthTime } from '@/domain/birth-input/date'
const props = withDefaults(defineProps<{ modelValue: string; labelPrefix?: string; invalid?: boolean }>(), { labelPrefix: '出生' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const hour = ref(''), minute = ref('')
let lastEmitted: string | undefined
const hours = Array.from({ length: 24 }, (_, value) => ({ value, label: String(value).padStart(2, '0') + ' 时' }))
const minutes = Array.from({ length: 60 }, (_, value) => ({ value, label: String(value).padStart(2, '0') + ' 分' }))
watch(() => props.modelValue, value => { if (value !== lastEmitted) { const parts = parseBirthTime(value); hour.value = parts ? String(parts.hour) : ''; minute.value = parts ? String(parts.minute) : '' }; lastEmitted = undefined }, { immediate: true })
function change(part: 'hour' | 'minute', value: string) { if (part === 'hour') hour.value = value; else minute.value = value; const result = hour.value !== '' && minute.value !== '' ? formatBirthTime(Number(hour.value), Number(minute.value)) : ''; lastEmitted = result; emit('update:modelValue', result) }
</script>
<style scoped>
.birth-time-field{min-width:0;width:100%;}.time-grid{display:grid;grid-template-columns:1fr 12px 1fr;gap:6px;align-items:center;}.separator{text-align:center;color:#a08aae;font-size:18px;}.time-hint{display:block;margin-top:8px;color:#8d7c97;font-size:11px;line-height:1.8;}
</style>
