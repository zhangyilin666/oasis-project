import { AstroTime, Body, Ecliptic, GeoVector, MakeTime, e_tilt } from 'astronomy-engine'

export const JYOTISH_BODIES = [Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn] as const
export const BODY_NAMES = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星'] as const
export const normalizeDegrees = (value: number) => { const remainder = value % 360; return remainder < 0 ? remainder + 360 : remainder }
export const AYANAMSA_MODEL = 'lahiri-p03-approx-v1' as const
const EPOCH_TT = -15991.5 // 1956-03-21 00:00 TT, in days from J2000 TT.
const EPOCH_TRUE_DEGREES = 23 + 15 / 60 + 0.658 / 3600
const epochNutation = e_tilt(AstroTime.FromTerrestrialTime(EPOCH_TT)).dpsi

/** P03 general precession, Capitaine et al. (2003), eq. 39; arcseconds. */
function precession(t: number): number {
  return t * (5028.796195 + t * (1.1054348 + t * (0.00007964 + t * (-0.000023857 + t * -0.0000000383))))
}

/** Independent approximation anchored at the published true Lahiri epoch.
 * This is not an implementation of Swiss Ephemeris SIDM_LAHIRI.
 */
export function calculateAyanamsa(instant: Date) {
  if (!instant || !Number.isFinite(instant.getTime())) throw new Error('恒星黄道计算需要有效的 UTC 时刻')
  const time = MakeTime(instant)
  const meanDegrees = EPOCH_TRUE_DEGREES - epochNutation / 3600 + (precession(time.tt / 36525) - precession(EPOCH_TT / 36525)) / 3600
  return { model: AYANAMSA_MODEL, meanDegrees, trueDegrees: meanDegrees + e_tilt(time).dpsi / 3600 }
}

export function calculateSiderealPositions(instant: Date) {
  const ayanamsa = calculateAyanamsa(instant)
  const time = MakeTime(instant)
  return {
    ayanamsa,
    positions: JYOTISH_BODIES.map((body, index) => ({
      body, name: BODY_NAMES[index],
      longitude: normalizeDegrees(Ecliptic(GeoVector(body, time, true)).elon - ayanamsa.trueDegrees),
    })),
  }
}
