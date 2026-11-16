<template>
 <view class="archive-panel">
  <AppButton class="toggle" :aria-expanded="open" @click="open = !open; if (open) refresh()"><view><text class="title">本机出生档案</text><text class="hint">{{ records.length }} / 30 份 · 保存计算时的完整快照</text></view><text>{{ open ? '−' : '＋' }}</text></AppButton>
  <view v-if="open" class="archive-content">
   <text class="hint">只在此设备保存，与登录账号分开。清理应用数据会丢失档案，可先导出备份。</text>
   <view v-if="result" class="save-form"><label for="chart-archive-name" class="label">给当前结果起个名字</label><input id="chart-archive-name" class="form-input" v-model="name" maxlength="40" placeholder="例如：我的出生盘" aria-label="档案名称" /><view class="action-row"><AppButton class="action primary" @click="save">保存新档案</AppButton><AppButton class="action" @click="exportCurrent">导出当前 JSON</AppButton></view><text class="hint">导出包含出生时间、地点及排盘数据，请自行保管。</text></view>
   <text v-if="message" class="message" role="status">{{ message }}</text><text v-if="error" class="error" role="alert">{{ error }}</text>
   <text v-if="!records.length" class="empty">暂无本机档案。生成三盘后可手动保存。</text>
   <view v-for="record in records" :key="record.id" class="record"><text class="record-name">{{ record.name }}</text><text class="hint">{{ record.result.profile.date }} {{ record.result.profile.time }} · {{ record.result.profile.gender }}</text><text class="hint">保存于 {{ record.savedAt.replace('T', ' ').slice(0, 19) }} UTC</text><view class="action-row"><AppButton class="action" @click="emit('open', record)">查看快照</AppButton><AppButton class="action" @click="emit('fill', record)">填入资料</AppButton><AppButton class="action" @click="exportRecord(record)">导出</AppButton><AppButton class="action delete" @click="remove(record)">删除</AppButton></view></view>
  </view>
 </view>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppButton from '@/components/AppButton.vue'
import { createChartArchive, chartExport, type SavedChart } from '@/domain/metaphysics/archive'
import type { ExplorationResult } from '@/domain/metaphysics/types'
import { exportJson } from '@/utils/export-json'
const props = defineProps<{ result: ExplorationResult | null }>()
const emit = defineEmits<{ open: [record: SavedChart]; fill: [record: SavedChart] }>()
const archive = createChartArchive({ get: key => uni.getStorageSync(key), set: (key, value) => uni.setStorageSync(key, value) })
const records = ref<SavedChart[]>([]), open = ref(false), name = ref(''), message = ref(''), error = ref('')
function failure(value: unknown) { error.value = value instanceof Error ? value.message : '本机档案操作失败，请重试'; message.value = '' }
function refresh() { try { records.value = archive.list(); error.value = '' } catch (e) { failure(e) } }
onMounted(refresh)
defineExpose({ openPanel: () => { open.value = true; refresh() } })
function save() {
 if (!props.result) return
 try { archive.save(name.value, props.result); refresh(); message.value = '已保存到本机。后续重新计算不会覆盖这份快照。' } catch (e) { failure(e) }
}
async function download(result: ExplorationResult, label: string, savedAt?: string) {
 try { const mode = await exportJson(chartExport(result, label, savedAt), `xiaoyi-chart-${result.profile.date}.json`); error.value = ''; message.value = mode === 'download' ? '已发起 JSON 文件下载' : 'JSON 已复制，可粘贴到文件中备份' } catch (e) { failure(e) }
}
function exportCurrent() { if (props.result) return download(props.result, name.value.trim() || '三盘同参') }
function exportRecord(record: SavedChart) { return download(record.result, record.name, record.savedAt) }
function remove(record: SavedChart) {
 uni.showModal({ title: '删除本机档案', content: `删除「${record.name}」？此操作不会删除其他档案。`, confirmText: '删除', success: response => {
  if (!response.confirm) return
  try { records.value = archive.remove(record.id); error.value = ''; message.value = '已删除这份本机档案' } catch (e) { failure(e) }
 } })
}
</script>
<style scoped>
.archive-panel { background: #fff; border: 1px solid #eee7f4; padding: 16px 20px; border-radius: 22px; margin: 20px 0; }.toggle { width: 100%; background: transparent; padding: 0; text-align: left; display: flex; justify-content: space-between; align-items: center; gap: 12px; white-space: normal; color: #6e528e; line-height: 1.8; min-height: 44px; }.title { display: block; font-size: 16px; font-weight: 600; }.hint { display: block; margin-top: 5px; font-size: 11px; color: #83718c; line-height: 1.9; }.archive-content { padding-top: 16px; }.save-form { background: #f8f4fb; padding: 14px; border-radius: 14px; margin-top: 16px; }.label { display: block; font-size: 12px; margin-bottom: 8px; color: #6d557f; }.form-input { font-size: 13px; }.action-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }.action { font-size: 11px; margin: 0; min-height: 40px; padding: 8px 10px; color: #75578e; background: #f2ebf8; line-height: 1.9; }.primary { color: #fff; background: #8c70b2; }.delete { color: #9b6471; background: #f9f0f2; }.record { border-top: 1px solid #eee7f4; margin-top: 20px; padding-top: 18px; }.record-name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }.empty, .message, .error { display: block; font-size: 12px; line-height: 1.9; margin-top: 14px; }.empty { color: #9a8aa4; }.message { color: #5e8366; }.error { color: #a45767; }@media(max-width:350px) { .archive-panel { padding: 16px; }.save-form { padding: 10px; } }
</style>
