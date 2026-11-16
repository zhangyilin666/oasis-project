import { SOURCES } from './catalog'
import { normalizeBirth, validateObservationDate } from './time'
import type { BirthProfile, ChartResult, ComparisonRow, ExplorationResult, ExplorationOptions, SystemId } from './types'
export type * from './types'
export { TRADITIONS } from './catalog'

function compare(charts: ChartResult[], options: ExplorationOptions): ComparisonRow[] {
  const read = (id: SystemId, label: string) => charts.find(c => c.id === id && c.status === 'ready')?.summary.find(f => f.label === label)?.value || '本次未生成'
  return [
    { theme: '认识自己', bazi: `日主：${read('bazi', '日主')}`, ziwei: `命宫：${read('ziwei', '命宫')}`, western: `太阳：${read('western', '太阳')}；月亮：${read('western', '月亮')}`, note: '这些是各体系不同的观察入口，可结合个人经历记录感受；不是彼此的换算公式。' },
    { theme: '行动与关系', bazi: '查看日柱与十神，各十神是相对日主的五行关系。', ziwei: '查看夫妻、交友（仆役）与官禄宫中的本命星曜。', western: `金星：${read('western', '金星')}；火星：${read('western', '火星')}`, note: '主题相近不等于结论一致；不从一个位置直接推断关系或事业结果。' },
    { theme: '时间变化', bazi: `起运：${read('bazi', '起运')}；查看八步大运。`, ziwei: options.observationDate ? `按 ${options.observationDate} 查看大限、流年与流月。` : '十二宫附大限虚岁区间；填写观察日期可查看运限。', western: charts.some(chart => chart.id === 'western' && chart.status === 'ready' && chart.observation) ? `查看 ${options.observationDate} 北京时间 12:00 的行运及对本命相位。` : options.observationDate ? '本次未生成行运快照。' : '填写观察日期可查看该日中午的行运快照。', note: '八字大运、紫微大限与西方行运是独立规则，不拼成统一吉凶分数。' },
    { theme: '从命盘到问事', bazi: '八字作为命类的个人资料入口。', ziwei: '紫微补充宫位与星曜的阅读角度。', western: '星盘作为跨文化比较的另一套语言。', note: '命盘保留出生资料与各体系的规则；问卦围绕具体问题独立起卦，两类记录可以并读，但不能彼此替代。' },
  ]
}

/** Each adapter is isolated: a failure never fabricates a replacement chart. */
export async function calculateExploration(profile: BirthProfile, options: ExplorationOptions = {}): Promise<ExplorationResult> {
  const input = normalizeBirth(profile)
  if (options.compareRules !== undefined && typeof options.compareRules !== 'boolean') throw new Error('规则对照选项须为开启或关闭')
  const resolvedOptions: ExplorationOptions = { ...(options.observationDate ? { observationDate: options.observationDate } : {}), ...(options.compareRules ? { compareRules: true } : {}) }
  if (resolvedOptions.observationDate) validateObservationDate(resolvedOptions.observationDate, input.chinese.date)
  const adapters = [
    { id: 'bazi' as const, title: '四柱八字', run: async () => (await import('./bazi')).calculateBazi(input, resolvedOptions) },
    { id: 'ziwei' as const, title: '紫微斗数', run: async () => (await import('./ziwei')).calculateZiwei(input, resolvedOptions) },
    { id: 'western' as const, title: '西方本命星盘 · 基础', run: async () => (await import('./western')).calculateWestern(input, resolvedOptions) },
  ]
  const charts = await Promise.all(adapters.map(async adapter => {
    try { return await adapter.run() }
    catch { return { id: adapter.id, title: adapter.title, status: 'error', error: '本体系暂时未能完成排盘，请重试；其他结果仍可查看。', summary: [], sections: [], conventions: [], limitations: [], source: SOURCES[adapter.id] } satisfies ChartResult }
  }))
  return {
    schemaVersion: 1, profile: input.profile, utcTime: input.instant.toISOString(), chineseTime: input.chineseTime,
    options: resolvedOptions, rulesVersion: '4.0.0',
    timeResolution: { mode: input.profile.timeZone ? 'iana' : 'manual', ...(input.profile.timeZone ? { timeZone: input.profile.timeZone } : {}), utcOffset: input.profile.utcOffset, ...(input.profile.timeChoice ? { choice: input.profile.timeChoice } : {}) },
    charts, comparison: compare(charts, resolvedOptions),
    notices: [
      '三套结果来自同一出生瞬间；八字、紫微统一采用北京时间，星盘采用 UTC。海外出生者需留意这一固定口径。',
      input.profile.timeZone ? `历史时区 ${input.profile.timeZone} 使用此设备的 IANA 数据；结果保留本次解析的 UTC 偏移和瞬间。不校正真太阳时。` : '手动 UTC 偏移应包含出生当年的夏令时；可选择 IANA 时区自动查询。不校正真太阳时。',
      ...(input.profile.timePrecision === 'approximate' ? ['出生时间已标记为大约时间：当前盘面只对应所填时刻，时柱、紫微命宫和星盘角度都可能随实际时刻改变。'] : []),
      '同参用于学习和自我记录。计算数据与传统解释分开，不将多个体系的相似说法视为已证实的预测。',
      '本页在设备上计算，只有点击保存才存到本机档案；不会上传或自动成为账号中的 AI 报告。导出文件包含所填出生资料。',
    ],
  }
}
