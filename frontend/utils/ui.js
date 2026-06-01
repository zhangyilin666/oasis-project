// UI 工具函数
// - Loading 引用计数（并发请求安全）
// - Toast / Modal 封装

let loadingCount = 0

const ui = {
  showLoading(title = '加载中...') {
    if (loadingCount === 0) {
      wx.showLoading({ title, mask: true })
    }
    loadingCount++
  },

  hideLoading() {
    if (loadingCount > 0) {
      loadingCount--
    }
    if (loadingCount === 0) {
      wx.hideLoading()
    }
  },

  showToast(title, duration = 2000) {
    wx.showToast({ title, icon: 'none', duration })
  },

  showSuccess(title) {
    wx.showToast({ title, icon: 'success', duration: 2000 })
  },

  showError(title) {
    wx.showToast({ title, icon: 'error', duration: 2000 })
  },

  showConfirm(title, content) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        success(res) { resolve(res.confirm) }
      })
    })
  }
}

module.exports = ui
