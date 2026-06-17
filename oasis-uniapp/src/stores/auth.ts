/**
 * 认证状态管理 — Pinia Store
 *
 * 设备匿名登录：首次启动自动用设备 ID 注册，无需手机号。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getToken,
  setToken,
  getUserId,
  setUserId,
  setLoginTime,
  getDeviceId,
  setDeviceId,
  clearAll,
} from '@/utils/storage'
import { anonymousLoginApi, refreshApi } from '@/api/auth'

function _formatTime(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

function _generateDeviceId(): string {
  // 使用 crypto (uni-app API) 或 Math.random 生成 UUID v4
  const s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  return s.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getToken())
  const userId = ref<number | null>(getUserId())
  const isLoggedIn = ref(false)

  /** App 启动时自动登录 */
  async function checkAuth(): Promise<void> {
    // 已有有效 token → 直接进首页
    const stored = getToken()
    if (stored) {
      // 尝试刷新 token
      try {
        const res = await refreshApi()
        if (res.code === 200 && res.data) {
          token.value = res.data.token
          userId.value = res.data.user_id
          isLoggedIn.value = true
          uni.switchTab({ url: '/pages/home/index' })
          return
        }
      } catch {
        // refresh 失败，用旧 token 继续
      }
      isLoggedIn.value = true
      uni.switchTab({ url: '/pages/home/index' })
      return
    }

    // 无 token → 匿名登录
    try {
      await anonymousLogin()
      uni.switchTab({ url: '/pages/home/index' })
    } catch {
      // 网络错误等 — 仍可进入（离线或重试）
      uni.switchTab({ url: '/pages/home/index' })
    }
  }

  /** 设备匿名登录 */
  async function anonymousLogin(): Promise<void> {
    let deviceId = getDeviceId()
    if (!deviceId) {
      deviceId = _generateDeviceId()
      setDeviceId(deviceId)
    }

    const res = await anonymousLoginApi(deviceId)
    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || '登录失败')
    }

    token.value = res.data.token
    userId.value = res.data.user_id
    isLoggedIn.value = true

    setToken(res.data.token)
    setUserId(res.data.user_id)
    setLoginTime(_formatTime(new Date()))
  }

  /** 重置设备（退出登录后使用新设备 ID） */
  async function resetDevice(): Promise<void> {
    clearAll()
    token.value = null
    userId.value = null
    isLoggedIn.value = false
    // 重新匿名登录
    await anonymousLogin()
  }

  /** 静默刷新 token（供 request.ts 的 401 拦截使用） */
  async function refreshToken(): Promise<string | null> {
    try {
      const res = await refreshApi()
      if (res.code === 200 && res.data) {
        token.value = res.data.token
        userId.value = res.data.user_id
        setToken(res.data.token)
        setUserId(res.data.user_id)
        return res.data.token
      }
      return null
    } catch {
      return null
    }
  }

  return {
    token,
    userId,
    isLoggedIn,
    checkAuth,
    anonymousLogin,
    resetDevice,
    refreshToken,
  }
})
