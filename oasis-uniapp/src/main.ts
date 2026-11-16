import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import AppButton from './components/AppButton.vue'
// #ifdef H5
import { installFeedbackAccessibility } from './utils/feedback-accessibility'
// #endif

export function createApp() {
  // #ifdef H5
  installFeedbackAccessibility()
  // #endif
  const app = createSSRApp(App)
  app.use(createPinia())
  app.component('AppButton', AppButton)
  // #ifndef MP-WEIXIN
  app.directive('input-label', {
    mounted(el, binding) {
      // H5 表单组件的外层属性不会自动传递给实际的输入控件。
      el.querySelector?.('input, textarea')?.setAttribute('aria-label', binding.value)
    },
  })
  // #endif
  return {
    app,
  }
}
