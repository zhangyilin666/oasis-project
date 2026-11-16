import { angularDistance, type WesternPosition } from '../metaphysics/positions'
import { MAJOR_ASPECTS } from '../metaphysics/transits'

export const SYNASTRY_ORB_DEGREES = 6
export const SYNASTRY_RULE_VERSION = 'synastry-ten-bodies-major-six-degrees-v1' as const
type Position = Pick<WesternPosition, 'body' | 'name' | 'longitude'>
export interface SynastryAspect {
  aBody: string
  bBody: string
  aName: string
  bName: string
  name: string
  angle: number
  separation: number
  orb: number
}
/** A's body versus B's body. The roles remain distinct, including same-body pairs. */
export function findSynastryAspects(aPositions: readonly Position[], bPositions: readonly Position[]): SynastryAspect[] {
  if ([...aPositions, ...bPositions].some(position => !Number.isFinite(position.longitude))) throw new Error('相位比较需要有效天体黄经')
  const aspects: SynastryAspect[] = []
  for (const a of aPositions) for (const b of bPositions) {
    const separation = angularDistance(a.longitude, b.longitude)
    const candidate = MAJOR_ASPECTS.find(aspect => Math.abs(separation - aspect.angle) <= SYNASTRY_ORB_DEGREES)
    if (candidate) aspects.push({ aBody: a.body, bBody: b.body, aName: a.name, bName: b.name, name: candidate.name, angle: candidate.angle, separation, orb: Math.abs(separation - candidate.angle) })
  }
  // Stable iteration order breaks exact ties without locale-dependent sorting.
  return aspects.sort((a, b) => a.orb - b.orb)
}
