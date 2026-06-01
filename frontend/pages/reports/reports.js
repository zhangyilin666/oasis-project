// 报告列表页（tabBar）— 分页 + 下拉刷新 + 触底加载
const oasisService = require('../../services/oasis.service')
const ui = require('../../utils/ui')

Page({
  data: {
    reports: [],
    total: 0,
    skip: 0,
    limit: 20,
    hasMore: false,
    isLoading: false,
    isEmpty: false,
    isError: false
  },

  onShow() {
    this.setData({ skip: 0, reports: [], hasMore: true, isError: false })
    this.loadReports()
  },

  async loadReports() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true })

    try {
      const result = await oasisService.getReports(this.data.skip, this.data.limit)
      const reports = this.data.skip === 0
        ? result.reports
        : this.data.reports.concat(result.reports)

      this.setData({
        reports,
        total: result.total,
        hasMore: reports.length < result.total,
        isEmpty: reports.length === 0,
        isError: false
      })
    } catch (err) {
      console.error('Load reports failed:', err)
      if (this.data.skip === 0 && this.data.reports.length === 0) {
        this.setData({ isError: true })
      } else {
        ui.showToast('加载失败')
      }
    } finally {
      this.setData({ isLoading: false })
      wx.stopPullDownRefresh()
    }
  },

  onPullDownRefresh() {
    this.setData({ skip: 0, reports: [], hasMore: true, isError: false })
    this.loadReports()
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.isLoading) return
    this.setData({ skip: this.data.reports.length })
    this.loadReports()
  },

  onTapReport(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/report-detail/report-detail?id=${id}` })
  }
})
