// 本地存储封装
// 命名空间前缀 __oasis_ 防止键名冲突

const KEYS = {
  TOKEN: '__oasis_token',
  USER_ID: '__oasis_user_id',
  LOGIN_TIME: '__oasis_login_time'
}

const storage = {
  // ── Token ──────────────────────────────────────────────
  getToken() {
    return wx.getStorageSync(KEYS.TOKEN) || null
  },

  setToken(token) {
    wx.setStorageSync(KEYS.TOKEN, token)
  },

  /**
   * 仅删除 token，保留 userId。
   * 用于主动退出登录、token 过期局部清理等场景。
   */
  removeToken() {
    wx.removeStorageSync(KEYS.TOKEN)
  },

  // ── UserId ────────────────────────────────────────────
  getUserId() {
    return wx.getStorageSync(KEYS.USER_ID) || null
  },

  setUserId(id) {
    wx.setStorageSync(KEYS.USER_ID, id)
  },

  // ── LoginTime ─────────────────────────────────────────
  /** 记录最近一次登录时间（已格式化的字符串） */
  getLoginTime() {
    return wx.getStorageSync(KEYS.LOGIN_TIME) || ''
  },

  setLoginTime(ts) {
    wx.setStorageSync(KEYS.LOGIN_TIME, ts)
  },

  // ── 全量清理 ──────────────────────────────────────────
  /** 删除所有 Oasis 相关的存储项（token + userId + loginTime） */
  clearAll() {
    wx.removeStorageSync(KEYS.TOKEN)
    wx.removeStorageSync(KEYS.USER_ID)
    wx.removeStorageSync(KEYS.LOGIN_TIME)
  }
}

module.exports = storage
