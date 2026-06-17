// 环境配置
// WeChat 小程序通过 __wxConfig 判断开发/生产环境
const isDev = typeof __wxConfig !== 'undefined'
  && __wxConfig.envVersion === 'develop'

// ⚠️ 部署前必须替换为你的生产域名（HTTPS，已备案，不含端口号）
// 示例: 'https://api.oasis-app.cn'
const PROD_API_BASE_URL = 'https://api.your-oasis-domain.com'

module.exports = {
  API_BASE_URL: isDev
    ? 'http://127.0.0.1:8000'
    : PROD_API_BASE_URL
}
