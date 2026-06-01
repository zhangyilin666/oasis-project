// 首页 — 黄历卡片 + 快速入口
const almanacService = require('../../services/almanac.service')

Page({
  data: {
    almanac: null,
    isLoading: true,
    isError: false,
    todayFormatted: ''
  },

  onShow() {
    this.loadAlmanac()
  },

  onLoad() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.setData({ todayFormatted: `${y}-${m}-${d}` })
  },

  async loadAlmanac() {
    this.setData({ isLoading: true, isError: false })

    try {
      const almanac = await almanacService.getAlmanac()
      this.setData({ almanac, isLoading: false })
    } catch (err) {
      console.error('Load almanac failed:', err)
      this.setData({ isError: true, isLoading: false })
    }
  },

  onTapAnalyze() {
    wx.navigateTo({ url: '/pages/analyze/analyze' })
  },

  onPullDownRefresh() {
    this.loadAlmanac().finally(() => wx.stopPullDownRefresh())
  }
})
