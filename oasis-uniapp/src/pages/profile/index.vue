<template>
 <view class="page-shell profile-page">
  <view v-if="DEMO_MODE" class="demo-banner">离线界面体验版 · 没有在线账号</view>
  <text class="eyebrow">猫来运转 · 你的安静角落</text>
  <view class="profile-intro"><view><text class="page-heading">很高兴，遇见你</text><text class="page-caption">好好了解自己，也好好照顾自己。</text></view><CatCompanion small mood="resting" /></view>
  <view v-if="!DEMO_MODE" class="account-strip"><AppIcon name="cat" /><view><text class="account-label">我的猫来运转账号</text><text class="account-id">{{ userIdStr ? 'ID · ' + userIdStr : '正在连接…' }}</text><text v-if="isAdmin" class="account-role">管理员 · AI 解读不限次数</text></view><AppButton class="text-button" @click="copyUserId" :disabled="!userIdStr">复制 ID</AppButton></view>
  <AppButton class="menu-row" @click="goReports"><AppIcon name="book" /><text>我的探索手记</text><AppIcon name="arrow" /></AppButton>
  <view v-if="!DEMO_MODE" class="recovery-card">
   <view class="recovery-heading"><view class="shield-circle"><AppIcon name="shield" /></view><view><text class="section-title">给你的手记，一把钥匙</text><text class="page-caption">换手机，也能找回熟悉的自己</text></view></view>
   <text class="recovery-description">恢复码可以找回这个账号的报告。请先保存到自己的备忘录，像密码一样妥善保管。</text>
   <AppButton class="btn-primary" @click="copyRecovery" :disabled="copying">{{ copying ? '正在准备…' : copied ? '已复制，再保存一份' : '复制我的恢复码' }}</AppButton>
   <AppButton class="text-button recovery-reveal" @click="toggleRecovery" :aria-expanded="recoveryVisible">{{ recoveryVisible ? '收起恢复码' : '无法复制？查看恢复码' }}</AppButton>
   <view v-if="recoveryVisible" class="recovery-code"><text selectable>{{ ownRecoveryCode }}</text><text class="muted">长按选择并复制，请不要分享给他人。</text></view>
   <text v-if="copyError" class="form-error" role="alert">{{ copyError }}</text>
  </view>
  <view v-if="!DEMO_MODE" class="restore-section">
   <AppButton class="menu-row" @click="showRestore = !showRestore" :aria-expanded="showRestore"><AppIcon name="moon" /><view><text>我有旧账号</text><text class="menu-hint">使用恢复码，找回之前的报告</text></view><text class="expand-mark">{{ showRestore ? '−' : '＋' }}</text></AppButton>
   <view v-if="showRestore" class="restore-form">
    <label class="form-label" for="recovery-code">旧账号恢复码</label>
    <!-- #ifndef MP-WEIXIN -->
    <input id="recovery-code" v-input-label="'旧账号恢复码'" class="form-input" :password="true" v-model="recoveryCode" placeholder="粘贴 mlyz账号ID- 开头的恢复码" aria-label="旧账号恢复码" @input="restoreError = ''" />
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    <input id="recovery-code" class="form-input" :password="true" v-model="recoveryCode" placeholder="粘贴 mlyz账号ID- 开头的恢复码" aria-label="旧账号恢复码" @input="restoreError = ''" />
    <!-- #endif -->
    <text class="field-hint">仅支持 mlyz 和账号 ID 开头的新版恢复码。恢复后会切换账号，请先保存当前账号的恢复码。</text>
    <text v-if="restoreError" class="form-error" role="alert">{{ restoreError }}</text>
    <AppButton class="btn-secondary" :disabled="isResetting || !recoveryCode.trim()" @click="handleRestore">{{ isResetting ? '正在找回你的手记…' : '恢复并切换账号' }}</AppButton>
   </view>
  </view>
  <view class="little-note"><CatCompanion small character="herbal" /><view><text class="herbal-title">草木小先生陪你</text><text>慢一点也没关系，照顾好自己的节奏。</text></view></view>
  <view class="legal-section"><AppButton class="text-button" @click="openAgreement('user')">用户协议</AppButton><text>·</text><AppButton class="text-button" @click="openAgreement('privacy')">隐私政策</AppButton></view>
  <text class="version-text">猫来运转 1.0 · 与自己温柔相处</text>
 </view>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { getUserId, getDeviceId, setUserId } from '@/utils/storage'
