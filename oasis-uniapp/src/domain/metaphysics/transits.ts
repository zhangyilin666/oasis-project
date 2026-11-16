import { angularDistance, calculatePositions, positionText, type WesternPosition } from './positions'
import { validateObservationDate, type NormalizedBirth } from './time'
import type { ChartSection } from './types'

export const MAJOR_ASPECTS = [{ angle: 0, name: '合相' }, { angle: 60, name: '六合' }, { angle: 90, name: '刑相' }, { angle: 120, name: '拱相' }, { angle: 180, name: '对冲' }] as const
export const TRANSIT_ORB_DEGREES = 1
export interface TransitAspect {
  transit: string
  natal: string
  name: string
  angle: number
  separation: number
  orb: number
}
type LongitudePosition = Pick<WesternPosition, 'name' | 'longitude'>

/** Directed cross-chart pairs include a body's return to its own natal position. */
export function findTransitAspects(transiting: readonly LongitudePosition[], natal: readonly LongitudePosition[]): TransitAspect[] {
  const aspects: TransitAspect[] = []
  for (const moving of transiting) {
    for (const fixed of natal) {
      const separation = angularDistance(moving.longitude, fixed.longitude)
      const aspect = MAJOR_ASPECTS.find(candidate => Math.abs(separation - candidate.angle) <= TRANSIT_ORB_DEGREES)
      if (aspect) aspects.push({ transit: moving.name, natal: fixed.name, name: aspect.name, angle: aspect.angle, separation, orb: Math.abs(separation - aspect.angle) })
    }
  }
  return aspects.sort((a, b) => a.orb - b.orb)
}

export function calculateTransits(input: NormalizedBirth, observationDate: string, natalPositions = calculatePositions(input.instant)) {
  validateObservationDate(observationDate, input.chinese.date)
  // A civil date is deliberately sampled at noon UTC+08, never device-local noon.
  const instant = new Date(`${observationDate}T04:00:00Z`)
  const positions = calculatePositions(instant)
  return {
    observation: {
      date: observationDate,
      timeZone: 'UTC+08:00' as const,
      localTime: '12:00' as const,
      utcTime: instant.toISOString(),
      kind: 'transit-snapshot' as const,
      orbDegrees: TRANSIT_ORB_DEGREES,
      ruleVersion: 'western-transit-v1' as const,
    } as const,
    positions,
    aspects: findTransitAspects(positions, natalPositions),
  }
}

export function transitSections(snapshot: ReturnType<typeof calculateTransits>): ChartSection[] {
  return [
    {
      title: '行运十天体 · 指定时刻',
      caption: `${snapshot.observation.date} 12:00 北京时间（UTC+08:00）· UTC ${snapshot.observation.date} 04:00。地心热带黄道位置，仅代表该时刻。`,
      facts: snapshot.positions.map(position => ({ label: position.name, value: `${positionText(position)} · 黄经 ${position.longitude.toFixed(2)}°` })),
    },
    {
      title: '行运对本命相位',
      caption: '行运天体 → 本命天体；合、六合、刑、拱、对冲，统一容许度 1°（软件筛选参数），按未舍入偏差从小到大排列。',
      facts: snapshot.aspects.length
        ? snapshot.aspects.map(aspect => ({ label: `行运${aspect.transit} → 本命${aspect.natal}`, value: `${aspect.name} ${aspect.angle}° · 偏差 ${aspect.orb.toFixed(2)}°` }))
        : [{ label: '该时刻相位', value: '容许度 1° 内未出现所选五类行运对本命相位；不代表当天没有发生相位。' }],
    },
  ]
}
