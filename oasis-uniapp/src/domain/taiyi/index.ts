export const TAIYI_RULE_VERSION = 'taiyi-jinjing-year-724-v1' as const
export const TAIYI_METHOD = '《太乙金镜式经》四库本 · 岁计 · 724 年锚' as const
export const TAIYI_EPOCH_NOTE = '本版取卷一后文“开元十二年甲子积一百九十三万七千二百八十一”为锚；同卷前段另有“开元十五年甲子”等不同记载，尚未校勘为统一纪元。'
export const TAIYI_YEAR_POLICY = '所求岁年以公元年份标识；只输入岁年，不将具体公历时刻自动归年，不暗定立春、春节或 1 月 1 日年界。'
export interface TaiyiInput { name: string; year: string; sourceNote: string; question: string }
export interface TaiyiCountStep { position: string; amount: number; kind: '正宫' | '间神起一' }
export interface TaiyiCalculation { count: number | null; general: number | null; assistant: number | null; steps: TaiyiCountStep[]; unresolved: string | null }
export interface TaiyiBoard {
  ju: number; dun: '阳'; taiyi: number; palaceYear: number; governance: string
  skyEye: string; skyEyeName: string; strike: string; strikeName: string; calculationSpirit: string
  host: TaiyiCalculation; guest: TaiyiCalculation; status: 'complete' | 'partial'
  palaces: { number: number; trigram: string; position: string; direction: string; markers: string[] }[]
  spirits: { position: string; name: string; markers: string[] }[]
  explanation: string[]
}
export interface TaiyiSnapshot {
  schemaVersion: 1; ruleVersion: typeof TAIYI_RULE_VERSION; method: typeof TAIYI_METHOD; createdAt: string
  input: TaiyiInput; yearPolicy: typeof TAIYI_YEAR_POLICY; epoch: { anchorYear: 724; anchorAccumulated: 1937281; additive: 1936557; note: typeof TAIYI_EPOCH_NOTE }
  accumulated: number; yearGanZhi: string; taiSui: string; combinedSpirit: string; cycle360: number; cycle60: number; cycle72: number; cycle24: number; cycle18: number; ji: number
  divisions: { divisor: number; quotient: number; remainder: number; ordinal: number }[]
  board: TaiyiBoard; sources: { title: string; url: string; usage: string }[]
}
export const TAIYI_SOURCES = [
  { title: '《太乙金镜式经》卷一 · 四库本 3a–4b', url: 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_001.txt', usage: '724 岁年积数锚、局数、太乙、天目、计神；保留同卷纪元文字分歧。' },
  { title: '卷二 · 九宫、十六神与运式法', url: 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_002.txt', usage: '太乙专用九宫编号、始击转盘和主客行算步骤。' },
  { title: '卷三 · 阳局立成表', url: 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_003.txt', usage: '23 个独立固定局式；第 39、50 局主算与步骤有冲突，相关字段留空待校勘。' },
  { title: '卷六 · 十三、二十二局将位例', url: 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_006.txt', usage: '主客大将、参将的独立古例。只核对位置，不采用占断。' },
  { title: '卷九 · 二十五局客算四十例', url: 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_009.txt', usage: '客算四十对应大将四宫、参将二宫，保留与其他实现的区别。' },
] as const

const positions = [...'子丑艮寅卯辰巽巳午未坤申酉戌乾亥']
const spiritNames = ['地主', '阳德', '和德', '吕申', '高丛', '太阳', '大炅', '大神', '大威', '天道', '大武', '武德', '太簇', '阴主', '阴德', '大义']
const branches = [...'子丑寅卯辰巳午未申酉戌亥'], stems = [...'甲乙丙丁戊己庚辛壬癸']
const palacePositions = [...'乾午艮卯中酉坤子巽'], trigrams = [...'乾离艮震中兑坤坎巽']
const directions = ['西北', '南', '东北', '东', '中', '西', '西南', '北', '东南']
const taiyiOrder = [1, 2, 3, 4, 6, 7, 8, 9]
const nameOf = (position: string) => spiritNames[positions.indexOf(position)]
const mod = (value: number, size: number) => ((value % size) + size) % size
const ordinal = (value: number, size: number) => mod(value - 1, size) + 1
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const validInstant = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const validPalace = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9
const spiritPosition = (value: unknown): value is string => typeof value === 'string' && positions.includes(value)
const yearGanZhi = (accumulated: number) => stems[mod(accumulated - 1, 10)] + branches[mod(accumulated - 1, 12)]
const unresolvedCounts: Record<number, { printed: number; calculated: number }> = { 39: { printed: 25, calculated: 35 }, 50: { printed: 6, calculated: 16 } }

export function emptyTaiyiInput(): TaiyiInput { return { name: '', year: '', sourceNote: '', question: '' } }
export function normalizeTaiyiInput(value: unknown): TaiyiInput {
  if (!object(value)) throw new Error('请填写有效的岁计资料')
  const input = emptyTaiyiInput()
  for (const [key, label, maximum] of [['name', '记录名称', 40], ['sourceNote', '底本备注', 200], ['question', '所记事项', 500]] as const) {
    if (typeof value[key] !== 'string' || value[key].trim().length > maximum) throw new Error(`${label}须为不超过 ${maximum} 字的文字`)
    input[key] = value[key].trim()
  }
  if (!input.name) throw new Error('请填写记录名称')
  if (typeof value.year !== 'string' || !/^[1-9]\d{0,3}$/.test(value.year.trim())) throw new Error('请填 1–9999 之间的所求岁年；本版不支持公元前、0 年或具体日期时刻')
  input.year = value.year.trim()
  return input
}

/** Count directly from the book's walking rule; no lookup of the verification table. */
function countFrom(eye: string, taiyi: number): TaiyiCalculation {
  const start = positions.indexOf(eye), destination = positions.indexOf(palacePositions[taiyi - 1]), steps: TaiyiCountStep[] = []
  const firstPalace = palacePositions.indexOf(eye) + 1
  steps.push({ position: eye, amount: firstPalace || 1, kind: firstPalace ? '正宫' : '间神起一' })
  if (start !== destination) {
    for (let cursor = mod(start + 1, 16); cursor !== destination; cursor = mod(cursor + 1, 16)) {
      const palace = palacePositions.indexOf(positions[cursor]) + 1
      if (palace) steps.push({ position: positions[cursor], amount: palace, kind: '正宫' })
    }
  }
  const count = steps.reduce((total, step) => total + step.amount, 0), general = count % 10 || count / 10
  return { count, general, assistant: general * 3 % 10, steps, unresolved: null }
}

/** Pure 阳局 1–72, independently usable for the book's fixed table. */
export function buildTaiyiYangBoard(ju: number): TaiyiBoard {
  if (!Number.isInteger(ju) || ju < 1 || ju > 72) throw new Error('本版只支持 1–72 的金镜阳局')
  const taiyi = taiyiOrder[Math.floor((ordinal(ju, 24) - 1) / 3)], palaceYear = ordinal(ju, 3)
  const skyEyeCycle = positions.slice(11).concat(positions.slice(0, 11)).flatMap(position => position === '乾' || position === '坤' ? [position, position] : [position])
  const skyEye = skyEyeCycle[ordinal(ju, 18) - 1], calculationSpirit = branches[mod(3 - ju, 12)]
  const strike = positions[mod(positions.indexOf(skyEye) + positions.indexOf('艮') - positions.indexOf(calculationSpirit), 16)]
  const host = countFrom(skyEye, taiyi), guest = countFrom(strike, taiyi)
  const conflict = unresolvedCounts[ju]
  if (conflict) {
    host.count = null; host.general = null; host.assistant = null
    host.unresolved = `第 ${ju} 局待校勘：卷三表列主算 ${conflict.printed}，依卷二行算步骤得 ${conflict.calculated}；本版将主算及主将留空，步骤仅供核对。`
  }
  const palaces = palacePositions.map((position, i) => {
    const number = i + 1, markers: string[] = []
    if (number === taiyi) markers.push('太乙')
    if (host.general === number) markers.push('主大将')
    if (host.assistant === number) markers.push('主参将')
    if (guest.general === number) markers.push('客大将')
    if (guest.assistant === number) markers.push('客参将')
    return { number, trigram: trigrams[i], position, direction: directions[i], markers }
  })
  const spirits = positions.map((position, i) => {
    const markers: string[] = []
    if (position === skyEye) markers.push('天目')
    if (position === strike) markers.push('始击')
    if (position === calculationSpirit) markers.push('计神')
    return { position, name: spiritNames[i], markers }
  })
  return {
    ju, dun: '阳', taiyi, palaceYear, governance: ['理天', '理地', '理人'][palaceYear - 1], skyEye, skyEyeName: nameOf(skyEye), strike, strikeName: nameOf(strike), calculationSpirit, host, guest,
    status: conflict ? 'partial' : 'complete', palaces, spirits,
    explanation: [
      `阳局 ${ju}：三年移一宫，按一、二、三、四、六、七、八、九行宫；太乙在${trigrams[taiyi - 1]}${taiyi}宫，第 ${palaceYear} 年。`,
      `天目起武德申，顺行十六神，乾阴德及坤大武各重留一年；第 ${ordinal(ju, 18)} 位为${nameOf(skyEye)}${skyEye}。`,
      `计神从寅逆行十二支，得${calculationSpirit}；以计神加和德艮，天目所临为始击${nameOf(strike)}${strike}。`,
      '主客分别从天目、始击行算：正宫按宫数起，间神起一，顺数经过的正宫，至太乙宫前止；目与太乙同处正宫取本宫数。',
      '大将取算数个位，整十取十位；参将为大将乘三的个位。这里只陈列传统规则位置，不作现实胜负解释。',
    ],
  }
}

export function createTaiyiSnapshot(value: unknown, now = new Date()): TaiyiSnapshot {
  const input = normalizeTaiyiInput(value)
  if (!Number.isFinite(now.getTime())) throw new Error('当前时间不可用，请重试')
  const accumulated = Number(input.year) + 1936557, ganZhi = yearGanZhi(accumulated), taiSui = ganZhi[1]
  const cycle360 = ordinal(accumulated, 360), cycle60 = ordinal(accumulated, 60), cycle72 = ordinal(accumulated, 72), cycle24 = ordinal(accumulated, 24), cycle18 = ordinal(accumulated, 18)
  return {
    schemaVersion: 1, ruleVersion: TAIYI_RULE_VERSION, method: TAIYI_METHOD, createdAt: now.toISOString(), input, yearPolicy: TAIYI_YEAR_POLICY,
    epoch: { anchorYear: 724, anchorAccumulated: 1937281, additive: 1936557, note: TAIYI_EPOCH_NOTE },
    accumulated, yearGanZhi: ganZhi, taiSui, combinedSpirit: branches[mod(1 - branches.indexOf(taiSui), 12)], cycle360, cycle60, cycle72, cycle24, cycle18, ji: Math.floor((cycle360 - 1) / 60) + 1,
    divisions: [360, 72, 24, 18, 60].map(divisor => ({ divisor, quotient: Math.floor(accumulated / divisor), remainder: accumulated % divisor, ordinal: ordinal(accumulated, divisor) })),
    board: buildTaiyiYangBoard(cycle72), sources: TAIYI_SOURCES.map(source => ({ ...source })),
  }
}

/** Check saved shape and links; do not rerun chart generation when opening history. */
export function isTaiyiSnapshot(value: unknown): value is TaiyiSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== TAIYI_RULE_VERSION || value.method !== TAIYI_METHOD || value.yearPolicy !== TAIYI_YEAR_POLICY || !validInstant(value.createdAt)) return false
  try { normalizeTaiyiInput(value.input) } catch { return false }
  const epoch = value.epoch, board = value.board
  if (!object(epoch) || epoch.anchorYear !== 724 || epoch.anchorAccumulated !== 1937281 || epoch.additive !== 1936557 || epoch.note !== TAIYI_EPOCH_NOTE || value.accumulated !== Number(value.input.year) + 1936557 || value.yearGanZhi !== yearGanZhi(value.accumulated) || value.taiSui !== value.yearGanZhi[1] || value.combinedSpirit !== branches[mod(1 - branches.indexOf(value.taiSui), 12)]) return false
  for (const divisor of [360, 60, 72, 24, 18]) if (value[`cycle${divisor}`] !== ordinal(value.accumulated, divisor)) return false
  if (value.ji !== Math.floor((value.cycle360 - 1) / 60) + 1 || !Array.isArray(value.divisions) || value.divisions.length !== 5 || !value.divisions.every((row: any, i: number) => object(row) && row.divisor === [360, 72, 24, 18, 60][i] && row.quotient === Math.floor(value.accumulated / row.divisor) && row.remainder === value.accumulated % row.divisor && row.ordinal === ordinal(value.accumulated, row.divisor))) return false
  if (!object(board) || board.ju !== value.cycle72 || board.dun !== '阳' || !validPalace(board.taiyi) || board.taiyi === 5 || board.palaceYear !== ordinal(board.ju, 3) || board.governance !== ['理天', '理地', '理人'][board.palaceYear - 1] || !spiritPosition(board.skyEye) || board.skyEyeName !== nameOf(board.skyEye) || !spiritPosition(board.strike) || board.strikeName !== nameOf(board.strike) || board.calculationSpirit !== branches[mod(3 - board.ju, 12)]) return false
  if (board.status !== (unresolvedCounts[board.ju] ? 'partial' : 'complete') || !Array.isArray(board.explanation) || !board.explanation.length || !board.explanation.every((line: unknown) => typeof line === 'string' && line.length > 0)) return false
  function validCalculation(calculation: unknown, nullable: boolean): calculation is TaiyiCalculation {
    if (!object(calculation) || !Array.isArray(calculation.steps) || !calculation.steps.length || calculation.steps.length > 8 || !calculation.steps.every((step: any) => object(step) && spiritPosition(step.position) && Number.isInteger(step.amount) && step.amount >= 1 && step.amount <= 9 && ['正宫', '间神起一'].includes(step.kind))) return false
    if (nullable) return calculation.count === null && calculation.general === null && calculation.assistant === null && typeof calculation.unresolved === 'string' && calculation.unresolved.length > 0
    return Number.isInteger(calculation.count) && calculation.count >= 1 && calculation.count <= 40 && calculation.count === calculation.steps.reduce((total: number, step: TaiyiCountStep) => total + step.amount, 0) && validPalace(calculation.general) && calculation.general === (calculation.count % 10 || calculation.count / 10) && validPalace(calculation.assistant) && calculation.assistant === calculation.general * 3 % 10 && calculation.unresolved === null
  }
  if (!validCalculation(board.host, board.status === 'partial') || !validCalculation(board.guest, false)) return false
  if (!Array.isArray(board.palaces) || board.palaces.length !== 9 || !board.palaces.every((cell: any, i: number) => object(cell) && cell.number === i + 1 && cell.trigram === trigrams[i] && cell.position === palacePositions[i] && cell.direction === directions[i] && Array.isArray(cell.markers) && cell.markers.every((marker: unknown) => ['太乙', '主大将', '主参将', '客大将', '客参将'].includes(marker as string)))) return false
  const expectedMarkers = { 太乙: board.taiyi, 主大将: board.host.general, 主参将: board.host.assistant, 客大将: board.guest.general, 客参将: board.guest.assistant }
  for (const [marker, palace] of Object.entries(expectedMarkers)) if (board.palaces.flatMap((cell: any) => cell.markers.filter((entry: string) => entry === marker).map(() => cell.number)).join() !== (palace === null ? '' : String(palace))) return false
  if (!Array.isArray(board.spirits) || board.spirits.length !== 16 || !board.spirits.every((cell: any, i: number) => object(cell) && cell.position === positions[i] && cell.name === spiritNames[i] && Array.isArray(cell.markers) && cell.markers.join() === [cell.position === board.skyEye ? '天目' : '', cell.position === board.strike ? '始击' : '', cell.position === board.calculationSpirit ? '计神' : ''].filter(Boolean).join())) return false
  return Array.isArray(value.sources) && value.sources.length > 0 && value.sources.every(source => object(source) && ['title', 'url', 'usage'].every(key => typeof source[key] === 'string' && source[key].length > 0))
}
