// 个人中心 — 用户信息、退出登录、法律链接
const storage = require('../../utils/storage')
const ui = require('../../utils/ui')

Page({
  data: {
    userId: '',
    avatarInitial: '?',
    loginTime: '',
    appVersion: '',
    isLoggingOut: false
  },

  onLoad() {
    const userId = storage.getUserId() || ''
    this.setData({
      userId: userId,
      avatarInitial: userId ? String(userId)[0] : '?',
      loginTime: storage.getLoginTime() || '',
      appVersion: this._readAppVersion()
    })
  },

  onShow() {
    // 每次切回页面时刷新（token 刷新可能更新 userId）
    const userId = storage.getUserId()
    if (userId && String(userId) !== String(this.data.userId)) {
      this.setData({
        userId: userId,
        avatarInitial: userId ? String(userId)[0] : '?',
        loginTime: storage.getLoginTime() || ''
      })
    }
  },

  // ── 退出登录 ──────────────────────────────────────────

  async handleLogout() {
    if (this.data.isLoggingOut) return

    const confirmed = await ui.showConfirm(
      '退出登录',
      '退出后需要重新登录才能使用，确定退出吗？'
    )
    if (!confirmed) return

    this.setData({ isLoggingOut: true })
    getApp().logout()
  },

  // ── 复制用户 ID ───────────────────────────────────────

  handleCopyUserId() {
    if (!this.data.userId) return
    wx.setClipboardData({
      data: String(this.data.userId),
      success() {
        ui.showSuccess('用户 ID 已复制')
      }
    })
  },

  // ── 法律页面 ──────────────────────────────────────────

  handleUserAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=user' })
  },

  handlePrivacyPolicy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' })
  },

  // ── 内部工具 ──────────────────────────────────────────

  _readAppVersion() {
    try {
      const info = wx.getAccountInfoSync()
      return info.miniProgram.version || '1.0.0'
    } catch (_) {
      return '1.0.0'
    }
  }
})
