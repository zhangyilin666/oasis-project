/**
 * 本地存储封装 — 替换原项目 utils/storage.js
 */

const KEYS = {
  TOKEN: '__xiaoyi_token',
  USER_ID: '__xiaoyi_user_id',
  LOGIN_TIME: '__xiaoyi_login_time',
  DEVICE_ID: '__xiaoyi_device_id',
} as const

export function getToken(): string | null {
  return uni.getStorageSync(KEYS.TOKEN) || null
}

export function setToken(token: string): void {
  uni.setStorageSync(KEYS.TOKEN, token)
}

export function getUserId(): number | null {
  const raw = uni.getStorageSync(KEYS.USER_ID)
  return raw ? Number(raw) : null
}

export function setUserId(userId: number): void {
  uni.setStorageSync(KEYS.USER_ID, String(userId))
}

export function getLoginTime(): string | null {
  return uni.getStorageSync(KEYS.LOGIN_TIME) || null
}

export function setLoginTime(time: string): void {
  uni.setStorageSync(KEYS.LOGIN_TIME, time)
}

export function getDeviceId(): string | null {
  return uni.getStorageSync(KEYS.DEVICE_ID) || null
}

export function setDeviceId(deviceId: string): void {
  uni.setStorageSync(KEYS.DEVICE_ID, deviceId)
}

export function clearAll(): void {
  uni.removeStorageSync(KEYS.TOKEN)
  uni.removeStorageSync(KEYS.USER_ID)
  uni.removeStorageSync(KEYS.LOGIN_TIME)
  // 保留 DEVICE_ID — 重新安装前不变
}
