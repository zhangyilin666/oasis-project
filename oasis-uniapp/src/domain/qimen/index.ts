import { LunarUtil, Solar } from 'lunar-typescript'

export const QIMEN_RULE_VERSION = 'qimen-zhuanpan-chaibu-kun2-v1' as const
export const QIMEN_METHOD = '时家转盘 · 拆补 · 中五寄坤二' as const
export type Dun = 'yang' | 'yin'
export interface QimenInput { name: string; date: string; time: string; utcOffsetMinutes: number; locationNote: string; question: string }
export interface QimenPalace { palace: number; name: string; direction: string; earth: string; heaven: string; star: string; gate: string; god: string; earthGuest: string; heavenGuest: string }
export interface QimenBoard {
  dun: Dun; ju: number; hour: string; xun: string; hiddenStem: string; xunPalace: number
  chiefStar: string; chiefPalace: number; chiefGate: string; gatePalace: number; gateRawPalace: number
  palaces: QimenPalace[]
}
export interface QimenSnapshot {
  schemaVersion: 1; ruleVersion: typeof QIMEN_RULE_VERSION; method: typeof QIMEN_METHOD; createdAt: string
  input: QimenInput; instant: string; referenceTime: string; calendarVersion: 'lunar-typescript@1.8.6'
  timePolicy: 'UTC+08:00-clock-zi23'; term: string; termAt: string; nextTerm: string; nextTermAt: string
  year: string; month: string; day: string; fuTou: string; yuan: string; board: QimenBoard
  sources: { title: string; url: string; usage: string }[]
}
export const QIMEN_SOURCES = [
  { title: '《遁甲演义》卷一', url: 'https://zh.wikisource.org/wiki/遁甲演義', usage: '传统局歌与转盘规则参考；本项目独立实现，无断语。' },
  { title: '时问奇门：完整阳遁教学盘', url: 'https://www.askqimen.com/zh-CN/knowledge/qimen-dunjia-charting-steps', usage: '2024-01-01 12:00 全九宫测试参考；未复制网站程序或文章。' },
  { title: '玄霖易学：阴遁中五值符例', url: 'https://xuanlinyi.com/article_detail?id=299569', usage: '2004-11-19 09:58 全九宫测试参考；核对中五计数与阴遁神序。' },
  { title: 'lunar-typescript 1.8.6', url: 'https://github.com/6tail/lunar-typescript', usage: 'MIT；仅负责历法与节气，奇门布盘由本项目实现。' },
] as const

const stems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']
const ring = [1, 8, 3, 4, 9, 2, 7, 6]
const stars = ['', '天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英']
const gates = ['', '休门', '死门', '伤门', '杜门', '', '开门', '惊门', '生门', '景门']
const gods = ['值符', '腾蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天']
const palaceNames = ['', '坎一', '坤二', '震三', '巽四', '中五', '乾六', '兑七', '艮八', '离九']
const directions = ['', '北', '西南', '东', '东南', '中', '西北', '西', '东北', '南']
const terms: Record<string, [Dun, number, number, number]> = {
  冬至: ['yang', 1, 7, 4], 小寒: ['yang', 2, 8, 5], 大寒: ['yang', 3, 9, 6],
  立春: ['yang', 8, 5, 2], 雨水: ['yang', 9, 6, 3], 惊蛰: ['yang', 1, 7, 4],
  春分: ['yang', 3, 9, 6], 清明: ['yang', 4, 1, 7], 谷雨: ['yang', 5, 2, 8],
  立夏: ['yang', 4, 1, 7], 小满: ['yang', 5, 2, 8], 芒种: ['yang', 6, 3, 9],
  夏至: ['yin', 9, 3, 6], 小暑: ['yin', 8, 5, 2], 大暑: ['yin', 7, 1, 4],
  立秋: ['yin', 2, 5, 8], 处暑: ['yin', 1, 4, 7], 白露: ['yin', 9, 3, 6],
  秋分: ['yin', 7, 1, 4], 寒露: ['yin', 6, 9, 3], 霜降: ['yin', 5, 8, 2],
  立冬: ['yin', 6, 9, 3], 小雪: ['yin', 5, 8, 2], 大雪: ['yin', 4, 7, 1],
}
const mod = (n: number, size: number) => ((n % size) + size) % size
const hosted = (palace: number) => palace === 5 ? 2 : palace
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const validInstant = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const validPalace = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9
const validGanZhi = (value: unknown): value is string => typeof value === 'string' && value.length === 2 && LunarUtil.getJiaZiIndex(value) >= 0

export function emptyQimenInput(): QimenInput { return { name: '', date: '', time: '', utcOffsetMinutes: 480, locationNote: '', question: '' } }
export function formatOffset(minutes: number) { return `UTC${minutes < 0 ? '−' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}` }

