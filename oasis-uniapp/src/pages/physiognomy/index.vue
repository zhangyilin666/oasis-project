<template>
  <view class="page-shell culture-page">
    <view class="hero"><view><text class="eyebrow">相学文化 · 文献与词语</text><text class="page-heading">把词语读清，<br />把出处留下。</text><text class="page-caption">八条文化词目 · 原创示意 · 自己的阅读笔记</text></view><CatCompanion small mood="thinking" /></view>
    <view class="panel">
      <text class="panel-title">从一个词开始</text><text class="hint">按所注明版本介绍词语与历史观点，不以个体照片判断人格、身份、健康或命运。</text>
      <input v-model="query" class="field" maxlength="80" placeholder="搜索词语、别名或释义，如三停、非相" aria-label="检索相学文化词条" />
      <view class="filters" role="group" aria-label="文化词条分类"><AppButton v-for="item in ARTICLE_CATEGORIES" :key="item.id" :aria-pressed="category === item.id" :class="{ active: category === item.id }" @click="category = item.id">{{ item.label }}</AppButton></view>
      <text class="hint">找到 {{ matches.length }} 条 · {{ PHYSIOGNOMY_CONTENT_VERSION }}</text>
      <text v-if="!matches.length" class="empty">没有匹配的词条。可换一个关键词，或返回全部词条。</text>
      <view class="article-list"><AppButton v-for="article in matches" :key="article.id" class="article-button" :aria-pressed="selected?.id === article.id" @click="choose(article)"><text>{{ article.title }}</text><text class="hint">{{ article.category === 'terms' ? '术语' : article.category === 'history' ? '文献' : '阅读视角' }} · {{ article.source.title }}</text></AppButton></view>
      <AppButton v-if="query || category !== 'all'" class="text-button" @click="query = ''; category = 'all'">显示全部词条</AppButton>
    </view>

    <view v-if="selected" class="panel">
      <text class="eyebrow">{{ saved ? '保存时的词条快照' : '本机文化词条' }}</text><text class="article-title">{{ selected.title }}</text><text class="body-copy">{{ selected.summary }}</text>
      <view v-if="selected.diagram === 'three-regions'" class="diagram-box">
        <text class="diagram-title">三停 · 原创位置示意</text>
        <view class="region-diagram" role="img" aria-label="三停词语示意：上停从发际至眉，中停从眉至准头，下停从准头至地阁；不按真实比例绘制">
          <view class="region upper"><text>上停</text><text>发际 → 眉</text></view><view class="region middle"><text>中停</text><text>眉 → 准头</text></view><view class="region lower"><text>下停</text><text>准头 → 地阁</text></view>
        </view>
        <text class="hint">按本词条注明的划分作抽象示意，不按真实比例绘制，也不作为测量模板。</text>
      </view>
      <view v-if="selected.terms.length" class="terms"><view v-for="term in selected.terms" :key="term.label" class="term"><text>{{ term.label }}</text><text>{{ term.description }}</text></view></view>
      <text class="reading-note">{{ selected.readingNote }}</text>
      <view class="source"><text class="label">核对出处</text><text class="body-copy">{{ selected.source.title }}</text><text class="hint">{{ selected.source.edition }}<br />定位：{{ selected.locator }}<br />{{ selected.source.revision }} · 复核 {{ selected.source.reviewedAt }}</text><text class="hint">{{ selected.source.rights }}</text><AppButton class="source-button" @click="openSource(selected.source.url)">打开这份固定版本原文 ↗</AppButton></view>
      <text v-if="saved" class="hint">这份内容保存于 {{ saved.savedAt.slice(0, 10) }}，回看没有替换成新词条。</text>
    </view>

    <view v-if="selected" class="panel">
      <text class="panel-title">留下阅读笔记</text><text class="hint">当前词条：{{ selected.title }}。保存时同时留下词条、原文定位和资料版本。</text>
      <text class="label">笔记日期 · 公历</text>
      <!-- #ifdef H5 -->
      <input v-model="date" class="field" maxlength="10" placeholder="YYYY-MM-DD" aria-label="相学文化笔记日期" />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <picker mode="date" :value="date" start="1900-01-01" end="2099-12-31" @change="date = $event.detail.value" aria-label="相学文化笔记日期"><view class="field picker-field">{{ date }}</view></picker>
      <!-- #endif -->
      <text class="label">笔记标题</text><input v-model="title" class="field" maxlength="160" placeholder="给这次阅读起一个标题" aria-label="相学文化笔记标题" />
      <text class="label">我的理解或待核对的问题</text><textarea v-model="note" class="field note-field" maxlength="4000" placeholder="可以记录词语区别、资料疑问或下一次想查的出处" aria-label="相学文化笔记正文" /><text class="hint">最多2000个字符。笔记仅在本机保存，不随账号同步。</text>
      <text v-if="error" class="error" role="alert">{{ error }}</text><text v-if="notice" class="success" role="status">{{ notice }}</text>
      <view class="actions"><AppButton class="primary" :disabled="Boolean(saved)" @click="save">{{ saved ? '这份笔记已保存' : '保存词条与笔记' }}</AppButton><AppButton v-if="saved" @click="exportCurrent">导出这份笔记 JSON</AppButton></view>
    </view>

    <view class="panel"><view class="record-heading"><text class="panel-title">本机文化笔记</text><text class="hint">{{ records.length }} / 50</text></view><text class="hint">清理应用数据会移除记录，请自行导出备份。打开旧笔记只恢复原快照。</text><text v-if="storageError" class="error" role="alert">{{ storageError }}</text><AppButton v-if="storageError" @click="refresh">重读本机记录</AppButton><text v-if="!records.length && !storageError" class="empty">还没有保存的文化笔记。选一个词条，留下自己的理解。</text><view v-for="record in records" :key="record.id" class="record"><AppButton class="record-open" @click="openRecord(record)"><text>{{ record.snapshot.input.title }}</text><text class="hint">{{ record.snapshot.input.date }} · {{ record.snapshot.article.title }} · 原样回看 ↗</text></AppButton><AppButton class="delete-button" :aria-label="`删除文化笔记：${record.snapshot.input.title}`" @click="remove(record)">删除</AppButton></view><AppButton :disabled="!records.length || Boolean(storageError)" @click="exportAll">导出全部文化笔记 JSON</AppButton><text class="hint">浏览器发起下载；其他端复制JSON后请自行保存到文件。</text></view>
    <text class="footer-note">了解一种旧时语言，也保留对它的提问。</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppButton from '@/components/AppButton.vue'
