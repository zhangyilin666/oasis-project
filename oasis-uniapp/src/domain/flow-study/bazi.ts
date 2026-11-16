import { Solar, LunarUtil } from 'lunar-typescript'
import type { NormalizedBirth } from '../metaphysics/time'

export const FLOW_JIE = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'] as const
export interface FlowPillar { ganZhi: string; stemGod: string; hidden: { stem: string; god: string }[] }
export interface FlowMonth { order: number; jie: string; nextJie: string; start: string; end: string; pillar: FlowPillar; current: boolean }
export interface BaziFlow {
  engine: 'lunar-typescript 1.8.6'; ruleProfile: 'bazi-day2-yun1'; birthPillars: string[]; dayMaster: string
  observationPillars: string[]; solarYear: number; yearly: FlowPillar; currentMonth: FlowPillar
  yearStart: string; yearEnd: string; months: FlowMonth[]
}
export function pillarFacts(ganZhi: string, dayMaster: string): FlowPillar {
  return { ganZhi, stemGod: LunarUtil.SHI_SHEN[dayMaster + ganZhi[0]], hidden: LunarUtil.ZHI_HIDE_GAN[ganZhi[1]].map(stem => ({ stem, god: LunarUtil.SHI_SHEN[dayMaster + stem] })) }
}
const solarFor = (input: NormalizedBirth) => { const t = input.chinese; return Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, t.second) }
export function calculateBaziFlow(birth: NormalizedBirth, observation: NormalizedBirth): BaziFlow {
  const natal = solarFor(birth).getLunar().getEightChar(); natal.setSect(2)
  const observedSolar = solarFor(observation), lunar = observedSolar.getLunar(), observed = lunar.getEightChar(); observed.setSect(2)
  const dayMaster = natal.getDayGan(), civilTime = observedSolar.toYmdHms()
  const thisLiChun = Solar.fromYmd(observation.chinese.year, 6, 1).getLunar().getJieQiTable()['立春']
  const solarYear = civilTime < thisLiChun.toYmdHms() ? observation.chinese.year - 1 : observation.chinese.year
  const table = Solar.fromYmd(solarYear, 6, 1).getLunar().getJieQiTable()
  const boundaries = [...FLOW_JIE.map(name => table[name === '小寒' ? 'XIAO_HAN' : name]), table['LI_CHUN']]
  if (boundaries.some(value => !value)) throw new Error('流月节气区间不完整，未生成结果。')
  const months = FLOW_JIE.map((jie, i): FlowMonth => {
    const start = boundaries[i].toYmdHms(), end = boundaries[i + 1].toYmdHms()
    return { order: i + 1, jie, nextJie: FLOW_JIE[(i + 1) % 12], start, end, pillar: pillarFacts(boundaries[i].getLunar().getMonthInGanZhiExact(), dayMaster), current: civilTime >= start && civilTime < end }
  })
  if (months.filter(item => item.current).length !== 1 || months.find(item => item.current)!.pillar.ganZhi !== observed.getMonth()) throw new Error('流月与交节区间不一致，未生成结果。')
  return { engine: 'lunar-typescript 1.8.6', ruleProfile: 'bazi-day2-yun1', birthPillars: [natal.getYear(), natal.getMonth(), natal.getDay(), natal.getTime()], dayMaster, observationPillars: [observed.getYear(), observed.getMonth(), observed.getDay(), observed.getTime()], solarYear, yearly: pillarFacts(lunar.getYearInGanZhiExact(), dayMaster), currentMonth: pillarFacts(lunar.getMonthInGanZhiExact(), dayMaster), yearStart: months[0].start, yearEnd: months[11].end, months }
}
