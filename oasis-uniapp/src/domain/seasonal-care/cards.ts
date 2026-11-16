export const SEASONAL_CARE_CONTENT_VERSION = 'seasonal-care-content-v1'
export type CulturalSeason = 'spring' | 'summer' | 'autumn' | 'winter'
export type SeasonalCareTheme = 'all' | 'seasonal' | 'food' | 'movement' | 'routine'
export interface SeasonalCareSource {
  title: string
  author: string
  url: string
  location: string
  publishedAt: string | null
  revision: string | null
  checkedAt: '2026-10-03'
}
export interface SeasonalCareCard {
  id: string
  layer: 'culture' | 'public-health'
  season: CulturalSeason | 'all'
  theme: Exclude<SeasonalCareTheme, 'all'>
  title: string
  excerpt: string
  summary: string
  reflectionPrompt: string
  source: SeasonalCareSource
}
export const SEASONAL_CARE_THEMES = Object.freeze([
  Object.freeze({ id: 'all' as const, label: '全部主题' }), Object.freeze({ id: 'seasonal' as const, label: '四时文化' }),
  Object.freeze({ id: 'food' as const, label: '日常饮食' }), Object.freeze({ id: 'movement' as const, label: '日常活动' }), Object.freeze({ id: 'routine' as const, label: '作息记录' }),
])
export const CULTURAL_SEASON_LABELS = Object.freeze({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' })
/** Four-lì calendar grouping, not local meteorological seasons or a health classification. */
export const CULTURAL_SEASON_TERMS = Object.freeze({
  spring: Object.freeze(['立春', '雨水', '惊蛰', '春分', '清明', '谷雨']),
  summer: Object.freeze(['立夏', '小满', '芒种', '夏至', '小暑', '大暑']),
  autumn: Object.freeze(['立秋', '处暑', '白露', '秋分', '寒露', '霜降']),
  winter: Object.freeze(['立冬', '小雪', '大雪', '冬至', '小寒', '大寒']),
})
const suwen: SeasonalCareSource = {
  title: '《黄帝内经·素问》第一卷', author: '古代医籍汇编；本页不采用单一作者署名',
  url: 'https://zh.wikisource.org/w/index.php?title=黃帝內經/素問第一卷&oldid=2083230',
  location: '四气调神大论篇第二 · 春夏秋冬四段', publishedAt: null, revision: '维基文库文本修订 2083230（2021-10-17）', checkedAt: '2026-10-03',
}
const cards: SeasonalCareCard[] = [
  { id: 'culture-spring', layer: 'culture', season: 'spring', theme: 'seasonal', title: '春 · 读“发陈”', excerpt: '发陈', summary: '篇中以萌发和舒展描写春日。读这段古代四时观，可以从身边植物的变化开始。', reflectionPrompt: '你所在的地方，有哪些新芽、花期或天气变化？', source: suwen },
  { id: 'culture-summer', layer: 'culture', season: 'summer', theme: 'seasonal', title: '夏 · 读“蕃秀”', excerpt: '蕃秀', summary: '篇中借繁茂与生长描写夏日。可把这幅季候图景与当地实际观察并列记录。', reflectionPrompt: '今天的日照、植物和户外环境有什么特点？', source: suwen },
  { id: 'culture-autumn', layer: 'culture', season: 'autumn', theme: 'seasonal', title: '秋 · 读“容平”', excerpt: '容平', summary: '篇中以收敛、安宁描写秋日。这里保留其文化意象，作为观察与整理日常的阅读线索。', reflectionPrompt: '这个时节，你想整理哪一件日常小事？', source: suwen },
  { id: 'culture-winter', layer: 'culture', season: 'winter', theme: 'seasonal', title: '冬 · 读“闭藏”', excerpt: '闭藏', summary: '篇中用闭藏描写冬日。可将古人的季候想象与眼前生活作对照，记下相似和不同。', reflectionPrompt: '你观察到的冬日景象，与这段古文有哪些不同？', source: suwen },
  { id: 'health-food', layer: 'public-health', season: 'all', theme: 'food', title: '日常饮食 · 看整体与多样性', excerpt: '', summary: 'WHO 将健康膳食概括为营养充足、平衡、适量、多样四个原则；具体组合随个人情况、文化和当地食物而异。', reflectionPrompt: '只记录：今天餐食里有哪些不同类别的食物？', source: { title: 'Healthy diet', author: '世界卫生组织（WHO）', url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet', location: 'Overview · four principles', publishedAt: '2026-01-26', revision: null, checkedAt: '2026-10-03' } },
  { id: 'health-movement', layer: 'public-health', season: 'all', theme: 'movement', title: '日常活动 · 看见已有的活动', excerpt: '', summary: 'WHO 把通勤、家务和休闲中的身体活动都纳入讨论，并强调有活动好过完全不动。活动安排须结合实际能力与环境。', reflectionPrompt: '今天做过哪些适合自己的活动？也可以如实记下休息。', source: { title: 'Physical activity', author: '世界卫生组织（WHO）', url: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity', location: 'Overview；How much physical activity is recommended?', publishedAt: '2024-06-26', revision: null, checkedAt: '2026-10-03' } },
  { id: 'health-routine', layer: 'public-health', season: 'all', theme: 'routine', title: '作息记录 · 留意时间与睡眠质量', excerpt: '', summary: 'CDC 建议尽量每天在相近时间入睡和起床；睡眠需要随年龄变化，质量同样重要。作息笔记可以帮助自己看见习惯。', reflectionPrompt: '今天的起居节奏怎样？写下想保留或调整的一件事。', source: { title: 'About Sleep', author: '美国疾病控制与预防中心（CDC）', url: 'https://www.cdc.gov/sleep/about/index.html', location: 'Key points；What to do；Sleep quality', publishedAt: '2024-05-15', revision: null, checkedAt: '2026-10-03' } },
]
export const SEASONAL_CARE_CARDS: readonly Readonly<SeasonalCareCard>[] = Object.freeze(cards.map(card => Object.freeze({ ...card, source: Object.freeze({ ...card.source }) })))
export function culturalSeasonForTerm(term: string): CulturalSeason {
  const season = (Object.keys(CULTURAL_SEASON_TERMS) as CulturalSeason[]).find(key => (CULTURAL_SEASON_TERMS[key] as readonly string[]).includes(term))
  if (!season) throw new Error('节气名称不在本版四时目录内。')
  return season
}
export function selectSeasonalCareCards(season: CulturalSeason, theme: SeasonalCareTheme): SeasonalCareCard[] {
  if (!Object.prototype.hasOwnProperty.call(CULTURAL_SEASON_TERMS, season) || !SEASONAL_CARE_THEMES.some(option => option.id === theme)) throw new Error('请选择有效的季节与主题。')
  return SEASONAL_CARE_CARDS.filter(card => (card.season === 'all' || card.season === season) && (theme === 'all' || card.theme === theme)).map(card => ({ ...card, source: { ...card.source } }))
}
