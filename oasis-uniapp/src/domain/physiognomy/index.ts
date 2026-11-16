import { createSnapshotStore, type SnapshotStorage } from '../records/snapshot-store'

export const PHYSIOGNOMY_CONTENT_VERSION = 'physiognomy-reading-2026-10-v1' as const
export const PHYSIOGNOMY_RULE_VERSION = 'physiognomy-notes-v1' as const
export const PHYSIOGNOMY_STORAGE_KEY = 'oasis.physiognomy.notes.v1'
export type ArticleCategory = 'terms' | 'history' | 'perspective'
export const ARTICLE_CATEGORIES = [
  { id: 'all', label: '全部词条' }, { id: 'terms', label: '术语' }, { id: 'history', label: '文献' }, { id: 'perspective', label: '阅读视角' },
] as const
export interface ReadingSource { title: string; edition: string; revision: string; url: string; reviewedAt: string; rights: string }
export interface CulturalArticle {
  id: string; title: string; aliases: string[]; category: ArticleCategory; summary: string; readingNote: string
  locator: string; source: ReadingSource; diagram: 'three-regions' | null
  terms: { label: string; description: string }[]
}
const rights = '古籍原文为公有领域；本工具短释义与图解自行创作，不复制平台现代标点、注译或图片。'
const sources: Record<string, ReadingSource> = {
  encyclopedia: { title: '《钦定古今图书集成》艺术典第632卷', edition: '相术部汇考二 · 所引《神相全编二》', revision: 'Wikisource oldid=1942595', url: 'https://zh.wikisource.org/w/index.php?title=欽定古今圖書集成/博物彙編/藝術典/第632卷&oldid=1942595', reviewedAt: '2026-10-03', rights },
  xunzi: { title: '《荀子》卷三', edition: '非相篇第五 · 开篇正文', revision: 'Wikisource oldid=382201', url: 'https://zh.wikisource.org/w/index.php?title=荀子/非相篇&oldid=382201', reviewedAt: '2026-10-03', rights },
  taiqing: { title: '《太清神鉴》四库全书本', edition: '提要 · 乾隆四十六年九月恭校上', revision: 'Wikisource oldid=631293', url: 'https://zh.wikisource.org/w/index.php?title=太清神鑑_(四庫全書本)&oldid=631293', reviewedAt: '2026-10-03', rights },
}
const articles: CulturalArticle[] = [
  { id: 'five-offices', title: '五官', aliases: ['五官说', '五官說', '采听官', '採聽官', '保寿官', '保壽官', '监察官', '監察官', '审辨官', '審辨官', '出纳官', '出納官'], category: 'terms', summary: '这部文献把耳、眉、眼、鼻、口配上五种“官”的名称。这里的五官是一套历史术语，用来读懂书中所指部位。', readingNote: '“保寿”等名称只是古书用语，不表示可以从相应部位测定寿命、健康或品行。', locator: '神相全编二 → 五官说首句', source: sources.encyclopedia, diagram: null, terms: [{ label: '耳', description: '采听官' }, { label: '眉', description: '保寿官' }, { label: '眼', description: '监察官' }, { label: '鼻', description: '审辨官' }, { label: '口', description: '出纳官' }] },
  { id: 'three-regions', title: '三停', aliases: ['上停', '中停', '下停', '三才三停论', '三才三停論'], category: 'terms', summary: '三停把面部纵向分成三段。本词条选取所引卷中“发际—眉—准头—地阁”的这一组划分，以便对照词语。准头指鼻尖一带，地阁指下颏一带。', readingNote: '同段还用“上府、中府、下府”列另一组描述；不同书本未必采用相同边界。图示不用于测量美丑、比例标准或判断人生阶段。', locator: '神相全编二 → 三才三停论，三停的后一组部位描述', source: sources.encyclopedia, diagram: 'three-regions', terms: [{ label: '上停', description: '发际至眉' }, { label: '中停', description: '眉至准头' }, { label: '下停', description: '准头至地阁' }] },
  { id: 'five-mountains', title: '五岳', aliases: ['五嶽', '衡山', '恒山', '恆山', '嵩山', '泰山', '华山', '華山'], category: 'terms', summary: '五岳在这里借山岳名称称呼额、颏、鼻及左右颧。它是一种比附命名，不是地理方向测量。左右按本人方位理解。', readingNote: '只整理名词对应，不沿用原文按外貌判断贵贱、寿夭或德行的说法。', locator: '神相全编二 → 五岳首句', source: sources.encyclopedia, diagram: null, terms: [{ label: '额', description: '衡山' }, { label: '颏', description: '恒山' }, { label: '鼻', description: '嵩山' }, { label: '左颧', description: '泰山' }, { label: '右颧', description: '华山' }] },
  { id: 'four-rivers', title: '四渎', aliases: ['四瀆', '江', '河', '淮', '济', '濟'], category: 'terms', summary: '四渎借江、河、淮、济四条水系的名称，称呼书中四种部位。这是历史文本中的比喻。', readingNote: '词语对应不支持从器官外观判断财富、性格或身体状况。', locator: '神相全编二 → 四渎首句', source: sources.encyclopedia, diagram: null, terms: [{ label: '耳', description: '江' }, { label: '目', description: '河' }, { label: '口', description: '淮' }, { label: '鼻', description: '济' }] },
  { id: 'yintang', title: '印堂', aliases: ['眉中', '眉间', '眉間'], category: 'terms', summary: '所引卷以两眉之间说明“印堂”，并列出其他术语名称。读到这个词时，可以先核对它在该书中的定位。', readingNote: '本页不以这一部位的颜色、形状或照片作健康判断，也不把不同书中的同名概念自动合并。', locator: '神相全编二 → 二曰眉为保寿官，“印堂广”段', source: sources.encyclopedia, diagram: null, terms: [] },
  { id: 'star-metaphors', title: '星名与部位借喻', aliases: ['五星六曜', '日月', '罗计', '羅計', '紫气', '紫氣'], category: 'terms', summary: '该卷“五星六曜说”把太阳、太阴、罗计等星名借作部位名称。读相书时遇见星名，须先判断它是否只是这一套部位用语。', readingNote: '这些比喻不是七政四余星体的天文位置；不能把相学词条当作出生星盘的坐标。', locator: '神相全编二 → 五星六曜说', source: sources.encyclopedia, diagram: null, terms: [] },
  { id: 'fei-xiang', title: '非相', aliases: ['荀子', '相形', '论心', '論心', '择术', '擇術'], category: 'perspective', summary: '《荀子》此篇开头质疑由形貌推论人的吉凶，转而讨论内在修养与所循之道。阅读相术史，也应看见古人对它的不同意见。', readingNote: '这是思想史的讨论；不把“论心”解释成能由照片识别他人内心的方法。', locator: '非相篇第五 → 开篇“相人”至“非吉凶也”', source: sources.xunzi, diagram: null, terms: [] },
  { id: 'authorship', title: '旧题作者与版本', aliases: ['太清神鉴', '太清神鑑', '王朴', '四库提要', '四庫提要'], category: 'history', summary: '《太清神鉴》旧本题王朴撰，四库提要核对生平与书中自序后不接受这个署名，并将作者名删去。本词条因此把作者记为有争议。', readingNote: '书的题署、后世编者意见和已经确定的作者身份，是不同层次的信息；阅读时应分别保留。', locator: '四库全书本 → 提要，论旧题王朴与删名部分', source: sources.taiqing, diagram: null, terms: [] },
]
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
export function getCulturalArticle(id: string): CulturalArticle {
  const article = articles.find(item => item.id === id)
  if (!article) throw new Error('这个词条不存在，请重新选择。')
  return clone(article)
}
export function searchCulturalArticles(query = '', category = 'all'): CulturalArticle[] {
  if (typeof query !== 'string' || [...query].length > 80) throw new Error('检索词最多80个字符。')
  if (!ARTICLE_CATEGORIES.some(item => item.id === category)) throw new Error('请选择有效的词条分类。')
  const search = query.trim().toLocaleLowerCase()
  return articles.filter(item => (category === 'all' || item.category === category) && [item.title, ...item.aliases, item.summary, ...item.terms.map(term => term.label + term.description)].join('\n').toLocaleLowerCase().includes(search)).map(clone)
}
export interface CulturalNoteInput { articleId: string; date: string; title: string; note: string }
export interface CulturalNoteSnapshot {
  schemaVersion: 1; ruleVersion: typeof PHYSIOGNOMY_RULE_VERSION; contentVersion: typeof PHYSIOGNOMY_CONTENT_VERSION
  kind: 'cultural-reading-note'; input: CulturalNoteInput; article: CulturalArticle
}
function validateInput(input: unknown): CulturalNoteInput {
  if (!object(input) || typeof input.articleId !== 'string' || typeof input.date !== 'string' || typeof input.title !== 'string' || typeof input.note !== 'string') throw new Error('笔记资料不完整，请重新填写。')
  getCulturalArticle(input.articleId)
  const date = new Date(`${input.date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < '1900-01-01' || input.date > '2099-12-31' || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) throw new Error('请填写1900–2099年内的有效日期，格式YYYY-MM-DD。')
  const title = input.title.trim(), note = input.note.trim()
  if (!title || [...title].length > 80 || /[\u0000-\u001f\u007f]/.test(title)) throw new Error('笔记标题需为1–80个字符的单行文字。')
  if (!note || [...note].length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)) throw new Error('笔记正文需为1–2000个字符，不支持控制字符。')
  return { articleId: input.articleId, date: input.date, title, note }
}
export function createCulturalNote(input: CulturalNoteInput): CulturalNoteSnapshot {
  const normalized = validateInput(input)
  return { schemaVersion: 1, ruleVersion: PHYSIOGNOMY_RULE_VERSION, contentVersion: PHYSIOGNOMY_CONTENT_VERSION, kind: 'cultural-reading-note', input: normalized, article: getCulturalArticle(normalized.articleId) }
}
const string = (value: unknown, maximum: number) => typeof value === 'string' && value.length > 0 && [...value].length <= maximum
/** Restore the saved prose verbatim; only structure and its source identity are validated. */
export function isCulturalNote(raw: unknown): raw is CulturalNoteSnapshot {
  try {
    if (!object(raw) || raw.schemaVersion !== 1 || raw.ruleVersion !== PHYSIOGNOMY_RULE_VERSION || raw.contentVersion !== PHYSIOGNOMY_CONTENT_VERSION || raw.kind !== 'cultural-reading-note') return false
    const input = validateInput(raw.input)
    if (JSON.stringify(input) !== JSON.stringify(raw.input)) return false
    const a = raw.article, canonical = getCulturalArticle(input.articleId)
    if (!object(a) || a.id !== input.articleId || !['terms', 'history', 'perspective'].includes(a.category) || !string(a.title, 100) || !string(a.summary, 1000) || !string(a.readingNote, 1000) || !string(a.locator, 200)) return false
    if (a.diagram !== null && a.diagram !== 'three-regions') return false
    if (!Array.isArray(a.aliases) || a.aliases.length > 30 || !Array.from(a.aliases).every(alias => string(alias, 80))) return false
    if (!Array.isArray(a.terms) || a.terms.length > 12 || !Array.from(a.terms).every(term => object(term) && string(term.label, 40) && string(term.description, 100))) return false
    if (!object(a.source) || a.source.url !== canonical.source.url || a.source.revision !== canonical.source.revision || a.source.reviewedAt !== '2026-10-03' || !string(a.source.title, 150) || !string(a.source.edition, 200) || !string(a.source.rights, 500)) return false
    return true
  } catch { return false }
}
export function createCulturalNoteRepository(storage: SnapshotStorage) {
  return createSnapshotStore<CulturalNoteSnapshot>(storage, { key: PHYSIOGNOMY_STORAGE_KEY, kind: 'physiognomy-culture', title: '相学文化笔记', maxRecords: 50, validate: isCulturalNote })
}
