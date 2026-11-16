<template>
 <view class="birth-form">
  <text class="person-label">{{ role }} · {{ role === 'A' ? '主要资料' : '对照资料' }}</text>
  
    <!-- #ifdef H5 -->
    
  <select v-if="sharedProfiles.length" class="field import-field" :aria-label="role + '填入本机出生资料'" value="0" @change="fillShared(($event.target as HTMLSelectElement).value)"><option value="0">填入本机出生资料</option><option v-for="(record, index) in sharedProfiles" :key="record.id" :value="index + 1">{{ record.name }} · {{ record.result.profile.date }}</option></select>
  
    <!-- #endif -->
    
  
    <!-- #ifndef H5 -->
    
  <picker v-if="sharedProfiles.length" :range="sharedLabels" :value="0" @change="fillShared($event.detail.value)"><view class="field import-field">填入本机出生资料</view></picker>
  
    <!-- #endif -->
    
  <view class="field-group"><text class="label">称呼</text><input v-model="form.name" class="field" maxlength="30" :aria-label="role + '称呼'" placeholder="用于区分两份资料" /></view>
  <view class="grid">
   <view class="full-field"><text class="label">出生日期</text><BirthDateField v-model="form.date" :max="birthMax" :label-prefix="role + ' 出生'" /></view>
   <view class="full-field"><text class="label">当地出生时间</text><BirthTimeField v-model="form.time" :label-prefix="role + ' 出生'" /></view>
   <view><text class="label">时间精度</text>
    
    <!-- #ifdef H5 -->
    <select v-model.number="form.precisionIndex" class="field" :aria-label="role + '时间精度'"><option v-for="(label, index) in precisionLabels" :key="label" :value="index">{{ label }}</option></select>
    <!-- #endif -->
    
    
    <!-- #ifndef H5 -->
    <picker :range="precisionLabels" :value="form.precisionIndex" @change="form.precisionIndex = Number($event.detail.value)"><view class="field">{{ precisionLabels[form.precisionIndex] }}</view></picker>
    <!-- #endif -->
    
   </view>
   <view><text class="label">性别 · 仅资料留档</text>
    
    <!-- #ifdef H5 -->
    <select v-model.number="form.genderIndex" class="field" :aria-label="role + '资料性别'"><option v-for="(label, index) in genderLabels" :key="label" :value="index">{{ label }}</option></select>
    <!-- #endif -->
    
    
    <!-- #ifndef H5 -->
    <picker :range="genderLabels" :value="form.genderIndex" @change="form.genderIndex = Number($event.detail.value)"><view class="field">{{ genderLabels[form.genderIndex] }}</view></picker>
    <!-- #endif -->
    
   </view>
  </view>
  <text class="hint">出生时间完全不详时请先核实；选择大约时间会保留所填时刻的天体位置，并停用宫位。</text>
  <view class="field-group"><text class="label">出生地区（选填）</text><BirthPlaceField v-model="form.placeName" :label-prefix="role + ' 出生'" @select="selectPlace" /><text class="hint">选择地区可填写城市中心坐标与时区；中心坐标是近似位置，可在高级设置中修改。</text><text v-if="regionCoordinates" class="hint">本次使用城市中心坐标，不代表具体出生地址。</text></view>
  <AppButton class="advanced-toggle" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen"><text>时区与精确坐标</text><text aria-hidden="true">{{ advancedOpen ? '−' : '＋' }}</text></AppButton>
  <text class="hint">{{ form.timeZone ? '历史时区 · ' + form.timeZone : form.utcOffset.trim() ? '手动 UTC 偏移 · ' + form.utcOffset + ' 小时，请按出生地核对' : '请在高级设置中确认出生时区' }}</text>
  <view v-if="advancedOpen" class="advanced-fields">
   <view class="field-group"><text class="label">历史 IANA 时区 · 可选</text><input v-model="form.timeZone" class="field" maxlength="100" :aria-label="role + '历史IANA时区'" placeholder="如 Asia/Shanghai" /><text class="hint">填写 IANA 后按该地历史时区解析夏令时，结果会显示实际偏移。</text></view>
   <view v-if="!form.timeZone.trim()" class="field-group"><text class="label">手动 UTC 偏移</text><input v-model="form.utcOffset" class="field" :aria-label="role + 'UTC偏移'" placeholder="如 8、-5、5.5" /></view>
   <view v-if="form.timeZone.trim()" class="field-group"><text class="label">遇到夏令时回拨的重复时刻</text>
   
    <!-- #ifdef H5 -->
    <select v-model.number="form.choiceIndex" class="field" :aria-label="role + '重复时刻选择'"><option v-for="(label, index) in choiceLabels" :key="label" :value="index">{{ label }}</option></select>
    <!-- #endif -->
    
   
    <!-- #ifndef H5 -->
    <picker :range="choiceLabels" :value="form.choiceIndex" @change="form.choiceIndex = Number($event.detail.value)"><view class="field">{{ choiceLabels[form.choiceIndex] }}</view></picker>
    <!-- #endif -->
    
   </view>
   <AppButton class="place-toggle" :aria-pressed="form.placeEnabled" @click="form.placeEnabled = !form.placeEnabled">{{ form.placeEnabled ? '已启用地点坐标 · 点击停用' : '手动填写地点坐标以比较宫位' }}</AppButton>
   <view v-if="form.placeEnabled" class="place-fields"><view class="grid"><view><text class="label">纬度 · 南纬为负</text><input v-model="form.latitude" class="field" :aria-label="role + '纬度'" placeholder="如 31.2304" /></view><view><text class="label">经度 · 西经为负</text><input v-model="form.longitude" class="field" :aria-label="role + '经度'" placeholder="如 121.4737" /></view></view><text class="hint">宫位支持纬度绝对值小于66°；超出范围时仅保留天体与相位。</text></view>
  </view>
 </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import BirthDateField from '@/components/birth/BirthDateField.vue'
