import { normalizeBirth } from '../metaphysics/time'
import type { BirthProfile } from '../metaphysics/types'
import { calculatePositions } from '../metaphysics/positions'
import { wholeSignHouse } from '../metaphysics/houses'
import { MAJOR_ASPECTS } from '../metaphysics/transits'
import { calculateHouseComparison, equalAscendantHouse } from './houses'
import { findSynastryAspects, SYNASTRY_ORB_DEGREES, SYNASTRY_RULE_VERSION } from './synastry'

export const WESTERN_STUDY_RULE_VERSION = 'western-equal-synastry-study-v1' as const
export interface StudyPersonInput { name: string; profile: BirthProfile }
export const WESTERN_STUDY_SOURCES = [
  { title: 'Astronomy Engine · 天体与坐标计算', url: 'https://github.com/cosinekitty/astronomy', version: '2.1.19', license: 'MIT' },
  { title: 'Swiss Ephemeris · 等宫制与整宫制定义', url: 'https://www.astro.com/swisseph/swisseph.htm', version: '§6.2.5；独立参考服务2.10.03', license: '仅引用公开定义与数值校验，未集成代码或星历文件' },
  { title: 'Swiss Ephemeris · ASC等宫制 A／E 参数', url: 'https://www.astro.com/swisseph/swephprg.htm', version: 'House methods A/E: cusp 1 is Ascendant', license: '公开接口说明引用' },
  { title: 'Astrodienst · Synastry与组合中点盘的区别', url: 'https://www.astro.com/faq/fq_fh_owtype_e.htm', version: 'Chart Types · Synastry / Composite Midpoint', license: '作者服务说明引用；本页为原创摘要' },
]

export function calculateStudyPerson(input: StudyPersonInput, role: 'A' | 'B') {
  try {
    if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 30) throw new Error('名称需为1–30个字')
    const birth = normalizeBirth(input.profile)
    const houses = calculateHouseComparison(birth)
    const positions = calculatePositions(birth.instant).map(position => ({ ...position,
      wholeSignHouse: houses.status === 'ready' ? wholeSignHouse(position.longitude, houses.ascendant) : null,
      equalAscendantHouse: houses.status === 'ready' ? equalAscendantHouse(position.longitude, houses.ascendant) : null,
    }))
    return {
      role, name: input.name.trim(), profile: birth.profile, utcTime: birth.instant.toISOString(),
      timeResolution: { mode: birth.profile.timeZone ? 'iana' as const : 'manual' as const, utcOffset: birth.profile.utcOffset, ...(birth.profile.timeZone ? { timeZone: birth.profile.timeZone, ...(birth.profile.timeChoice ? { choice: birth.profile.timeChoice } : {}) } : {}) },
      positions, houses,
      limitations: [
        ...(houses.status === 'unavailable' ? [houses.reason] : ['宫头与落宫依赖出生时刻及地点。天顶MC是独立角点，在这两种宫制中均不保证是第十宫宫头。']),
        ...(birth.profile.timePrecision === 'approximate' ? ['大约出生时间：天体位置及相位只对应所填时刻，尤其月亮可能随时间误差发生明显变化。'] : []),
      ],
    }
  } catch (error) { throw new Error(`${role} 的资料：${error instanceof Error ? error.message : '无法完成计算'}`) }
}

/** Secondary omitted => standalone house comparison. No midpoint chart is constructed. */
export function calculateWesternStudy(primary: StudyPersonInput, secondary?: StudyPersonInput) {
  const a = calculateStudyPerson(primary, 'A')
  const b = secondary ? calculateStudyPerson(secondary, 'B') : undefined
  const participants = b ? [a, b] : [a]
  return {
    schemaVersion: 1 as const, ruleVersion: WESTERN_STUDY_RULE_VERSION,
    mode: b ? 'synastry' as const : 'house-comparison' as const,
    engine: { name: 'astronomy-engine' as const, version: '2.1.19' as const, license: 'MIT' as const },
    zodiac: 'tropical-true-ecliptic-of-date' as const,
    houseSystems: ['whole-sign', 'equal-ascendant'] as const,
    participants,
    synastry: b ? { ruleVersion: SYNASTRY_RULE_VERSION, kind: 'cross-chart-natal-aspects' as const, orbDegrees: SYNASTRY_ORB_DEGREES, aspectsIncluded: MAJOR_ASPECTS.map(aspect => ({ ...aspect })), pairsConsidered: 100, aspects: findSynastryAspects(a.positions, b.positions) } : null,
    conventions: [
      'A、B各自的当地出生时刻、历史时区与地点分别解析，独立换算成UTC。',
      '十天体使用热带黄道近似地心视位置；每人的日期真黄经直接比较，不做恒星岁差校正。',
      '整宫制从上升星座0°开始；ASC等宫制从上升点度数开始，每宫30°。落宫按未舍入黄经，含本宫宫头、不含下一宫宫头。',
      '宫位只在已确认时刻且有支持的地点时提供；纬度绝对值须小于66°，这是本版产品支持范围。',
      '双人比较逐一检查A十天体与B十天体的100种组合，保留A太阳/B月亮与A月亮/B太阳的身份差别。',
      '相位限定合相0°、六合60°、刑相90°、拱相120°、对冲180°；统一容许度6°并包含边界，按未舍入偏差排序。',
    ],
    limitations: [
      '双人相位比较（Synastry）不生成组合中点盘；本页也未计算角点相位、交点、交叉落宫或行运关系。',
      '相位数量和角度不是关系质量、婚姻适合度或命运的评分，本页提供几何事实与个人笔记。',
      '天体、时刻与宫头误差会影响接近分界的落宫或相位。独立参考样例通过不构成所有日期的精度保证。',
    ],
    sources: WESTERN_STUDY_SOURCES.map(source => ({ ...source })),
  }
}
export type WesternStudyPerson = ReturnType<typeof calculateStudyPerson>
export type WesternStudySnapshot = ReturnType<typeof calculateWesternStudy>
