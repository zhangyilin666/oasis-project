import { astro } from 'iztro'
import i18n, { setLanguage } from 'iztro/lib/i18n'
import { ziweiTimeIndex, type NormalizedBirth } from '../metaphysics/time'
import { clone } from './time'

export const ZIWEI_FLOW_CONFIG = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current', algorithm: 'default' } as const
export const FLOW_SCOPES = ['origin', 'decadal', 'age', 'yearly', 'monthly', 'daily', 'hourly'] as const
export type FlowScopeId = typeof FLOW_SCOPES[number]
export interface Mutation { kind: '禄' | '权' | '科' | '忌'; star: string; natalIndex: number; natalPalace: string; branch: string }
export interface ZiweiPalace { index: number; name: string; stem: string; branch: string; stars: string[]; ages: number[]; decadalRange: number[] }
export interface ZiweiScope { id: FlowScopeId; label: string; status: 'ready' | 'unavailable'; note: string; palaceIndex: number | null; ganZhi: string | null; mutations: Mutation[]; palaceNames: string[]; flowStars: string[][] }
export interface ZiweiFlow { engine: 'iztro 2.6.1'; ruleProfile: 'ziwei-normal-current'; config: typeof ZIWEI_FLOW_CONFIG; fixLeap: true; lunarDate: string; nominalAge: number; inputTimeIndex: number; effectiveTimeIndex: number; palaces: ZiweiPalace[]; scopes: ZiweiScope[] }

/** iztro's configuration is process-global and tables are merged, so restore both tables and scalars. */
export function withFlowZiweiRules<T>(calculate: () => T): T {
  const previous = clone(astro.getConfig()), language = i18n.language
  const clearTables = () => { const current = astro.getConfig(); for (const table of [current.mutagens, current.brightness]) for (const key of Object.keys(table)) delete (table as Record<string, unknown>)[key] }
  try { clearTables(); astro.config(ZIWEI_FLOW_CONFIG); setLanguage('zh-CN'); return calculate() }
  finally {
    clearTables()
    const { mutagens, brightness, ...scalars } = previous
    astro.config(scalars)
    Object.assign(astro.getConfig().mutagens, mutagens)
    Object.assign(astro.getConfig().brightness, brightness)
    if (language) i18n.changeLanguage(language)
  }
}
export function calculateZiweiFlow(birth: NormalizedBirth, observation: NormalizedBirth): ZiweiFlow {
  return withFlowZiweiRules(() => {
    const chart = astro.bySolar(birth.chinese.date, ziweiTimeIndex(birth.chinese.hour), birth.profile.gender, true, 'zh-CN')
    const inputTimeIndex = ziweiTimeIndex(observation.chinese.hour)
    const civil = observation.chineseTime.replace(' UTC+08:00', '')
    const flow = chart.horoscope(civil, inputTimeIndex)
    const palaces = chart.palaces.map((p, index): ZiweiPalace => ({ index, name: p.name, stem: p.heavenlyStem, branch: p.earthlyBranch, stars: [...p.majorStars, ...p.minorStars].map(star => star.name), ages: [...p.ages], decadalRange: [...p.decadal.range] }))
    const kinds = ['禄', '权', '科', '忌'] as const
    const mutation = (names: string[]): Mutation[] => names.map((name, i) => {
      const natal = palaces.find(p => p.stars.includes(name))
      if (!natal || !kinds[i]) throw new Error('紫微四化未找到对应本命星曜，未生成结果。')
      return { kind: kinds[i], star: name, natalIndex: natal.index, natalPalace: natal.name, branch: natal.branch }
    })
    const age = flow.age.nominalAge
    const limits = palaces.map(p => p.decadalRange), first = Math.min(...limits.map(r => r[0])), last = Math.max(...limits.map(r => r[1]))
    type RawScope = typeof flow.monthly
    const make = (id: Exclude<FlowScopeId, 'origin'>, label: string, raw: RawScope, note: string, available = true): ZiweiScope => {
      if (!available || raw.index < 0 || raw.index > 11) return { id, label, status: 'unavailable', note, palaceIndex: null, ganZhi: null, mutations: [], palaceNames: [], flowStars: [] }
      const palace = palaces[raw.index]
      // `age` exposes translated natal palace stems, unlike other scopes.
      const ganZhi = id === 'age' ? palace.stem + palace.branch : raw.heavenlyStem + raw.earthlyBranch
      return { id, label, status: 'ready', note, palaceIndex: raw.index, ganZhi, mutations: mutation(raw.mutagen), palaceNames: [...raw.palaceNames], flowStars: palaces.map(p => raw.stars?.[p.index]?.map(star => star.name) ?? []) }
    }
    const natalNames = kinds.map(kind => {
      const star = chart.palaces.flatMap(p => [...p.majorStars, ...p.minorStars]).find(item => item.mutagen === kind)
      if (!star) throw new Error('紫微生年四化资料不完整。')
      return star.name
    })
    const origin: ZiweiScope = { id: 'origin', label: '本命', status: 'ready', note: '生年四化；以下各层四化仍映射至这些本命星曜的落宫，不把星曜搬到流年宫位。', palaceIndex: palaces.find(p => p.name === '命宫')!.index, ganZhi: chart.rawDates.chineseDate.yearly.join(''), mutations: mutation(natalNames), palaceNames: palaces.map(p => p.name), flowStars: palaces.map(() => []) }
    const ageCovered = palaces.some(p => p.ages.includes(age))
    return { engine: 'iztro 2.6.1', ruleProfile: 'ziwei-normal-current', config: { ...ZIWEI_FLOW_CONFIG }, fixLeap: true, lunarDate: flow.lunarDate, nominalAge: age, inputTimeIndex, effectiveTimeIndex: inputTimeIndex === 12 ? 0 : inputTimeIndex, palaces, scopes: [origin,
      make('decadal', age < first ? '童限' : '大限', flow.decadal, age > last ? `${age} 虚岁超出十二大限（至 ${last} 岁），不外推。` : age < first ? `尚未进入 ${first} 虚岁起的首个大限，使用引擎童限宫位。` : `${age} 虚岁所在大限；按阴阳与性别定顺逆。`, age <= last),
      make('age', '小限', flow.age, ageCovered ? '按虚岁定位；男顺女逆。小限四化取所在本命宫干，非另造小限天干。' : `${age} 虚岁不在引擎小限年龄表（1–120 岁）内，不外推。`, ageCovered),
      make('yearly', '流年', flow.yearly, '干支与虚岁以农历正月初一换年。'),
      make('monthly', '流月', flow.monthly, '按农历月；出生与观测的闰月十六日起按下一月定位。'),
      make('daily', '流日', flow.daily, '流月命宫起初一，按农历日数顺推；日干支按本版 current 日界。'),
      make('hourly', '流时', flow.hourly, '流日命宫起子时，顺推至观测时辰；晚子按当日早子处理。'),
    ] }
  })
}
