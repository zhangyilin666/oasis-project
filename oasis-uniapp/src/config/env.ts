/**
 * 环境配置 — 替换原小程序 config/env.js
 *
 * 开发环境：H5 / App 真机调试使用 API_BASE_URL_DEV
 * 生产环境：使用 API_BASE_URL_PROD
 *
 * uni-app 中通过 VITE_ 前缀环境变量区分环境。
 */
// #ifdef APP-PLUS
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://192.168.2.12:8000'
// #endif
// #ifdef H5
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
// #endif
// #ifdef MP-WEIXIN
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
// #endif

// API 版本前缀（与后端路由一致）
export const API_PREFIX = '/api/v1/app'

// 请求超时（毫秒）
export const REQUEST_TIMEOUT = 20000

// Token 刷新端点
export const REFRESH_URL = `${API_PREFIX}/refresh`

// 默认 API Base URL
export { API_BASE_URL }
