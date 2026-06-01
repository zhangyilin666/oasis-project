// 报告详情页 — 八字四柱 + AI 分析全文 + 分析步骤
const oasisService = require('../../services/oasis.service')
const ui = require('../../utils/ui')

Page({
  data: {
    report: null,
    isLoading: true,
    isError: false,
    pillarFields: [
      { key: 'gan_zhi', label: '干支' },
      { key: 'gan', label: '天干' },
      { key: 'zhi', label: '地支' },
      { key: 'na_yin', label: '纳音' },
      { key: 'wu_xing', label: '五行' },
      { key: 'shi_shen_gan', label: '十神(干)' },
      { key: 'shi_shen_zhi', label: '十神(支)' },
      { key: 'di_shi', label: '地势' },
      { key: 'hide_gan', label: '藏干' },
      { key: 'xun', label: '旬' },
      { key: 'xun_kong', label: '旬空' }
    ]
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '分析报告' })

    if (!options.id) {
      ui.showToast('参数错误')
      wx.navigateBack()
      return
    }

    this.reportId = options.id
    this.fetchReport()
  },

  async fetchReport() {
    this.setData({ isLoading: true, isError: false })

    try {
      const report = await oasisService.getReportDetail(this.reportId)
      // 预计算分析日志的显示字段（WXML 不支持 === 、.toFixed() 等方法调用）
      if (report.analysis_logs && report.analysis_logs.length > 0) {
        report.analysis_logs = report.analysis_logs.map(function (log, i) {
          var success = log.status === 'success'
          var ms = log.latency_ms || 0
          return Object.assign({}, log, {
            _key: i,
            _statusClass: success ? 'dot-success' : 'dot-error',
            _tagClass: success ? 'tag-success' : 'tag-error',
            _statusText: success ? '成功' : '失败',
            _latencyDisplay: ms < 1000
              ? ms + 'ms'
              : (ms / 1000).toFixed(1) + 's',
            _tokenDisplay: log.total_tokens
              ? log.total_tokens + ' tokens'
              : ''
          })
        })
      }
      this.setData({ report, isLoading: false })
    } catch (err) {
      console.error('Fetch report failed:', err)
      this.setData({ isError: true, isLoading: false })
    }
  },

  onRetry() {
    this.fetchReport()
  }
})
