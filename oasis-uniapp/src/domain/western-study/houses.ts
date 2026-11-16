import { calculateHouses, wholeSignHouse } from '../metaphysics/houses'
import type { NormalizedBirth } from '../metaphysics/time'

/** Below any supported astronomical accuracy; only protects floating-point cusp arithmetic. */
const CUSP_NUMERICAL_EPSILON = 1e-10
const wrap = (angle: number) => { const remainder = angle % 360; return remainder < 0 ? remainder + 360 : remainder }
export function equalAscendantCusps(ascendant: number): number[] {
  if (!Number.isFinite(ascendant)) throw new Error('上升点黄经必须为有限数值')
  return Array.from({ length: 12 }, (_, index) => wrap(ascendant + index * 30))
}
/** Each equal house includes its cusp and excludes the following cusp. */
export function equalAscendantHouse(longitude: number, ascendant: number): number {
  if (!Number.isFinite(longitude) || !Number.isFinite(ascendant)) throw new Error('宫位黄经必须为有限数值')
  return Math.floor((wrap(longitude - ascendant) + CUSP_NUMERICAL_EPSILON) / 30) % 12 + 1
}
export function calculateHouseComparison(birth: NormalizedBirth) {
  if (birth.profile.timePrecision === 'approximate') return { status: 'unavailable' as const, reason: '出生时刻为大约时间，本页不生成确定上升点、宫头或落宫；天体与双人相位仅对应所填时刻。' }
  const geometry = calculateHouses(birth.instant, birth.profile.place)
  if (geometry.status === 'unavailable') return geometry
  return {
    status: 'ready' as const, ascendant: geometry.ascendant, midheaven: geometry.midheaven,
    wholeSign: { id: 'whole-sign' as const, cusps: [...geometry.cusps], midheavenHouse: wholeSignHouse(geometry.midheaven, geometry.ascendant) },
    equalAscendant: { id: 'equal-ascendant' as const, cusps: equalAscendantCusps(geometry.ascendant), midheavenHouse: equalAscendantHouse(geometry.midheaven, geometry.ascendant) },
  }
}
