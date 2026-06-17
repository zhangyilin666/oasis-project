<template>
  <view class="profile-page">
    <!-- 头像 + 用户信息 -->
    <view class="card profile-card">
      <view class="avatar-placeholder">
        <text class="avatar-text">{{ firstChar }}</text>
      </view>
      <view class="profile-info">
        <view class="id-row" @click="copyUserId">
          <text class="id-label">用户 ID</text>
          <text class="id-value">{{ userIdStr }}</text>
          <text class="copy-hint">点击复制</text>
        </view>
        <view class="login-time-row" v-if="loginTime">
          <text class="meta-label">登录时间</text>
          <text class="meta-value">{{ loginTime }}</text>
        </view>
      </view>
    </view>

    <!-- 重置设备 -->
    <view class="action-section">
      <button class="btn-reset" :disabled="isResetting" @click="handleReset">
        {{ isResetting ? '正在重置...' : '重置账号' }}
      </button>
      <text class="reset-hint">重置后将使用新的设备标识，历史报告不会丢失</text>
    </view>

    <!-- 法律链接 -->
    <view class="legal-section">
      <text class="legal-link" @click="openAgreement('user')">《用户协议》</text>
      <text class="legal-separator">|</text>
      <text class="legal-link" @click="openAgreement('privacy')">《隐私政策》</text>
    </view>

    <!-- 版本信息 -->
    <view class="version-footer">
      <text class="version-text">小易 v1.0.0</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { getUserId, getLoginTime } from '@/utils/storage'

const auth = useAuthStore()
const userIdStr = ref('')
const firstChar = ref('?')
const loginTime = ref('')
const isResetting = ref(false)

function loadProfile() {
  const uid = getUserId()
  userIdStr.value = uid ? String(uid) : ''
  firstChar.value = userIdStr.value ? userIdStr.value[0] : '?'
  loginTime.value = getLoginTime() || ''
}

onLoad(() => { loadProfile() })
onShow(() => { loadProfile() })

async function handleReset() {
  if (isResetting.value) return

  const res = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '重置账号',
      content: '将使用新的设备标识重新登录。你的分析报告保存在当前账号下，重置不会丢失数据。确定继续吗？',
      success: (r) => resolve(r.confirm),
      fail: () => resolve(false),
    })
  })

  if (!res) return

  isResetting.value = true
  try {
    await auth.resetDevice()
    loadProfile()
    uni.showToast({ title: '已重置', icon: 'success' })
  } catch {
    uni.showToast({ title: '重置失败，请重试', icon: 'none' })
  } finally {
    isResetting.value = false
  }
}

function copyUserId() {
  if (!userIdStr.value) return
  uni.setClipboardData({
    data: String(userIdStr.value),
    success: () => {
      uni.showToast({ title: '用户 ID 已复制', icon: 'success', duration: 1500 })
    },
  })
}

function openAgreement(type: string) {
  uni.navigateTo({ url: `/pages/agreement/index?type=${type}` })
}
</script>

<style lang="scss" scoped>
.profile-page { padding: 24rpx; }
.profile-card {
  display: flex;
  align-items: center;
  padding: 1rem;
}
.avatar-placeholder {
  width: 3.125rem;
  height: 3.125rem;
  border-radius: 50%;
  background: #2c5f2d;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}
.avatar-text { color: #fff; font-size: 1.25rem; font-weight: 700; }
.profile-info { flex: 1; }
.id-row { display: flex; align-items: center; margin-bottom: 0.25rem; }
.id-label { font-size: 26rpx; color: #7a7a7a; margin-right: 12rpx; }
.id-value { font-size: 32rpx; font-weight: 600; color: #2c5f2d; margin-right: 12rpx; }
.copy-hint { font-size: 22rpx; color: #7a7a7a; }
.login-time-row { display: flex; align-items: center; }
.meta-label { font-size: 22rpx; color: #7a7a7a; margin-right: 12rpx; }
.meta-value { font-size: 22rpx; color: #555555; }
.action-section { margin-top: 1.5rem; }
.btn-reset {
  width: 100%;
  height: 2.75rem;
  background: #fff;
  color: #2c5f2d;
  border: 1rpx solid #2c5f2d;
  border-radius: 1.375rem;
  font-size: 28rpx;
  line-height: 2.75rem;
}
.reset-hint {
  font-size: 22rpx;
  color: #7a7a7a;
  display: block;
  text-align: center;
  margin-top: 12rpx;
}
.legal-section { display: flex; justify-content: center; margin-top: 1.5rem; }
.legal-link { font-size: 26rpx; color: #2c5f2d; }
.legal-separator { margin: 0 0.5rem; color: #7a7a7a; }
.version-footer { display: flex; justify-content: center; margin-top: 1rem; }
.version-text { font-size: 22rpx; color: #7a7a7a; }
</style>
