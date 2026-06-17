<template>
  <view class="analyze-page">
    <view class="card">
      <!-- 姓名 -->
      <view class="form-group" @click="nameFocus = true">
        <view class="form-label">
          <text>姓名</text><text class="required">*</text>
        </view>
        <input class="form-input" v-model="nameDraft" placeholder="请输入您的姓名" maxlength="50" :focus="nameFocus" @focus="nameFocus = true" @blur="onNameBlur" />
        <text class="form-error" v-if="errors.name">{{ errors.name }}</text>
      </view>

      <!-- 出生日期 -->
      <view class="form-group">
        <view class="form-label">
          <text>{{ isSolar ? '出生日期（公历）' : '出生日期（农历）' }}</text>
          <text class="required">*</text>
          <text class="solar-toggle" @click.stop="isSolar = !isSolar">{{ isSolar ? '切换农历' : '切换公历' }}</text>
        </view>
        <picker mode="date" :value="birthDate" @change="onDateChange" :end="todayMax">
          <view class="form-picker" :class="{ placeholder: !birthDate }">{{ birthDate || '请选择出生日期' }}</view>
        </picker>
        <text class="form-error" v-if="errors.birth_date">{{ errors.birth_date }}</text>
      </view>

      <!-- 出生时间 -->
      <view class="form-group">
        <view class="form-label">
          <text>出生时间</text><text class="required">*</text>
        </view>
        <picker mode="time" :value="birthTime" @change="onTimeChange">
          <view class="form-picker" :class="{ placeholder: !birthTime }">{{ birthTime || '请选择出生时间' }}</view>
        </picker>
        <text class="form-error" v-if="errors.birth_time">{{ errors.birth_time }}</text>
      </view>

      <!-- 性别 -->
      <view class="form-group">
        <view class="form-label">
          <text>性别</text><text class="required">*</text>
        </view>
        <picker mode="selector" :range="genders" :value="genderIndex" @change="onGenderChange">
          <view class="form-picker" :class="{ placeholder: !gender }">{{ gender || '请选择性别' }}</view>
        </picker>
        <text class="form-error" v-if="errors.gender">{{ errors.gender }}</text>
      </view>

      <!-- 出生地点 -->
      <view class="form-group" @click="locationFocus = true">
        <view class="form-label">
          <text>出生地点</text><text class="required">*</text>
        </view>
        <input class="form-input" v-model="locationDraft" placeholder="例如：北京" maxlength="100" :focus="locationFocus" @focus="locationFocus = true" @blur="onLocationBlur" />
        <text class="form-error" v-if="errors.location">{{ errors.location }}</text>
      </view>

      <button class="btn-primary" @click="handleSubmit" :disabled="submitting">
        {{ submitting ? '正在提交...' : '开始八字命理分析' }}
      </button>
      <text class="submit-note">分析可能需要几十秒，请耐心等待</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { analyzeApi } from '@/api/xiaoyi'

const nameDraft = ref('')
const birthDate = ref('')
const birthTime = ref('')
const gender = ref('')
const genderIndex = ref(-1)
const isSolar = ref(true)
const locationDraft = ref('')
const nameFocus = ref(false)
const locationFocus = ref(false)
const submitting = ref(false)

const errors = reactive<Record<string, string>>({})
const genders = ['男', '女']

const todayMax = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})()

function onNameBlur(e: any) {
  nameDraft.value = e.detail.value || ''
  nameFocus.value = false
  delete errors.name
}

function onDateChange(e: any) {
  birthDate.value = e.detail.value
  delete errors.birth_date
}

function onTimeChange(e: any) {
  birthTime.value = e.detail.value
  delete errors.birth_time
}

function onGenderChange(e: any) {
  const idx = parseInt(e.detail.value)
  genderIndex.value = idx
  gender.value = genders[idx]
  delete errors.gender
}

function onLocationBlur(e: any) {
  locationDraft.value = e.detail.value || ''
  locationFocus.value = false
  delete errors.location
}

function validate(): boolean {
  const errs: Record<string, string> = {}
  const name = (nameDraft.value || '').trim()
  const location = (locationDraft.value || '').trim()

  if (!name) errs.name = '请输入姓名'
  if (!birthDate.value) errs.birth_date = '请选择出生日期'
  if (!birthTime.value) errs.birth_time = '请选择出生时间'
  if (!gender.value) errs.gender = '请选择性别'
  if (!location) errs.location = '请输入出生地点'

  Object.keys(errors).forEach(k => delete errors[k])
  Object.assign(errors, errs)

  if (Object.keys(errs).length > 0) {
    uni.showToast({ title: '请完善表单信息', icon: 'none' })
    return false
  }
  return true
}

async function handleSubmit() {
  if (!validate()) return
  if (submitting.value) return

  submitting.value = true
  try {
    const res = await analyzeApi({
      name: (nameDraft.value || '').trim(),
      birth_date: birthDate.value,
      birth_time: birthTime.value,
      gender: gender.value,
      location: (locationDraft.value || '').trim(),
      is_solar_time: isSolar.value,
    })

    if (res.code === 200 && res.data) {
      uni.redirectTo({ url: `/pages/report-detail/index?id=${res.data.report_id}` })
    } else {
      uni.showToast({ title: res.message || '分析失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '分析失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.analyze-page { padding: 24rpx; }
.form-label {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  color: #555555;
  margin-bottom: 8rpx;
}
.required { color: #d32f2f; margin-left: 0.125rem; }
.solar-toggle { margin-left: auto; color: #2c5f2d; font-size: 22rpx; }
.form-input {
  width: 100%;
  height: 88rpx;
  background: #f5f5f5;
  border: 1rpx solid #e0e0e0;
  border-radius: 18rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.form-picker {
  height: 2.75rem;
  line-height: 2.75rem;
  padding: 0 24rpx;
  background: #f5f5f5;
  border: 1rpx solid #e0e0e0;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.form-picker.placeholder { color: #7a7a7a; }
.form-error { display: block; margin-top: 8rpx; font-size: 22rpx; color: #d32f2f; }
.form-group { margin-bottom: 26rpx; }
.btn-primary {
  width: 100%;
  height: 88rpx;
  border-radius: 44rpx;
  background: #2c5f2d;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 88rpx;
  text-align: center;
  border: none;
  margin-top: 10rpx;
}
.submit-note {
  text-align: center;
  font-size: 22rpx;
  color: #7a7a7a;
  margin-top: 12rpx;
  display: block;
}
</style>
