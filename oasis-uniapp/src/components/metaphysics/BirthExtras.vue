<template>
 <view class="extra-settings">
  <view class="form-group"><text class="form-label">出生地区（选填）</text><BirthPlaceField :model-value="modelValue.placeName" @update:model-value="set('placeName', $event)" @select="choosePlace" /><text v-if="modelValue.placeEnabled" class="hint">{{ coordinateLabel || '已填入出生地点' }} · 已启用星盘宫位，可在高级设置修正坐标。</text><text v-else-if="modelValue.placeName" class="hint">此地点暂未提供坐标；可计算基础盘，或在高级设置补充经纬度。</text></view>
  <view class="form-group"><text class="form-label">出生时间精度</text><BirthSelect :model-value="modelValue.timePrecision" :options="precisionOptions" label="出生时间精度" placeholder="选择时间精度" @update:model-value="set('timePrecision', $event === 'approximate' ? 'approximate' : 'minute')" /><text class="hint">不确定分钟时选「大约时间」。完全不详时先核实资料。</text></view>
  <AppButton class="toggle" :aria-expanded="open" @click="open = !open"><text>高级设置 · 时区、坐标与观察日期</text><text>{{ open ? '−' : '＋' }}</text></AppButton>
  <text v-if="!open" class="hint">{{ summary }}</text>
  <view v-if="open" class="extra-body">
   <slot name="timezone" />
   <view class="form-group"><text class="form-label">历史时区</text>
    <picker :range="zoneLabels" :value="zoneIndex" @change="chooseZone" aria-label="选择历史时区"><view class="form-picker">{{ zoneLabels[zoneIndex] }}</view></picker>
    <input v-if="zoneIndex === zones.length - 1" class="form-input custom-zone" :value="modelValue.timeZone" @input="inputText('timeZone', $event)" placeholder="例如 America/New_York" aria-label="IANA时区名称" maxlength="100" />
    <text class="hint">按出生当年的规则查询夏令时。依赖设备时区数据；不支持时可选手动偏移。时区与经纬度分别填写。</text>
   </view>
   <view v-if="modelValue.timeZone" class="form-group"><text class="form-label">重复时刻</text>
    <picker :range="choiceLabels" :value="choiceIndex" @change="set('timeChoice', choices[Number($event.detail.value)])" aria-label="选择夏令时重复时刻"><view class="form-picker">{{ choiceLabels[choiceIndex] }}</view></picker>
    <text class="hint">仅在钟表回拨、同一时刻出现两次时使用。不确定时先保留「需要时提醒」。</text>
   </view>
   <AppButton class="coordinate-toggle" :aria-pressed="modelValue.placeEnabled" @click="set('placeEnabled', !modelValue.placeEnabled)">{{ modelValue.placeEnabled ? '✓ 已启用出生地点' : '＋ 添加出生地点，计算星盘宫位' }}</AppButton>
   <view v-if="modelValue.placeEnabled" class="coordinate-fields">
    <view class="coordinate-grid"><view><label for="chart-latitude" class="form-label">纬度</label><input id="chart-latitude" class="form-input" :value="modelValue.latitude" @input="inputText('latitude', $event)" maxlength="14" placeholder="如 31.23" aria-label="出生纬度" /></view><view><label for="chart-longitude" class="form-label">经度</label><input id="chart-longitude" class="form-input" :value="modelValue.longitude" @input="inputText('longitude', $event)" maxlength="14" placeholder="如 121.47" aria-label="出生经度" /></view></view>
    <text class="hint">北纬、东经为正；南纬、西经为负。使用整宫制，上升点所在星座为第一宫。本期宫位支持纬度绝对值小于 66°。</text>
   </view>
   <view class="form-group observation"><text class="form-label">观察日期（选填）</text><BirthDateField :model-value="modelValue.observationDate" max="2099-12-31" :allow-lunar="false" label-prefix="运限与行运观察" @update:model-value="set('observationDate', $event)" /><AppButton v-if="modelValue.observationDate" class="text-button" @click="set('observationDate', '')">清除观察日期</AppButton><text class="hint">以所选公历日期的北京时间 12:00（UTC 04:00）为观察时刻，查看紫微运限与星盘行运快照。日期会随结果保存，不能早于换算后的北京时间出生日期。</text></view>
   <view class="form-group rule-comparison"><AppButton class="coordinate-toggle" :aria-pressed="modelValue.compareRules" @click="set('compareRules', !modelValue.compareRules)">{{ modelValue.compareRules ? '✓ 已开启八字／紫微规则对照' : '＋ 查看八字／紫微规则对照' }}</AppButton><text class="hint">并排查看不同换年、晚子换日和起运规则带来的差异。主盘沿用原有规则，对照结果会随档案保存。</text></view>
  </view>
 </view>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import BirthPlaceField from '@/components/birth/BirthPlaceField.vue'
