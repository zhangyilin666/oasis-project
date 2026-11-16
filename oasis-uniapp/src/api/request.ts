import { API_BASE_URL, REQUEST_TIMEOUT, API_PREFIX } from '@/config/env'
import { ensureSession, recoverSession, ApiError, rawRequest } from './session'
import { showLoading, hideLoading } from '@/utils/ui'
interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, any>
  params?: Record<string, any>
  header?: Record<string, string>
  timeout?: number
  showLoading?: boolean
  loadingText?: string
}
export interface ApiResponse<T = any> { code: number; message: string; data: T }
export async function request<T = any>(opts: RequestOptions): Promise<ApiResponse<T>> {
  const publicAuth = opts.url === `${API_PREFIX}/anonymous-login` || opts.url === `${API_PREFIX}/restore`
  const refreshRequest = opts.url === `${API_PREFIX}/refresh`
  let token = publicAuth ? '' : await ensureSession()
  let url = opts.url.startsWith('http') ? opts.url : `${API_BASE_URL}${opts.url}`
  const query = Object.entries(opts.params || {}).filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  if (query) url += `${url.includes('?') ? '&' : '?'}${query}`
  if (opts.showLoading) showLoading(opts.loadingText || '加载中...')
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await rawRequest<T>(url, opts.method || 'GET', opts.data, token, opts.timeout || REQUEST_TIMEOUT, opts.header)
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 401 || publicAuth || refreshRequest || attempt > 0) throw error
        token = await recoverSession(token)
      }
    }
    throw new ApiError('登录已失效，请重试', 401)
  } finally {
    if (opts.showLoading) hideLoading()
  }
}
export const get = <T = any>(url: string, params?: Record<string, any>, opts?: Partial<RequestOptions>) => request<T>({ ...opts, url, params, method: 'GET' })
export const post = <T = any>(url: string, data?: Record<string, any>, opts?: Partial<RequestOptions>) => request<T>({ ...opts, url, data, method: 'POST' })
export const put = <T = any>(url: string, data?: Record<string, any>, opts?: Partial<RequestOptions>) => request<T>({ ...opts, url, data, method: 'PUT' })
export const del = <T = any>(url: string, opts?: Partial<RequestOptions>) => request<T>({ ...opts, url, method: 'DELETE' })
