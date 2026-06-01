// 环境配置
// WeChat 小程序通过 __wxConfig 判断开发/生产环境
const isDev = typeof __wxConfig !== 'undefined'
  && __wxConfig.envVersion === 'develop'

module.exports = {
  // 开发环境使用本地后端，生产环境替换为线上域名
  API_BASE_URL: isDev
    ? 'http://127.0.0.1:8000'
    : 'https://api.your-oasis-domain.com'
}
