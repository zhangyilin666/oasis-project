<script setup lang="ts">
import { onLaunch, onShow, onHide, onError, onPageNotFound } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { resetLoading } from '@/utils/ui'
import { CLOSED_PAGE_PATHS } from '@/domain/metaphysics/navigation'

onPageNotFound(({ path }) => {
  const normalizedPath = path.replace(/^\/+/, '').split(/[?#]/, 1)[0]
  const closed = CLOSED_PAGE_PATHS.some(page => page === normalizedPath)
  uni.reLaunch({
    url: '/pages/home/index',
    success: () => { if (closed) uni.showToast({ title: '此板块已关闭', icon: 'none' }) },
  })
})

onLaunch(() => {
  console.log('[Oasis] App 启动 —', new Date().toISOString())

  // 认证状态检查
  const auth = useAuthStore()
  auth.checkAuth().catch(() => { /* 页面请求提供可重试的错误状态。 */ })

  // #ifdef APP-PLUS
  // 原生状态栏配置
  plus.navigator.setStatusBarStyle('dark')
  plus.navigator.setStatusBarBackground('#ffffff')
  // #endif
})

onShow(() => {
  console.log('[Oasis] App 显示')
  // 从后台恢复时，重置所有 loading 状态，防止 UI 卡住
  resetLoading()
})

onHide(() => {
  console.log('[Oasis] App 隐藏')
})

// 全局错误捕获
onError((err: string) => {
  console.error('[Oasis] 全局错误:', err)
})
</script>

<style lang="scss">
@use '@/styles/global.scss';
/* #ifdef H5 */
@use '@/styles/feedback.scss';
/* #endif */

/* #ifdef APP-PLUS */
/* 原生 App 全局磨砂导航栏适配 */
uni-page-head {
  border-bottom: none !important;
}

/* 原生滚动条隐藏 */
::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
/* #endif */
</style>
