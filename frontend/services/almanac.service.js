// 黄历查询服务
const request = require('../utils/request')

const almanacService = {
  /**
   * 查询指定日期黄历宜忌
   * @param {string} [solarDate] - 公历日期 YYYY-MM-DD，默认今天
   * @returns {Promise<Object>} - solar_date, lunar_date, day_gan_zhi, animal, yi, ji, ji_shen, xiong_sha, chong_sheng_xiao
   */
  async getAlmanac(solarDate) {
    const params = solarDate ? { solar_date: solarDate } : {}
    const res = await request.get('/api/v1/wechat/oasis/almanac', params)
    return res.data
  }
}

module.exports = almanacService
