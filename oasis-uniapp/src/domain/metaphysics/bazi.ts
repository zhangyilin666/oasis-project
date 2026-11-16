import { Solar } from 'lunar-typescript'
import { SOURCES } from './catalog'
import { BAZI_RULE_PROFILE, baziRuleSections } from './bazi-rules'
import type { ChartResult, ExplorationOptions } from './types'
import type { NormalizedBirth } from './time'

export function calculateBazi(input: NormalizedBirth, options: ExplorationOptions = {}): ChartResult {
  const t = input.chinese
  const lunar = Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, t.second).getLunar()
  const chart = lunar.getEightChar()
  chart.setSect(2)
  const pillars = [
    { name: '年柱', value: chart.getYear(), element: chart.getYearWuXing(), hidden: chart.getYearHideGan(), god: chart.getYearShiShenGan(), nayin: chart.getYearNaYin() },
    { name: '月柱', value: chart.getMonth(), element: chart.getMonthWuXing(), hidden: chart.getMonthHideGan(), god: chart.getMonthShiShenGan(), nayin: chart.getMonthNaYin() },
    { name: '日柱', value: chart.getDay(), element: chart.getDayWuXing(), hidden: chart.getDayHideGan(), god: '日主', nayin: chart.getDayNaYin() },
    { name: '时柱', value: chart.getTime(), element: chart.getTimeWuXing(), hidden: chart.getTimeHideGan(), god: chart.getTimeShiShenGan(), nayin: chart.getTimeNaYin() },
  ]
  const elements = ['金', '木', '水', '火', '土'].map(label => ({ label, value: String(pillars.reduce((n, p) => n + [...p.element].filter(e => e === label).length, 0)) }))
  const yun = chart.getYun(input.profile.gender === '男' ? 1 : 0, 1)
  return {
    id: 'bazi', title: '四柱八字', status: 'ready', source: SOURCES.bazi,
    ...(options.compareRules === true ? { ruleProfile: { ...BAZI_RULE_PROFILE, comparisonIds: [...BAZI_RULE_PROFILE.comparisonIds] } } : {}),
    summary: [
      { label: '四柱', value: pillars.map(p => p.value).join(' ') },
      { label: '日主', value: chart.getDayGan() },
      { label: '农历', value: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}` },
      { label: '起运', value: `${yun.getStartSolar().toYmd()} · ${yun.isForward() ? '顺行' : '逆行'}` },
    ],
    sections: [
      ...pillars.map(p => ({ title: p.name, facts: [
        { label: '干支', value: p.value }, { label: '五行', value: p.element },
        { label: '天干十神', value: p.god }, { label: '藏干', value: p.hidden.join('、') }, { label: '纳音', value: p.nayin },
      ] })),
      { title: '五行数量', caption: '只统计四柱八个字的五行归属，总数为 8；不代表旺衰、喜忌或补益需求。', facts: elements },
      { title: '八步大运', caption: '起运采用 lunar 的 sect=1；年龄为库的虚岁口径。', facts: yun.getDaYun(9).filter(d => d.getIndex() > 0).map(d => ({ label: `${d.getStartAge()}–${d.getEndAge()}岁`, value: `${d.getGanZhi()} · ${d.getStartYear()}–${d.getEndYear()}年` })) },
      ...(options.compareRules === true ? baziRuleSections(input) : []),
    ],
    conventions: ['先换算至北京时间 UTC+8；不作真太阳时校正。', '年柱按立春、月柱按节气；日柱采用 sect=2，晚子时日柱仍属当日，时柱沿用该库规则。', '此处为本地基础排盘，原有 AI 八字报告仍由服务端独立生成。'],
    limitations: ['未推断身强身弱、格局或喜用神；五行数量不能直接转为生活处方。', options.compareRules === true ? '对照仅涵盖两种日界与两种起运参数，不代表全部流派；主盘仍使用日柱 sect=2、起运 sect=1。' : '本版固定一种排盘口径，不代表所有流派。'],
  }
}
