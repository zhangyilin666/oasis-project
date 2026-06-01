// 统一 HTTP 请求客户端
// ── 能力 ─────────────────────────────────────────────────
// - 自动注入 Bearer token（GET/POST/PUT/DELETE）
// - Content-Type: application/json 自动注入（POST/PUT，可覆盖）
// - GET 请求 params 自动拼接到 URL query string
// - 401 → 静默刷新 token → 重放请求（宽限期 30 天）
// - 401 并发保护：多次 401 只刷新一次，排队等待
// - 403 → Toast "无权限访问"
// - 500 → Toast "服务器开小差了，请稍后重试"
// - 网络错误 → Toast "网络不可用，请检查网络连接"
// - 业务层 code != 200 自动 reject
// - Loading 引用计数（通过 ui.js，并发安全）
// - 超时 20s
// ────────────────────────────────────────────────────────

const storage = require('./storage')
const ui = require('./ui')
const config = require('../config/env')

// ── 状态旗标 ────────────────────────────────────────────
let isRedirectingToLogin = false  // 401 → reLaunch 防抖
let isRefreshing = false          // token 刷新进行中
let refreshQueue = []             // 等待刷新的请求队列 { resolve, reject, options }

// ── 工具函数 ────────────────────────────────────────────

/** 将 plain object 转为 URL query string（已 encode） */
function buildQuery(params) {
  if (!params) return ''
  const parts = []
  for (const key of Object.keys(params)) {
    const val = params[key]
    if (val !== undefined && val !== null && val !== '') {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(val))
    }
  }
  return parts.length ? '?' + parts.join('&') : ''
}

/**
 * 隐藏 loading（带引用计数保护）。
 * 与 ui.showLoading 配对，确保并发请求不会互相干扰。
 */
function safeHideLoading(showLoading) {
  if (showLoading) {
    ui.hideLoading()
  }
}

/**
 * 重定向到登录页（带防抖）。
 * 调用位置必须保证当前不在登录页，避免 reLaunch 循环。
 */
function redirectToLogin() {
  storage.clearAll()
  if (!isRedirectingToLogin) {
    isRedirectingToLogin = true
    wx.reLaunch({ url: '/pages/login/login' })
    setTimeout(() => { isRedirectingToLogin = false }, 1000)
  }
}

// ── Token 静默刷新 ──────────────────────────────────────

/**
 * 直接调用 /api/v1/wechat/refresh 端点。
 * 使用原始 wx.request 而非 request()，避免循环依赖
 *（auth.service → request → auth.service）。
 * 不弹 loading，不弹 toast — 静默失败，由 handle401AndRetry 决定后续动作。
 */
function callRefreshEndpoint() {
  const oldToken = storage.getToken()
  if (!oldToken) {
    return Promise.reject(new Error('无 token 可刷新'))
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: config.API_BASE_URL + '/api/v1/wechat/refresh',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + oldToken
      },
      timeout: 20000,
      success(res) {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          resolve(res.data.data) // { token, user_id }
        } else {
          reject(new Error('token 刷新被拒绝'))
        }
      },
      fail(err) {
        reject(new Error('token 刷新网络错误'))
      }
    })
  })
}

/**
 * 处理 401 响应：尝试静默刷新 token，成功则重放请求。
 *
 * ┌─ 判断 ─────────────────────────────────────────────┐
 * │ auth 端点 (/login, /refresh) 或 无 token？          │
 * │   → 直接 clearAll + reLaunch（不尝试刷新）          │
 * │                                                    │
 * │ 已有刷新正在进行中？                                │
 * │   → 入队等待（多个 401 只刷新一次）                 │
 * │                                                    │
 * │ 否则 → 发起刷新 → 成功 → 更新 storage + globalData │
 * │                → 重放原始请求 + 清空队列             │
 * │                → 失败 → clearAll + reLaunch          │
 * └────────────────────────────────────────────────────┘
 */
