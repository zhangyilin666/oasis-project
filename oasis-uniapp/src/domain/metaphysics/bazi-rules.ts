import { Solar } from 'lunar-typescript'
import type { NormalizedBirth } from './time'
import type { ChartFact, ChartSection } from './types'

export const BAZI_RULE_PROFILE = { id: 'bazi-day2-yun1', version: 'rules-comparison-v1', comparisonIds: ['bazi-day1-yun1', 'bazi-day2-yun2'] }

/** Each rule pair gets its own EightChar; changing sect never mutates the main chart. */
function factsFor(input: NormalizedBirth, daySect: 1 | 2, yunSect: 1 | 2): ChartFact[] {
  const t = input.chinese
  const chart = Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, t.second).getLunar().getEightChar()
  chart.setSect(daySect)
  const yun = chart.getYun(input.profile.gender === '男' ? 1 : 0, yunSect)
  return [
    { label: '四柱', value: chart.toString() },
    { label: '日主', value: chart.getDayGan() },
    { label: '天干十神（年／月／日／时）', value: [chart.getYearShiShenGan(), chart.getMonthShiShenGan(), '日主', chart.getTimeShiShenGan()].join('／') },
    { label: '藏干十神（年／月／日／时）', value: [chart.getYearShiShenZhi(), chart.getMonthShiShenZhi(), chart.getDayShiShenZhi(), chart.getTimeShiShenZhi()].map(gods => gods.join('、')).join('／') },
    { label: '起运日期', value: `${yun.getStartSolar().toYmdHms()} · 北京时间 UTC+08:00` },
    { label: '起运间隔', value: `${yun.getStartYear()}年 ${yun.getStartMonth()}月 ${yun.getStartDay()}日 ${yun.getStartHour()}时` },
    { label: '大运方向', value: yun.isForward() ? '顺行' : '逆行' },
  ]
}

export function baziRuleSections(input: NormalizedBirth): ChartSection[] {
  const presets = [
    { title: '主盘口径', day: 2, yun: 1 },
    { title: '晚子日柱归次日', day: 1, yun: 1 },
    { title: '起运按分钟折算', day: 2, yun: 2 },
  ] as const
  const results = presets.map(preset => factsFor(input, preset.day, preset.yun))
  return presets.map((preset, index) => ({
    title: `规则对照 · ${preset.title}`,
    caption: '可选对照，不替换上方主盘。lunar-typescript 1.8.6；各方案只改变所列参数，不评定哪种规则更准确。',
    facts: [
      { label: '规则参数', value: `日柱 sect=${preset.day}；起运 getYun sect=${preset.yun}；年界=立春交节时刻；月界=节；北京时间；不校正真太阳时` },
      { label: '日界说明', value: preset.day === 2 ? '晚子（23:00–23:59）日柱归当日；时柱仍沿用库的次日时干。' : '晚子（23:00–23:59）日柱归次日；时柱沿用库的次日时干。' },
      { label: '起运说明', value: preset.yun === 1 ? '按出生至前／后节的天数与时辰差折算，沿用库的 sect=1。' : '按出生至前／后节的分钟差折算：4320分钟=1年，360分钟=1月，12分钟=1日；余分钟×2为小时。' },
      ...results[index],
      { label: '与主盘所列字段差异', value: index === 0 ? '此方案为上方主盘使用的固定规则。' : results[index].filter((fact, position) => fact.value !== results[0][position].value).map(fact => `${fact.label}：${results[0].find(base => base.label === fact.label)!.value} → ${fact.value}`).join('；') || '本次所列字段未见差异；不表示全部规则等同。' },
    ],
  }))
}
