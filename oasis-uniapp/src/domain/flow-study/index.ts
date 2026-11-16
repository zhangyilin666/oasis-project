import type { BirthProfile } from '../metaphysics/types'
import { calculateBaziFlow, pillarFacts, FLOW_JIE, type BaziFlow } from './bazi'
import { calculateZiweiFlow, FLOW_SCOPES, ZIWEI_FLOW_CONFIG, type ZiweiFlow } from './ziwei'
import { normalizeFlowTimes, clone, type ObservationTime, type TimeSnapshot } from './time'
export type { ObservationTime, TimeSnapshot } from './time'
export type { FlowScopeId, ZiweiScope } from './ziwei'

export const FLOW_STUDY_RULE_VERSION = 'flow-study-v1' as const
export interface FlowStudyInput { name: string; birth: BirthProfile; observation: ObservationTime; note: string }
export const FLOW_STUDY_SOURCES = Object.freeze([
  Object.freeze({ title: 'lunar · 干支与节气', url: 'https://6tail.cn/calendar/lunar.ganzhi.html', version: 'lunar-typescript 1.8.6', license: 'MIT' }),
  Object.freeze({ title: 'iztro · 运限接口与小限四化', url: 'https://docs.iztro.com/posts/horoscope', version: 'iztro 2.6.1', license: 'MIT' }),
  Object.freeze({ title: 'iztro · 配置与插件', url: 'https://docs.iztro.com/posts/config-n-plugin', version: 'iztro 2.6.1', license: 'MIT' }),
  Object.freeze({ title: '日本国立天文台 · 2026 年二十四节气（日本标准时）', url: 'https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou262.html', version: '2026 年历要项；用于分钟级边界核对', license: '仅链接与事实核对' }),
])
export const FLOW_STUDY_CONVENTIONS = Object.freeze([
  '出生与观测分别输入当地日期、时分和时区，先还原同一 UTC 时刻，再转为固定 UTC+08:00。IANA 历史规则使用设备时区数据；保留解析偏移，不校正真太阳时。',
  '八字沿用 bazi-day2-yun1 主盘口径：年以立春交节时刻、月以十二节交节时刻换界；日柱 sect=2，23 点仍归当日，时柱沿用引擎次日时干。本页只展开流年与流月及相对日主的十神。',
  '紫微沿用 ziwei-normal-current：yearDivide/horoscopeDivide/ageDivide=normal，dayDivide=current，algorithm=default，fixLeap=true，使用内置四化表。春节换流年与虚岁，闰月十六日起按下一月，晚子按当日早子。',
  '紫微本命、大限或童限、小限、流年、流月、流日、流时分别列出四化；小限四化取本命宫干。各层四化落宫均指星曜所在本命宫；流曜另列，不推演吉凶或事件。',
  '区间采用起点包含、终点不包含。交节时间显示至秒是引擎分辨率，不表示天文绝对精度；独立节气资料以分钟核对。1900–2099 年的观测可跨未来；观测必须不早于出生。',
  '结果和输入作为独立本机快照保存；重新查看不调用当前历法重排。导入三盘档案仅复制出生资料，不改动原档案。',
])
export interface FlowStudySnapshot {
  schemaVersion: 1; ruleVersion: typeof FLOW_STUDY_RULE_VERSION; input: FlowStudyInput
  birthTime: TimeSnapshot; observationTime: TimeSnapshot; bazi: BaziFlow; ziwei: ZiweiFlow
  conventions: string[]; sources: { title: string; url: string; version: string; license: string }[]
}
export function calculateFlowStudy(input: FlowStudyInput): FlowStudySnapshot {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 40) throw new Error('请为这次研习填写 1–40 字的名称。')
  if (typeof input.note !== 'string' || input.note.trim().length > 2000) throw new Error('研习笔记最多 2000 字。')
  const times = normalizeFlowTimes(input.birth, input.observation)
  // IANA resolution is authoritative; an inactive manual field may be empty or stale.
  const normalizedInput = clone({ ...input, name: input.name.trim(), note: input.note.trim(), birth: { ...input.birth, utcOffset: times.birthTime.resolvedUtcOffset }, observation: { ...input.observation, utcOffset: times.observationTime.resolvedUtcOffset } })
  const result: FlowStudySnapshot = { schemaVersion: 1, ruleVersion: FLOW_STUDY_RULE_VERSION, input: normalizedInput, birthTime: times.birthTime, observationTime: times.observationTime, bazi: calculateBaziFlow(times.birth, times.observation), ziwei: calculateZiweiFlow(times.birth, times.observation), conventions: [...FLOW_STUDY_CONVENTIONS], sources: clone([...FLOW_STUDY_SOURCES]) }
  return validateFlowStudySnapshot(result)
}

