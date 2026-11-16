import { getTarotCard, TAROT_NAME_VERSION, type TarotCard } from './cards'
export { getTarotCard, TAROT_CARDS, TAROT_GROUPS, TAROT_NAME_VERSION } from './cards'
export type { TarotCard, TarotCardGroup, TarotRank } from './cards'

export const TAROT_RULE_VERSION = 'tarot-manual-v1' as const
export const TAROT_SOURCES = Object.freeze([
  { title: 'V&A · 塔罗历史与 78 张牌的分类', url: 'https://www.vam.ac.uk/articles/tarot-cards' },
  { title: 'A. E. Waite 原著 · 第 II 部大牌名称与编号', url: 'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_2' },
  { title: 'A. E. Waite 原著 · 第 III 部四花色牌目', url: 'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3' },
].map(source => Object.freeze(source)))
export const TAROT_CONVENTIONS = Object.freeze([
  '采用 RWS（韦特–史密斯）体系的 78 张文字牌目：22 张大阿卡纳与四花色各 14 张小阿卡纳；力量编号 8，正义编号 11。',
  '中文牌名由本工具统一用字；王牌即 Ace，星币亦常称钱币。你的牌组若用不同名称，可写入牌组说明。',
  '每张牌与正逆位均由你手动记录，同一条记录限一副牌，不重复选牌；本版不随机抽牌。',
  '单张与三张的位置名是本工具的复盘模板；自定义牌阵可录入 1 至 10 个位置，不把位置名当作预测结论。',
  '仅整理文字牌名与用户笔记，不引入牌图或复制现代牌义。来源页面可阅读，不表示其中图片、版式或译文获准再分发。',
] as const)

export type TarotSpreadKind = 'single' | 'three' | 'custom'
export type TarotOrientation = 'upright' | 'reversed'
export const TAROT_PRESETS = Object.freeze({
  single: Object.freeze({ name: '单张关注', positions: Object.freeze(['当下关注']) }),
  three: Object.freeze({ name: '三张复盘', positions: Object.freeze(['当前状况', '需要留意', '行动思考']) }),
})
export interface TarotSelection { positionName: string; cardId: string; orientation: TarotOrientation; note: string }
export interface TarotInput {
  question: string; date: string; deckDescription: string; drawNotes: string
  spreadKind: TarotSpreadKind; spreadName: string; selections: TarotSelection[]; notes: string
}
export interface TarotSnapshot {
  ruleVersion: typeof TAROT_RULE_VERSION; nameVersion: typeof TAROT_NAME_VERSION
  recordingMethod: 'manual'; duplicatePolicy: 'single-deck-no-repeats'
  question: string; date: string; deckDescription: string; drawNotes: string
  spread: { kind: TarotSpreadKind; name: string }
  cards: { position: number; positionName: string; card: TarotCard; orientation: TarotOrientation; note: string }[]
  notes: string; conventions: string[]; sources: { title: string; url: string }[]
}

function text(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${label}格式不正确。`)
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) throw new Error(`${label}${min ? `须为 ${min} 至 ${max} 字` : `最多 ${max} 字`}。`)
  return trimmed
}
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式不正确。`)
  return value as Record<string, unknown>
}