import { DEMO_MODE } from '@/config/env'
import { ensureSession, restoreAccount } from '@/api/session'
import { getMyAccountApi } from '@/api/auth'
import { formatRecoveryCode } from '@/utils/recovery-code'
import CatCompanion from '@/components/CatCompanion.vue'
import AppIcon from '@/components/AppIcon.vue'
const recoveryCode = ref(''), userIdStr = ref(''), isResetting = ref(false), showRestore = ref(false), restoreError = ref('')
const copied = ref(false), copying = ref(false), recoveryVisible = ref(false), ownRecoveryCode = ref(''), copyError = ref('')
const isAdmin = ref(false)
const auth = useAuthStore()
let profileGeneration = 0
function clearProfile() {
 profileGeneration++
 userIdStr.value = ''; isAdmin.value = false
}
async function loadProfile() {
 clearProfile()
 const generation = profileGeneration
 try {
  await ensureSession()
  if (generation !== profileGeneration) return false
  const { data } = await getMyAccountApi()
  if (generation !== profileGeneration) return false
  if (!Number.isInteger(data.user_id) || data.user_id < 0 || typeof data.is_admin !== 'boolean') throw new Error('账号身份暂时无法确认，请重试')
  setUserId(data.user_id); auth.userId = data.user_id
  userIdStr.value = String(data.user_id); isAdmin.value = data.is_admin
  return true
 } catch (error: any) {
  if (generation !== profileGeneration) return false
  userIdStr.value = String(getUserId() ?? '')
  uni.showToast({ title: error.message || '账号加载失败', icon: 'none' })
  return false
 }
}
onShow(() => {
 if (!DEMO_MODE && !isResetting.value) void loadProfile()
})
onHide(() => { clearProfile(); recoveryVisible.value = false; ownRecoveryCode.value = ''; recoveryCode.value = '' })
async function toggleRecovery() {
 if (recoveryVisible.value) { recoveryVisible.value = false; ownRecoveryCode.value = ''; return }
 try { ownRecoveryCode.value = await currentRecoveryCode(); recoveryVisible.value = true }
 catch (error: any) { copyError.value = error.message || '账号暂时未连接，请重试' }
}
async function currentRecoveryCode() {
 const { data } = await getMyAccountApi()
 return formatRecoveryCode(data.user_id, getDeviceId())
}
async function copyRecovery() {
 if (copying.value) return
 copying.value = true; copyError.value = ''
 try {
  const code = await currentRecoveryCode()
  await new Promise<void>((resolve,reject) => uni.setClipboardData({ data: code, success: () => resolve(), fail: reject }))
  copied.value = true
  if (!isResetting.value) void loadProfile()
 } catch { copyError.value = '复制未成功，可以点击下方“查看恢复码”手动保存。' }
 finally { copying.value = false }
}
async function handleRestore() {
 if (isResetting.value || !recoveryCode.value.trim()) return
 isResetting.value = true; restoreError.value = ''
 try {
  await restoreAccount(recoveryCode.value)
  clearProfile(); await auth.checkAuth()
  recoveryCode.value = ''; recoveryVisible.value = false; ownRecoveryCode.value = ''; copied.value = false; showRestore.value = false
  const profileLoaded = await loadProfile()
  uni.showToast({ title: profileLoaded ? '欢迎回来，账号已恢复' : '账号已恢复，身份暂未加载', icon: 'none' })
 } catch (error: any) { restoreError.value = error.message || '没有恢复成功，请核对恢复码后重试' }
 finally { isResetting.value = false }
}
function copyUserId() { if (userIdStr.value) uni.setClipboardData({ data: userIdStr.value }) }
function goReports() { uni.switchTab({ url: '/pages/reports/index' }) }
function openAgreement(type: string) { uni.navigateTo({ url: '/pages/agreement/index?type=' + type }) }
</script>
<style scoped>
.demo-banner { margin-bottom: 16px; padding: 10px 14px; border-radius: 12px; background: #fff1db; color: #76551c; font-size: 12px; }
.profile-intro { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.profile-intro .page-heading { font-size: 24px; }.profile-intro .page-caption { font-size: 12px; }
.account-strip { display: flex; gap: 12px; align-items: center; background: #f0ebf7; border-radius: 18px; padding: 12px 16px; margin: 24px 0 16px; }.account-strip > view { flex: 1; min-width: 0; }.account-label { display: block; font-size: 12px; color: #766789; }.account-id { display: block; font-size: 14px; font-weight: 600; }.account-role { display: block; margin-top: 4px; color: #6b518d; font-size: 11px; line-height: 1.7; }
.menu-row { display: flex; align-items: center; text-align: left; gap: 12px; width: 100%; min-height: 64px; padding: 16px; margin: 0; background: white; color: #302b40; border-radius: 18px; line-height: 1.6; font-size: 16px; }
.menu-row > text:nth-child(2), .menu-row > view { flex: 1; }.menu-hint { display: block; font-size: 12px; color: #777083; margin-top: 4px; }.expand-mark { color: #8b77a8; }
.recovery-card { background: white; border: 1px solid #eee8f4; border-radius: 24px; padding: 24px 20px 12px; margin: 20px 0; }.recovery-heading { display: flex; align-items: center; gap: 12px; }.shield-circle { background: #edf3ed; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 14px; flex-shrink: 0; }.recovery-heading .section-title { font-size: 16px; margin: 0; }.recovery-heading .page-caption { font-size: 12px; margin-top: 4px; }.recovery-description { display: block; font-size: 14px; color: #625b72; line-height: 1.9; margin: 20px 0; }.recovery-reveal { width: 100%; margin-top: 8px; font-size: 12px; }
.recovery-code { background: #f8f5fb; border-radius: 12px; padding: 12px; margin: 8px 0; overflow-wrap: anywhere; font-size: 14px; }.recovery-code .muted { display: block; margin-top: 8px; }
.restore-section { border: 1px solid #eee8f4; background: white; border-radius: 18px; }.restore-form { padding: 8px 16px 20px; }.field-hint { display: block; font-size: 12px; color: #777083; margin: 12px 0 16px; }
.little-note { display: flex; align-items: center; gap: 12px; color: #536b59; font-size: 12px; line-height: 1.8; margin: 28px 0 16px; padding: 12px; background: #edf3ed; border-radius: 18px; }.herbal-title { display: block; color: #395a46; font-weight: 600; margin-bottom: 4px; }.legal-section { display: flex; align-items: center; justify-content: center; gap: 8px; color: #b5a9c1; }.legal-section .text-button { font-size: 12px; color: #777083; }.version-text { display: block; text-align: center; font-size: 12px; color: #777083; }
</style>
