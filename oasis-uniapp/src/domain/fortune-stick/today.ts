/** Local cache of today's stick. The question is never written here. */

export const STICK_STORAGE_KEY = 'oasis.fortuneStick.v1'

export interface StoredStick {
  date: string
  number: number
  grade: string
  title: string
  poem: string
  line: string
  plain: string
  cat: string
  disclaimer: string
}

export function chinaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const pick = (type: string) => parts.find(part => part.type === type)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

export function parseStoredStick(raw: unknown, today: string): StoredStick | null {
  const value = typeof raw === 'string' ? parseJson(raw) : raw
  if (!value || typeof value !== 'object') return null
  const stick = value as Partial<StoredStick>
  const number = Number(stick.number)
  if (stick.date !== today) return null
  if (!Number.isInteger(number) || number < 1 || number > 100) return null
  if (!stick.poem || !stick.plain || !stick.cat || !stick.grade || !stick.line) return null
  return {
    date: today,
    number,
    grade: String(stick.grade),
    title: String(stick.title || ''),
    poem: String(stick.poem),
    line: String(stick.line),
    plain: String(stick.plain),
    cat: String(stick.cat),
    disclaimer: String(stick.disclaimer || '仅供娱乐参考'),
  }
}

export function serializeStick(stick: StoredStick): string {
  return JSON.stringify({
    date: stick.date,
    number: stick.number,
    grade: stick.grade,
    title: stick.title,
    poem: stick.poem,
    line: stick.line,
    plain: stick.plain,
    cat: stick.cat,
    disclaimer: stick.disclaimer || '仅供娱乐参考',
  })
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