export function validateTarotInput(value: unknown): TarotInput {
  const raw = object(value, '塔罗资料')
  const question = text(raw.question, '记录问题', 1, 200)
  const date = text(raw.date, '记录日期', 10, 10)
  const parsed = new Date(`${date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01' || date > '2099-12-31' || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('记录日期须为 1900 至 2099 年之间的有效公历日期。')
  const deckDescription = text(raw.deckDescription, '牌组说明', 1, 100)
  const drawNotes = text(raw.drawNotes, '抽取过程', 0, 200), notes = text(raw.notes, '整体笔记', 0, 2000)
  if (raw.spreadKind !== 'single' && raw.spreadKind !== 'three' && raw.spreadKind !== 'custom') throw new Error('未知牌阵类型。')
  const spreadKind = raw.spreadKind, spreadName = text(raw.spreadName, '牌阵名称', 1, 60)
  if (!Array.isArray(raw.selections) || raw.selections.length < 1 || raw.selections.length > 10) throw new Error('牌阵须有 1 至 10 张牌。')
  if (spreadKind !== 'custom' && (raw.selections.length !== TAROT_PRESETS[spreadKind].positions.length || spreadName !== TAROT_PRESETS[spreadKind].name)) throw new Error('预设牌阵的名称或张数不匹配，请重新选择牌阵。')
  const cardIds = new Set<string>(), positionNames = new Set<string>()
  const selections = Array.from(raw.selections).map<TarotSelection>((value, index) => {
    const selection = object(value, `第 ${index + 1} 张牌`)
    const positionName = text(selection.positionName, `第 ${index + 1} 个位置名称`, 1, 40)
    if (spreadKind !== 'custom' && positionName !== TAROT_PRESETS[spreadKind].positions[index]) throw new Error('预设位置名称不匹配，请重新选择牌阵。')
    if (positionNames.has(positionName)) throw new Error('位置名称不能重复，请为每个位置填写不同的名称。')
    positionNames.add(positionName)
    const card = getTarotCard(selection.cardId)
    if (cardIds.has(card.id)) throw new Error(`${card.name}重复出现。本版每次记录一副牌，同一张牌只能选一次。`)
    cardIds.add(card.id)
    if (selection.orientation !== 'upright' && selection.orientation !== 'reversed') throw new Error(`请为第 ${index + 1} 张牌选择正位或逆位。`)
    return { positionName, cardId: card.id, orientation: selection.orientation, note: text(selection.note, `第 ${index + 1} 张牌的笔记`, 0, 500) }
  })
  return { question, date, deckDescription, drawNotes, spreadKind, spreadName, selections, notes }
}

export function createTarotSnapshot(value: unknown): TarotSnapshot {
  const input = validateTarotInput(value)
  return {
    ruleVersion: TAROT_RULE_VERSION, nameVersion: TAROT_NAME_VERSION, recordingMethod: 'manual', duplicatePolicy: 'single-deck-no-repeats',
    question: input.question, date: input.date, deckDescription: input.deckDescription, drawNotes: input.drawNotes,
    spread: { kind: input.spreadKind, name: input.spreadName },
    cards: input.selections.map((selection, index) => ({ position: index + 1, positionName: selection.positionName, card: getTarotCard(selection.cardId), orientation: selection.orientation, note: selection.note })),
    notes: input.notes, conventions: [...TAROT_CONVENTIONS], sources: TAROT_SOURCES.map(source => ({ ...source })),
  }
}

/** Validate the complete persisted snapshot; unknown versions never get silently relabelled. */
export function validateTarotSnapshot(value: unknown): TarotSnapshot {
  const raw = object(value, '塔罗快照')
  if (raw.ruleVersion !== TAROT_RULE_VERSION || raw.nameVersion !== TAROT_NAME_VERSION) throw new Error('塔罗记录或牌名版本无法识别，原始数据已保留。')
  if (raw.recordingMethod !== 'manual' || raw.duplicatePolicy !== 'single-deck-no-repeats') throw new Error('塔罗记录方式或单副牌规则不匹配，原始数据已保留。')
  const spread = object(raw.spread, '牌阵')
  if (!Array.isArray(raw.cards)) throw new Error('塔罗牌阵快照不完整，原始数据已保留。')
  const selections = Array.from(raw.cards).map((value, index) => {
    const selection = object(value, '牌位'), card = object(selection.card, '牌名')
    const canonical = getTarotCard(card.id)
    if (selection.position !== index + 1 || Object.keys(canonical).some(key => card[key] !== canonical[key as keyof TarotCard])) throw new Error('牌位顺序或牌名快照不匹配，原始数据已保留。')
    return { positionName: selection.positionName, cardId: card.id, orientation: selection.orientation, note: selection.note }
  })
  const snapshot = createTarotSnapshot({ question: raw.question, date: raw.date, deckDescription: raw.deckDescription, drawNotes: raw.drawNotes, spreadKind: spread.kind, spreadName: spread.name, selections, notes: raw.notes })
  if (['question', 'date', 'deckDescription', 'drawNotes', 'notes'].some(key => raw[key] !== snapshot[key as 'question' | 'date' | 'deckDescription' | 'drawNotes' | 'notes']) || spread.name !== snapshot.spread.name || selections.some((selection, index) => selection.positionName !== snapshot.cards[index].positionName || selection.note !== snapshot.cards[index].note)) throw new Error('塔罗文字快照格式不匹配，原始数据已保留。')
  if (!Array.isArray(raw.conventions) || raw.conventions.length !== snapshot.conventions.length || raw.conventions.some((line, index) => line !== snapshot.conventions[index])) throw new Error('塔罗规则快照不完整，原始数据已保留。')
  if (!Array.isArray(raw.sources) || raw.sources.length !== snapshot.sources.length || raw.sources.some((value, index) => {
    const source = object(value, '来源')
    return source.title !== snapshot.sources[index].title || source.url !== snapshot.sources[index].url
  })) throw new Error('塔罗来源快照不完整，原始数据已保留。')
  return snapshot
}

export function inputFromTarotSnapshot(value: unknown): TarotInput {
  const snapshot = validateTarotSnapshot(value)
  return {
    question: snapshot.question, date: snapshot.date, deckDescription: snapshot.deckDescription, drawNotes: snapshot.drawNotes,
    spreadKind: snapshot.spread.kind, spreadName: snapshot.spread.name,
    selections: snapshot.cards.map(item => ({ positionName: item.positionName, cardId: item.card.id, orientation: item.orientation, note: item.note })), notes: snapshot.notes,
  }
}
