import { Body, Ecliptic, GeoVector } from 'astronomy-engine'

const BODIES: readonly [Body, string][] = [[Body.Sun, '太阳'], [Body.Moon, '月亮'], [Body.Mercury, '水星'], [Body.Venus, '金星'], [Body.Mars, '火星'], [Body.Jupiter, '木星'], [Body.Saturn, '土星'], [Body.Uranus, '天王星'], [Body.Neptune, '海王星'], [Body.Pluto, '冥王星']]
export const SIGNS = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座']

export interface WesternPosition {
  body: Body
  name: string
  longitude: number
  sign: string
  degree: number
  motion: '近驻留' | '逆行' | '顺行'
}

export const wrapDegrees = (angle: number) => ((angle % 360) + 360) % 360
export const angularDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const longitudeAt = (body: Body, date: Date) => wrapDegrees(Ecliptic(GeoVector(body, date, true)).elon)

/** Natal and transit positions must share the same apparent geocentric model. */
export function calculatePositions(instant: Date): WesternPosition[] {
  if (!Number.isFinite(instant.getTime())) throw new Error('天体位置需要有效的 UTC 时刻')
  const previous = new Date(instant.getTime() - 3_600_000)
  const next = new Date(instant.getTime() + 3_600_000)
  return BODIES.map(([body, name]) => {
    const longitude = longitudeAt(body, instant)
    const delta = ((longitudeAt(body, next) - longitudeAt(body, previous) + 540) % 360) - 180
    return { body, name, longitude, sign: SIGNS[Math.floor(longitude / 30)], degree: longitude % 30, motion: Math.abs(delta * 12) < 0.001 ? '近驻留' : delta < 0 ? '逆行' : '顺行' }
  })
}

export const positionText = (position: WesternPosition) => `${position.sign} ${position.degree.toFixed(2)}° · ${position.motion}`