import CatCompanion from '@/components/CatCompanion.vue'
import { getAlmanacToday } from '@/domain/almanac'
import { ARTICLE_CATEGORIES, PHYSIOGNOMY_CONTENT_VERSION, getCulturalArticle, searchCulturalArticles, createCulturalNote, createCulturalNoteRepository, type CulturalArticle, type CulturalNoteSnapshot } from '@/domain/physiognomy'
import type { SnapshotRecord } from '@/domain/records/snapshot-store'
import { exportJson } from '@/utils/export-json'

const query = ref(''), category = ref('all'), date = ref(getAlmanacToday()), title = ref(''), note = ref('')
const selected = ref<CulturalArticle | null>(null), saved = ref<SnapshotRecord<CulturalNoteSnapshot> | null>(null)
const error = ref(''), storageError = ref(''), notice = ref(''), records = ref<SnapshotRecord<CulturalNoteSnapshot>[]>([])
const repo = createCulturalNoteRepository({ getItem: key => uni.getStorageSync(key), setItem: (key, value) => uni.setStorageSync(key, value) })
const matches = computed(() => searchCulturalArticles(query.value, category.value))
const message = (value: unknown) => value instanceof Error ? value.message : '操作未完成，请重试。'
watch([date, title, note], () => { saved.value = null; error.value = ''; notice.value = '' }, { flush: 'sync' })
function refresh() { try { records.value = repo.list(); storageError.value = '' } catch (e) { storageError.value = message(e) } }
onShow(refresh)
function choose(article: CulturalArticle) { selected.value = getCulturalArticle(article.id); saved.value = null; error.value = ''; notice.value = ''; if (!title.value) title.value = `${article.title} · 阅读笔记` }
function save() {
  if (!selected.value) return
  try {
    const snapshot = createCulturalNote({ articleId: selected.value.id, date: date.value, title: title.value, note: note.value })
    saved.value = repo.save(snapshot); selected.value = snapshot.article; refresh(); error.value = ''; notice.value = '词条、出处和笔记已保存在本机。'
  } catch (e) { error.value = message(e) }
}
function openRecord(record: SnapshotRecord<CulturalNoteSnapshot>) { date.value = record.snapshot.input.date; title.value = record.snapshot.input.title; note.value = record.snapshot.input.note; selected.value = JSON.parse(JSON.stringify(record.snapshot.article)); saved.value = record; error.value = ''; notice.value = '已恢复保存时的词条与笔记。' }
async function download(value: unknown, filename: string) { try { const mode = await exportJson(value, filename); notice.value = mode === 'download' ? '已发起JSON下载，请在下载目录确认。' : 'JSON已复制，请粘贴后保存。' } catch (e) { error.value = message(e) } }
function exportCurrent() { if (saved.value) void download({ kind: 'physiognomy-culture-note', schemaVersion: 1, record: saved.value }, 'oasis-culture-note.json') }
function exportAll() { try { void download(JSON.parse(repo.exportJSON()), 'oasis-culture-notes.json') } catch (e) { storageError.value = message(e) } }
function remove(record: SnapshotRecord<CulturalNoteSnapshot>) { uni.showModal({ title: '删除这份文化笔记？', content: `仅删除本机的「${record.snapshot.input.title}」。如需保留，请先导出。`, success: result => { if (!result.confirm) return; try { repo.remove(record.id); if (saved.value?.id === record.id) saved.value = null; refresh() } catch (e) { storageError.value = message(e) } } }) }
function openSource(url: string) {
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer')
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url })
  // #endif
}
</script>

