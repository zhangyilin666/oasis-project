/** H5 uses the same origin; the development server proxies /api. */
let baseUrl = import.meta.env.VITE_API_BASE_URL || ''
// #ifdef H5
baseUrl = ''
// #endif
export const API_BASE_URL = baseUrl
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
export const API_PREFIX = '/api/v1/app'
export const REQUEST_TIMEOUT = 20000
export const REFRESH_URL = `${API_PREFIX}/refresh`
