<template>
  <view class="share-wrap">
    <AppButton class="share-button" :disabled="sharing" aria-label="生成今日运势卡片并保存图片" @click="saveCard">
      {{ sharing ? '正在生成卡片…' : '分享卡片 / 保存图片' }}
    </AppButton>
    <canvas
      id="fortuneShareCanvas"
      canvas-id="fortuneShareCanvas"
      class="share-canvas"
      width="1080"
      height="1440"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppButton from '@/components/AppButton.vue'
import type { AlmanacDay, DailyFortune } from '@/api/xiaoyi'
import { buildFortuneCard, type FortuneCardSource } from '@/domain/fortune-card/map'
import { drawFortuneCard } from '@/domain/fortune-card/draw'

const props = defineProps<{ fortune: DailyFortune; almanac: AlmanacDay | null }>()
const sharing = ref(false)
const catUrl = '/static/ui/cat-calico-sprite.webp'

function sourceFromProps(): FortuneCardSource {
  return {
    date: props.fortune.date,
    dayGanZhi: props.fortune.day_gan_zhi,
    dayRelation: props.fortune.day_relation,
    fortuneText: props.fortune.fortune_text,
    luckyColor: props.fortune.lucky_color,
    luckyDirection: props.fortune.lucky_direction,
    lunarMonth: props.almanac?.lunar_month_cn,
    lunarDay: props.almanac?.lunar_day_cn,
    yearGanZhi: props.almanac?.year_gan_zhi,
    yi: props.almanac?.yi,
    ji: props.almanac?.ji,
    redact: props.fortune.birth_info,
  }
}

async function saveCard() {
  if (sharing.value) return
  sharing.value = true
  try {
    const card = buildFortuneCard(sourceFromProps())
    const canvas = await prepareCanvas()
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas')
    drawFortuneCard(context, card, await loadCat())
    await exportCard(canvas)
    uni.showToast({ title: '图片已保存', icon: 'success' })
  } catch {
    uni.showToast({ title: '暂时没能保存图片', icon: 'none' })
  } finally {
    sharing.value = false
  }
}

async function prepareCanvas(): Promise<HTMLCanvasElement> {
  await nextPaint()
  const canvas = findCanvas()
  if (!canvas) throw new Error('missing canvas')
  canvas.width = 1080
  canvas.height = 1440
  return canvas
}

function findCanvas(): HTMLCanvasElement | null {
  const host = document.getElementById('fortuneShareCanvas')
  if (host instanceof HTMLCanvasElement) return host
  const nested = host?.querySelector('canvas')
  return nested instanceof HTMLCanvasElement ? nested : null
}

function loadCat(): Promise<CanvasImageSource | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = catUrl
  })
}

async function exportCard(canvas: HTMLCanvasElement) {
  const filename = '猫来运转-今日运势.png'
  // #ifdef H5
  downloadPng(canvas, filename)
  return
  // #endif
  const path = await writeTempPng(canvas)
  await saveToAlbum(path)
}

function downloadPng(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function writeTempPng(canvas: HTMLCanvasElement): Promise<string> {
  const data = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
  const path = `${userDataPath()}/fortune-share-card.png`
  return new Promise((resolve, reject) => {
    uni.getFileSystemManager().writeFile({
      filePath: path,
      data,
      encoding: 'base64',
      success: () => resolve(path),
      fail: () => reject(new Error('write')),
    })
  })
}

function saveToAlbum(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: () => reject(new Error('album')),
    })
  })
}

function userDataPath(): string {
  const env = (uni as unknown as { env?: { USER_DATA_PATH?: string } }).env
  return env?.USER_DATA_PATH || '_doc'
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 30))
}
</script>

<style scoped>
.share-wrap { margin-top: 16px; }
.share-button {
  width: 100%;
  min-height: 44px;
  border-radius: 12px;
  background: #f4eef9;
  color: #6f538c;
  font-size: 14px;
}
.share-canvas {
  position: fixed;
  left: -2400px;
  top: 0;
  width: 1080px;
  height: 1440px;
  pointer-events: none;
}
</style>
