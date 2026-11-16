export const TAROT_NAME_VERSION = 'rws-names-zh-v1' as const
export type TarotCardGroup = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles'
export type TarotRank = 'ace' | 'two' | 'three' | 'four' | 'five' | 'six' | 'seven' | 'eight' | 'nine' | 'ten' | 'page' | 'knight' | 'queen' | 'king'
export interface TarotCard {
  id: string; name: string; english: string; group: TarotCardGroup
  majorNumber: number | null; rank: TarotRank | null
}

export const TAROT_GROUPS: readonly { id: TarotCardGroup; label: string }[] = Object.freeze([
  { id: 'major', label: '大阿卡纳' }, { id: 'wands', label: '权杖' }, { id: 'cups', label: '圣杯' },
  { id: 'swords', label: '宝剑' }, { id: 'pentacles', label: '星币' },
].map(group => Object.freeze(group as { id: TarotCardGroup; label: string })))

// Names and numbering only. No deck images, card meanings or modern translations.
// Waite, The Pictorial Key to the Tarot, Part II: Strength VIII, Justice XI.
const MAJOR_NAMES = [
  ['愚人', 'The Fool'], ['魔术师', 'The Magician'], ['女祭司', 'The High Priestess'],
  ['皇后', 'The Empress'], ['皇帝', 'The Emperor'], ['教皇', 'The Hierophant'],
  ['恋人', 'The Lovers'], ['战车', 'The Chariot'], ['力量', 'Strength'], ['隐者', 'The Hermit'],
  ['命运之轮', 'Wheel of Fortune'], ['正义', 'Justice'], ['倒吊人', 'The Hanged Man'],
  ['死神', 'Death'], ['节制', 'Temperance'], ['恶魔', 'The Devil'], ['高塔', 'The Tower'],
  ['星星', 'The Star'], ['月亮', 'The Moon'], ['太阳', 'The Sun'], ['审判', 'Judgement'], ['世界', 'The World'],
] as const
const SUITS = [
  ['wands', '权杖', 'Wands'], ['cups', '圣杯', 'Cups'], ['swords', '宝剑', 'Swords'], ['pentacles', '星币', 'Pentacles'],
] as const
const RANKS: readonly (readonly [TarotRank, string, string])[] = [
  ['ace', '王牌', 'Ace'], ['two', '二', 'Two'], ['three', '三', 'Three'], ['four', '四', 'Four'],
  ['five', '五', 'Five'], ['six', '六', 'Six'], ['seven', '七', 'Seven'], ['eight', '八', 'Eight'],
  ['nine', '九', 'Nine'], ['ten', '十', 'Ten'], ['page', '侍从', 'Page'], ['knight', '骑士', 'Knight'],
  ['queen', '王后', 'Queen'], ['king', '国王', 'King'],
]

export const TAROT_CARDS: readonly Readonly<TarotCard>[] = Object.freeze([
  ...MAJOR_NAMES.map(([name, english], majorNumber): TarotCard => ({ id: `major-${String(majorNumber).padStart(2, '0')}`, name, english, group: 'major', majorNumber, rank: null })),
  ...SUITS.flatMap(([group, suitName, suitEnglish]) => RANKS.map(([rank, rankName, rankEnglish]): TarotCard => ({
    id: `${group}-${rank}`, name: `${suitName}${rankName}`, english: `${rankEnglish} of ${suitEnglish}`,
    group, majorNumber: null, rank,
  }))),
].map(card => Object.freeze(card)))

/** Return an isolated value so an editor cannot mutate the versioned catalog. */
export function getTarotCard(id: unknown): TarotCard {
  const card = TAROT_CARDS.find(item => item.id === id)
  if (!card) throw new Error('存在未知牌名，请从本版 78 张牌中重新选择。')
  return { ...card }
}
