export type Line = 0 | 1
export type Element = '金' | '木' | '水' | '火' | '土'
export interface Trigram {
  number: number
  name: string
  image: string
  element: Element
  /** Always bottom to top. */
  lines: readonly Line[]
}

export const TRIGRAMS: readonly Trigram[] = [
  { number: 1, name: '乾', image: '天', element: '金', lines: [1, 1, 1] },
  { number: 2, name: '兑', image: '泽', element: '金', lines: [1, 1, 0] },
  { number: 3, name: '离', image: '火', element: '火', lines: [1, 0, 1] },
  { number: 4, name: '震', image: '雷', element: '木', lines: [1, 0, 0] },
  { number: 5, name: '巽', image: '风', element: '木', lines: [0, 1, 1] },
  { number: 6, name: '坎', image: '水', element: '水', lines: [0, 1, 0] },
  { number: 7, name: '艮', image: '山', element: '土', lines: [0, 0, 1] },
  { number: 8, name: '坤', image: '地', element: '土', lines: [0, 0, 0] },
]

// King Wen order: [name, lower trigram number, upper trigram number].
// Checked against 周易本義 (四庫全書本), 卷1/卷2, and the Unicode 4DC0–4DFF chart.
// No modern interpretations or translations are included.
const KING_WEN: readonly (readonly [string, number, number])[] = [
  ['乾', 1, 1], ['坤', 8, 8], ['屯', 4, 6], ['蒙', 6, 7],
  ['需', 1, 6], ['讼', 6, 1], ['师', 6, 8], ['比', 8, 6],
  ['小畜', 1, 5], ['履', 2, 1], ['泰', 1, 8], ['否', 8, 1],
  ['同人', 3, 1], ['大有', 1, 3], ['谦', 7, 8], ['豫', 8, 4],
  ['随', 4, 2], ['蛊', 5, 7], ['临', 2, 8], ['观', 8, 5],
  ['噬嗑', 4, 3], ['贲', 3, 7], ['剥', 8, 7], ['复', 4, 8],
  ['无妄', 4, 1], ['大畜', 1, 7], ['颐', 4, 7], ['大过', 5, 2],
  ['坎', 6, 6], ['离', 3, 3], ['咸', 7, 2], ['恒', 5, 4],
  ['遁', 7, 1], ['大壮', 1, 4], ['晋', 8, 3], ['明夷', 3, 8],
  ['家人', 3, 5], ['睽', 2, 3], ['蹇', 7, 6], ['解', 6, 4],
  ['损', 2, 7], ['益', 4, 5], ['夬', 1, 2], ['姤', 5, 1],
  ['萃', 8, 2], ['升', 5, 8], ['困', 6, 2], ['井', 5, 6],
  ['革', 3, 2], ['鼎', 5, 3], ['震', 4, 4], ['艮', 7, 7],
  ['渐', 7, 5], ['归妹', 2, 4], ['丰', 3, 4], ['旅', 7, 3],
  ['巽', 5, 5], ['兑', 2, 2], ['涣', 6, 5], ['节', 2, 6],
  ['中孚', 2, 5], ['小过', 7, 4], ['既济', 3, 6], ['未济', 6, 3],
]

export interface Hexagram {
  number: number
  name: string
  symbol: string
  lower: Trigram
  upper: Trigram
  lines: readonly Line[]
}

export const HEXAGRAMS: readonly Hexagram[] = KING_WEN.map(([name, lower, upper], index) => ({
  number: index + 1,
  name,
  symbol: String.fromCodePoint(0x4dc0 + index),
  lower: TRIGRAMS[lower - 1],
  upper: TRIGRAMS[upper - 1],
  lines: [...TRIGRAMS[lower - 1].lines, ...TRIGRAMS[upper - 1].lines],
}))

export function hexagramFromLines(lines: readonly Line[]): Hexagram {
  if (!Array.isArray(lines) || lines.length !== 6 || Array.from(lines).some(line => line !== 0 && line !== 1)) {
    throw new Error('卦象须包含自下而上的六个阴阳爻。')
  }
  const hexagram = HEXAGRAMS.find(item => item.lines.join('') === lines.join(''))
  if (!hexagram) throw new Error('未找到对应卦象。')
  // Keep callers from changing the shared lookup table through a result.
  return { ...hexagram, lower: { ...hexagram.lower, lines: [...hexagram.lower.lines] }, upper: { ...hexagram.upper, lines: [...hexagram.upper.lines] }, lines: [...hexagram.lines] }
}
