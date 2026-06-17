/**
 * UI 工具层 — 替换原小程序 utils/ui.js
 *
 * 封装 uni.showToast / uni.showLoading / uni.showModal，
 * 提供带引用计数的加载状态管理（防止并发请求同时隐藏 loading）。
 */

let _loadingCount = 0

export function showLoading(title: string = '加载中...'): void {
  _loadingCount++
  if (_loadingCount === 1) {
    uni.showLoading({ title, mask: true })
  }
}

export function hideLoading(): void {
  _loadingCount = Math.max(0, _loadingCount - 1)
  if (_loadingCount === 0) {
    uni.hideLoading()
  }
}

export function showToast(title: string, icon: 'none' | 'success' | 'error' = 'none'): void {
  uni.showToast({ title, icon, duration: 2000 })
}

export function showConfirm(
  title: string = '提示',
  content: string = '',
): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false),
    })
  })
}

/** 重置加载计数（异常恢复用） */
export function resetLoading(): void {
  _loadingCount = 0
  uni.hideLoading()
}