export function normalizeQimenInput(input: unknown): QimenInput {
  if (!object(input)) throw new Error('请填写有效的起盘资料')
  const result = emptyQimenInput()
  for (const [key, label, maximum] of [['name', '记录名称', 40], ['locationNote', '地点备注', 200], ['question', '所记事项', 500]] as const) {
    if (typeof input[key] !== 'string' || input[key].trim().length > maximum) throw new Error(`${label}须为不超过 ${maximum} 字的文字`)
    result[key] = input[key].trim()
  }
  if (!result.name) throw new Error('请填写记录名称')
  if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < '1900-01-01' || input.date > '2099-12-31') throw new Error('请选择 1900–2099 年内的公历日期')
  if (typeof input.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(input.time)) throw new Error('时间须为有效的 HH:mm 或 HH:mm:ss，24:00 请改填次日 00:00')
  result.date = input.date; result.time = input.time.length === 5 ? `${input.time}:00` : input.time
  const wall = new Date(`${result.date}T${result.time}.000Z`)
  if (!Number.isFinite(wall.getTime()) || wall.toISOString().slice(0, 10) !== result.date) throw new Error('公历日期不存在，请重新选择')
  if (typeof input.utcOffsetMinutes !== 'number' || !Number.isInteger(input.utcOffsetMinutes) || input.utcOffsetMinutes < -720 || input.utcOffsetMinutes > 840 || input.utcOffsetMinutes % 15 !== 0) throw new Error('请明确选择 UTC−12:00 至 UTC+14:00 内的时区偏移（15 分钟为单位）')
  result.utcOffsetMinutes = input.utcOffsetMinutes
  const reference = new Date(wall.getTime() + (480 - result.utcOffsetMinutes) * 60000)
  if (reference.getUTCFullYear() < 1900 || reference.getUTCFullYear() > 2099) throw new Error('换算至 UTC+08:00 后超出 1900–2099 年支持范围')
  return result
}

/** Pure rotating-board rules, independent of the calendar adapter. */
export function buildQimenBoard(dun: Dun, ju: number, hour: string): QimenBoard {
  if (!['yang', 'yin'].includes(dun) || !validPalace(ju) || !validGanZhi(hour)) throw new Error('遁别、局数或时柱无效')
  const direction = dun === 'yang' ? 1 : -1
  const hourIndex = LunarUtil.getJiaZiIndex(hour)
  const xunIndex = Math.floor(hourIndex / 10)
  const hiddenStem = stems[xunIndex]
  const earth = Array<string>(10).fill('')
  stems.forEach((stem, index) => { earth[mod(ju - 1 + direction * index, 9) + 1] = stem })
  const xunPalace = earth.indexOf(hiddenStem)
  const hourStem = hour[0] === '甲' ? hiddenStem : hour[0]
  const chiefPalace = hosted(earth.indexOf(hourStem))
  const origin = hosted(xunPalace)
  const starShift = mod(ring.indexOf(chiefPalace) - ring.indexOf(origin), 8)
  const gateRawPalace = mod(xunPalace - 1 + direction * (hourIndex % 10), 9) + 1
  const gatePalace = hosted(gateRawPalace)
  const gateShift = mod(ring.indexOf(gatePalace) - ring.indexOf(origin), 8)
  const palaces: QimenPalace[] = Array.from({ length: 9 }, (_, index) => {
    const palace = index + 1
    return { palace, name: palaceNames[palace], direction: directions[palace], earth: earth[palace], heaven: '', star: '', gate: '', god: '', earthGuest: palace === 2 ? earth[5] : '', heavenGuest: '' }
  })
  ring.forEach((source, index) => {
    const starTarget = palaces[ring[mod(index + starShift, 8)] - 1]
    starTarget.heaven = earth[source]
    starTarget.star = source === 2 ? '天芮、天禽' : stars[source]
    if (source === 2) starTarget.heavenGuest = earth[5]
    palaces[ring[mod(index + gateShift, 8)] - 1].gate = gates[source]
    palaces[ring[mod(ring.indexOf(chiefPalace) + direction * index, 8)] - 1].god = gods[index]
  })
  return { dun, ju, hour, xun: LunarUtil.JIA_ZI[xunIndex * 10], hiddenStem, xunPalace, chiefStar: stars[xunPalace], chiefPalace, chiefGate: gates[origin], gatePalace, gateRawPalace, palaces }
}

