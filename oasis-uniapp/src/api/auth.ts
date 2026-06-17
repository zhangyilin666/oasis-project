/**
 * Auth API 服务 — 设备匿名登录 + Token 刷新
 */
import { post } from './request'
import { API_PREFIX } from '@/config/env'

export interface LoginResult {
  token: string
  user_id: number
}

/** 设备匿名登录 */
export function anonymousLoginApi(deviceId: string) {
  return post<LoginResult>(`${API_PREFIX}/anonymous-login`, { device_id: deviceId })
}

/** 刷新 Token */
export function refreshApi() {
  return post<LoginResult>(`${API_PREFIX}/refresh`)
}
