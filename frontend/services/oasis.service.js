// Oasis 核心业务服务
const request = require('../utils/request')

const oasisService = {
  /**
   * 提交出生信息，执行八字命理分析
   * @param {Object} payload - UserInput: name, birth_date, birth_time, gender, location, is_solar_time
   * @returns {Promise<Object>} - report_id, calendar_data, ai_analysis_text, workflow_steps, trace_id
   */
  async analyze(payload) {
    const res = await request.post('/api/v1/wechat/oasis/analyze', payload, {
      showLoading: true,
      loadingText: '正在排盘分析...'
    })
    return res.data
  },

  /**
   * 获取报告列表（分页）
   * @param {number} skip - 跳过条数
   * @param {number} limit - 每页条数（max 100）
   * @returns {Promise<Object>} - { reports, total, skip, limit }
   */
  async getReports(skip = 0, limit = 20) {
    const res = await request.get('/api/v1/wechat/oasis/reports', {
      skip, limit
    })
    return res.data
  },

  /**
   * 获取单份报告详情
   * @param {number} reportId
   * @returns {Promise<Object>} - id, birth_info, calendar_data, ai_analysis, analysis_logs_count, ...
   */
  async getReportDetail(reportId) {
    const res = await request.get(`/api/v1/wechat/oasis/report/${reportId}`)
    return res.data
  }
}

module.exports = oasisService
