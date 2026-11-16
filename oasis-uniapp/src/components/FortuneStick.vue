<template>
  <view class="stick-card">
    <view class="stick-heading">
      <text class="stick-title">运势一签</text>
      <text class="stick-note">一天一支 · 仅供娱乐参考</text>
    </view>

    <view v-if="phase === 'loading'" class="stick-loading">
      <CatCompanion small mood="thinking" />
      <text>看看今天有没有抽过…</text>
    </view>

    <view v-else-if="phase === 'ask'" class="stick-ask">
      <text class="stick-prompt">心里默念想问的事</text>
      <text class="stick-hint">想清楚就好，写不写都可以。写下的话只用来陪你看这一支签。</text>
      <input
        class="stick-input"
        maxlength="40"
        :value="question"
        placeholder="想问的事，可以不写"
        @input="onInput"
      />
      <AppButton class="stick-button" :disabled="busy" @click="beginDraw">摇一支签</AppButton>
    </view>

    <view v-else-if="phase === 'shaking'" class="stick-stage" :class="{ 'is-reduced': reducedMotion }">
      <view class="tube" aria-hidden="true">
        <view class="tube-lip"></view>
        <view class="tube-body"></view>
        <view class="flying-stick"></view>
      </view>
      <CatCompanion mood="playful" />
      <text class="stick-hint">签筒在响，一支签要出来了。</text>
    </view>

    <view v-else-if="phase === 'result' && stick" class="stick-result">
      <view class="stick-slip">
        <text class="slip-grade">第 {{ stick.number }} 签 · {{ stick.grade }}</text>
        <text v-if="stick.title" class="slip-title">{{ stick.title }}</text>
        <text class="slip-poem">{{ stick.poem }}</text>
      </view>
      <text class="slip-label">解签</text>
      <text class="slip-plain">{{ stick.plain }}</text>
      <view class="cat-line">
        <CatCompanion small mood="complete" />
        <text class="cat-copy">{{ stick.cat }}</text>
      </view>
      <text class="stick-note">{{ stick.disclaimer || '仅供娱乐参考' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { drawFortuneStickApi, getTodayStickApi, type FortuneStickResult } from '@/api/xiaoyi'
import { STICK_STORAGE_KEY, chinaDate, parseStoredStick, serializeStick, type StoredStick } from '@/domain/fortune-stick/today'

const emit = defineEmits<{ change: [stick: { number: number; grade: string; line: string } | null] }>()

const phase = ref<'loading' | 'ask' | 'shaking' | 'result'>('loading')
const question = ref('')
const stick = ref<StoredStick | null>(null)
const busy = ref(false)
const reducedMotion = ref(false)

function onInput(event: Event) {
  const detail = (event as unknown as { detail?: { value?: string } }).detail
  const target = event.target as { value?: string } | null
  question.value = (detail?.value || target?.value || '').slice(0, 40)
}

function show(next: StoredStick) {
  stick.value = next
  phase.value = 'result'
  uni.setStorageSync(STICK_STORAGE_KEY, serializeStick(next))
  emit('change', { number: next.number, grade: next.grade, line: next.line })
}

function fromResult(data: FortuneStickResult): StoredStick {
  return {
    date: data.date || chinaDate(),
    number: data.number,
    grade: data.grade,
    title: data.title,
    poem: data.poem,
    line: data.line,
    plain: data.plain,
    cat: data.cat,
    disclaimer: data.disclaimer || '仅供娱乐参考',
  }
}

onMounted(async () => {
  reducedMotion.value = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const today = chinaDate()
  const cached = parseStoredStick(uni.getStorageSync(STICK_STORAGE_KEY), today)
  if (cached) show(cached)
  try {
    const res = await getTodayStickApi()
    if (res.data) show(fromResult(res.data))
    else if (!cached) phase.value = 'ask'
  } catch {
    if (!cached) phase.value = 'ask'
  }
})

async function beginDraw() {
  if (busy.value || phase.value === 'result') return
  busy.value = true
  phase.value = 'shaking'
  try {
    if (!reducedMotion.value) await wait(1600)
    const asked = question.value.trim()
    const res = await drawFortuneStickApi(asked)
    question.value = ''
    show(fromResult(res.data))
  } catch {
    phase.value = 'ask'
    uni.showToast({ title: '这支签暂时没摇出来', icon: 'none' })
  } finally {
    busy.value = false
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
</script>

<style scoped>
.stick-card {
  margin-top: 12px;
  padding: 16px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #f0ecf5;
}
.stick-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.stick-title { font-size: 16px; font-weight: 600; color: #3a3148; }
.stick-note { font-size: 11px; color: #9a8eaa; }
.stick-prompt { display: block; margin-top: 12px; font-size: 18px; font-weight: 600; line-height: 1.5; }
.stick-hint { display: block; margin-top: 6px; font-size: 12px; line-height: 1.7; color: #796b85; }
.stick-input {
  width: 100%;
  box-sizing: border-box;
  margin-top: 12px;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #e4dced;
  border-radius: 12px;
  background: #fbf9fd;
  font-size: 14px;
}
.stick-button {
  width: 100%;
  margin-top: 12px;
  min-height: 44px;
  border-radius: 12px;
  background: #6f538c;
  color: #fff;
  font-size: 15px;
}
.stick-loading, .stick-stage, .cat-line { display: flex; align-items: center; gap: 10px; }
.stick-loading { margin-top: 12px; color: #796b85; font-size: 13px; }
.stick-stage { flex-direction: column; margin-top: 16px; }
.tube { position: relative; width: 74px; height: 92px; }
.tube-body {
  position: absolute;
  left: 10px;
  bottom: 0;
  width: 54px;
  height: 70px;
  border-radius: 8px 8px 16px 16px;
  background: linear-gradient(#d7b48a, #b8885a);
}
.tube-lip {
  position: absolute;
  left: 4px;
  top: 14px;
  width: 66px;
  height: 16px;
  border-radius: 8px;
  background: #e7cba8;
}
.flying-stick {
  position: absolute;
  left: 30px;
  top: 18px;
  width: 8px;
  height: 46px;
  border-radius: 4px;
  background: #f4efe4;
  box-shadow: inset 0 8px 0 #c4554a;
}
.stick-stage:not(.is-reduced) .tube { animation: wobble 0.18s linear infinite; }
.stick-stage:not(.is-reduced) .flying-stick { animation: fly-out 1.1s ease-out forwards; }
.stick-slip {
  margin-top: 12px;
  padding: 14px;
  border-radius: 14px;
  background: #fbf6ee;
}
.slip-grade { display: block; font-size: 14px; font-weight: 600; color: #8a6232; }
.slip-title { display: block; margin-top: 4px; font-size: 12px; color: #9a7b58; }
.slip-poem { display: block; margin-top: 8px; white-space: pre-wrap; font-size: 16px; line-height: 1.8; color: #3a3148; }
.slip-label { display: block; margin-top: 12px; font-size: 12px; color: #8d74c4; }
.slip-plain { display: block; margin-top: 4px; font-size: 15px; line-height: 1.8; }
.cat-line { margin-top: 12px; align-items: flex-start; }
.cat-copy { flex: 1; padding: 10px 12px; border-radius: 14px; background: #f4eef9; font-size: 14px; line-height: 1.7; color: #4d3d63; }
@keyframes wobble {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg); }
}
@keyframes fly-out {
  0% { transform: translateY(8px); opacity: 0; }
  35% { opacity: 1; }
  100% { transform: translate(28px, -64px) rotate(18deg); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .tube, .flying-stick { animation: none; }
}
</style>
