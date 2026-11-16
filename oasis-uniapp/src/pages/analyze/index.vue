<template>
 <view class="page-shell analyze-page">
  <view v-if="DEMO_MODE" class="demo-banner">离线界面体验版 · 不会生成真实解读</view>
  <view class="form-intro"><view><text class="eyebrow">命 · 认识自己</text><text class="page-heading">八字 AI 解读</text><text class="page-caption">填写出生资料，读懂自己的四柱与大运。</text></view><CatCompanion small mood="comfort" /></view>
  <view class="journey-guide"><text>填写资料</text><text aria-hidden="true">→</text><text>AI 解读</text><text aria-hidden="true">→</text><text>报告中回看</text></view>
  <view class="completion-row"><text>出生资料</text><text>{{ completedFields }} / 5 项已填写</text></view>
  <view class="completion-track" role="progressbar" :aria-valuenow="completedFields" aria-valuemin="0" aria-valuemax="5" aria-label="资料填写进度"><view :style="{ width: completedFields * 20 + '%' }"></view></view>
  <view class="form-section">
   <view class="form-group" id="field-name">
    <label class="form-label" for="birth-name">怎么称呼你</label>
    <!-- #ifndef MP-WEIXIN -->
    <input id="birth-name" v-input-label="'姓名或昵称'" class="form-input" :class="{ 'field-invalid': errors.name }" v-model="nameDraft" placeholder="姓名或昵称" maxlength="50" :focus="nameFocus" @focus="nameFocus = true" @blur="nameFocus = false" aria-label="姓名或昵称" />
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    <input id="birth-name" class="form-input" :class="{ 'field-invalid': errors.name }" v-model="nameDraft" placeholder="姓名或昵称" maxlength="50" :focus="nameFocus" @focus="nameFocus = true" @blur="nameFocus = false" aria-label="姓名或昵称" />
    <!-- #endif -->
    <text class="form-error" v-if="errors.name">{{ errors.name }}</text>
   </view>
   <view class="form-group" id="field-gender"><text class="form-label">性别</text>
    <view class="gender-options" role="group" aria-label="选择性别"><AppButton v-for="g in genders" :key="g" :class="{ selected: gender === g }" :aria-pressed="gender === g" @click="gender = g; delete errors.gender">{{ g }}<text v-if="gender === g" aria-hidden="true"> ✓</text></AppButton></view>
    <text class="form-error" v-if="errors.gender">{{ errors.gender }}</text>
   </view>
   <view class="form-group" id="field-birth_date"><text class="form-label">出生日期</text>
    <BirthDateField v-model="birthDate" :max="todayMax" :invalid="Boolean(errors.birth_date)" />
    <text class="form-error" v-if="errors.birth_date">{{ errors.birth_date }}</text>
   </view>
   <view class="form-group" id="field-birth_time"><text class="form-label">出生时间 <text class="field-tag">北京时间</text></text>
    <BirthTimeField v-model="birthTime" label-prefix="北京时间出生" :invalid="Boolean(errors.birth_time)" />
    <text class="field-note">请填写北京时间。时间不详时先核实，不用默认时刻代替。</text>
    <text class="form-error" v-if="errors.birth_time">{{ errors.birth_time }}</text>
   </view>
   <view class="form-group" id="field-location"><text class="form-label">出生地区</text>
    <BirthPlaceField v-model="locationDraft" :invalid="Boolean(errors.location)" />
    <text class="form-error" v-if="errors.location">{{ errors.location }}</text>
   </view>
  </view>
  <view class="privacy-note"><AppIcon name="shield" /><text>{{ DEMO_MODE ? '体验版不会上传或保存你填写的信息。' : '报告保存在你的账号中。资料草稿仅保留在本机，提交后自动清除。' }}</text></view>
  <view class="submit-dock"><AppButton class="btn-primary" @click="handleSubmit" :disabled="submitting">{{ DEMO_MODE ? '查看示例解读' : submitting ? '正在为你准备…' : '生成八字 AI 解读' }}<text v-if="!submitting" aria-hidden="true">→</text></AppButton><text class="submit-note">{{ DEMO_MODE ? '示例内容与填写的信息无关' : '生成约需 1–3 分钟，可稍后在「报告」查看' }}</text></view>
 </view>
