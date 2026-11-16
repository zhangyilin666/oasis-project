<template>
  <view v-if="records.length || error" class="archive-panel">
    <AppButton class="archive-toggle" :aria-expanded="open" @click="open = !open"><view><text class="archive-title">历史出生档案</text><text class="muted">{{ records.length }} 份已保存资料</text></view><text aria-hidden="true">{{ open ? '−' : '＋' }}</text></AppButton>
    <text v-if="error" class="error" role="alert">{{ error }}</text>
    <view v-if="open" class="archive-content">
      <text class="muted">保留在此设备的历史快照，可回看或导出备份。各命盘工具中仍可复制这些出生资料。</text>
      <text v-if="message" class="message" role="status">{{ message }}</text>
      <view v-for="record in records" :key="record.id" class="record">
        <text class="record-name">{{ record.name }}</text><text class="muted">{{ record.result.profile.date }} {{ record.result.profile.time }} · {{ record.result.profile.gender }}{{ record.result.profile.timePrecision === 'approximate' ? ' · 大致时间' : '' }}</text>
        <view class="actions"><AppButton class="action" :aria-expanded="selectedId === record.id" @click="selectedId = selectedId === record.id ? '' : record.id; activeChart = ''">{{ selectedId === record.id ? '收起快照' : '查看快照' }}</AppButton><AppButton class="action" @click="exportRecord(record)">导出 JSON</AppButton></view>
        <view v-if="selectedId === record.id" class="snapshot">
          <text class="muted">保存于 {{ record.savedAt.replace('T', ' ').slice(0, 19) }} UTC · 此处显示保存时的结果</text>
          <text class="muted">{{ record.result.profile.place?.name || '出生时间' }} · UTC{{ record.result.profile.utcOffset >= 0 ? '+' : '' }}{{ record.result.profile.utcOffset }}</text>
          <text v-if="record.result.profile.timeZone" class="muted">历史时区 · {{ record.result.profile.timeZone }}</text>
          <text v-if="record.result.profile.timePrecision === 'approximate'" class="muted">出生时间为大致时间，可能跨越时辰或交节边界，快照仍按当时所填时刻计算。</text>
          <view v-for="chart in record.result.charts" :key="chart.id" class="chart">
            <AppButton class="chart-toggle" :aria-expanded="activeChart === chart.id" @click="activeChart = activeChart === chart.id ? '' : chart.id"><text>{{ chart.title }}</text><text aria-hidden="true">{{ activeChart === chart.id ? '−' : '＋' }}</text></AppButton>
            <view v-if="activeChart === chart.id">
              <text v-if="chart.status === 'error'" class="error">{{ chart.error || '此份快照未包含有效结果' }}</text>
              <template v-else><view v-for="fact in chart.summary" :key="fact.label" class="fact"><text>{{ fact.label }}</text><text selectable>{{ fact.value }}</text></view><view v-for="section in chart.sections" :key="section.title" class="chart-section"><text class="record-name">{{ section.title }}</text><text v-if="section.caption" class="muted">{{ section.caption }}</text><view v-for="(fact, index) in section.facts" :key="index" class="fact"><text>{{ fact.label }}</text><text selectable>{{ fact.value }}</text></view></view></template>
              <text class="detail-heading">计算约定与范围</text><text v-for="(item, index) in [...chart.conventions, ...chart.limitations]" :key="index" class="muted">· {{ item }}</text><text class="muted" selectable>{{ chart.source.title }} · {{ chart.source.version }} · {{ chart.source.license }}<br />{{ chart.source.url }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppButton from '@/components/AppButton.vue'
import { createChartArchive, chartExport, type SavedChart } from '@/domain/metaphysics/archive'
import { exportJson } from '@/utils/export-json'

const records = ref<SavedChart[]>([])
const open = ref(false), selectedId = ref(''), activeChart = ref(''), error = ref(''), message = ref('')
onMounted(() => {
  try { records.value = createChartArchive({ get: key => uni.getStorageSync(key), set: (key, value) => uni.setStorageSync(key, value) }).list() }
  catch (value) { error.value = value instanceof Error ? value.message : '暂时无法读取历史档案，请稍后重试' }
})
async function exportRecord(record: SavedChart) {
  try {
    const mode = await exportJson(chartExport(record.result, record.name, record.savedAt), `xiaoyi-chart-${record.result.profile.date}.json`)
    error.value = ''; message.value = mode === 'download' ? '已发起 JSON 文件下载' : 'JSON 已复制，可粘贴到文件中备份'
  } catch (value) { error.value = value instanceof Error ? value.message : '导出失败，请重试' }
}
</script>

<style scoped>
.archive-panel { margin-top: 24px; border: 1px solid #eee7f4; border-radius: 20px; padding: 16px 20px; background: #fff; }
.archive-toggle, .chart-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; margin: 0; padding: 0; min-height: 44px; background: transparent; color: #735989; text-align: left; white-space: normal; line-height: 1.8; }
.archive-title { display: block; font-size: 15px; font-weight: 600; }
.muted { display: block; color: #92819e; font-size: 11px; line-height: 1.9; margin-top: 5px; overflow-wrap: anywhere; }
.archive-content { margin-top: 14px; }
.record { border-top: 1px solid #eee7f4; margin-top: 18px; padding-top: 18px; }
.record-name { display: block; font-size: 13px; font-weight: 600; color: #766083; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.action { margin: 0; min-height: 44px; padding: 10px 14px; line-height: 1.8; background: #f4edf9; color: #806295; font-size: 11px; }
.snapshot { margin-top: 14px; }
.chart { border-top: 1px solid #eee7f4; margin-top: 14px; padding-top: 6px; }
.chart-toggle { font-size: 13px; }
.chart-section { margin-top: 18px; }
.fact { display: grid; grid-template-columns: minmax(50px, 1fr) minmax(0, 2fr); gap: 10px; padding: 7px 0; font-size: 11px; line-height: 1.9; color: #85718f; overflow-wrap: anywhere; }
.detail-heading { display: block; margin-top: 18px; color: #796288; font-size: 12px; }
.error, .message { display: block; margin-top: 12px; font-size: 12px; line-height: 1.9; color: #a35f72; }.message { color: #658674; }
</style>
