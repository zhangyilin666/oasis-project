import { API_BASE_URL, API_PREFIX, DEMO_MODE } from '@/config/env'
import { offlineResponse } from '@/demo/offline'
import { getToken, setToken, getDeviceId, setDeviceId, setUserId, setLoginTime, clearAll } from '@/utils/storage'
import { parseRecoveryCode } from '@/utils/recovery-code'

export class ApiError extends Error {
  constructor(message: string, public code: number) { super(message); this.name = 'ApiError' }
}

export function rawRequest<T = any>(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', data?: any, token = '', timeout = 20000, header?: Record<string, string>): Promise<{ code: number; message: string; data: T }> {
  if (DEMO_MODE) return Promise.resolve(offlineResponse(url, method))
  return new Promise((resolve, reject) => uni.request({
    url, method, data, timeout,
    header: { 'Content-Type': 'application/json', ...header, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    success: (res) => {
      const body = res.data as any
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.code === 200) { resolve(body); return }
      const detail = body?.detail
      const code = res.statusCode >= 400 ? res.statusCode : body?.code || 500
      const message = body?.message || detail?.message || (Array.isArray(detail) ? '输入信息不正确，请检查日期和时间' : typeof detail === 'string' ? detail : '请求失败，请稍后重试')
      reject(new ApiError(message, code))
    },
    fail: () => reject(new ApiError('网络连接失败，请检查网络后重试', 0)),
  }))
}

let sessionPromise: Promise<string> | null = null
function saveSession(data: { token: string; user_id: number }): string {
  if (!data?.token || !Number.isInteger(data.user_id) || data.user_id < 0) throw new ApiError('登录响应不完整，请重试', 500)
  setToken(data.token); setUserId(data.user_id); setLoginTime(new Date().toLocaleString())
  return data.token
}
function deviceId(): string {
  const stored = getDeviceId()
  if (stored) return stored
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.getRandomValues) throw new ApiError('请使用系统浏览器通过 HTTPS 打开此页面', 400)
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  const id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  setDeviceId(id)
  return id
}
async function login(): Promise<string> {
  const res = await rawRequest<{ token: string; user_id: number }>(`${API_BASE_URL}${API_PREFIX}/anonymous-login`, 'POST', { device_id: deviceId() })
  return saveSession(res.data)
}
function singleFlight(work: () => Promise<string>): Promise<string> {
  if (!sessionPromise) sessionPromise = work().finally(() => { sessionPromise = null })
  return sessionPromise
}
export function ensureSession(): Promise<string> {
  if (DEMO_MODE) {
    setToken('offline-preview'); setUserId(1)
    return Promise.resolve('offline-preview')
  }
  if (sessionPromise) return sessionPromise
  const token = getToken()
  return token ? Promise.resolve(token) : singleFlight(login)
}
export function recoverSession(rejectedToken: string): Promise<string> {
  const current = getToken()
  if (current && current !== rejectedToken) return Promise.resolve(current)
  return singleFlight(async () => {
    try {
      const res = await rawRequest<{ token: string; user_id: number }>(`${API_BASE_URL}${API_PREFIX}/refresh`, 'POST', undefined, rejectedToken)
      return saveSession(res.data)
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 401) throw error
      clearAll()
      return login()
    }
  })
}
export async function restoreAccount(code: string): Promise<void> {
  if (DEMO_MODE) throw new ApiError('离线界面体验版不支持账号恢复', 400)
  let parsed: ReturnType<typeof parseRecoveryCode>
  try { parsed = parseRecoveryCode(code) }
  catch { throw new ApiError('请完整粘贴 mlyz 和账号 ID 开头的新版恢复码，旧版恢复码已停用', 400) }
  const id = parsed.deviceId
  if (sessionPromise) await sessionPromise
  const res = await rawRequest<{ token: string; user_id: number }>(`${API_BASE_URL}${API_PREFIX}/restore`, 'POST', { device_id: id })
  if (!res.data?.token || !Number.isInteger(res.data.user_id) || res.data.user_id < 0) throw new ApiError('登录响应不完整，请重试', 500)
  if (parsed.userId !== res.data.user_id) throw new ApiError('恢复码中的账号 ID 与编码不匹配，请检查是否完整', 400)
  clearAll(); setDeviceId(id); saveSession(res.data)
}