import BirthTimeField from '@/components/birth/BirthTimeField.vue'
import BirthPlaceField from '@/components/birth/BirthPlaceField.vue'
import type { SavedChart } from '@/domain/metaphysics/archive'
import { fillPersonForm, type StudyPersonForm } from './form'
const props = defineProps<{ form: StudyPersonForm; role: 'A' | 'B'; sharedProfiles: SavedChart[] }>()
const birthMax = new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10)
const advancedOpen = ref(false), regionCoordinates = ref(false)
const precisionLabels = ['请选择', '已确认到分钟', '大约时间']
const genderLabels = ['请选择', '女', '男']
const choiceLabels = ['需要时提醒我确认', '较早的一次（回拨前）', '较晚的一次（回拨后）']
const sharedLabels = computed(() => ['填入本机出生资料', ...props.sharedProfiles.map(record => `${record.name} · ${record.result.profile.date}`)])
function fillShared(value: string | number) { const record = props.sharedProfiles[Number(value) - 1]; if (record) fillPersonForm(props.form, record.name.slice(0, 30), record.result.profile) }
watch([() => props.form.placeName, () => props.form.latitude, () => props.form.longitude], () => { regionCoordinates.value = false }, { flush: 'sync' })
function selectPlace(place: { name: string; latitude?: number; longitude?: number; timeZone?: string } | null) {
 const hasCoordinates = typeof place?.latitude === 'number' && Number.isFinite(place.latitude) && typeof place.longitude === 'number' && Number.isFinite(place.longitude)
 props.form.placeEnabled = hasCoordinates
 props.form.latitude = hasCoordinates ? String(place!.latitude) : ''
 props.form.longitude = hasCoordinates ? String(place!.longitude) : ''
 if (place) props.form.placeName = place.name
 if (place?.timeZone) props.form.timeZone = place.timeZone
 else {
  if (props.form.timeZone) props.form.utcOffset = ''
  props.form.timeZone = ''; advancedOpen.value = true
 }
 props.form.choiceIndex = 0
 regionCoordinates.value = hasCoordinates
}
</script>

<style scoped>
.full-field { grid-column: 1/-1; }.advanced-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 44px; padding: 10px 0; margin: 16px 0 0; border-top: 1px solid #eee7f4; background: transparent; color: #79618a; font-size: 13px; line-height: 1.7; text-align: left; white-space: normal; }
.birth-form{min-width:0;padding-top:18px}.person-label,.label,.hint{display:block}.person-label{font-size:16px;color:#604c72;font-weight:650;margin-bottom:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0 8px}.grid>view{min-width:0}.field-group{margin:16px 0}.label{font-size:12px;line-height:1.6;color:#776283;margin-bottom:8px}.field{box-sizing:border-box;width:100%;min-width:0;height:46px;min-height:44px;padding:11px;background:#f9f6fb;border:1px solid #eee7f4;border-radius:12px;color:#624e70;font-size:12px;line-height:1.6}.import-field{margin:6px 0 10px}.hint{color:#918499;font-size:11px;line-height:1.85;overflow-wrap:anywhere}.place-toggle{width:100%;min-height:44px;padding:12px;background:#f1ebf7;color:#79618a;border-radius:12px;font-size:12px;line-height:1.8;margin-top:16px;white-space:normal}@media(max-width:360px){.grid{gap:8px}.field{padding:8px;font-size:11px}.label{font-size:11px}}
</style>
