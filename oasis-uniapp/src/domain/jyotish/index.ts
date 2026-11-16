import type { BirthProfile } from '../metaphysics/types'
import { normalizeBirth } from '../metaphysics/time'
import { calculateHouses, wholeSignHouse } from '../metaphysics/houses'
import { calculateSiderealPositions, normalizeDegrees } from './astronomy'
import { calculateVimshottari, currentDasha, moonNakshatra, navamsaPosition, zodiacPosition } from './rules'

export const JYOTISH_RULE_VERSION = 'jyotish-seven-lahiri-p03-v1' as const
export interface JyotishOptions { observationDate?: string }
export const JYOTISH_SOURCES = [
  { title: 'Astronomy Engine · 天体计算', url: 'https://github.com/cosinekitty/astronomy', version: '2.1.19', license: 'MIT' },
  { title: 'Swiss Ephemeris · Lahiri 基准说明与公开校验数据', url: 'https://www.astro.com/swisseph/swisseph.htm', version: '说明 §2.8.5 / 附录 E；校验服务 2.10.03', license: '仅引用公开说明及数值校验，未集成其代码或星历文件' },
  { title: 'Capitaine 等 · P03 岁差模型', url: 'https://syrte.obspm.fr/iau2006/aa03_412_P03.pdf', version: '2003 · 式 39', license: '公开论文，独立实现公式' },
  { title: 'P. V. R. Narasimha Rao · Vedic Astrology', url: 'https://vedicastrologer.org/articles/vedic_astro_textbook.pdf', version: 'D9 §6.2.9；Vimshottari §16.2–16.3', license: '公开阅读教材，仅引用规则与少量校验数据' },
]
export function jyotishToday(now = new Date()): string { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10) }

export function calculateJyotish(profile: BirthProfile, options: JyotishOptions = {}) {
  const birth = normalizeBirth(profile)
  const observationDate = options.observationDate || jyotishToday()
  const observation = new Date(observationDate + 'T04:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observationDate) || observationDate < '1900-01-01' || observationDate > '2099-12-31' || !Number.isFinite(observation.getTime()) || observation.toISOString().slice(0, 10) !== observationDate) throw new Error('观察日期须为 1900–2099 年的有效公历日期')
  const astronomy = calculateSiderealPositions(birth.instant)
  const approximate = birth.profile.timePrecision === 'approximate'
  const geometry = calculateHouses(birth.instant, birth.profile.place)
  const houses = approximate ? { status: 'unavailable' as const, reason: '出生时间为大约时刻，本页不生成确定的上升点与宫位。' }
    : geometry.status === 'ready' ? (() => {
      const ascendant = normalizeDegrees(geometry.ascendant - astronomy.ayanamsa.trueDegrees)
      return { status: 'ready' as const, ascendant: zodiacPosition(ascendant), midheaven: zodiacPosition(geometry.midheaven - astronomy.ayanamsa.trueDegrees), navamsaAscendant: navamsaPosition(ascendant), cusps: Array.from({ length: 12 }, (_, index) => normalizeDegrees(Math.floor(ascendant / 30) * 30 + index * 30)) }
    })() : { status: 'unavailable' as const, reason: !birth.profile.place ? '未填写出生地点经纬度，暂不生成上升点与宫位。' : Math.abs(birth.profile.place.latitude) >= 66 ? '本版上升点与宫位仅支持纬度绝对值小于 66° 的地点。' : '当前地点与时刻的地平圈交点无法可靠求解，暂不生成上升点与宫位。' }
  const positions = astronomy.positions.map(position => ({ ...position, d1: zodiacPosition(position.longitude), d9: navamsaPosition(position.longitude), house: houses.status === 'ready' ? wholeSignHouse(position.longitude, houses.ascendant.longitude) : null }))
  const moon = positions.find(position => position.body === 'Moon')!
  const nakshatra = moonNakshatra(moon.longitude)
  const periods = calculateVimshottari(birth.instant, moon.longitude)
  const active = currentDasha(periods, observation, birth.instant)
  const boundaryBodies = positions.filter(position => {
    const within = position.longitude % (10 / 3)
    return Math.min(within, 10 / 3 - within) < 0.02
  }).map(position => position.name)
  return {
    schemaVersion: 1 as const, ruleVersion: JYOTISH_RULE_VERSION,
    profile: birth.profile, birthUtc: birth.instant.toISOString(),
    timeResolution: { mode: profile.timeZone ? 'iana' as const : 'manual' as const, utcOffset: birth.profile.utcOffset, ...(profile.timeZone ? { timeZone: profile.timeZone, ...(profile.timeChoice ? { choice: profile.timeChoice } : {}) } : {}) },
    observation: { date: observationDate, localTime: '12:00' as const, timeZone: 'UTC+08:00' as const, utcTime: observation.toISOString() },
    engine: { name: 'astronomy-engine' as const, version: '2.1.19' as const, license: 'MIT' as const },
    ayanamsa: astronomy.ayanamsa, positions, houses, nakshatra,
    vimshottari: { yearDays: 365.25 as const, interval: '[start,end)' as const, periods, active },
    conventions: ['七曜 D1：地心视黄经，日期真黄道；减去含章动的 Lahiri 基准近似岁差值。', '宫位采用恒星黄道整宫制；上升点所在星座为第一宫。', 'D9 采用 Parashari 九分法；27 等分月宿，每宿四足。', 'Vimshottari：120 年周期；本版每年固定 365.25 日，区间含起点、不含终点；分运划分完整大运。', '观察时刻固定为所选日期北京时间 12:00；保留原始 UTC 时间便于复核。'],
    limitations: [
      '这是七曜基础盘，尚未计算罗睺／计都位置、其他分盘、瑜伽或吉凶断语；周期中的罗睺／计都仅为传统运主名称。',
      'Lahiri-P03 为公开基准上的独立近似模型，不能视为专业软件 Lahiri 实现完全相同。六个时刻的七曜已与独立星历校验；样例通过不代表全时段误差保证。',
      '位置误差和出生时刻误差会放大为月宿、分盘与周期交界差异；周期日期为计算约值，不是事件发生日期或命运预测。',
      ...(approximate ? ['大约出生时间：所有位置、月宿、D9 与周期仅对应所填时刻，时间误差可能改变结果；上升点与宫位已停用。'] : []),
      ...(boundaryBodies.length ? [`${boundaryBodies.join('、')}接近九分边界（距边界小于 0.02°），D9 星座尤其需要复核。`] : []),
    ], sources: JYOTISH_SOURCES.map(source => ({ ...source })),
  }
}
export type JyotishSnapshot = ReturnType<typeof calculateJyotish>