function handle401AndRetry(options) {
  const url = options.url
  const currentToken = storage.getToken()

  // 无需刷新的场景：无 token 或请求的是鉴权端点自身
  if (!currentToken || url === '/api/v1/wechat/login' || url === '/api/v1/wechat/refresh') {
    redirectToLogin()
    return Promise.reject(new Error('登录已失效，请重新登录'))
  }

  // 已有刷新在进行中 → 入队等待
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject, options })
    })
  }

  // 发起刷新
  isRefreshing = true

  return callRefreshEndpoint().then(result => {
    // ── 刷新成功 ──
    storage.setToken(result.token)
    if (result.user_id) {
      storage.setUserId(result.user_id)
    }

    // 同步到 app.globalData
    const app = getApp()
    if (app) {
      app.setAuth(result.token, result.user_id)
    }

    // 清空队列：逐一重放
    const queue = refreshQueue.slice()
    refreshQueue = []
    isRefreshing = false

    const retryOptions = { ...options, _retryCount: 1 }

    queue.forEach(({ resolve, reject, options: queuedOptions }) => {
      request({ ...queuedOptions, _retryCount: 1 }).then(resolve).catch(reject)
    })

    // 重放原始请求（token 已更新，request() 会读取到新 token）
    return request(retryOptions)

  }).catch(err => {
    // ── 刷新失败：token 彻底过期 ──
    const queue = refreshQueue.slice()
    refreshQueue = []
    isRefreshing = false

    // 通知所有排队请求
    queue.forEach(({ reject }) => {
      reject(new Error('登录已失效，请重新登录'))
    })

    redirectToLogin()

    throw new Error('登录已失效，请重新登录')
  })
}

// ── 核心请求方法 ────────────────────────────────────────

function request(options) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    showLoading = false,
    loadingText = '加载中...',
    timeout = 20000
  } = options

  const token = storage.getToken()

  // 构建 headers：POST/PUT 默认注入 Content-Type，可被外部 header 覆盖
  const isBodyMethod = method === 'POST' || method === 'PUT'
  const defaultHeader = {}
  if (isBodyMethod) {
    defaultHeader['Content-Type'] = 'application/json'
  }
  if (token) {
    defaultHeader['Authorization'] = 'Bearer ' + token
  }

  return new Promise((resolve, reject) => {
    if (showLoading) {
      ui.showLoading(loadingText)
    }

    wx.request({
      url: config.API_BASE_URL + url,
      method,
      data,
      header: { ...defaultHeader, ...header },
      timeout,

      success(res) {
        // ── 401：尝试静默刷新 token，成功后重放请求 ──
        if (res.statusCode === 401) {
          // 防止无限重试：已经重试过一次仍 401 则直接退出
          if (options._retryCount > 0) {
            safeHideLoading(showLoading)
            redirectToLogin()
            return reject(new Error('登录已失效，请重新登录'))
          }
          handle401AndRetry(options).then(
            body => {
              safeHideLoading(showLoading)
              resolve(body)
            },
            err => {
              safeHideLoading(showLoading)
              reject(err)
            }
          )
          return
        }

        safeHideLoading(showLoading)

        // ── 403：无权限 ──
        if (res.statusCode === 403) {
          ui.showToast('无权限访问')
          return reject(new Error('无权限访问'))
        }

        // ── 500：服务器内部错误 ──
        if (res.statusCode >= 500) {
          ui.showToast('服务器开小差了，请稍后重试')
          return reject(new Error('服务器错误'))
        }

        // ── 其他 HTTP 错误 ──
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('网络错误 (' + res.statusCode + ')'))
        }

        // ── 业务层错误（后端 code !== 200）──
        const body = res.data || {}
        if (body.code && body.code !== 200) {
          return reject(new Error(body.message || '请求失败'))
        }

        resolve(body)
      },

      fail(err) {
        safeHideLoading(showLoading)
        ui.showToast('网络不可用，请检查网络连接')
        reject(new Error('网络不可用，请检查网络连接'))
      }
    })
  })
}

// ── 便捷方法 ────────────────────────────────────────────

/**
 * GET 请求 — params 自动拼接到 URL query string，不传 body。
 * @param {string} url  接口路径（不含 base）
 * @param {object} [params={}]  查询参数，拼接到 query string
 * @param {object} [options={}]  额外配置（showLoading、loadingText、timeout 等）
 */
request.get = (url, params = {}, options = {}) =>
  request({ ...options, url: url + buildQuery(params), method: 'GET', data: {} })

/**
 * POST 请求 — data 作为 JSON body 发送。
 * @param {string} url  接口路径（不含 base）
 * @param {object} [data={}]  请求体
 * @param {object} [options={}]  额外配置
 */
request.post = (url, data = {}, options = {}) =>
  request({ ...options, url, method: 'POST', data })

/**
 * PUT 请求 — data 作为 JSON body 发送。
 * @param {string} url  接口路径（不含 base）
 * @param {object} [data={}]  请求体
 * @param {object} [options={}]  额外配置
 */
request.put = (url, data = {}, options = {}) =>
  request({ ...options, url, method: 'PUT', data })

/**
 * DELETE 请求 — 仅 URL 路径参数，不传 body。
 * @param {string} url  接口路径（不含 base）
 * @param {object} [options={}]  额外配置
 */
request.delete = (url, options = {}) =>
  request({ ...options, url, method: 'DELETE', data: {} })

module.exports = request
