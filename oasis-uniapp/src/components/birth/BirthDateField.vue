<template>
 <view class="birth-date-field">
  <view v-if="allowLunar" class="calendar-switch"><AppButton :class="{ selected: calendar === 'solar' }" :aria-label="labelPrefix + '使用公历'" :aria-pressed="calendar === 'solar'" @click="switchCalendar('solar')">公历（阳历）</AppButton><AppButton :class="{ selected: calendar === 'lunar' }" :aria-label="labelPrefix + '使用农历'" :aria-pressed="calendar === 'lunar'" @click="switchCalendar('lunar')">农历（阴历）</AppButton></view>
  <view class="date-grid">
   <BirthSelect :model-value="year" :options="years" :label="labelPrefix + '年份'" placeholder="选择年" :invalid="invalid" @update:model-value="change('year', $event)" />
   <BirthSelect :model-value="month" :options="months" :label="labelPrefix + '月份'" placeholder="选择月" :disabled="!year" :invalid="invalid" @update:model-value="change('month', $event)" />
   <BirthSelect :model-value="day" :options="days" :label="labelPrefix + '日期'" placeholder="选择日" :disabled="!year || !month" :invalid="invalid" @update:model-value="change('day', $event)" />
  </view>
  <text v-if="issue" class="date-hint issue" role="alert">{{ issue }}</text>
  <text v-else-if="modelValue" class="date-hint">{{ dateSummary }}</text>
  <text v-else class="date-hint">{{ calendar === 'lunar' ? '按农历依次选择；闰月会单独列出。' : '依次选择年、月、日。' }}</text>
 </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import BirthSelect from './BirthSelect.vue'
import { MIN_BIRTH_DATE, getBirthMonths, getBirthDays, birthDateToSolar, solarToBirthDate, formatLunarBirthDate, type BirthCalendar } from '@/domain/birth-input/date'
const props = withDefaults(defineProps<{ modelValue: string; min?: string; max?: string; labelPrefix?: string; invalid?: boolean; allowLunar?: boolean }>(), { min: MIN_BIRTH_DATE, max: () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10), labelPrefix: '出生', allowLunar: true })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const calendar = ref<BirthCalendar>('solar'), year = ref(''), month = ref(''), day = ref(''), issue = ref('')
let lastEmitted: string | undefined
const years = computed(() => { const first = Number(props.min.slice(0, 4)) - (calendar.value === 'lunar' ? 1 : 0), last = Number(props.max.slice(0, 4)); return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => ({ value: last - index, label: `${last - index}年` })) })
const months = computed(() => year.value ? getBirthMonths(calendar.value, Number(year.value)) : [])
const days = computed(() => year.value && month.value ? getBirthDays(calendar.value, Number(year.value), Number(month.value)) : [])
const dateSummary = computed(() => { try { return `公历 ${props.modelValue}${props.allowLunar ? ' · ' + formatLunarBirthDate(props.modelValue) : ''}` } catch { return props.modelValue } })
function restore(value: string) { issue.value = ''; if (!value) { year.value = ''; month.value = ''; day.value = ''; return }; try { const parts = solarToBirthDate(value, calendar.value); year.value = String(parts.year); month.value = String(parts.month); day.value = String(parts.day) } catch { year.value = ''; month.value = ''; day.value = ''; issue.value = '原日期无法识别，请重新选择。' } }
watch(() => props.modelValue, value => { if (value !== lastEmitted) restore(value); lastEmitted = undefined }, { immediate: true })
function publish(value: string) { lastEmitted = value; emit('update:modelValue', value) }
function change(part: 'year' | 'month' | 'day', value: string) {
 if (part === 'year') year.value = value; else if (part === 'month') month.value = value; else day.value = value
 issue.value = ''
 if (!months.value.some(option => String(option.value) === month.value)) month.value = ''
 if (!days.value.some(option => String(option.value) === day.value)) day.value = ''
 if (!year.value || !month.value || !day.value) { publish(''); return }
 try { publish(birthDateToSolar(calendar.value, { year: Number(year.value), month: Number(month.value), day: Number(day.value) }, { min: props.min, max: props.max })) } catch (error) { issue.value = error instanceof Error ? error.message : '请选择有效日期'; publish('') }
}
function switchCalendar(next: BirthCalendar) { if (calendar.value === next) return; calendar.value = next; restore(props.modelValue) }
</script>
<style scoped>
.birth-date-field{width:100%;min-width:0;}.calendar-switch{display:flex;gap:4px;padding:4px;background:#f1ebf6;border-radius:12px;margin-bottom:10px;}.calendar-switch>button{flex:1;min-width:0;min-height:44px;padding:8px 4px;border-radius:9px;font-size:13px;line-height:1.7;background:transparent;color:#8c7799;}.calendar-switch>button.selected{background:#fff;color:#705384;box-shadow:0 2px 7px #7053840d;}.date-grid{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:8px;min-width:0;}.date-hint{display:block;margin-top:8px;color:#8d7c97;font-size:11px;line-height:1.8;overflow-wrap:anywhere;}.issue{color:#a64e60;}@media(max-width:360px){.date-grid{gap:5px;}}
</style>
