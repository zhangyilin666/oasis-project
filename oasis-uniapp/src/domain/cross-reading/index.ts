import { calculateDivination, type DivinationResult } from '../divination'
import { cardsForSelection, READING_CONTEXT_LABELS, type ReadingCard, type ReadingComparison } from './cards'
import { copy, sourceTitle, sourceSavedAt, validateSourceSelection, type CrossSourceSelection } from './sources'
import { validDivinationReconstruction } from './reconstruction'
export * from './sources'
export type { ReadingCard, ReadingFact, ReadingSource } from './cards'
export { READING_CONTEXT_LABELS } from './cards'

export const CROSS_READING_RULE_VERSION = 'cross-reading-v1' as const
export const CROSS_READING_CONTENT_VERSION = 'cross-reading-prompts-v1' as const
export interface CrossReadingEntry {
  selection: CrossSourceSelection; title: string; sourceSavedAt: string
  representation: 'saved-snapshot' | 'reconstructed-from-input'
  provenance: string; reconstruction?: DivinationResult; cards: ReadingCard[]
}
export interface ReadingDifference { id: string; title: string; detail: string }
export interface ReadingPrompt { id: string; title: string; text: string }
export interface CrossReadingSnapshot {
  schemaVersion: 1; ruleVersion: typeof CROSS_READING_RULE_VERSION; contentVersion: typeof CROSS_READING_CONTENT_VERSION
  createdAt: string; topic: string; note: string; entries: CrossReadingEntry[]; differences: ReadingDifference[]; readingPrompts: ReadingPrompt[]
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const object = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v)
function iso(v: unknown): v is string { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v }
function field(value: unknown, title: string, max: number, required: boolean): string {
  if (typeof value !== 'string' || (required && !value.trim()) || [...value.trim()].length > max) throw new Error(`${title}${required ? '须填写，且' : ''}最多 ${max} 字。`)
  return value.trim()
}
function makeEntry(selection: CrossSourceSelection, reconstruction?: DivinationResult): CrossReadingEntry {
  const rebuilt = selection.kind === 'divination'
  if (rebuilt && (!reconstruction || !validDivinationReconstruction(reconstruction, selection.record))) throw new Error('易卦重建结果与原规则或输入不一致。')
  if (!rebuilt && reconstruction !== undefined) throw new Error('完整快照来源不应附带重建结果。')
  return { selection: copy(selection), title: sourceTitle(selection), sourceSavedAt: sourceSavedAt(selection), representation: rebuilt ? 'reconstructed-from-input' : 'saved-snapshot', provenance: rebuilt ? '本次依原规则重建：旧记录只含输入及规则版本；本同读已保存此次结果，回看不重新起卦。' : '来源的完整已存快照；本次只读复制并整理事实，原记录未修改。', ...(rebuilt ? { reconstruction: copy(reconstruction!) } : {}), cards: cardsForSelection(selection, reconstruction) }
}
const distinct = <T>(items: T[]): T[] => [...new Set(items)]
const distinctInstants = (items: string[]): string[] => distinct(items.filter(value => Number.isFinite(Date.parse(value))).map(value => new Date(value).toISOString()))
export function readingDifferences(entries: CrossReadingEntry[]): ReadingDifference[] {
  const cards = entries.flatMap(e => e.cards), contexts = distinct(cards.map(c => c.context))
  const result: ReadingDifference[] = [{ id: 'identity', title: '主题由你选定，人物与事件关系未推定', detail: '所选记录可以属于不同人、不同事件或不同日期。共同主题只是阅读线索，本页没有自动匹配身份，也没有建立因果关系。' }]
  if (contexts.length > 1) result.push({ id: 'contexts', title: '资料类型不同', detail: `本次包含${contexts.map(c => READING_CONTEXT_LABELS[c]).join('、')}。出生条件、问事参数、测量与阅读笔记各自保留，不互相替换。` })
  const comparisons: [keyof ReadingComparison, string][] = [['timeBasis', '时间基准'], ['yearBoundary', '年界'], ['monthBoundary', '月界或月将'], ['dayBoundary', '日界'], ['coordinateSystem', '坐标与宫制']]
  for (const [key, label] of comparisons) {
    const values = distinct(cards.map(c => c.comparison[key]).filter(v => v !== '不适用'))
    if (values.length > 1) result.push({ id: key, title: `${label}有差异`, detail: cards.filter(c => c.comparison[key] !== '不适用').map(c => `${c.title}：${c.comparison[key]}`).join('；') })
  }
  const births = distinctInstants(cards.flatMap(c => c.birthInstants)), observations = distinctInstants(cards.flatMap(c => c.observationInstants))
  if (births.length > 1) result.push({ id: 'birth-instants', title: '出生 UTC 时刻不一致', detail: `${births.length} 个不同出生瞬间：${births.join('；')}。这可能是不同人物或资料版本，不自动判为录入错误。` })
  if (observations.length > 1) result.push({ id: 'observation-instants', title: '观测或问事 UTC 时刻不一致', detail: `${observations.length} 个不同瞬间：${observations.join('；')}。只并列各次结果，不假定描述同一个时刻。` })
  if (entries.some(e => e.representation === 'reconstructed-from-input')) result.push({ id: 'reconstruction', title: '易卦事实为本次重建', detail: '旧易卦记录没有历史计算快照。本次只对明确支持的原规则版本重建，并把原输入和本次结果一并保存；它与其他来源的原样快照有所区别。' })
  if (entries.some(e => e.selection.kind === 'physiognomy-culture') && entries.some(e => ['qizheng', 'jyotish', 'western-study', 'birth-charts'].includes(e.selection.kind))) result.push({ id: 'borrowed-names', title: '同名星曜可能是不同用语', detail: '相学文献里的日月、罗计等可能借指部位；天文卡里的星名指计算对象。仅名称相同不能互换，也不支持从外貌反推星盘。' })
  if (entries.some(e => e.selection.kind === 'qizheng-lodges') && entries.some(e => ['qizheng', 'jyotish', 'western-study', 'birth-charts'].includes(e.selection.kind))) result.push({ id: 'historical-modern-coordinates', title: '古表推移与现代星位分别保留', detail: '清历宿度使用手动年标号与宫度，按《历象考成》底本及每年51角秒规则推移；天文卡按明确 UTC 计算现代坐标。年标号不是出生年份，古表推移不是该年的实测距星位置，也不能仅更换零点就把现代星位当作古籍宿度。' })
  return result
}
function promptsFor(entries: CrossReadingEntry[]): ReadingPrompt[] {
  const prompts: ReadingPrompt[] = [
    { id: 'question', title: '先把主题写成能观察的问题', text: '把你关心的事情分为已发生的事实、自己的理解与尚未知道的部分。主题无需得到一个总判断。' },
    { id: 'definitions', title: '读到同名词，先核对定义', text: '看看每张卡的时间口径、规则版本和出处。相同词语未必指相同对象，差异也未必说明哪一份错了。' },
    { id: 'evidence', title: '区分盘面、文本与个人笔记', text: '标出哪些内容来自保存的计算事实，哪些是原文短释，哪些是你自己写下的观察。先保留这些层次，再形成个人理解。' },
    { id: 'next-observation', title: '留下一个可核对的小问题', text: '记下一项现实中可以再确认的资料，例如时区、测量基准、日期安排或文献版本。不要把符号对应直接当作事件结论。' },
  ]
  if (entries.some(e => e.selection.kind === 'date-selection')) prompts.push({ id: 'schedule', title: '把日期条件带回现实安排', text: '候选日期只表示已启用条件的筛选结果。逐条查看哪些条件尚未涵盖，再核对人员、场地和实际安排。' })
  if (entries.some(e => ['name-culture', 'physiognomy-culture', 'seasonal-care'].includes(e.selection.kind))) prompts.push({ id: 'text-context', title: '把阅读材料放回它的语境', text: '核对作者、版本、篇章位置与现代资料的用途。字义、古代比喻或季节描写，不能替代对具体人的了解。' })
  return prompts
}
export function createCrossReading(input: { topic: string; note: string; selections: CrossSourceSelection[] }, createdAt = new Date().toISOString()): CrossReadingSnapshot {
  const topic = field(input?.topic, '同读主题', 100, true), note = field(input?.note, '个人笔记', 4000, false)
  if (!iso(createdAt)) throw new Error('本次同读创建时间无效。')
  if (!Array.isArray(input?.selections) || input.selections.length < 2 || input.selections.length > 8) throw new Error('每次请选择 2–8 份已保存记录。')
  const selections = input.selections.map(validateSourceSelection)
  if (new Set(selections.map(s => s.key)).size !== selections.length) throw new Error('同一份来源记录不能重复选择。')
  const entries = selections.map(selection => makeEntry(selection, selection.kind === 'divination' ? calculateDivination(selection.record.input, selection.record.ruleVersion) : undefined))
  const result: CrossReadingSnapshot = { schemaVersion: 1, ruleVersion: CROSS_READING_RULE_VERSION, contentVersion: CROSS_READING_CONTENT_VERSION, createdAt, topic, note, entries, differences: readingDifferences(entries), readingPrompts: promptsFor(entries) }
  if (JSON.stringify(result).length > 850_000) throw new Error('所选原快照合计过大，请减少记录数量后再试。')
  return validateCrossReadingSnapshot(result)
}
/** Restores saved originals and readable summaries without rerunning source calculations. */
export function isCrossReadingSnapshot(value: unknown): value is CrossReadingSnapshot {
  try {
    if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== CROSS_READING_RULE_VERSION || value.contentVersion !== CROSS_READING_CONTENT_VERSION || !iso(value.createdAt) || field(value.topic, '主题', 100, true) !== value.topic || field(value.note, '笔记', 4000, false) !== value.note || !Array.isArray(value.entries) || value.entries.length < 2 || value.entries.length > 8) return false
    const entries: CrossReadingEntry[] = []
    for (const item of value.entries) {
      if (!object(item)) return false
      const selection = validateSourceSelection(item.selection)
      const expected = makeEntry(selection, item.reconstruction)
      if (!equal(item, expected)) return false
      entries.push(expected)
    }
    if (new Set(entries.map(e => e.selection.key)).size !== entries.length || !equal(value.differences, readingDifferences(entries)) || !equal(value.readingPrompts, promptsFor(entries))) return false
    return JSON.stringify(value).length <= 850_000
  } catch { return false }
}
export function validateCrossReadingSnapshot(value: unknown): CrossReadingSnapshot { if (!isCrossReadingSnapshot(value)) throw new Error('主题同读记录格式异常或版本不兼容，原始内容未改动。'); return copy(value) }