import BirthDateField from '@/components/birth/BirthDateField.vue'
import BirthSelect from '@/components/birth/BirthSelect.vue'
import type { BirthExtrasValue } from '@/domain/metaphysics/form'
const props = defineProps<{ modelValue: BirthExtrasValue; birthDate: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: BirthExtrasValue] }>()
const open = ref(false)
const coordinateLabel = ref('')
watch([() => props.modelValue.placeName, () => props.modelValue.latitude, () => props.modelValue.longitude], () => { coordinateLabel.value = '' }, { flush: 'sync' })
const precisionOptions = [{ value: 'minute', label: '已确认到分钟' }, { value: 'approximate', label: '大约时间' }]
const zones = ['', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Kolkata', 'Asia/Kathmandu', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Australia/Sydney', 'Pacific/Auckland', 'custom']
const zoneLabels = ['手动 UTC 偏移', '中国大陆 · Asia/Shanghai', '香港 · Asia/Hong_Kong', '台北 · Asia/Taipei', '东京 · Asia/Tokyo', '新加坡 · Asia/Singapore', '印度 · Asia/Kolkata', '尼泊尔 · Asia/Kathmandu', '纽约 · America/New_York', '洛杉矶 · America/Los_Angeles', '伦敦 · Europe/London', '巴黎 · Europe/Paris', '悉尼 · Australia/Sydney', '奥克兰 · Pacific/Auckland', '其他 IANA 时区']
const zoneIndex = computed(() => props.modelValue.customTimeZone || !zones.includes(props.modelValue.timeZone) ? zones.length - 1 : zones.indexOf(props.modelValue.timeZone))
const choices = ['', 'earlier', 'later'] as const
const choiceLabels = ['需要时提醒我确认', '较早的一次（回拨前）', '较晚的一次（回拨后）']
const choiceIndex = computed(() => choices.indexOf(props.modelValue.timeChoice))
const summary = computed(() => [props.modelValue.timeZone || (props.modelValue.customTimeZone ? '自定义时区待填写' : '手动 UTC 偏移'), props.modelValue.placeEnabled ? '含整宫制宫位' : '未填写地点', props.modelValue.observationDate ? '观察 ' + props.modelValue.observationDate : '本命盘', ...(props.modelValue.compareRules ? ['含规则对照'] : [])].join(' · '))
function set<K extends keyof BirthExtrasValue>(key: K, value: BirthExtrasValue[K]) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
async function choosePlace(place: { name: string; latitude?: number; longitude?: number; timeZone?: string; coordinateLabel?: string } | null) {
 await nextTick()
 const hasCoordinates = typeof place?.latitude === 'number' && Number.isFinite(place.latitude) && typeof place?.longitude === 'number' && Number.isFinite(place.longitude)
 const needsTimeZone = !place && Boolean(props.modelValue.timeZone || props.modelValue.customTimeZone)
 if (needsTimeZone) open.value = true
 emit('update:modelValue', { ...props.modelValue, placeName: place?.name ?? props.modelValue.placeName, placeEnabled: hasCoordinates, latitude: hasCoordinates ? String(place!.latitude) : '', longitude: hasCoordinates ? String(place!.longitude) : '', timeZone: place?.timeZone || '', customTimeZone: needsTimeZone, timeChoice: '' })
 await nextTick()
 coordinateLabel.value = place?.coordinateLabel || ''
}
function inputText(key: 'timeZone' | 'placeName' | 'latitude' | 'longitude', event: unknown) {
 const value = (event as { detail: { value: string } }).detail.value
 if (typeof value === 'string') set(key, value)
}
function chooseZone(event: { detail: { value: string | number } }) {
 const index = Number(event.detail.value)
 const customTimeZone = index === zones.length - 1
 emit('update:modelValue', { ...props.modelValue, customTimeZone, timeZone: customTimeZone ? '' : zones[index], timeChoice: '' })
}
</script>
<style scoped>
.extra-settings { border-top: 1px solid #eee7f4; margin: 8px 0 20px; padding-top: 10px; }.toggle { width: 100%; padding: 6px 0; display: flex; justify-content: space-between; gap: 8px; text-align: left; background: transparent; color: #6e528e; font-size: 13px; white-space: normal; line-height: 1.8; min-height: 44px; }.hint { display: block; margin-top: 7px; font-size: 11px; line-height: 1.9; color: #82718e; }.extra-body { padding-top: 18px; }.form-group { margin-bottom: 18px; }.form-label { font-size: 13px; }.form-picker { font-size: 12px; white-space: normal; }.custom-zone { margin-top: 8px; }.coordinate-toggle { width: 100%; white-space: normal; padding: 10px; line-height: 1.8; font-size: 12px; color: #6c518b; background: #f2ecf8; }.coordinate-fields { margin-top: 16px; }.coordinate-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; margin-top: 16px; }.coordinate-grid > view { min-width: 0; }.form-input { min-width: 0; font-size: 13px; box-sizing: border-box; }.observation { margin-top: 22px; }.text-button { font-size: 11px; padding-left: 0; }
</style>
