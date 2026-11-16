<template>
  <view class="cat-companion" :class="{ small }" role="img" :aria-label="character === 'herbal' ? '穿淡青布衣的橘白小猫，抱着药钵和草药' : pose.label">
    <image v-if="character === 'herbal'" class="cat-portrait" src="/static/ui/cat-herbal.webp" mode="aspectFit" aria-hidden="true" />
    <image v-else class="cat-sprite" src="/static/ui/cat-calico-sprite.webp" mode="scaleToFill" :style="{ left: `${-pose.column * 100}%`, top: `${-pose.row * 100}%` }" aria-hidden="true" />
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'

const poses = {
  welcome: { column: 0, row: 0, label: '穿蓝布衣的三花小猫向你挥爪' },
  thinking: { column: 1, row: 0, label: '三花小猫正在认真翻书' },
  playful: { column: 2, row: 0, label: '三花小猫眯着眼，偷偷藏起小鱼干' },
  complete: { column: 0, row: 1, label: '三花小猫开心地递上解读卷轴' },
  comfort: { column: 1, row: 1, label: '三花小猫伸出小爪，安静陪着你' },
  resting: { column: 2, row: 1, label: '三花小猫蜷着尾巴安心打盹' },
} as const
const props = withDefaults(defineProps<{ small?: boolean; mood?: keyof typeof poses; character?: 'calico' | 'herbal' }>(), { small: false, mood: 'welcome', character: 'calico' })
const pose = computed(() => poses[props.mood])
</script>
<style scoped>
.cat-companion { position: relative; display: block; width: 160px; height: 160px; flex-shrink: 0; overflow: hidden; }
.cat-sprite { position: absolute; display: block; width: 300%; height: 200%; max-width: none; pointer-events: none; }
.cat-portrait { display: block; width: 100%; height: 100%; pointer-events: none; }
.cat-companion.small { width: 72px; height: 72px; }
</style>
