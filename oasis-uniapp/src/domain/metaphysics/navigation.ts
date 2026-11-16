import { TRADITIONS } from './catalog'
import type { Tradition } from './types'
import type { CrossSourceKind } from '../cross-reading/sources'

/** Shared front-door navigation for the homepage and the detailed catalogue. */
export const TRADITION_ROUTES: Record<string, string> = {
  bazi: '/pages/analyze/index',
  liuyao: '/pages/divination/index', meihua: '/pages/divination/index?method=meihua-calendar',
}
const categories: { category: Tradition['category']; caption: string }[] = [
  { category: '命', caption: '命盘与时间' },
  { category: '卜', caption: '问事与记录' },
]
export const TRADITION_GROUPS = categories.map(group => ({
  ...group,
  items: TRADITIONS.filter(item => item.category === group.category && TRADITION_ROUTES[item.id]).map(item => ({ ...item, route: TRADITION_ROUTES[item.id] })),
}))
export const TRADITION_COUNT = TRADITION_GROUPS.reduce((count, group) => count + group.items.length, 0)

/** Legacy snapshot compatibility; the combined-reading page is no longer registered. */
export const ACTIVE_CROSS_SOURCE_KINDS = [
  'flow-study', 'jyotish', 'western-study', 'qizheng', 'qizheng-lodges',
  'qimen', 'liuren', 'taiyi', 'divination', 'date-selection', 'tarot', 'almanac', 'name-culture',
] as const satisfies readonly CrossSourceKind[]

/** Retired UI routes; stored records and their validators are retained. */
export const CLOSED_PAGE_PATHS = [
  'pages/practice/index', 'pages/seasonal-care/index', 'pages/space/index',
  'pages/bazhai/index', 'pages/physiognomy/index',
  'pages/cross-reading/index',
  'pages/taiyi/index',
  'pages/flow-study/index',
  'pages/western-study/index',
  'pages/liuren/index',
  'pages/qizheng-lodges/index',
  'pages/qizheng/index',
  'pages/qimen/index',
  'pages/date-selection/index',
  'pages/jyotish/index',
  'pages/names/index',
  'pages/tarot/index',
] as const
