// 猫来运转 微信小程序
// 入口文件 — App() 生命周期、全局数据、Token 检查
const storage = require('./utils/storage')

App({
  onLaunch() {
    this.checkLoginStatus()
  },

  /**
   * 全局未捕获错误 — 记录到控制台，生产环境可对接日志服务。
   * 不弹 toast，避免用户困惑（页面级 error-retry 组件应自行处理）。
   */
  onError(msg) {
    console.error('[App.onError]', msg)
    // TODO: 生产环境接入日志服务（如 WeChat 实时日志 wx.getRealtimeLogManager）
  },

  /**
   * 页面不存在 — 尝试回退到首页。
   * 常见场景：report-detail?id=xxx 中报告被删除，navigateBack 后路径失效。
   */
  onPageNotFound(res) {
    console.warn('[App.onPageNotFound]', res.path, res.query)
    wx.switchTab({ url: '/pages/home/home' })
  },

  /**
   * 启动时检查登录状态：
   * - 无 token → 不做任何事，停留在默认入口页（登录页）
   * - 有 token + wx.checkSession 有效 → 同步 globalData，进入首页
   * - 有 token + wx.checkSession 过期 → 清空登录态，停留在登录页
   *   （后续由 request.js 的 401 拦截器尝试静默刷新 token）
   *
   * 注意：不再 reLaunch 到登录页 — 登录页已是 app.json 入口页。
   *       在页面初始化期间 reLaunch 自身会摧毁 Page 实例，导致按钮失效。
   */
  checkLoginStatus() {
    const token = storage.getToken()
    if (!token) {
      // 入口页就是登录页，无需跳转
      return
    }

    wx.checkSession({
      success: () => {
        // 微信会话有效 — 同步 globalData，进入首页
        this.globalData.token = token
        this.globalData.userId = storage.getUserId()
        wx.switchTab({ url: '/pages/home/home' })
      },
      fail: () => {
        // 微信会话过期 — 清空登录态，留在登录页
        this.globalData.token = null
        this.globalData.userId = null
      }
    })
  },

  // ── 全局鉴权状态 ──────────────────────────────────────

  globalData: {
    token: null,
    userId: null
  },

  /**
   * 登录成功后调用，同步 token 和 userId 到 globalData。
   * 由 login.js、request.js（token 刷新成功后）调用。
   */
  setAuth(token, userId) {
    this.globalData.token = token
    this.globalData.userId = userId
  },

  /**
   * 退出登录时调用，清空 globalData。
   */
  clearAuth() {
    this.globalData.token = null
    this.globalData.userId = null
  },

  /**
   * 完整退出登录流程：
   * 清空 storage + globalData → reLaunch 登录页。
   * 供任意页面（个人中心、401 拦截器）复用。
   */
  logout() {
    const storage = require('./utils/storage')
    this.clearAuth()
    storage.clearAll()
    wx.reLaunch({ url: '/pages/login/login' })
  }
})
