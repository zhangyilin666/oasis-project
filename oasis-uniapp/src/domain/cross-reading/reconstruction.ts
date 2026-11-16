import { TRIGRAMS, hexagramFromLines, elementRelation, MEIHUA_CALENDAR_CONVENTIONS, MEIHUA_CALENDAR_SOURCES, type DivinationResult, type Line } from '../divination'
import { buildNajiaStructure, LIUYAO_NAJIA_CONVENTIONS, LIUYAO_NAJIA_SOURCES } from '../divination/najia'
import type { DivinationRecord } from '../divination/repository'

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const object = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const texts = (v: unknown, max: number, length: number) => Array.isArray(v) && v.length <= max && v.every(s => typeof s === 'string' && s.length > 0 && s.length <= length)
const branches = '子丑寅卯辰巳午未申酉戌亥'

/** Check stored reconstruction geometry and saved calendar fields; do not request a fresh calendar. */
export function validDivinationReconstruction(value: unknown, original: DivinationRecord): value is DivinationResult {
  try {
    if (!object(value) || !equal(value.input, original.input) || value.ruleVersion !== original.ruleVersion || !texts(value.calculation, 20, 1500)) return false
    const input = original.input, utc = new Date(Date.parse(`${input.date}T${input.time}:00Z`) - input.utcOffset * 3600000).toISOString(), beijing = new Date(Date.parse(utc) + 28_800_000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC+08:00'
    if (value.questionInstant !== utc) return false
    let lines: readonly Line[], moving: number[]
    if (input.method === 'liuyao-coins' || input.method === 'liuyao-manual' || input.method === 'liuyao-najia') { lines = input.lines.map(v => v === 7 || v === 9 ? 1 : 0); moving = input.lines.flatMap((v, i) => v === 6 || v === 9 ? [i + 1] : []) }
    else if (input.method === 'meihua-two-numbers') { lines = [...TRIGRAMS[(input.numbers[1] % 8 || 8) - 1].lines, ...TRIGRAMS[(input.numbers[0] % 8 || 8) - 1].lines]; moving = [(input.numbers[0] + input.numbers[1]) % 6 || 6] }
    else {
      const c = value.calendar
      if (!object(c) || !equal(c.engine, { name: 'lunar-typescript', version: '1.8.6' }) || c.beijingTime !== beijing || !object(c.lunar) || !object(c.numbers)) return false
      const l = c.lunar, n = c.numbers
      if (!integer(l.year, 1899, 2099) || !integer(l.month, 1, 12) || !integer(l.day, 1, 30) || typeof l.isLeapMonth !== 'boolean' || typeof l.label !== 'string' || l.label.length > 100 || !integer(n.year, 1, 12) || !integer(n.time, 1, 12) || n.month !== l.month || n.day !== l.day || l.yearBranch !== branches[n.year - 1] || c.timeBranch !== branches[n.time - 1]) return false
      if (c.upperSum !== n.year + n.month + n.day || c.total !== c.upperSum + n.time || c.upperNumber !== (c.upperSum % 8 || 8) || c.lowerNumber !== (c.total % 8 || 8) || c.movingLine !== (c.total % 6 || 6) || !equal(c.conventions, MEIHUA_CALENDAR_CONVENTIONS) || !equal(c.sources, MEIHUA_CALENDAR_SOURCES)) return false
      if (!equal(c.rules, { timeBasis: 'fixed-utc8', yearBoundary: 'lunar-new-year', dayBoundary: 'midnight', leapMonthPolicy: 'same-number', mutualPolicy: 'original-structure', bodyUsePolicy: 'moving-trigram-is-use' })) return false
      lines = [...TRIGRAMS[c.lowerNumber - 1].lines, ...TRIGRAMS[c.upperNumber - 1].lines]; moving = [c.movingLine]
    }
    const base = hexagramFromLines(lines), changed = hexagramFromLines(lines.map((v, i) => moving.includes(i + 1) ? v === 1 ? 0 : 1 : v))
    if (!equal(value.original, base) || !equal(value.changed, changed) || !equal(value.movingLines, moving)) return false
    if (input.method === 'meihua-two-numbers' || input.method === 'meihua-calendar') {
      const body = moving[0] <= 3 ? base.upper : base.lower, use = moving[0] <= 3 ? base.lower : base.upper
      if (!equal(value.mutual, hexagramFromLines([lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]])) || !equal(value.bodyUse, { body, use, bodyPosition: moving[0] <= 3 ? '上卦' : '下卦', usePosition: moving[0] <= 3 ? '下卦' : '上卦', relation: elementRelation(body.element, use.element) })) return false
    } else if (value.mutual !== undefined || value.bodyUse !== undefined) return false
    if (input.method !== 'meihua-calendar' && value.calendar !== undefined) return false
    if (input.method === 'liuyao-coins' || input.method === 'liuyao-najia') {
      const n = value.najia
      if (!object(n) || !object(n.calendar)) return false
      const c = n.calendar
      if (c.beijingTime !== beijing || !equal(c.engine, { name: 'lunar-typescript', version: '1.8.6' }) || typeof c.dayGanzhi !== 'string' || c.dayStem !== c.dayGanzhi[0] || c.dayBranch !== c.dayGanzhi[1] || typeof c.monthBranch !== 'string' || c.monthBranch.length !== 1 || !branches.includes(c.monthBranch) || !['金', '木', '水', '火', '土'].includes(c.monthElement)) return false
      const structure = buildNajiaStructure(base, changed, moving, c.dayGanzhi)
      if (!['palace', 'lines', 'missingKin', 'xun', 'voidBranches'].every(key => equal(n[key], structure[key as keyof typeof structure])) || !equal(n.conventions, LIUYAO_NAJIA_CONVENTIONS) || !equal(n.sources, LIUYAO_NAJIA_SOURCES)) return false
      if (!equal(n.rules, { timeBasis: 'fixed-utc8', monthBoundary: 'exact-jie', dayBoundary: 'midnight', kinBasis: 'original-palace-element', changedKinBasis: 'original-palace-element', hiddenPolicy: 'all-missing-kin-from-pure-palace', changedPolicy: 'moving-lines-only' })) return false
      for (const t of [c.monthStart, c.nextMonthStart]) if (!object(t) || typeof t.name !== 'string' || !['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'].includes(t.name) || typeof t.beijingTime !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC\+08:00$/.test(t.beijingTime)) return false
      const wall = Date.parse(utc) + 28_800_000, start = Date.parse(c.monthStart.beijingTime.slice(0, 19).replace(' ', 'T') + 'Z'), end = Date.parse(c.nextMonthStart.beijingTime.slice(0, 19).replace(' ', 'T') + 'Z')
      if (!Number.isFinite(start) || !Number.isFinite(end) || wall < start || wall >= end) return false
    } else if (value.najia !== undefined) return false
    return true
  } catch { return false }
}
