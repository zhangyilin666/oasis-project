/**
 * HTTP 客户端 — 替换原小程序 utils/request.js
 *
 * 核心能力：
 *   1. 自动注入 Bearer Token
 *   2. 401 静默刷新（队列防抖）
 *   3. 引用计数 Loading 管理
 *   4. 统一错误处理
 */

import { API_BASE_URL, REQUEST_TIMEOUT, REFRESH_URL } from '@/config/env'
import { getToken, setToken, setUserId, clearAll } from '@/utils/storage'
import { showLoading, hideLoading, showToast } from '@/utils/ui'

// ---- 类型定义 ----

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, any>
  params?: Record<string, any>
  header?: Record<string, string>
  timeout?: number
  showLoading?: boolean   // 是否显示 loading（默认 false）
  loadingText?: string
}

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// ---- 401 Token 刷新队列 ----

let _isRefreshing = false
let _refreshQueue: Array<{
  resolve: (token: string) => void
  reject: (err: any) => void
}> = []
let _hasRedirectedToLogin = false  // 防止重复跳转登录页

function _onRefreshed(newToken: string): void {
  _refreshQueue.forEach((p) => p.resolve(newToken))
  _refreshQueue = []
}

function _onRefreshFailed(err: any): void {
  _refreshQueue.forEach((p) => p.reject(err))
  _refreshQueue = []
}

async function _callRefreshEndpoint(): Promise<string> {
  const oldToken = getToken()
  if (!oldToken) {
    throw new Error('No token to refresh')
  }

  return new Promise<string>((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${REFRESH_URL}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oldToken}`,
      },
      timeout: 15000,
      success: (res) => {
        const body = res.data as ApiResponse
        if (res.statusCode === 200 && body.code === 200 && body.data?.token) {
          const newToken = body.data.token
          const userId = body.data.user_id
          setToken(newToken)
          if (userId) setUserId(userId)
          resolve(newToken)
        } else {
          reject(new Error(body.message || 'Refresh failed'))
        }
      },
      fail: (err) => reject(err),
    })
  })
}

// ---- 核心请求函数 ----

function _buildUrl(url: string, params?: Record<string, any>): string {
  let fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) fullUrl += `?${qs}`
  }
  return fullUrl
}

async function _doRequest<T = any>(opts: RequestOptions): Promise<ApiResponse<T>> {
  const {
    url,
    method = 'GET',
    data,
    params,
    header = {},
    timeout = REQUEST_TIMEOUT,
    showLoading: withLoading = false,
    loadingText,
  } = opts

  if (withLoading && loadingText) {
    showLoading(loadingText)
  }

  const token = getToken()
  const headers: Record<string, string> = { ...header }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (method === 'POST' || method === 'PUT') {
    headers['Content-Type'] = 'application/json'
  }

  const fullUrl = _buildUrl(url, params)
  console.log(`[request] ${method} ${fullUrl}`)

  const resp = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header: headers,
      timeout,
      success: resolve,
      fail: reject,
    })
  })

  if (withLoading) hideLoading()

  const body = resp.data as ApiResponse<T>
  const statusCode = resp.statusCode

  // ---- 401 静默刷新 ----
  if (statusCode === 401 && token) {
    // 排除刷新端点自身（防止死循环）
    if (url.includes(REFRESH_URL)) {
      return body
    }

    if (!_isRefreshing) {
      _isRefreshing = true
      try {
        const newToken = await _callRefreshEndpoint()
        _isRefreshing = false
        _onRefreshed(newToken)
        // 用新 token 重试原请求
        return _doRequest<T>(opts)
      } catch (err) {
        _isRefreshing = false
        _onRefreshFailed(err)
        // Token 刷新失败 → 踢到登录页
        if (!_hasRedirectedToLogin) {
          _hasRedirectedToLogin = true
          clearAll()
          uni.reLaunch({ url: '/pages/home/index' })
        }
        throw err
      }
    } else {
      // 正在刷新中 → 排队等待
      return new Promise<ApiResponse<T>>((resolve, reject) => {
        _refreshQueue.push({
          resolve: async () => {
            try {
              resolve(await _doRequest<T>(opts))
            } catch (e) {
              reject(e)
            }
          },
          reject,
        })
      })
    }
  }

  // ---- 错误处理 ----
  if (statusCode === 403) {
    showToast('无权限访问')
  } else if (statusCode >= 500) {
    showToast('服务器开小差了')
  } else if (statusCode === 0) {
    showToast('网络不可用')
  }

  // 重置登录页跳转标记（非 401 情况）
  if (statusCode !== 401) {
    _hasRedirectedToLogin = false
  }

  return body
}

// ---- 公开 API ----

export async function request<T = any>(opts: RequestOptions): Promise<ApiResponse<T>> {
  return _doRequest<T>(opts)
}

export async function get<T = any>(
  url: string,
  params?: Record<string, any>,
  opts?: Partial<RequestOptions>,
): Promise<ApiResponse<T>> {
  return _doRequest<T>({ ...opts, url, method: 'GET', params })
}

export async function post<T = any>(
  url: string,
  data?: Record<string, any>,
  opts?: Partial<RequestOptions>,
): Promise<ApiResponse<T>> {
  return _doRequest<T>({ ...opts, url, method: 'POST', data })
}

export async function put<T = any>(
  url: string,
  data?: Record<string, any>,
  opts?: Partial<RequestOptions>,
): Promise<ApiResponse<T>> {
  return _doRequest<T>({ ...opts, url, method: 'PUT', data })
}

export async function del<T = any>(
  url: string,
  opts?: Partial<RequestOptions>,
): Promise<ApiResponse<T>> {
  return _doRequest<T>({ ...opts, url, method: 'DELETE' })
}
