import { CIRCLE_ARCSECONDS, LODGE_ANNUAL_SHIFT_ARCSECONDS, LODGE_BASE_TABLE, LODGE_BASE_YEAR, LODGE_TABLE_SOURCE, LODGE_TABLE_VERSION } from './table'

export const QIZHENG_LODGES_RULE_VERSION = 'qing-ecliptic-lodge-table-lookup-v1' as const
export const LODGE_MIN_YEAR = 1684
export const LODGE_MAX_YEAR = 2099
export interface PalaceAngle { palace: number; degree: number; minute: number; second: number }
export interface QizhengLodgesInput extends PalaceAngle { yearLabel: number; label: string }
export const QIZHENG_LODGES_SOURCES = [
  { id: 'table', title: '《历象考成》表卷十四 · 原始黄道宿钤与算例', url: LODGE_TABLE_SOURCE, version: '四库本 · 康熙甲子1684年标号；11幅表图逐项核录', license: '古籍原文公版；本页仅原创转录数值，不打包网站图片或现代译文' },
  { id: 'method', title: '《历象考成》· 七政宿度算法', url: 'https://www.shidianguji.com/book/SK1530/chapter/1la1uvjpyqx3d', version: '上编恒星历理 · 每年黄道经度加51角秒', license: '古籍公版；原创摘要与公式实现' },
  { id: 'cases', title: '《清史稿》· 康熙甲子十二宫初度值宿', url: 'https://www.shidianguji.com/book/LS0025/chapter/1kt95doojkysp', version: '10项吻合；室、房两项异文保留说明', license: '古籍公版；只引用数值与来源' },
  { id: 'units', title: '《五礼通考》· 宫度单位与冬至起点', url: 'https://www.shidianguji.com/book/SK0367/chapter/1lcuu30rfqpsj', version: '卷195 · 初宫冬至、每宫30°、六十进位；不混入其异数宿表', license: '古籍公版；原创摘要，不打包网站内容' },
] as const
const integer = (value: number, minimum: number, maximum: number) => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
const wrap = (value: number) => ((value % CIRCLE_ARCSECONDS) + CIRCLE_ARCSECONDS) % CIRCLE_ARCSECONDS
function validateYear(year: number) { if (!integer(year, LODGE_MIN_YEAR, LODGE_MAX_YEAR)) throw new Error('宿钤年标号须为1684–2099之间的整数；这是本页支持范围') }

export function palaceAngleToArcseconds(angle: PalaceAngle): number {
  if (!angle || !integer(angle.palace, 0, 11) || !integer(angle.degree, 0, 29) || !integer(angle.minute, 0, 59) || !integer(angle.second, 0, 59)) throw new Error('请完整填写黄道宫度：宫为0–11，度为0–29，分和秒为0–59的整数')
  return (angle.palace * 30 + angle.degree) * 3600 + angle.minute * 60 + angle.second
}
export function splitPalaceArcseconds(value: number): PalaceAngle {
  if (!integer(value, 0, CIRCLE_ARCSECONDS - 1)) throw new Error('黄道角秒须为一周内的非负整数')
  return { palace: Math.floor(value / 108000), degree: Math.floor(value % 108000 / 3600), minute: Math.floor(value % 3600 / 60), second: value % 60 }
}
export function formatPalaceArcseconds(value: number): string {
  const angle = splitPalaceArcseconds(value)
  return `${angle.palace === 0 ? '初' : angle.palace}宫 ${angle.degree}°${String(angle.minute).padStart(2, '0')}′${String(angle.second).padStart(2, '0')}″`
}
export function formatLodgeArcseconds(value: number): string {
  if (!integer(value, 0, CIRCLE_ARCSECONDS)) throw new Error('宿内角秒须为非负整数且不超过一周')
  return `${Math.floor(value / 3600)}°${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}′${String(value % 60).padStart(2, '0')}″`
}
export function buildLodgeTable(yearLabel: number) {
  validateYear(yearLabel)
  const shiftArcseconds = (yearLabel - LODGE_BASE_YEAR) * LODGE_ANNUAL_SHIFT_ARCSECONDS
  return LODGE_BASE_TABLE.map((row, index) => {
    const next = LODGE_BASE_TABLE[(index + 1) % LODGE_BASE_TABLE.length]
    const startArcseconds = wrap(row.startArcseconds + shiftArcseconds)
    const endArcseconds = wrap(next.startArcseconds + shiftArcseconds)
    return { name: row.name, referenceStar: row.referenceStar, sourceFigure: row.figure, baseStartArcseconds: row.startArcseconds, startArcseconds, endArcseconds, widthArcseconds: wrap(next.startArcseconds - row.startArcseconds), nextMansion: next.name }
  })
}

