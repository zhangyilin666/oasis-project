import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  css: {
    preprocessorOptions: {
      scss: {
        // CSS 自定义属性通过 global.scss 在 App.vue 中全局导入
        // scss 变量（如有）可在此注入: additionalData: `@import "...";`
      },
    },
  },
  build: {
    target: 'es2015',
    cssTarget: 'chrome80',
    // 减小包体积
    minify: 'esbuild',
    // chunk 拆分策略
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/@dcloudio')) {
            return 'uni-framework'
          }
          if (id.includes('node_modules/pinia')) {
            return 'pinia'
          }
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
  // H5 开发服务器
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