export function createQimenSnapshot(value: unknown, now = new Date()): QimenSnapshot {
  const input = normalizeQimenInput(value)
  if (!Number.isFinite(now.getTime())) throw new Error('当前时间不可用，请重试')
  const instant = new Date(Date.parse(`${input.date}T${input.time}.000Z`) - input.utcOffsetMinutes * 60000)
  const reference = new Date(instant.getTime() + 480 * 60000)
  const lunar = Solar.fromYmdHms(reference.getUTCFullYear(), reference.getUTCMonth() + 1, reference.getUTCDate(), reference.getUTCHours(), reference.getUTCMinutes(), reference.getUTCSeconds()).getLunar()
  const previous = lunar.getPrevJieQi(false), next = lunar.getNextJieQi(false)
  const term = previous.getName(), termRule = terms[term]
  if (!termRule) throw new Error('当前节气不在本版规则表中，未生成盘面')
  const day = lunar.getDayInGanZhiExact()
  const dayIndex = LunarUtil.getJiaZiIndex(day)
  const fuTou = LunarUtil.JIA_ZI[Math.floor(dayIndex / 5) * 5]
  const yuanIndex = '子午卯酉'.includes(fuTou[1]) ? 0 : '寅申巳亥'.includes(fuTou[1]) ? 1 : 2
  const ju = termRule[yuanIndex + 1] as number
  return {
    schemaVersion: 1, ruleVersion: QIMEN_RULE_VERSION, method: QIMEN_METHOD, createdAt: now.toISOString(), input,
    instant: instant.toISOString(), referenceTime: reference.toISOString().slice(0, 19).replace('T', ' '),
    calendarVersion: 'lunar-typescript@1.8.6', timePolicy: 'UTC+08:00-clock-zi23',
    term, termAt: previous.getSolar().toYmdHms(), nextTerm: next.getName(), nextTermAt: next.getSolar().toYmdHms(),
    year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(), day, fuTou, yuan: ['上元', '中元', '下元'][yuanIndex],
    board: buildQimenBoard(termRule[0], ju, lunar.getTimeInGanZhi()), sources: QIMEN_SOURCES.map(source => ({ ...source })),
  }
}

/** Validates the persisted shape and internal links only; never recalculates history. */
export function isQimenSnapshot(value: unknown): value is QimenSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== QIMEN_RULE_VERSION || value.method !== QIMEN_METHOD || value.calendarVersion !== 'lunar-typescript@1.8.6' || value.timePolicy !== 'UTC+08:00-clock-zi23' || !validInstant(value.createdAt) || !validInstant(value.instant)) return false
  try { normalizeQimenInput(value.input) } catch { return false }
  if (!terms[value.term] || !terms[value.nextTerm] || !['上元', '中元', '下元'].includes(value.yuan) || ![value.year, value.month, value.day, value.fuTou].every(validGanZhi)) return false
  if (![value.referenceTime, value.termAt, value.nextTermAt].every(text => typeof text === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) && Number.isFinite(Date.parse(text.replace(' ', 'T') + '+08:00')))) return false
  const board = value.board
  if (!object(board) || !['yang', 'yin'].includes(board.dun) || ![board.ju, board.xunPalace, board.chiefPalace, board.gatePalace, board.gateRawPalace].every(validPalace) || !validGanZhi(board.hour) || !validGanZhi(board.xun) || !stems.slice(0, 6).includes(board.hiddenStem) || !stars.filter(Boolean).includes(board.chiefStar) || !gates.filter(Boolean).includes(board.chiefGate) || !Array.isArray(board.palaces) || board.palaces.length !== 9) return false
  const cells = board.palaces as QimenPalace[]
  if (!cells.every((cell, index) => object(cell) && cell.palace === index + 1 && cell.name === palaceNames[index + 1] && cell.direction === directions[index + 1] && stems.includes(cell.earth) && ['heaven', 'star', 'gate', 'god', 'earthGuest', 'heavenGuest'].every(key => typeof (cell as any)[key] === 'string'))) return false
  const center = cells[4], outer = cells.filter(cell => cell.palace !== 5)
  if ([center.heaven, center.star, center.gate, center.god, center.earthGuest, center.heavenGuest].some(Boolean)) return false
  if (new Set(cells.map(cell => cell.earth)).size !== 9 || new Set(outer.map(cell => cell.heaven)).size !== 8 || new Set(outer.map(cell => cell.star)).size !== 8 || new Set(outer.map(cell => cell.gate)).size !== 8 || new Set(outer.map(cell => cell.god)).size !== 8) return false
  if (!outer.every(cell => stems.includes(cell.heaven) && cell.heaven !== center.earth && [...stars.filter(star => star && !['天芮', '天禽'].includes(star)), '天芮、天禽'].includes(cell.star) && gates.filter(Boolean).includes(cell.gate) && gods.includes(cell.god) && cell.earthGuest === (cell.palace === 2 ? center.earth : '') && cell.heavenGuest === (cell.star === '天芮、天禽' ? center.earth : ''))) return false
  if (board.chiefPalace === 5 || board.gatePalace === 5 || !cells[board.chiefPalace - 1].star.includes(board.chiefStar) || cells[board.chiefPalace - 1].god !== '值符' || cells[board.gatePalace - 1].gate !== board.chiefGate || board.gatePalace !== hosted(board.gateRawPalace)) return false
  return Array.isArray(value.sources) && value.sources.length > 0 && value.sources.every(source => object(source) && ['title', 'url', 'usage'].every(key => typeof source[key] === 'string' && source[key].length > 0))
}
