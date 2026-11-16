import { normalizeSpaceFacts, type SpaceFacts } from '../space'
import { createSnapshotStore, type SnapshotStorage } from '../records/snapshot-store'

export const BAZHAI_RULE_VERSION = 'bazhai-sitting-true-v1' as const
export const BAZHAI_STORAGE_KEY = 'oasis.bazhai.records.v1'
export type TrigramName = '坎' | '艮' | '震' | '巽' | '离' | '坤' | '兑' | '乾'
export type StarName = '伏位' | '祸害' | '绝命' | '天医' | '生气' | '六煞' | '五鬼' | '延年'
export interface BazhaiInput {
  facts: SpaceFacts
  bearingRole: 'sitting' | 'facing'
  uncertaintyDegrees: number
}
export interface BazhaiDirection {
  trigram: TrigramName; direction: string; centerDegrees: number
  star: StarName; traditionalStar: string; changedLines: number[]; explanation: string
}
export interface BazhaiSnapshot {
  schemaVersion: 1; ruleVersion: typeof BAZHAI_RULE_VERSION
  scope: 'sitting-palace-cultural-comparison'
  input: BazhaiInput; sittingDegrees: number; facingDegrees: number
  baseTrigram: TrigramName; group: '东四宅' | '西四宅'
  sectors: BazhaiDirection[]; steps: string[]; limitations: string[]
  sources: { title: string; url: string; locator: string; rights: string; reviewedAt: string }[]
}
const directions: { trigram: TrigramName; direction: string; centerDegrees: number; bits: number }[] = [
  { trigram: '坎', direction: '北', centerDegrees: 0, bits: 2 },
  { trigram: '艮', direction: '东北', centerDegrees: 45, bits: 4 },
  { trigram: '震', direction: '东', centerDegrees: 90, bits: 1 },
  { trigram: '巽', direction: '东南', centerDegrees: 135, bits: 6 },
  { trigram: '离', direction: '南', centerDegrees: 180, bits: 5 },
  { trigram: '坤', direction: '西南', centerDegrees: 225, bits: 0 },
  { trigram: '兑', direction: '西', centerDegrees: 270, bits: 3 },
  { trigram: '乾', direction: '西北', centerDegrees: 315, bits: 7 },
]
// Initial / middle / upper line differences are bits 1 / 2 / 4.
// Xieji Bianfang Shu vol.2: 大游年, deliberately not 小游年.
const stars: [StarName, string][] = [['伏位', '辅弼'], ['祸害', '禄存'], ['绝命', '破军'], ['天医', '巨门'], ['生气', '贪狼'], ['六煞', '文曲'], ['五鬼', '廉贞'], ['延年', '武曲']]
const limitations = [
  '本版只作坐山起伏位的大游年文化对照；卦名、星名不构成房屋质量或个人命运的判断。',
  '现代真北与45度八方划分是本版明示约定，不宣称是所有古籍或流派统一的测量标准。',
  '未纳入门起伏位、个人命卦、玄空飞星、建筑时期或户型细分；不据此建议拆改、搬迁或治疗。',
  '只使用你确认的原始测量资料，不验证测量仪器，不自动换算磁偏角。',
]
const sources = [
  { title: '《钦定协纪辨方书》四库全书本卷二', url: 'https://zh.wikisource.org/w/index.php?title=欽定協紀辨方書_(四庫全書本)/卷02&oldid=787335', locator: '大游年变卦；八卦逐爻变换与星名', rights: '古籍公版；只提取卦变对应，步骤与解释为本项目自写。', reviewedAt: '2026-10-03' },
  { title: '《古今图书集成》艺术典676卷引《阳宅十书》', url: 'https://zh.wikisource.org/w/index.php?title=Page:Gujin_Tushu_Jicheng,_Volume_476_(1700-1725).djvu/81&oldid=1899482', locator: '第81扫描页，论大游年第三；八首游年歌。转录页尚未校对，与前一底本交叉核对64格。', rights: '古籍公版；只提取对应关系，不复制现代注释或书页图像。原文天乙，本版依前一底本称天医。', reviewedAt: '2026-10-03' },
]
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const normalAngle = (value: number): number => (value % 360 + 360) % 360

