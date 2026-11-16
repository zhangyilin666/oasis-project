import { astro } from 'iztro'
import { SOURCES } from './catalog'
import { resetZiweiRules, ZIWEI_RULE_PROFILE, ziweiRuleSections } from './ziwei-rules'
import { ziweiTimeIndex, type NormalizedBirth } from './time'
import type { ChartResult, ChartSection, ExplorationOptions } from './types'

type ZiweiChart = ReturnType<typeof astro.bySolar>
type HoroscopeScope = ReturnType<ZiweiChart['horoscope']>['monthly']
const palaceTitle = (name: string) => `${name}${name.endsWith('宫') ? '' : '宫'}`

function flowSections(chart: ZiweiChart, input: NormalizedBirth, observationDate: string): ChartSection[] {
  // Keep this adapter safe even when invoked outside calculateExploration.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observationDate)) throw new Error('观察日期须为完整公历日期 YYYY-MM-DD')
  const [year, month, day] = observationDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (year < 1900 || year > 2099 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new Error('观察日期须为 1900–2099 年内的有效公历日期')
  }
  if (observationDate < input.chinese.date) throw new Error('观察日期不能早于北京时间出生日期')

  // Pass calendar text and an explicit noon time index, never a local Date.
  // iztro's date parser otherwise reads Date.getFullYear/getMonth/getDate.
  const flow = chart.horoscope(`${observationDate} 12:00:00`, 6)
  const timeline = chart.decadalList()
  const age = flow.age.nominalAge
  const current = timeline.find(item => age >= item.ageRange[0] && age <= item.ageRange[1])
  const childhood = age < timeline[0].ageRange[0]
  const forward = timeline[1].index === (timeline[0].index + 1) % 12
  const location = (index: number) => {
    const palace = chart.palaces[index]
    if (!palace) throw new Error('紫微运限返回无效宫位')
    return `${palace.earthlyBranch} · 本命${palaceTitle(palace.name)}`
  }
  const scopeSection = (title: string, scope: HoroscopeScope, caption: string): ChartSection => {
    const palace = chart.palaces[scope.index]
    if (!palace) throw new Error('紫微运限返回无效宫位')
    return { title, caption, facts: [
      { label: '命宫落宫', value: location(scope.index) },
      { label: '运限干支', value: `${scope.heavenlyStem}${scope.earthlyBranch}` },
      { label: '本命主星', value: palace.majorStars.map(star => star.name).join('、') || '空宫（无主星）' },
      { label: '本命辅星', value: palace.minorStars.map(star => star.name).join('、') || '无' },
      ...scope.mutagen.map((name, index) => {
        const target = chart.palaces.find(item => [...item.majorStars, ...item.minorStars].some(star => star.name === name))
        if (!target) throw new Error('紫微运限四化星曜未找到本命落宫')
        return { label: `化${['禄', '权', '科', '忌'][index]}`, value: `${name} · 本命${palaceTitle(target.name)}（${target.earthlyBranch}）` }
      }),
      { label: '命宫流曜', value: scope.stars?.[scope.index]?.map(star => star.name).join('、') || '无' },
    ] }
  }
  const currentSection = current
    ? scopeSection('当前大限', flow.decadal, `${current.ageRange[0]}–${current.ageRange[1]}岁（虚岁） · 农历年份 ${current.yearRange[0]}–${current.yearRange[1]}`)
    : childhood
      ? scopeSection('当前童限', flow.decadal, `尚未进入首个大限；${timeline[0].ageRange[0]}虚岁起大限。童限依本版引擎规则展示。`)
      : { title: '当前大限', facts: [{ label: '计算范围', value: `所选日期为 ${age} 虚岁，超出本命盘十二大限（至 ${timeline[timeline.length - 1].ageRange[1]} 虚岁）；不推算后续大限。` }] }
  return [
    { title: '运限概览', facts: [
      { label: '观察日期', value: `${observationDate} 12:00 · 北京时间 UTC+08:00` },
      { label: '观察农历', value: flow.lunarDate },
      { label: '虚岁', value: `${age}岁` },
      { label: '大限顺逆', value: `${forward ? '顺行' : '逆行'} · 阳男阴女顺、阴男阳女逆` },
    ] },
    currentSection,
    scopeSection('流年', flow.yearly, '流年命宫按当年地支定位；干支与虚岁在农历正月初一切换。'),
    scopeSection('流月', flow.monthly, '按农历月定位；闰月前十五日随本月，十六日起随下月。'),
    { title: '大限时间轴', caption: '依起限顺序排列；年份指农历年份，区间起止均以正月初一为界。', facts: timeline.map(item => ({
      label: `${item.ageRange[0]}–${item.ageRange[1]}岁${item === current ? ' · 当前' : ''}`,
      value: `${location(item.index)} · ${item.heavenlyStem}${item.earthlyBranch} · 农历 ${item.yearRange[0]}–${item.yearRange[1]}年`,
    })) },
  ]
}

