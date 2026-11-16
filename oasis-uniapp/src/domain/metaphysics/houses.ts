import { CombineRotation, InverseRotation, MakeTime, Observer, RotateVector, Rotation_EQD_ECT, Rotation_HOR_EQD, Vector } from 'astronomy-engine'
import type { BirthProfile } from './types'

export type HouseResult = {
  status: 'ready'
  ascendant: number
  midheaven: number
  /** Whole-sign cusps in house order, each at a zodiac sign's zero degree. */
  cusps: number[]
} | { status: 'unavailable'; reason: string }

const normalize = (angle: number) => ((angle % 360) + 360) % 360
const MIN_DIRECTION = 1e-8

/** Whole signs start at the rising SIGN, not at the precise ASC degree. */
export function wholeSignHouse(longitude: number, ascendant: number): number {
  if (!Number.isFinite(longitude) || !Number.isFinite(ascendant)) throw new Error('宫位黄经必须为有限数值')
  const sign = Math.floor(normalize(longitude) / 30)
  const risingSign = Math.floor(normalize(ascendant) / 30)
  return (sign - risingSign + 12) % 12 + 1
}

/**
 * Intersect the true ecliptic of date with the geometric horizon/meridian.
 * Astronomy Engine HOR axes are north, WEST, zenith. No atmospheric refraction
 * or terrain horizon is applied. These are directions, not observer positions.
 * The conservative latitude cutoff is a product limit, not a claim that all
 * whole-sign charts become mathematically undefined at 66 degrees.
 */
export function calculateHouses(instant: Date, place?: BirthProfile['place']): HouseResult {
  if (place === undefined) return { status: 'unavailable', reason: '未填写出生地点经纬度：暂不计算上升点、天顶和十二宫；十天体位置与相位仍可阅读。' }
  if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) {
    return { status: 'unavailable', reason: '出生地点经纬度无效：纬度须在 -90° 至 90°，经度须在 -180° 至 180°；宫位未生成。' }
  }
  if (Math.abs(place.latitude) >= 66) {
    return { status: 'unavailable', reason: '出生地接近或位于极圈：本版仅支持南北纬 66° 以内（不含 66°）的上升点、天顶与宫位；十天体位置与相位不受影响。' }
  }
  if (!instant || !Number.isFinite(instant.getTime())) return { status: 'unavailable', reason: '出生时刻无效，无法计算宫位。' }

  try {
    const time = MakeTime(instant)
    const observer = new Observer(place.latitude, place.longitude, 0)
    const horizonToEcliptic = CombineRotation(Rotation_HOR_EQD(time, observer), Rotation_EQD_ECT(time))
    const eclipticToHorizon = InverseRotation(horizonToEcliptic)

    const intersection = (normal: Vector, select: 'east' | 'above'): number => {
      // Cross the plane normal with the ecliptic pole (0, 0, 1).
      const length = Math.hypot(normal.x, normal.y)
      if (!Number.isFinite(length) || length < MIN_DIRECTION) throw new Error('Degenerate intersection')
      const candidate = new Vector(normal.y / length, -normal.x / length, 0, time)
      const horizontal = RotateVector(eclipticToHorizon, candidate)
      const direction = select === 'east' ? -horizontal.y : horizontal.z
      if (!Number.isFinite(direction) || Math.abs(direction) < MIN_DIRECTION) throw new Error('Ambiguous hemisphere')
      const sign = direction > 0 ? 1 : -1
      return normalize(Math.atan2(sign * candidate.y, sign * candidate.x) * 180 / Math.PI)
    }

    const zenith = RotateVector(horizonToEcliptic, new Vector(0, 0, 1, time))
    const west = RotateVector(horizonToEcliptic, new Vector(0, 1, 0, time))
    const ascendant = intersection(zenith, 'east')
    const midheaven = intersection(west, 'above')
    const firstCusp = Math.floor(ascendant / 30) * 30
    return { status: 'ready', ascendant, midheaven, cusps: Array.from({ length: 12 }, (_, index) => normalize(firstCusp + index * 30)) }
  } catch {
    return { status: 'unavailable', reason: '当前时刻与地点的地平圈交点无法可靠求解，暂不生成上升点、天顶与宫位；十天体位置与相位仍可阅读。' }
  }
}
