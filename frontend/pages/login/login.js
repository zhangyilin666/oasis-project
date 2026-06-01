// 登录页 — wx.login 换取后端 JWT
console.log('[login] module loading...')

var authService, storage, ui
try {
  authService = require('../../services/auth.service')
  storage = require('../../utils/storage')
  ui = require('../../utils/ui')
  console.log('[login] all dependencies loaded')
} catch (e) {
  console.error('[login] dependency load FAILED:', e)
}

try {
  Page({
    data: {
      isLoading: false
    },

    onLoad: function() {
      console.log('[login] onLoad — Page 生命周期触发')
    },

    onReady: function() {
      console.log('[login] onReady — 页面首次渲染完成，bindtap 已绑定')
    },

    onShow: function() {
      console.log('[login] onShow — 页面显示')
    },

    /**
     * 微信一键登录：
     *   1. wx.login 获取临时 code（每次点击都重新获取，code 只能使用一次）
     *   2. 发送 code 到后端 /api/v1/wechat/login 换取 JWT
     *   3. 持久化 token + userId 到 storage
     *   4. 同步到 app.globalData
     *   5. 跳转首页
     */
    handleLogin: function() {
      console.log('[login] ========== handleLogin 被调用 ==========')
      console.log('[login] this.data.isLoading =', this.data.isLoading)

      if (this.data.isLoading) {
        console.log('[login] 已在加载中，跳过')
        return
      }

      this.setData({ isLoading: true })
      ui.showLoading('正在登录...')
      console.log('[login] loading 已显示')

      var self = this

      // 1. 获取微信 code
      authService.wxLoginCode().then(function(loginRes) {
        console.log('[login] wx.login 成功，code:', loginRes.code ? loginRes.code.substring(0, 10) + '...' : 'null')

        // 2. 发送 code 到后端换取 JWT
        return authService.login(loginRes.code).then(function(result) {
          console.log('[login] 后端登录成功，userId:', result.user_id)

          // 3. 持久化
          storage.setToken(result.token)
          storage.setUserId(result.user_id)
          storage.setLoginTime(self._formatTime())

          // 4. 同步 globalData
          var app = getApp()
          if (app) {
            app.setAuth(result.token, result.user_id)
          }

          ui.hideLoading()
          ui.showSuccess('登录成功')
          self.setData({ isLoading: false })

          // 5. 跳转首页
          wx.switchTab({ url: '/pages/home/home' })
        })

      }).catch(function(err) {
        console.error('[login] 登录失败:', err)
        ui.hideLoading()
        ui.showToast(err.message || '登录失败，请重试')
        self.setData({ isLoading: false })
      })
    },

    handleRetry: function() {
      console.log('[login] handleRetry 被调用')
      this.handleLogin()
    },

    _formatTime: function() {
      var now = new Date()
      var y = now.getFullYear()
      var mo = String(now.getMonth() + 1).padStart(2, '0')
      var d = String(now.getDate()).padStart(2, '0')
      var h = String(now.getHours()).padStart(2, '0')
      var mi = String(now.getMinutes()).padStart(2, '0')
      return y + '-' + mo + '-' + d + ' ' + h + ':' + mi
    }
  })
  console.log('[login] Page() 注册成功')
} catch (e) {
  console.error('[login] Page() 注册失败:', e)
}