<style scoped>
.culture-page{padding-bottom:48px}.hero{display:flex;gap:8px;align-items:center;margin-bottom:22px}.hero>view{min-width:0;flex:1}.hero .page-heading{font-size:25px;line-height:1.6}.panel{padding:20px;border:1px solid #e8e3ef;border-radius:20px;background:#fff;margin-bottom:18px}.panel-title,.article-title,.body-copy,.hint,.label,.empty,.error,.success,.reading-note,.footer-note{display:block}.panel-title{font-size:16px;line-height:1.8;font-weight:600;color:#5a4769}.hint{font-size:11px;line-height:1.9;color:#8a7b95;margin-top:7px;overflow-wrap:anywhere}.field{box-sizing:border-box;display:block;width:100%;height:48px;padding:12px;border:1px solid #e9e1f0;border-radius:12px;background:#faf7fc;color:#655273;font-size:13px;margin:12px 0}.note-field{height:132px;line-height:1.8}.picker-field{line-height:22px}.filters,.actions{display:flex;gap:7px;flex-wrap:wrap;margin:16px 0}.filters button,.actions button,.panel>button,.source-button,.delete-button{padding:9px 12px;margin:0;border-radius:10px;background:#f4eef9;color:#7c6091;font-size:12px;line-height:1.8;white-space:normal}.filters button.active{background:#e9dff3;color:#634580}.actions button.primary{background:#9476b0;color:white}.actions button[disabled],.panel>button[disabled]{opacity:.5}.article-list{margin-top:14px}.article-button{display:block;width:100%;text-align:left;padding:13px 0;margin:0;border-radius:0;background:transparent;line-height:1.8;color:#665174;font-size:14px;border-top:1px solid #eee8f4;white-space:normal}.article-button[aria-pressed=true]{color:#6c4388}.article-button>text{display:block}.article-title{font-size:25px;color:#64477b;line-height:1.8;margin:10px 0}.body-copy{font-size:13px;line-height:2;color:#6d5c77;white-space:pre-wrap;overflow-wrap:anywhere}.reading-note{font-size:12px;line-height:1.9;color:#8a7657;background:#fbf7ef;padding:13px;border-radius:12px;margin-top:18px}.source{padding-top:16px;margin-top:18px;border-top:1px solid #eee8f4}.source-button{width:100%;margin-top:14px;text-align:left}.label{font-size:12px;line-height:1.8;color:#796084;margin:16px 0 8px}.terms{margin:16px 0}.term{display:flex;gap:20px;justify-content:space-between;font-size:13px;line-height:1.9;color:#7a6486;border-bottom:1px solid #f0eaf6;padding:9px 0}.term>text:last-child{text-align:right}.diagram-box{background:#f8f5fb;border-radius:15px;padding:16px;margin:18px 0}.diagram-title{display:block;color:#786186;font-size:12px;line-height:1.8}.region-diagram{max-width:180px;margin:18px auto;border:2px solid #b5a1c5;border-radius:48% 48% 42% 42%;overflow:hidden}.region{padding:15px 5px;text-align:center;color:#836a96;display:flex;flex-direction:column;gap:5px;font-size:12px}.region>text:last-child{font-size:10px}.upper{background:#e9e0f1}.middle{background:#f1eaf7;border-top:1px dashed #bba6cb;border-bottom:1px dashed #bba6cb}.lower{background:#f7f1fa}.empty{padding:20px 0;color:#95829e;font-size:12px;line-height:1.9}.error{padding:11px;background:#fbf1f3;color:#a25265;font-size:12px;line-height:1.9;border-radius:10px}.success{color:#5f835e;font-size:12px;line-height:1.9;margin-top:12px}.record-heading{display:flex;justify-content:space-between;gap:8px}.record{display:flex;align-items:center;gap:8px;padding:13px 0;border-top:1px solid #eee8f4}.record-open{flex:1;min-width:0;margin:0;padding:4px 0;background:transparent;text-align:left;font-size:13px;line-height:1.8;color:#6f577e;white-space:normal;overflow-wrap:anywhere}.record-open>text{display:block}.delete-button{flex-shrink:0;color:#a47481;background:#fbf2f5}.footer-note{font-size:11px;line-height:1.9;text-align:center;color:#96879e}.text-button{margin-top:14px!important}
@media(max-width:350px){.panel{padding:15px}.hero .page-heading{font-size:22px}.hero .page-caption{font-size:11px}.filters{gap:5px}.filters button{font-size:11px;padding:8px}.region-diagram{max-width:155px}}
</style>