</template>
<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { analyzeApi } from '@/api/xiaoyi'
import { ensureSession } from '@/api/session'
import { getUserId } from '@/utils/storage'
import { DEMO_MODE } from '@/config/env'
import CatCompanion from '@/components/CatCompanion.vue'
import AppIcon from '@/components/AppIcon.vue'
import BirthDateField from '@/components/birth/BirthDateField.vue'
import BirthTimeField from '@/components/birth/BirthTimeField.vue'
import BirthPlaceField from '@/components/birth/BirthPlaceField.vue'
const nameDraft = ref(''), birthDate = ref(''), birthTime = ref(''), gender = ref(''), locationDraft = ref('')
const nameFocus = ref(false), submitting = ref(false)
const errors = reactive<Record<string,string>>({})
const genders = ['男', '女']
const completedFields = computed(() => [nameDraft.value.trim(), birthDate.value, birthTime.value, gender.value, locationDraft.value.trim()].filter(Boolean).length)
const now = new Date()
const todayMax = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-')
let draftKey = '', restoring = true
onLoad(async () => {
 if (DEMO_MODE) { restoring = false; return }
 try {
  await ensureSession()
  draftKey = '__xiaoyi_birth_draft_' + getUserId()
  const draft = uni.getStorageSync(draftKey)
  if (draft && typeof draft === 'object') {
   nameDraft.value = typeof draft.name === 'string' ? draft.name : ''
   birthDate.value = typeof draft.birth_date === 'string' ? draft.birth_date : ''
   birthTime.value = typeof draft.birth_time === 'string' ? draft.birth_time : ''
   gender.value = genders.includes(draft.gender) ? draft.gender : ''
   locationDraft.value = typeof draft.location === 'string' ? draft.location : ''
  }
 } catch { /* 提交请求仍会尝试登录并显示错误。 */ }
 finally { restoring = false }
})
function payload() { return { name: nameDraft.value.trim(), birth_date: birthDate.value, birth_time: birthTime.value, gender: gender.value, location: locationDraft.value.trim(), is_solar_time: true } }
watch([nameDraft,birthDate,birthTime,gender,locationDraft], () => {
 if (!DEMO_MODE && !restoring && draftKey) uni.setStorageSync(draftKey, payload())
 for (const key of Object.keys(errors)) if ((payload() as any)[key]) delete errors[key]
}, { flush: 'sync' })
function validate() {
 Object.keys(errors).forEach(k => delete errors[k])
 if (!nameDraft.value.trim()) errors.name = '请填写一个姓名或昵称'
 if (!gender.value) errors.gender = '请选择性别'
 if (!birthDate.value) errors.birth_date = '请选择完整的出生日期'
 else if (birthDate.value > todayMax || birthDate.value < '1900-01-01') errors.birth_date = '请选择 1900 年至今天之间的日期'
 if (!birthTime.value) errors.birth_time = '请选择出生时间'
 if (!locationDraft.value.trim()) errors.location = '请填写出生城市'
 const first = Object.keys(errors)[0]
 if (first) { uni.pageScrollTo({ selector: '#field-' + first, duration: 200 }); if (first === 'name') nameFocus.value = true; return false }
 return true
}
async function handleSubmit() {
 if (DEMO_MODE) { uni.navigateTo({ url: '/pages/report-detail/index?id=1' }); return }
 if (submitting.value || !validate()) return
 submitting.value = true
 try {
  const res = await analyzeApi(payload())
  if (draftKey) uni.removeStorageSync(draftKey)
  uni.redirectTo({ url: '/pages/report-detail/index?id=' + res.data.report_id })
 } catch (e: any) { uni.showToast({ title: e.message || '暂时没有提交成功，请重试', icon: 'none' }) }
 finally { submitting.value = false }
}
</script>
<style scoped>
.demo-banner { margin-bottom: 16px; padding: 10px 14px; border-radius: 12px; background: #fff1db; color: #76551c; font-size: 12px; }
.analyze-page { padding-bottom: calc(132px + env(safe-area-inset-bottom)); }
.form-intro { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 28px; }
.form-intro .page-caption { font-size: 12px; }.form-intro .page-heading { font-size: 24px; }
.completion-row { display: flex; justify-content: space-between; font-size: 12px; color: #736581; margin-bottom: 8px; }
.completion-track { height: 4px; background: #eae3f2; border-radius: 4px; overflow: hidden; }
.completion-track > view { height: 100%; background: #9b83c5; border-radius: 4px; transition: width .2s; }
.form-section { padding-top: 28px; }.form-group:last-child { margin-bottom: 16px; }
.field-tag { font-size: 12px; font-weight: 400; color: #796a89; margin-left: 8px; background: #f1ecf8; padding: 2px 8px; border-radius: 6px; }
.gender-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.gender-options button { width: 100%; border: 1px solid #e5dfed; border-radius: 14px; margin: 0; font-size: 16px; min-height: 48px; line-height: 48px; background: #fff; color: #625b72; }
.gender-options .selected { background: #eee7f8; border-color: #a18abb; color: #59428e; font-weight: 600; }
.placeholder { color: #8a8297; }.field-note { display: block; color: #777083; font-size: 12px; margin-top: 8px; }
.privacy-note { display: flex; gap: 8px; font-size: 12px; color: #777083; align-items: flex-start; padding: 16px 0; }
.submit-dock { position: fixed; bottom: 0; left: 0; right: 0; z-index: 10; background: #faf8fc; border-top: 1px solid #eee8f4; padding: 16px 20px calc(12px + env(safe-area-inset-bottom)); max-width: 560px; box-sizing: border-box; margin: auto; }
.submit-dock .btn-primary { justify-content: space-between; }
.submit-note { display: block; text-align: center; color: #777083; font-size: 12px; margin-top: 8px; }
</style>
