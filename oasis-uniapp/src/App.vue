<script setup lang="ts">
import { onLaunch, onShow, onHide, onError } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { resetLoading } from '@/utils/ui'

onLaunch(() => {
  console.log('[Oasis] App 启动 —', new Date().toISOString())

  // 认证状态检查
  const auth = useAuthStore()
  auth.checkAuth()

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
