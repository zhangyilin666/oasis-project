import { normalizeDegrees } from './astronomy'

export const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'] as const
export const DASHA_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'] as const
export type DashaLord = typeof DASHA_LORDS[number]
export const DASHA_NAMES: Record<DashaLord, string> = { Ketu: '计都', Venus: '金星', Sun: '太阳', Moon: '月亮', Mars: '火星', Rahu: '罗睺', Jupiter: '木星', Saturn: '土星', Mercury: '水星' }
export const DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17] as const
export const DASHA_YEAR_DAYS = 365.25
const YEAR_MS = DASHA_YEAR_DAYS * 86400000
export const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'] as const

function longitude(value: number): number {
  if (!Number.isFinite(value)) throw new Error('黄经必须为有限数值')
  return normalizeDegrees(value)
}
export function zodiacPosition(value: number) {
  const normalized = longitude(value)
  const signIndex = Math.floor(normalized / 30)
  return { longitude: normalized, signIndex, sign: SIGNS[signIndex], degreeInSign: normalized - signIndex * 30 }
}
/** Parashari Navamsa: nine equal subdivisions per sign, preserving intra-division degree. */
export function navamsaPosition(value: number) { return zodiacPosition(longitude(value) * 9) }
export function moonNakshatra(value: number) {
  const normalized = longitude(value)
  const scaled = normalized * 3 / 40
  const index = Math.min(26, Math.floor(scaled))
  const fraction = scaled - index
  const lordIndex = index % 9
  return { index, number: index + 1, name: NAKSHATRAS[index], pada: Math.min(4, Math.floor(fraction * 4) + 1), fraction, remainingFraction: 1 - fraction, lord: DASHA_LORDS[lordIndex], remainingYears: (1 - fraction) * DASHA_YEARS[lordIndex] }
}
export interface DashaPeriod { lord: DashaLord; startUtc: string; endUtc: string; years: number }
export interface MahaDasha extends DashaPeriod { antardashas: DashaPeriod[] }
const iso = (milliseconds: number) => new Date(Math.round(milliseconds)).toISOString()

/** First interval starts before birth. Antars always divide the full maha duration. */
export function calculateVimshottari(birth: Date, moonLongitude: number): MahaDasha[] {
  if (!birth || !Number.isFinite(birth.getTime())) throw new Error('周期计算需要有效出生时刻')
  const nakshatra = moonNakshatra(moonLongitude)
  const first = nakshatra.index % 9
  const origin = birth.getTime() - nakshatra.fraction * DASHA_YEARS[first] * YEAR_MS
  let elapsedYears = 0
  return Array.from({ length: 9 }, (_, mahaIndex) => {
    const index = (first + mahaIndex) % 9
    const years = DASHA_YEARS[index]
    const startYears = elapsedYears
    elapsedYears += years
    let subYears = 0
    const antardashas = Array.from({ length: 9 }, (_, antarIndex) => {
      const subIndex = (index + antarIndex) % 9
      const duration = years * DASHA_YEARS[subIndex] / 120
      const startUtc = iso(origin + (startYears + subYears) * YEAR_MS)
      subYears += duration
      return { lord: DASHA_LORDS[subIndex], startUtc, endUtc: iso(origin + (startYears + (antarIndex === 8 ? years : subYears)) * YEAR_MS), years: duration }
    })
    return { lord: DASHA_LORDS[index], startUtc: iso(origin + startYears * YEAR_MS), endUtc: iso(origin + elapsedYears * YEAR_MS), years, antardashas }
  })
}

export function currentDasha(periods: MahaDasha[], observation: Date, birth?: Date) {
  const timestamp = observation.getTime()
  if (!Number.isFinite(timestamp)) throw new Error('观察时刻无效')
  if (birth && timestamp < birth.getTime()) return null
  const maha = periods.find(period => timestamp >= Date.parse(period.startUtc) && timestamp < Date.parse(period.endUtc))
  if (!maha) return null
  const antar = maha.antardashas.find(period => timestamp >= Date.parse(period.startUtc) && timestamp < Date.parse(period.endUtc))
  return antar ? { maha: maha.lord, antar: antar.lord, mahaStartUtc: maha.startUtc, mahaEndUtc: maha.endUtc, antarStartUtc: antar.startUtc, antarEndUtc: antar.endUtc } : null
}
