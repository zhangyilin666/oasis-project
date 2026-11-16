import { SOURCES } from './catalog'
import { calculateHouses, wholeSignHouse } from './houses'
import { angularDistance, calculatePositions, positionText, SIGNS, wrapDegrees } from './positions'
import { calculateTransits, MAJOR_ASPECTS, transitSections } from './transits'
import type { ChartResult, ChartSection, ExplorationOptions } from './types'
import type { NormalizedBirth } from './time'

export { angularDistance, wrapDegrees } from './positions'

export function calculateWestern(input: NormalizedBirth, options: ExplorationOptions = {}): ChartResult {
  const houses = calculateHouses(input.instant, input.profile.place)
  const positions = calculatePositions(input.instant)
  const transit = options.observationDate === undefined ? undefined : calculateTransits(input, options.observationDate, positions)
  const angleText = (longitude: number) => `${SIGNS[Math.floor(longitude / 30)]} ${(longitude % 30).toFixed(2)}° · 黄经 ${longitude.toFixed(2)}°`
  const houseSections: ChartSection[] = houses.status === 'ready' ? [
    {
      title: '四轴与宫制',
      caption: '当日真黄道与出生地的几何地平圈、子午圈求交；不加入大气折射。天顶是独立角点，不固定为整宫制第十宫起点。',
      facts: [
        { label: '上升点 ASC', value: angleText(houses.ascendant) },
        { label: '天顶 MC', value: `${angleText(houses.midheaven)} · 第 ${wholeSignHouse(houses.midheaven, houses.ascendant)} 宫` },
        { label: '下降点 DSC', value: angleText(wrapDegrees(houses.ascendant + 180)) },
        { label: '天底 IC', value: angleText(wrapDegrees(houses.midheaven + 180)) },
        { label: '宫制', value: '整宫制 Whole Sign：上升星座完整作为第一宫，每宫 30°；不是 Placidus 宫制。' },
      ],
    },
    {
      title: '十二宫 · 整宫制',
      caption: '每宫从对应星座 0° 开始。天体按未四舍五入的热带黄经分宫；上升点仍保留其精确度数。',
      facts: houses.cusps.map((cusp, index) => ({
        label: `第 ${index + 1} 宫`,
        value: `${angleText(cusp)} · ${positions.filter(p => wholeSignHouse(p.longitude, houses.ascendant) === index + 1).map(p => p.name).join('、') || '无十天体落入'}`,
      })),
    },
  ] : []
  const aspects: { label: string; value: string; orb: number }[] = []
  positions.forEach((a, i) => positions.slice(i + 1).forEach(b => {
    const separation = angularDistance(a.longitude, b.longitude)
    const aspect = MAJOR_ASPECTS.find(x => Math.abs(separation - x.angle) <= 6)
    if (aspect) aspects.push({ label: `${a.name} / ${b.name}`, value: `${aspect.name} ${aspect.angle}° · 偏差 ${Math.abs(separation - aspect.angle).toFixed(2)}°`, orb: Math.abs(separation - aspect.angle) })
  }))
  return {
    id: 'western', title: houses.status === 'ready' ? '西方本命星盘 · 整宫制' : '西方本命星盘 · 基础', status: 'ready', source: SOURCES.western,
    ...(transit ? { observation: transit.observation } : {}),
    summary: [
      ...positions.filter(p => ['太阳', '月亮', '金星', '火星'].includes(p.name)).map(p => ({ label: p.name, value: positionText(p) })),
      ...(houses.status === 'ready' ? [{ label: '上升点 ASC', value: angleText(houses.ascendant) }, { label: '天顶 MC', value: angleText(houses.midheaven) }] : []),
    ],
    sections: [
      { title: '十天体位置', caption: '地心视位置 · 当日真春分点起算的热带黄道。度数保留两位小数。', facts: positions.map(p => ({ label: p.name, value: `${positionText(p)} · 黄经 ${p.longitude.toFixed(2)}°${houses.status === 'ready' ? ` · 第 ${wholeSignHouse(p.longitude, houses.ascendant)} 宫` : ''}` })) },
      ...houseSections,
      { title: '主要相位', caption: '合、六合、刑、拱、对冲；统一容许度 6°，按偏差从小到大排列。', facts: aspects.sort((a, b) => a.orb - b.orb).map(({ label, value }) => ({ label, value })) },
      ...(transit ? transitSections(transit) : []),
    ],
    conventions: ['由已确认的出生时刻与时区资料转换为 UTC 瞬间。', '使用 GeoVector + Ecliptic 计算地心黄经；太阳与行星启用光行差，月亮采用引擎内置月球模型。不使用日心黄经。', '逆行按前后一小时的黄经变化估算；近驻留阈值为每日 0.001°。', ...(houses.status === 'ready' ? ['经度东正西负，纬度北正南负；上升点取黄道与地平圈的东侧交点，天顶取黄道与子午圈的上方交点。', '整宫制以未四舍五入的上升点所在星座起算，与 Placidus 或从上升点度数起算的等宫制不同。'] : []), ...(transit ? ['观察日期固定取北京时间 12:00（UTC 04:00），不随设备时区改变；可选出生当天，所选中午可能早于当天的出生时刻。', '行运日期的热带黄经与本命热带黄经直接比较，不作岁差校正；行运相位统一容许度 1°，本命相位仍为 6°。'] : [])],
    limitations: [...(houses.status === 'unavailable' ? [houses.reason] : ['宫位依赖准确的出生时刻与地点；时间误差可能改变上升星座及天体落宫。引擎将 UT1 近似为 UTC，度数显示不构成秒级精度保证。']), '尚未接入其他宫制、交点与合盘。', ...(transit ? ['行运只展示中午一个时刻，不代表全天。月亮日内变化明显，出生时间误差也可能改变本命月亮相位。', '尚未计算行运四轴、精确相位发生时刻、持续窗口与入相出相，不提供事件预测。'] : []), '星座为每段 30° 的热带黄道分区，不是天文学星座边界。天体计算精度不代表占星解释的预测效力。'],
  }
}
