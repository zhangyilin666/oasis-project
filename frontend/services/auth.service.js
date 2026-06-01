// 认证服务
// ── 能力 ─────────────────────────────────────────────────
// - wx.login code 获取（Promise 封装，供多页面复用）
// - 微信登录：code → 后端 JWT
// - Token 刷新：静默换取新 JWT（宽限期 30 天）
// ────────────────────────────────────────────────────────

const request = require('../utils/request')
const storage = require('../utils/storage')

const authService = {
  // ── wx.login Promise 封装 ─────────────────────────────

  /**
   * 调用 wx.login 获取临时 code。
   * 提取为独立方法，供登录页、token 刷新等场景复用。
   * @returns {Promise<{code: string}>}
   */
  wxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success(res) {
          if (res.code) {
            resolve(res)
          } else {
            reject(new Error('wx.login 未返回 code'))
          }
        },
        fail(err) {
          reject(new Error(err.errMsg || 'wx.login 调用失败'))
        }
      })
    })
  },

  // ── 后端鉴权 ──────────────────────────────────────────

  /**
   * 微信小程序登录 — code 换 JWT。
   * @param {string} code - wx.login 返回的临时 code
   * @returns {Promise<{token: string, user_id: number}>}
   */
  async login(code) {
    const res = await request.post('/api/v1/wechat/login', { code })
    if (res.code !== 200) {
      throw new Error(res.message || '登录失败')
    }
    return res.data
  },

  /**
   * 刷新 JWT Token（使用当前 token，宽限期 30 天）。
   * 不弹 toast/loading — 由调用方决定 UI 反馈。
   * @returns {Promise<{token: string, user_id: number}>}
   */
  async refreshToken() {
    const res = await request.post('/api/v1/wechat/refresh', {}, {
      showLoading: false
    })
    if (res.code !== 200) {
      throw new Error(res.message || '刷新登录失败')
    }
    return res.data
  }
}

module.exports = authService