/** This is a historical table lookup from explicit numbers, not an ephemeris or a birth chart. */
export function calculateQizhengLodges(input: QizhengLodgesInput) {
  if (!input || typeof input.label !== 'string' || !input.label.trim() || input.label.trim().length > 30) throw new Error('查算对象名称须为1–30个字')
  validateYear(input.yearLabel)
  const angleArcseconds = palaceAngleToArcseconds(input)
  const table = buildLodgeTable(input.yearLabel)
  const selected = table.find(row => wrap(angleArcseconds - row.startArcseconds) < row.widthArcseconds)
  if (!selected) throw new Error('宿钤区间未能覆盖输入角度')
  const withinArcseconds = wrap(angleArcseconds - selected.startArcseconds)
  return {
    schemaVersion: 1 as const, ruleVersion: QIZHENG_LODGES_RULE_VERSION, scope: 'historical-ecliptic-lodge-table-lookup' as const,
    input: { label: input.label.trim(), yearLabel: input.yearLabel, palace: input.palace, degree: input.degree, minute: input.minute, second: input.second },
    rules: { tableVersion: LODGE_TABLE_VERSION, epochYearLabel: LODGE_BASE_YEAR, epochName: '康熙二十三年甲子' as const, yearKind: 'explicit-historical-year-label' as const, origin: 'winter-solstice' as const, originInModernLongitude: 270 as const, circleDegrees: 360 as const, palaceDegrees: 30 as const, angleBase: 60 as const, annualShiftArcseconds: LODGE_ANNUAL_SHIFT_ARCSECONDS, interval: 'start-inclusive-end-exclusive' as const },
    yearsFromEpoch: input.yearLabel - LODGE_BASE_YEAR,
    shiftArcseconds: (input.yearLabel - LODGE_BASE_YEAR) * LODGE_ANNUAL_SHIFT_ARCSECONDS,
    angleArcseconds,
    // A coordinate-origin conversion only; no modern star positions are inferred.
    vernalOriginArcseconds: wrap(angleArcseconds + 270 * 3600),
    table,
    result: { mansion: selected.name, referenceStar: selected.referenceStar, nextMansion: selected.nextMansion, startArcseconds: selected.startArcseconds, endArcseconds: selected.endArcseconds, withinArcseconds, remainingArcseconds: selected.widthArcseconds - withinArcseconds, widthArcseconds: selected.widthArcseconds, atBoundary: withinArcseconds === 0 },
    conventions: [
      '固定采用《御制历象考成》表卷十四的康熙甲子黄道宿钤，逐宿以该书第一星为界；二十八宿宽度不相等。',
      '输入年是明确指定的宿钤年标号，1684代表康熙二十三年甲子。这里不从公历日期、春节或冬至自动判断古历年界。',
      '原书初宫初度从冬至点起算；每宫30°，周天360°，度分秒均为六十进位。换为春分点零度只加270°并取一周余数。',
      '各宿起点统一加上（所填年标号−1684）×51角秒。只作整年推移，不暗加月、日或时刻的比例修正。',
      '每宿包含本宿起点、不包含下一宿起点，计算全用整数角秒；原表只列到分，显示秒是运算位数，不代表秒级测量准确度。',
      '本底本宫度顺序是参前觜后，保留原表，不替换为其他年代的距星顺序。',
    ],
    limitations: [
      '这是古法黄道宿钤查算，不是完整七政四余命盘；不计算现代星历、赤道入宿度、立命或运限。',
      input.yearLabel === 1684 ? '当前使用原表基准年标号，未作年移。' : '当前按底本的51角秒/年规则推移；没有核对该岁年实测或修订宿表，不能解释为该年的真实距星位置。',
      '参考《清史稿》的十二宫初度值宿时，10项与本底本吻合；室、房两项分别相差4分和10分。程序保留本底本数值，未拼合异文。',
      '罗睺、计都、月孛、紫气的传统位置均未在本页核算，也不以其他天体或西方交点代替。',
    ],
    sources: QIZHENG_LODGES_SOURCES.map(source => ({ ...source })),
  }
}
export type QizhengLodgesSnapshot = ReturnType<typeof calculateQizhengLodges>