export function getBazhaiDirections() { return clone(directions.map(({ bits: _, ...item }) => item)) }
export function bazhaiForTrigram(base: TrigramName): BazhaiDirection[] {
  const baseDirection = directions.find(item => item.trigram === base)
  if (!baseDirection) throw new Error('不支持的本宫卦')
  return directions.map(item => {
    const mask = baseDirection.bits ^ item.bits
    const changedLines = [1, 2, 3].filter(line => (mask & (1 << (line - 1))) !== 0)
    const [star, traditionalStar] = stars[mask]
    const description = changedLines.length ? `${changedLines.map(line => ['初', '中', '上'][line - 1]).join('、')}爻变化` : '三爻不变'
    return { trigram: item.trigram, direction: item.direction, centerDegrees: item.centerDegrees, star, traditionalStar, changedLines, explanation: `${base}至${item.trigram}：${description}，按大游年对应${star}（${traditionalStar}）。` }
  })
}
export function normalizeBazhaiInput(value: unknown): BazhaiInput {
  if (!object(value)) throw new Error('请先填写测量资料。')
  const facts = normalizeSpaceFacts(value.facts)
  if (facts.bearingDegrees === null) throw new Error('尚无方向度数，请先测量并记录。')
  if (facts.northReference !== 'true') throw new Error('本盘法只接收已注明真北的读数；磁北或未知基准不会自动换算。')
  if (!facts.directionTarget || !facts.measurementTool || !facts.measurementBasis || !facts.measuredAt) throw new Error('请补全测量对象、工具、测量依据和日期。')
  if (!['sitting', 'facing'].includes(value.bearingRole)) throw new Error('请确认所填度数是坐山方向还是朝向方向。')
  if (typeof value.uncertaintyDegrees !== 'number' || !Number.isFinite(value.uncertaintyDegrees) || value.uncertaintyDegrees < 0 || value.uncertaintyDegrees >= 22.5) throw new Error('请明确填写测量不确定度，须为0至小于22.5度；未知时先核实，不能留空当作0。')
  return { facts, bearingRole: value.bearingRole, uncertaintyDegrees: value.uncertaintyDegrees }
}
export function calculateBazhai(value: unknown): BazhaiSnapshot {
  const input = normalizeBazhaiInput(value)
  const reading = input.facts.bearingDegrees!
  const sittingDegrees = input.bearingRole === 'sitting' ? reading : normalAngle(reading + 180)
  const facingDegrees = normalAngle(sittingDegrees + 180)
  const centerIndex = Math.floor(normalAngle(sittingDegrees + 22.5) / 45)
  const base = directions[centerIndex]
  const fromCenter = Math.abs(normalAngle(sittingDegrees - base.centerDegrees + 180) - 180)
  const boundaryDistance = 22.5 - fromCenter
  if (input.uncertaintyDegrees > 0 && input.uncertaintyDegrees >= boundaryDistance - 1e-9) throw new Error('测量不确定范围已触及八方分界，无法确认唯一坐山卦。请核实方向与精度后再试。')
  return {
    schemaVersion: 1, ruleVersion: BAZHAI_RULE_VERSION, scope: 'sitting-palace-cultural-comparison', input,
    sittingDegrees, facingDegrees, baseTrigram: base.trigram, group: ['坎', '震', '巽', '离'].includes(base.trigram) ? '东四宅' : '西四宅',
    sectors: bazhaiForTrigram(base.trigram),
    steps: [
      `原始读数${reading}°，以真北为0°顺时针，测量对象：${input.facts.directionTarget}。`,
      input.bearingRole === 'sitting' ? `输入是坐山方向，坐山${sittingDegrees}°；相反朝向${facingDegrees}°。` : `输入是朝向${reading}°，转180°得到坐山${sittingDegrees}°。`,
      `八方以45°分区、左闭右开；坐山落${base.direction}方${base.trigram}卦，输入不确定度±${input.uncertaintyDegrees}°。`,
      `以坐山${base.trigram}卦为本宫起伏位；比较各方初、中、上爻差异，按《协纪辨方书》大游年映射八名。`,
    ], limitations: [...limitations], sources: clone(sources),
  }
}

/** Validate versioned values without recalculating a stored chart or replacing its prose. */
export function isBazhaiSnapshot(value: unknown): value is BazhaiSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== BAZHAI_RULE_VERSION || value.scope !== 'sitting-palace-cultural-comparison') return false
  try {
    const input = normalizeBazhaiInput(value.input)
    if (!equal(input, value.input)) return false
    const sitting = input.bearingRole === 'sitting' ? input.facts.bearingDegrees! : normalAngle(input.facts.bearingDegrees! + 180)
    if (value.sittingDegrees !== sitting || value.facingDegrees !== normalAngle(sitting + 180)) return false
    const base = directions[Math.floor(normalAngle(sitting + 22.5) / 45)]
    const distance = 22.5 - Math.abs(normalAngle(sitting - base.centerDegrees + 180) - 180)
    if (input.uncertaintyDegrees > 0 && input.uncertaintyDegrees >= distance - 1e-9) return false
    if (value.baseTrigram !== base.trigram || value.group !== (['坎', '震', '巽', '离'].includes(base.trigram) ? '东四宅' : '西四宅')) return false
    if (!Array.isArray(value.sectors) || value.sectors.length !== 8) return false
    const expected = bazhaiForTrigram(base.trigram)
    if (!value.sectors.every((sector: unknown, i: number) => object(sector) && typeof sector.explanation === 'string' && sector.explanation.length <= 300 && Object.keys(sector).sort().join() === Object.keys(expected[i]).sort().join() && equal({ ...sector, explanation: '' }, { ...expected[i], explanation: '' }))) return false
    if (!Array.isArray(value.steps) || value.steps.length !== 4 || !value.steps.every((item: unknown) => typeof item === 'string' && item.length <= 500)) return false
    if (!Array.isArray(value.limitations) || value.limitations.length !== 4 || !value.limitations.every((item: unknown) => typeof item === 'string' && item.length <= 500)) return false
    return equal(value.sources, sources)
  } catch { return false }
}
export function createBazhaiRepository(storage: SnapshotStorage) {
  return createSnapshotStore<BazhaiSnapshot>(storage, { key: BAZHAI_STORAGE_KEY, kind: 'bazhai', title: '八宅对照记录', maxRecords: 30, validate: isBazhaiSnapshot, maxBytes: 2_000_000 })
}