export function calculateZiwei(input: NormalizedBirth, options: ExplorationOptions = {}): ChartResult {
  // iztro merges custom tables and cannot reset them with {}. Do not silently
  // label a chart with customized tables as the built-in convention.
  const configured = astro.getConfig()
  const polluted = Object.keys(configured.mutagens).length || Object.keys(configured.brightness).length
  try {
    resetZiweiRules()
    if (polluted) throw new Error('紫微引擎包含未声明的自定义四化或亮度表')
    const result = calculatePrimaryZiwei(input, options)
    if (options.compareRules === true) {
      result.sections.push(...ziweiRuleSections(input))
      result.ruleProfile = { ...ZIWEI_RULE_PROFILE, comparisonIds: [...ZIWEI_RULE_PROFILE.comparisonIds] }
    }
    return result
  } finally {
    resetZiweiRules()
  }
}

function calculatePrimaryZiwei(input: NormalizedBirth, options: ExplorationOptions): ChartResult {
  const chart = astro.bySolar(input.chinese.date, ziweiTimeIndex(input.chinese.hour), input.profile.gender, true, 'zh-CN')
  const starText = (star: { name: string; brightness?: string; mutagen?: string }) => `${star.name}${star.brightness ? `（${star.brightness}）` : ''}${star.mutagen ? `·化${star.mutagen}` : ''}`
  const mutations = chart.palaces.flatMap(p => [...p.majorStars, ...p.minorStars].filter(s => s.mutagen).map(s => ({ label: `化${s.mutagen}`, value: `${s.name} · ${p.name}${p.name.endsWith('宫') ? '' : '宫'}` })))
  const soulPalace = chart.palaces.find(p => p.name === '命宫')
  return {
    id: 'ziwei', title: '紫微斗数', status: 'ready', source: SOURCES.ziwei,
    summary: [
      { label: '命宫', value: `${chart.earthlyBranchOfSoulPalace} · ${soulPalace?.majorStars.map(s => s.name).join('、') || '空宫'}` },
      { label: '身宫', value: `${chart.earthlyBranchOfBodyPalace} · ${chart.palaces.find(p => p.isBodyPalace)?.name || ''}` },
      { label: '五行局', value: chart.fiveElementsClass },
      { label: '命主 / 身主', value: `${chart.soul} / ${chart.body}` },
    ],
    sections: [
      { title: '生年四化', facts: mutations },
      ...chart.palaces.map(p => ({ title: `${p.name}${p.name.endsWith('宫') ? '' : '宫'} · ${p.heavenlyStem}${p.earthlyBranch}${p.isBodyPalace ? ' · 身宫' : ''}`, facts: [
        { label: '主星', value: p.majorStars.map(starText).join('、') || '空宫（无主星）' },
        { label: '辅星', value: p.minorStars.map(starText).join('、') || '无' },
        { label: '杂曜', value: p.adjectiveStars.map(s => s.name).join('、') || '无' },
        { label: '大限', value: `${p.decadal.range[0]}–${p.decadal.range[1]}岁（虚岁）` },
      ] })),
      ...(options.observationDate === undefined ? [] : flowSections(chart, input, options.observationDate)),
    ],
    conventions: ['先换算至北京时间 UTC+8；时辰按 00:00–00:59 早子、23:00–23:59 晚子划分。', '采用 iztro 默认流派；农历正月初一换年，晚子时仍算当日（dayDivide=current）。', '闰月按前十五日归本月、十六日起归下月；四化和亮度使用该版本内置表。',
      ...(options.observationDate === undefined ? [] : ['观察日固定取北京时间午时（12:00），按出生日期校验，可选出生当天；不使用设备当前日期。', '运限干支按春节及农历月换界（horoscopeDivide=normal）；虚岁在春节递增（ageDivide=normal），不以立春或生日换岁。', '大限由五行局数起虚岁，每十岁一宫；阳男阴女顺行，阴男阳女逆行。运限四化独立列出其本命落宫。'])],
    limitations: ['紫微命宫、身宫、五行局与八字中的同名概念不能直接等同。', options.observationDate === undefined
      ? '展示本命与大限年龄分布；选择观察日期后可查看大限、流年与流月。飞化解读暂未接入。'
      : '运限展示选定规则下的宫位、四化及命宫流曜，不作事件、吉凶或现实结果预测；暂不展开小限、流日、流时与飞化解读。'],
  }
}