const object = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v)
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const text = (v: unknown, max: number, empty = false) => typeof v === 'string' && v.length <= max && (empty || v.length > 0)
const texts = (v: unknown, max: number, itemMax = 30) => Array.isArray(v) && v.length <= max && v.every(s => text(s, itemMax))
const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥'
const ganzhi = (v: unknown): v is string => typeof v === 'string' && v.length === 2 && stems.includes(v[0]) && branches.includes(v[1]) && stems.indexOf(v[0]) % 2 === branches.indexOf(v[1]) % 2
function validDate(v: unknown): v is string { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '1900-01-01' || v > '2099-12-31') return false; const date = new Date(v + 'T00:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v }
function validCivil(v: unknown): v is string { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) return false; const date = new Date(v.replace(' ', 'T') + 'Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19).replace('T', ' ') === v }
function validTimeInput(v: unknown): v is ObservationTime {
  if (!object(v) || !validDate(v.date) || typeof v.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time) || !Number.isFinite(v.utcOffset) || Math.abs(v.utcOffset) > 24) return false
  if (v.timeZone !== undefined && (!text(v.timeZone, 100) || !/^(?:UTC|GMT|[A-Za-z_+-]+\/[A-Za-z0-9_+./-]+)$/.test(v.timeZone))) return false
  if (!v.timeZone && (v.utcOffset < -12 || v.utcOffset > 14 || !Number.isInteger(v.utcOffset * 4))) return false
  return v.timeChoice === undefined || ['earlier', 'later'].includes(v.timeChoice)
}
function validTimeSnapshot(input: ObservationTime, snapshot: unknown): snapshot is TimeSnapshot {
  if (!object(snapshot) || !validCivil(snapshot.beijingTime) || !validDate(snapshot.beijingTime.slice(0, 10)) || typeof snapshot.utcTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(snapshot.utcTime) || !Number.isFinite(Date.parse(snapshot.utcTime)) || new Date(snapshot.utcTime).toISOString() !== snapshot.utcTime) return false
  if (!Number.isFinite(snapshot.resolvedUtcOffset) || Math.abs(snapshot.resolvedUtcOffset) > 24 || snapshot.mode !== (input.timeZone ? 'iana' : 'manual') || snapshot.timeZone !== input.timeZone || snapshot.timeChoice !== input.timeChoice) return false
  if (!input.timeZone && input.utcOffset !== snapshot.resolvedUtcOffset) return false
  const wall = Date.parse(input.date + 'T' + input.time + ':00Z'), utc = Date.parse(snapshot.utcTime)
  return Math.abs(wall - snapshot.resolvedUtcOffset * 3_600_000 - utc) < 1 && snapshot.beijingTime === new Date(utc + 28_800_000).toISOString().slice(0, 19).replace('T', ' ')
}
/** Validates the saved schema and internal relationships without re-running calendar or timezone engines. */
export function isFlowStudySnapshot(value: unknown): value is FlowStudySnapshot {
  try {
    if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== FLOW_STUDY_RULE_VERSION || !object(value.input)) return false
    const input = value.input
    if (!text(input.name, 40) || input.name.trim() !== input.name || !text(input.note, 2000, true) || input.note.trim() !== input.note || !validTimeInput(input.birth) || !validTimeInput(input.observation)) return false
    const birth = input.birth as BirthProfile
    if (!['男', '女'].includes(birth.gender) || (birth.timePrecision !== undefined && !['minute', 'approximate'].includes(birth.timePrecision))) return false
    if (birth.place !== undefined && (!object(birth.place) || !Number.isFinite(birth.place.latitude) || Math.abs(birth.place.latitude) > 90 || !Number.isFinite(birth.place.longitude) || Math.abs(birth.place.longitude) > 180 || (birth.place.name !== undefined && !text(birth.place.name, 200, true)))) return false
    if (!validTimeSnapshot(input.birth, value.birthTime) || !validTimeSnapshot(input.observation, value.observationTime) || value.birthTime.utcTime > value.observationTime.utcTime) return false
    if (!eq(value.conventions, FLOW_STUDY_CONVENTIONS) || !eq(value.sources, FLOW_STUDY_SOURCES)) return false
    const b = value.bazi, z = value.ziwei, civil = value.observationTime.beijingTime
    if (!object(b) || b.engine !== 'lunar-typescript 1.8.6' || b.ruleProfile !== 'bazi-day2-yun1' || !Array.isArray(b.birthPillars) || b.birthPillars.length !== 4 || !b.birthPillars.every(ganzhi) || !Array.isArray(b.observationPillars) || b.observationPillars.length !== 4 || !b.observationPillars.every(ganzhi) || b.dayMaster !== b.birthPillars[2][0]) return false
    const validPillar = (p: unknown) => object(p) && ganzhi(p.ganZhi) && eq(p, pillarFacts(p.ganZhi, b.dayMaster))
    if (!validPillar(b.yearly) || !validPillar(b.currentMonth) || b.yearly.ganZhi !== b.observationPillars[0] || b.currentMonth.ganZhi !== b.observationPillars[1] || !Number.isInteger(b.solarYear) || b.solarYear < 1899 || b.solarYear > 2099 || !validCivil(b.yearStart) || !validCivil(b.yearEnd) || !b.yearStart.startsWith(String(b.solarYear)) || !b.yearEnd.startsWith(String(b.solarYear + 1)) || civil < b.yearStart || civil >= b.yearEnd) return false
    if (!Array.isArray(b.months) || b.months.length !== 12 || b.months.filter((m: any) => m.current === true).length !== 1) return false
    for (let i = 0; i < 12; i++) {
      const m = b.months[i]
      if (!object(m) || m.order !== i + 1 || m.jie !== FLOW_JIE[i] || m.nextJie !== FLOW_JIE[(i + 1) % 12] || !validCivil(m.start) || !validCivil(m.end) || m.start >= m.end || !validPillar(m.pillar) || m.current !== (civil >= m.start && civil < m.end)) return false
      if ((i === 0 ? b.yearStart : b.months[i - 1].end) !== m.start || (i === 11 && m.end !== b.yearEnd) || (m.current && !eq(m.pillar, b.currentMonth))) return false
      if (i && (stems.indexOf(m.pillar.ganZhi[0]) !== (stems.indexOf(b.months[i - 1].pillar.ganZhi[0]) + 1) % 10 || branches.indexOf(m.pillar.ganZhi[1]) !== (branches.indexOf(b.months[i - 1].pillar.ganZhi[1]) + 1) % 12)) return false
    }
    if (!object(z) || z.engine !== 'iztro 2.6.1' || z.ruleProfile !== 'ziwei-normal-current' || !eq(z.config, ZIWEI_FLOW_CONFIG) || z.fixLeap !== true || !text(z.lunarDate, 40) || !Number.isInteger(z.nominalAge) || z.nominalAge < 1 || z.nominalAge > 201 || z.inputTimeIndex !== Math.floor((Number(civil.slice(11, 13)) + 1) / 2) || z.effectiveTimeIndex !== (z.inputTimeIndex === 12 ? 0 : z.inputTimeIndex)) return false
    if (!Array.isArray(z.palaces) || z.palaces.length !== 12 || new Set(z.palaces.map((p: any) => p.name)).size !== 12) return false
    for (const [i, p] of z.palaces.entries()) {
      if (!object(p) || p.index !== i || !text(p.name, 4) || p.branch !== branches[(i + 2) % 12] || !ganzhi(p.stem + p.branch) || !texts(p.stars, 20, 8) || !Array.isArray(p.ages) || p.ages.length !== 10 || p.ages.some((a: number, n: number) => !Number.isInteger(a) || a < 1 || a > 120 || (n > 0 && a !== p.ages[n - 1] + 12)) || !Array.isArray(p.decadalRange) || p.decadalRange.length !== 2 || !Number.isInteger(p.decadalRange[0]) || p.decadalRange[0] < 2 || p.decadalRange[1] !== p.decadalRange[0] + 9) return false
    }
    if (!Array.isArray(z.scopes) || z.scopes.length !== FLOW_SCOPES.length) return false
    for (const [i, s] of z.scopes.entries()) {
      if (!object(s) || s.id !== FLOW_SCOPES[i] || !text(s.label, 4) || !text(s.note, 180)) return false
      const available = s.id === 'age' ? z.palaces.some((p: any) => p.ages.includes(z.nominalAge)) : s.id === 'decadal' ? z.nominalAge <= Math.max(...z.palaces.map((p: any) => p.decadalRange[1])) : true
      if (s.status !== (available ? 'ready' : 'unavailable')) return false
      if (!available) { if (s.ganZhi !== null || s.palaceIndex !== null || !eq(s.mutations, []) || !eq(s.palaceNames, []) || !eq(s.flowStars, [])) return false; continue }
      if (!Number.isInteger(s.palaceIndex) || s.palaceIndex < 0 || s.palaceIndex > 11 || !ganzhi(s.ganZhi) || !texts(s.palaceNames, 12, 4) || s.palaceNames.length !== 12 || s.palaceNames[s.palaceIndex] !== '命宫' || new Set(s.palaceNames).size !== 12 || !Array.isArray(s.flowStars) || s.flowStars.length !== 12 || !s.flowStars.every((a: unknown) => texts(a, 20, 8))) return false
      if (s.id === 'age' && (!z.palaces[s.palaceIndex].ages.includes(z.nominalAge) || s.ganZhi !== z.palaces[s.palaceIndex].stem + z.palaces[s.palaceIndex].branch)) return false
      if (!Array.isArray(s.mutations) || s.mutations.length !== 4) return false
      for (const [j, m] of s.mutations.entries()) {
        if (!object(m) || m.kind !== ['禄', '权', '科', '忌'][j] || !Number.isInteger(m.natalIndex) || m.natalIndex < 0 || m.natalIndex > 11) return false
        const p = z.palaces[m.natalIndex]
        if (!p.stars.includes(m.star) || m.natalPalace !== p.name || m.branch !== p.branch) return false
      }
    }
    return true
  } catch { return false }
}
export function validateFlowStudySnapshot(value: unknown): FlowStudySnapshot { if (!isFlowStudySnapshot(value)) throw new Error('流年流月快照格式异常或规则版本不支持，未修改原记录。'); return clone(value) }
