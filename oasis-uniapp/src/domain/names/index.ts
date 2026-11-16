import unihan from './unihan-subset.json'
import { createSnapshotStore, type SnapshotStorage } from '../records/snapshot-store'

export const NAME_RULE_VERSION = 'name-culture-v1' as const
export const NAME_DATA_VERSION = 'unihan-17.0.0-subset-v1' as const
export const NAME_STORAGE_KEY = 'oasis.name-culture.records.v1'
export const NAME_CHARACTER_COUNT = unihan.characterCount
export const NAME_SOURCES = [
  { title: 'Unicode 17.0.0 · Unihan 固定版本数据', url: unihan.sourceUrl },
  { title: 'Unicode 17.0.0 · UAX #38 属性说明', url: 'https://www.unicode.org/reports/tr38/tr38-39.html' },
  { title: 'Unicode 数据许可 · Unicode License V3', url: 'https://www.unicode.org/license.txt' },
]
export const NAME_CONVENTIONS = [
  '逐字保留输入字形和 Unicode 码位，不自动简繁转换，不推断姓氏与名字的分界。',
  '普通话字段为 kMandarin 的常用读音，不是全部多音字读法；人名读音请由你确认。',
  '笔画保留 Unihan kTotalStrokes 原值，是字库的说明性数据，不等同于康熙字典或姓名数理的笔画口径。',
  '字义为 kDefinition 的英文原始摘要；不将字义当作姓名所有者的性格、健康或命运。',
  '简繁候选仅展示字库映射，可能一对多或包含自身；不自动替换，也不把候选视作任意语境下可互换。',
  `本机字库仅收录 ${NAME_CHARACTER_COUNT} 个字；缺字明确显示未收录，仍可保存你自行核对的读音和笔记。`,
  '字体由设备提供，罕用字可能显示为方框；码位可用于核对。本版不附带字体文件、五格或命运评分。',
]

interface UnihanEntry { kDefinition?: string; kMandarin?: string; kTotalStrokes?: string; kSimplifiedVariant?: string; kTraditionalVariant?: string }
const entries: Record<string, UnihanEntry> = unihan.entries
export interface NameInput { name: string; confirmedPronunciation: string; notes: string }
export interface NameCharacter {
  character: string; codePoint: string; status: 'available' | 'unavailable' | 'separator'
  definition?: string; mandarin?: string; totalStrokes?: string
  simplified: { character: string; codePoint: string }[]
  traditional: { character: string; codePoint: string }[]
}
export interface NameSnapshot {
  schemaVersion: 1; ruleVersion: typeof NAME_RULE_VERSION; dataVersion: typeof NAME_DATA_VERSION
  input: NameInput; characters: NameCharacter[]; conventions: string[]
  data: { title: string; version: string; license: string; sourceSha256: string }
  sources: { title: string; url: string }[]
}
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const point = (value: string) => `U+${value.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`
const separators = new Set([' ', '·', '・', '-'])

export function validateNameInput(raw: unknown): NameInput {
  if (!object(raw) || typeof raw.name !== 'string' || typeof raw.confirmedPronunciation !== 'string' || typeof raw.notes !== 'string') throw new Error('请填写姓名、确认读音与备注字段。')
  const name = raw.name.trim()
  if (!name || [...name].length > 40 || [...name].every(char => separators.has(char))) throw new Error('姓名需为 1–40 个字符，不能只有分隔符。')
  if (/[\u0000-\u001f\u007f]/.test(name) || /[\ud800-\udfff]/u.test(name)) throw new Error('姓名中含有无法识别的控制字符或不完整字形。')
  if ([...raw.confirmedPronunciation].length > 120 || /[\u0000-\u001f\u007f]/.test(raw.confirmedPronunciation)) throw new Error('确认读音最多 120 个字符，请使用单行文字。')
  if ([...raw.notes].length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw.notes)) throw new Error('笔记最多 2000 个字符，不支持控制字符。')
  return { name, confirmedPronunciation: raw.confirmedPronunciation.trim(), notes: raw.notes.trim() }
}
function variants(raw?: string) {
  return (raw?.split(' ') || []).map(codePoint => ({ codePoint, character: String.fromCodePoint(Number.parseInt(codePoint.slice(2), 16)) }))
}
export function inspectName(raw: NameInput): NameSnapshot {
  const input = validateNameInput(raw)
  return {
    schemaVersion: 1, ruleVersion: NAME_RULE_VERSION, dataVersion: NAME_DATA_VERSION, input,
    characters: [...input.name].map(character => {
      const entry = entries[character]
      return {
        character, codePoint: point(character), status: separators.has(character) ? 'separator' : entry ? 'available' : 'unavailable',
        ...(entry?.kDefinition ? { definition: entry.kDefinition } : {}),
        ...(entry?.kMandarin ? { mandarin: entry.kMandarin } : {}),
        ...(entry?.kTotalStrokes ? { totalStrokes: entry.kTotalStrokes } : {}),
        simplified: variants(entry?.kSimplifiedVariant), traditional: variants(entry?.kTraditionalVariant),
      }
    }),
    conventions: [...NAME_CONVENTIONS],
    data: { title: 'Unihan 姓名文化字库子集', version: unihan.version, license: unihan.license, sourceSha256: unihan.sourceSha256 },
    sources: NAME_SOURCES.map(source => ({ ...source })),
  }
}
/** Shape validation only: never replace a saved definition with a newer dictionary. */
export function isNameSnapshot(raw: unknown): raw is NameSnapshot {
  try {
    if (!object(raw) || raw.schemaVersion !== 1 || raw.ruleVersion !== NAME_RULE_VERSION || raw.dataVersion !== NAME_DATA_VERSION) return false
    const input = validateNameInput(raw.input)
    if (JSON.stringify(input) !== JSON.stringify(raw.input) || !Array.isArray(raw.characters) || raw.characters.length !== [...input.name].length) return false
    const variantValid = (items: unknown) => Array.isArray(items) && items.length < 20 && Array.from(items).every(item => object(item) && typeof item.character === 'string' && [...item.character].length === 1 && item.codePoint === point(item.character))
    if (!Array.from(raw.characters).every((char: unknown, i: number) => object(char) && char.character === [...input.name][i] && char.codePoint === point(char.character)
      && ['available', 'unavailable', 'separator'].includes(char.status)
      && ['definition', 'mandarin', 'totalStrokes'].every(key => char[key] === undefined || (typeof char[key] === 'string' && char[key].length <= 1000))
      && variantValid(char.simplified) && variantValid(char.traditional))) return false
    if (!object(raw.data) || raw.data.version !== '17.0.0' || raw.data.license !== 'Unicode-3.0' || raw.data.sourceSha256 !== unihan.sourceSha256 || typeof raw.data.title !== 'string' || raw.data.title.length > 100) return false
    return Array.isArray(raw.conventions) && raw.conventions.length > 0 && raw.conventions.length <= 20 && Array.from(raw.conventions).every((text: unknown) => typeof text === 'string' && text.length <= 500)
      && Array.isArray(raw.sources) && raw.sources.length > 0 && raw.sources.length <= 10 && Array.from(raw.sources).every((source: unknown) => object(source) && typeof source.title === 'string' && source.title.length <= 200 && typeof source.url === 'string' && source.url.length <= 1000 && /^https:\/\/[^\s]+$/.test(source.url))
  } catch { return false }
}
export function createNameRepository(storage: SnapshotStorage) {
  return createSnapshotStore<NameSnapshot>(storage, { key: NAME_STORAGE_KEY, kind: 'name-culture', title: '姓名文化笔记', maxRecords: 50, validate: isNameSnapshot })
}
