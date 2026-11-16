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
  if (typeof raw !== 'number' && typeof raw !== 'string') return null
  if (typeof raw === 'string' && !raw.trim()) return null
  const userId = Number(raw)
  return Number.isInteger(userId) && userId >= 0 ? userId : null
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

export function getSelectedReport(): number | undefined {
  return Number(uni.getStorageSync(`__xiaoyi_report_${getUserId()}`)) || undefined
}
export function setSelectedReport(id: number): void {
  uni.setStorageSync(`__xiaoyi_report_${getUserId()}`, id)
}
export function clearSelectedReport(id: number): void {
  if (getSelectedReport() === id) uni.removeStorageSync(`__xiaoyi_report_${getUserId()}`)
}
