/**
 * Auth API 服务 — 设备匿名登录 + Token 刷新
 */
import { get, post } from './request'
import { API_PREFIX } from '@/config/env'

export interface LoginResult {
  token: string
  user_id: number
}

export interface AccountInfo {
  user_id: number
  is_admin: boolean
}

/** 当前登录账号及服务器确认的身份 */
export function getMyAccountApi() {
  return get<AccountInfo>(`${API_PREFIX}/me`)
}

/** 设备匿名登录 */
export function anonymousLoginApi(deviceId: string) {
  return post<LoginResult>(`${API_PREFIX}/anonymous-login`, { device_id: deviceId })
}

/** 刷新 Token */
export function refreshApi() {
  return post<LoginResult>(`${API_PREFIX}/refresh`)
}
