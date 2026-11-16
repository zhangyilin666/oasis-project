import { astro } from 'iztro'
import { ziweiTimeIndex, type NormalizedBirth } from './time'
import type { ChartFact, ChartSection } from './types'

export const ZIWEI_RULE_PROFILE = { id: 'ziwei-normal-current', version: 'rules-comparison-v1', comparisonIds: ['ziwei-exact-current', 'ziwei-normal-forward'] }
const BASE_CONFIG = { yearDivide: 'normal', horoscopeDivide: 'normal', dayDivide: 'current', ageDivide: 'normal', algorithm: 'default' } as const

/** iztro 2.6.1 merges tables; getConfig exposes the live table objects. */
export function resetZiweiRules(): void {
  const config = astro.getConfig()
  for (const table of [config.mutagens, config.brightness]) {
    for (const key of Object.keys(table)) delete (table as Record<string, unknown>)[key]
  }
  astro.config(BASE_CONFIG)
}

function factsFor(input: NormalizedBirth, yearDivide: 'normal' | 'exact', dayDivide: 'current' | 'forward'): ChartFact[] {
  resetZiweiRules()
  try {
    astro.config({ ...BASE_CONFIG, yearDivide, dayDivide })
    const chart = astro.bySolar(input.chinese.date, ziweiTimeIndex(input.chinese.hour), input.profile.gender, true, 'zh-CN')
    const soul = chart.palaces.find(palace => palace.name === '命宫')!
    const body = chart.palaces.find(palace => palace.isBodyPalace)!
    const mutations = chart.palaces.flatMap(palace => [...palace.majorStars, ...palace.minorStars].filter(star => star.mutagen).map(star => `化${star.mutagen} ${star.name}（${palace.earthlyBranch}）`))
    const ziwei = chart.palaces.find(palace => palace.majorStars.some(star => star.name === '紫微'))!
    return [
      { label: '农历日期（引擎原值）', value: chart.lunarDate },
      { label: '干支日期（引擎原值）', value: chart.chineseDate },
      { label: '命宫', value: `${soul.heavenlyStem}${soul.earthlyBranch} · ${soul.majorStars.map(star => star.name).join('、') || '空宫'}` },
      { label: '身宫', value: `${body.heavenlyStem}${body.earthlyBranch} · ${body.name}` },
      { label: '五行局', value: chart.fiveElementsClass },
      { label: '命主／身主', value: `${chart.soul}／${chart.body}` },
      { label: '紫微星落宫', value: `${ziwei.earthlyBranch} · ${ziwei.name}` },
      { label: '生年四化', value: mutations.sort().join('；') },
    ]
  } finally { resetZiweiRules() }
}

export function ziweiRuleSections(input: NormalizedBirth): ChartSection[] {
  const presets = [
    { title: '主盘口径', year: 'normal', day: 'current' },
    { title: '立春日年界', year: 'exact', day: 'current' },
    { title: '晚子归次日', year: 'normal', day: 'forward' },
  ] as const
  const results = presets.map(preset => factsFor(input, preset.year, preset.day))
  return presets.map((preset, index) => ({
    title: `规则对照 · ${preset.title}`,
    caption: '可选本命参数对照，不替换上方主盘或运限。已做边界与关键字段核对，未完成各方案全盘独立验收；不评定哪种规则更准确。',
    facts: [
      { label: '规则参数', value: `yearDivide=${preset.year}；dayDivide=${preset.day}；horoscopeDivide=normal；ageDivide=normal；algorithm=default；fixLeap=true` },
      { label: '年界说明', value: preset.year === 'normal' ? '年干支以农历正月初一换界。' : '已装 lunar-lite 以立春所在公历日换年干支；不是立春交节瞬间，不提供秒级年界。' },
      { label: '日界说明', value: preset.day === 'current' ? '晚子（23:00–23:59）按当日早子排盘。' : '晚子沿用原日期的年、月信息，部分安星将日数加一（月末回到一）；并非把公历整体加一天。农历显示仍为输入日。' },
      { label: '闰月处理', value: preset.day === 'current' ? 'fixLeap=true：闰月前十五日随本月，十六日起随下月。' : 'fixLeap=true：非晚子闰月十六日起随下月；晚子命身宫的月份仍沿用原闰月，不作后半月进月。此为当前库实现。' },
      { label: '四化与亮度表', value: 'iztro 2.6.1 内置表，无自定义覆盖。' },
      ...results[index],
      { label: '与主盘所列字段差异', value: index === 0 ? '此方案为上方主盘使用的固定规则。' : results[index].filter((fact, position) => fact.value !== results[0][position].value).map(fact => `${fact.label}：${results[0].find(base => base.label === fact.label)!.value} → ${fact.value}`).join('；') || '本次所列字段未见差异；不表示全盘或全部规则相同。' },
    ],
  }))
}
