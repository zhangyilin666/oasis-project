import { LunarUtil, Solar } from 'lunar-typescript'

export const LIUREN_RULE_VERSION = 'liuren-daqquan-jiuzong-v1' as const
export const LIUREN_METHOD = '大六壬 · 九宗门 · 中气换将' as const
export const LIUREN_BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥']
export const LIUREN_DAYS = [...LunarUtil.JIA_ZI]
export interface LiurenInput { name: string; mode: 'calendar' | 'manual'; date: string; time: string; utcOffsetMinutes: number; day: string; general: string; hour: string; locationNote: string; question: string }
export interface LiurenLesson { lower: string; upper: string; relation: '下贼上' | '上克下' | '无克' }
export interface LiurenBoard {
  day: string; general: string; hour: string; shift: number; dayPeriod: '昼' | '夜'; noble: string; nobleDirection: '顺' | '逆'
  palaces: { earth: string; heaven: string; god: string; empty: boolean }[]
  lessons: LiurenLesson[]; transmissions: string[]; method: string; status: 'complete' | 'unsupported'; explanation: string[]; xun: string; voids: string[]
}
export interface LiurenSnapshot {
  schemaVersion: 1; ruleVersion: typeof LIUREN_RULE_VERSION; method: typeof LIUREN_METHOD; createdAt: string; input: LiurenInput
  calendar: null | { instant: string; referenceTime: string; year: string; month: string; hour: string; qi: string; qiAt: string; nextQi: string; nextQiAt: string; timePolicy: 'UTC+08:00-clock-zi23'; version: 'lunar-typescript@1.8.6' }
  board: LiurenBoard; sources: { title: string; url: string; usage: string }[]
}
export const LIUREN_SOURCES = [
  { title: '《六壬大全》卷七', url: 'https://zh.wikisource.org/zh-hans/六壬大全/7', usage: '九宗门古例与涉害《订讹》；固定测试先于本项目规则实现。' },
  { title: '《六壬大全》卷一', url: 'https://zh.wikisource.org/zh-hant/六壬大全/1', usage: '月将、寄宫、四课及起传规则。' },
  { title: '《大六壬探原》', url: 'https://www.dao-mind.com/zh-HK/library/liuren/daliuren-tanyuan', usage: '中气换将及阴别责古例；只参考规则与事实数据。' },
  { title: 'lunar-typescript 1.8.6', url: 'https://github.com/6tail/lunar-typescript', usage: 'MIT；仅用于历法、中气和干支，本项目独立实现六壬布盘。' },
] as const
const branches = LIUREN_BRANCHES, stems = [...'甲乙丙丁戊己庚辛壬癸']
const lodge = [...'寅辰巳未巳未申戌亥丑']
const gods = ['贵人', '腾蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后']
const punish = [...'卯戌巳子辰申午丑寅酉未亥']
const generalByQi: Record<string, string> = { 雨水: '亥', 春分: '戌', 谷雨: '酉', 小满: '申', 夏至: '未', 大暑: '午', 处暑: '巳', 秋分: '辰', 霜降: '卯', 小雪: '寅', 冬至: '丑', 大寒: '子' }
const elements = ['甲乙寅卯', '丙丁巳午', '戊己丑辰未戌', '庚辛申酉', '壬癸亥子']
const element = (value: string) => elements.findIndex(group => group.includes(value))
const controls = (a: string, b: string) => (element(a) + 2) % 5 === element(b)
const mod = (value: number) => ((value % 12) + 12) % 12
const index = (value: string) => branches.indexOf(value)
const yang = (value: string) => (stems.includes(value) ? stems.indexOf(value) : index(value)) % 2 === 0
const unique = (values: string[]) => [...new Set(values)]
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const validDay = (value: unknown): value is string => typeof value === 'string' && LunarUtil.getJiaZiIndex(value) >= 0
const validBranch = (value: unknown): value is string => typeof value === 'string' && branches.includes(value)
const validInstant = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value

export function emptyLiurenInput(): LiurenInput { return { name: '', mode: 'calendar', date: '', time: '', utcOffsetMinutes: 480, day: '', general: '', hour: '', locationNote: '', question: '' } }
export function formatLiurenOffset(minutes: number) { return `UTC${minutes < 0 ? '−' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}` }
export function normalizeLiurenInput(value: unknown): LiurenInput {
  if (!object(value) || !['calendar', 'manual'].includes(value.mode)) throw new Error('请选择公历起课或古例核对')
  const input = emptyLiurenInput(); input.mode = value.mode
  for (const [key, label, maximum] of [['name', '记录名称', 40], ['locationNote', '地点备注', 200], ['question', '所记事项', 500]] as const) {
    if (typeof value[key] !== 'string' || value[key].trim().length > maximum) throw new Error(`${label}须为不超过 ${maximum} 字的文字`)
    input[key] = value[key].trim()
  }
  if (!input.name) throw new Error('请填写记录名称')
  if (input.mode === 'manual') {
    if (!validDay(value.day) || !validBranch(value.general) || !validBranch(value.hour)) throw new Error('请选择合法的六十甲子日、月将和占时')
    input.day = value.day; input.general = value.general; input.hour = value.hour
    return input
  }
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || value.date < '1900-01-01' || value.date > '2099-12-31') throw new Error('日期须为 1900–2099 年内的 YYYY-MM-DD')
  if (typeof value.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value.time)) throw new Error('时间须为 HH:mm 或 HH:mm:ss；24:00 请改为次日 00:00')
  input.date = value.date; input.time = value.time.length === 5 ? `${value.time}:00` : value.time
  const wall = new Date(`${input.date}T${input.time}.000Z`)
  if (!Number.isFinite(wall.getTime()) || wall.toISOString().slice(0, 10) !== input.date) throw new Error('公历日期不存在')
  if (typeof value.utcOffsetMinutes !== 'number' || !Number.isInteger(value.utcOffsetMinutes) || value.utcOffsetMinutes < -720 || value.utcOffsetMinutes > 840 || value.utcOffsetMinutes % 15 !== 0) throw new Error('请选择 UTC−12:00 至 UTC+14:00 内的时区偏移（15 分钟为单位）')
  input.utcOffsetMinutes = value.utcOffsetMinutes
  const reference = new Date(wall.getTime() + (480 - input.utcOffsetMinutes) * 60000)
  if (reference.getUTCFullYear() < 1900 || reference.getUTCFullYear() > 2099) throw new Error('换算至 UTC+08:00 后超出支持年份')
  return input
}

/** Pure month-general/hour board, usable for ancient examples without inventing dates. */
export function buildLiurenBoard(day: string, general: string, hour: string): LiurenBoard {
  if (!validDay(day) || !validBranch(general) || !validBranch(hour)) throw new Error('日干支、月将或占时无效')
  const stem = day[0], dayBranch = day[1], shift = mod(index(general) - index(hour)), dayIsYang = yang(stem)
  const sky = (earth: string) => branches[mod(index(earth) + shift)]
  const earth = (heaven: string) => branches[mod(index(heaven) - shift)]
  const first = sky(lodge[stems.indexOf(stem)]), third = sky(dayBranch)
  const lessons: LiurenLesson[] = [[stem, first], [first, sky(first)], [dayBranch, third], [third, sky(third)]].map(([lower, upper]) => ({ lower, upper, relation: controls(lower, upper) ? '下贼上' : controls(upper, lower) ? '上克下' : '无克' }))
  const explanation: string[] = [], dayPeriod = index(hour) >= 3 && index(hour) <= 8 ? '昼' : '夜'
  const noblePair = '甲戊庚'.includes(stem) ? '丑未' : '乙己'.includes(stem) ? '子申' : '丙丁'.includes(stem) ? '亥酉' : '壬癸'.includes(stem) ? '巳卯' : '午寅'
  const noble = noblePair[dayPeriod === '昼' ? 0 : 1], nobleEarth = index(earth(noble))
  const direction = nobleEarth <= 4 || nobleEarth === 11 ? 1 : -1
  const dayIndex = LunarUtil.getJiaZiIndex(day), xun = LunarUtil.JIA_ZI[Math.floor(dayIndex / 10) * 10]
  const voids = [branches[mod(index(xun[1]) + 10)], branches[mod(index(xun[1]) + 11)]]
  const palaces = branches.map((branch, i) => ({ earth: branch, heaven: sky(branch), god: gods[mod((i - nobleEarth) * direction)], empty: voids.includes(sky(branch)) }))
  let method = '', transmissions: string[] = [], status: 'complete' | 'unsupported' = 'complete'
  const chain = (initial: string) => [initial, sky(initial), sky(sky(initial))]
  const lowerHarms = unique(lessons.filter(lesson => lesson.relation === '下贼上').map(lesson => lesson.upper))
  const upperHarms = unique(lessons.filter(lesson => lesson.relation === '上克下').map(lesson => lesson.upper))
  const candidates = lowerHarms.length ? lowerHarms : upperHarms
  function selectDirect(): { initial: string; method: string } {
    if (candidates.length === 1) { explanation.push(lowerHarms.length ? '四课有下贼上，优先取唯一受克上神。' : '四课无下贼上，取唯一上克下之上神。'); return { initial: candidates[0], method: '贼克' } }
    let compared = candidates.filter(candidate => yang(candidate) === dayIsYang)
    if (compared.length === 1) { explanation.push('多个克取候选中，取与日干阴阳相同的唯一上神。'); return { initial: compared[0], method: '比用' } }
    if (!compared.length) compared = candidates
    const scores = compared.map(candidate => {
      const origin = index(earth(candidate)), home = index(candidate)
      let count = 0
      // 《订讹》 examples count only the intervening locations, excluding departure and home.
      for (let position = mod(origin + 1); position !== home; position = mod(position + 1)) {
        const encountered = [branches[position], ...stems.filter((_, i) => lodge[i] === branches[position])]
        count += encountered.filter(symbol => lowerHarms.length ? controls(symbol, candidate) : controls(candidate, symbol)).length
      }
      return { candidate, count, rank: '寅申巳亥'.includes(branches[origin]) ? 2 : '子午卯酉'.includes(branches[origin]) ? 1 : 0 }
    })
    const depth = Math.max(...scores.map(item => item.count)), deepest = scores.filter(item => item.count === depth)
    const rank = Math.max(...deepest.map(item => item.rank)), finalists = deepest.filter(item => item.rank === rank).map(item => item.candidate)
    const order = dayIsYang ? [0, 1, 2, 3] : [2, 3, 0, 1]
    const initial = order.map(i => lessons[i].upper).find(candidate => finalists.includes(candidate))!
    explanation.push(`涉害途中地支与寄干分别计数（不计出发与归家）：${scores.map(item => `${item.candidate}${item.count}重`).join('、')}。同深先孟、仲、季，再阳先干课、阴先支课。`)
    return { initial, method: '涉害' }
  }
  if (shift === 0) {
    method = '伏吟'
    const initial = candidates.length ? selectDirect().initial : dayIsYang ? first : third
    const middle = punish[index(initial)] === initial ? (initial === first ? third : first) : punish[index(initial)]
    const lastPunish = punish[index(middle)]
    transmissions = [initial, middle, lastPunish === middle || lastPunish === initial ? branches[mod(index(middle) + 6)] : lastPunish]
    explanation.push('天地同位为伏吟；有克取克，无克阳取干上、阴取支上；刑递取，自刑或回初依本版规则改取。')
  } else if (candidates.length) {
    const selected = selectDirect(); method = shift === 6 ? '返吟' : selected.method; transmissions = chain(selected.initial)
    if (shift === 6) explanation.push(`天地相冲为返吟，有克按${selected.method}取初传，中末递取天盘上神。`)
  } else if (shift === 6) {
    method = '返吟'
    if (!['丑', '未'].includes(dayBranch)) { status = 'unsupported'; explanation.push('此返吟无克组合未通过本版独立例证核对，三传暂不生成。') }
    else { transmissions = [dayBranch === '丑' ? '亥' : '巳', third, first]; explanation.push('返吟无克：丑日取亥、未日取巳为初传，中取支上，末取干上。') }
  } else if (lodge[stems.indexOf(stem)] === dayBranch) {
    method = '八专'; transmissions = [branches[mod(index(dayIsYang ? first : lessons[3].upper) + (dayIsYang ? 2 : -2))], first, first]
    explanation.push('干支同位且无克为八专，不再论遥克；阳从干上顺数三位，阴从四课上神逆数三位，中末并取干上。')
  } else {
    const uppers = unique(lessons.map(lesson => lesson.upper)), remoteControl = uppers.filter(upper => controls(upper, stem)), remote = remoteControl.length ? remoteControl : uppers.filter(upper => controls(stem, upper))
    if (remote.length) {
      method = '遥克'
      const same = remote.filter(candidate => yang(candidate) === dayIsYang), choice = remote.length === 1 ? remote[0] : same.length === 1 ? same[0] : ''
      if (choice) { transmissions = chain(choice); explanation.push(`四课无直接克，先查上神克日干、再查日干克上神；${remote.length > 1 ? '按阴阳比用取唯一候选' : '取唯一遥克候选'}。`) }
      else { status = 'unsupported'; explanation.push(`遥克候选 ${remote.join('、')} 经比用仍未唯一；本版未核实此分支，三传暂不生成。`) }
    } else if (uppers.length === 4) {
      method = '昴星'; transmissions = dayIsYang ? [sky('酉'), third, first] : [earth('酉'), first, third]
      explanation.push('四课俱全且无直接克、遥克；阳取酉上神，中支上末干上；阴取酉下神，中干上末支上。')
    } else if (uppers.length === 3) {
      method = '别责'; transmissions = [dayIsYang ? sky(lodge[(stems.indexOf(stem) + 5) % 10]) : branches[mod(index(dayBranch) + 4)], first, first]
      explanation.push('三课无克为别责：阳取日干五合寄宫的上神，阴取日支三合前位地支，中末并取干上。')
    } else { method = '未定'; status = 'unsupported'; explanation.push('本版规则未覆盖此无克组合，保留天地盘与四课，三传暂不生成。') }
  }
  return { day, general, hour, shift, dayPeriod, noble, nobleDirection: direction === 1 ? '顺' : '逆', palaces, lessons, transmissions, method, status, explanation, xun, voids }
}

export function createLiurenSnapshot(value: unknown, now = new Date()): LiurenSnapshot {
  const input = normalizeLiurenInput(value)
  if (!Number.isFinite(now.getTime())) throw new Error('当前时间不可用，请重试')
  let calendar: LiurenSnapshot['calendar'] = null, board: LiurenBoard
  if (input.mode === 'manual') board = buildLiurenBoard(input.day, input.general, input.hour)
  else {
    const instant = new Date(Date.parse(`${input.date}T${input.time}.000Z`) - input.utcOffsetMinutes * 60000), reference = new Date(instant.getTime() + 480 * 60000)
    const lunar = Solar.fromYmdHms(reference.getUTCFullYear(), reference.getUTCMonth() + 1, reference.getUTCDate(), reference.getUTCHours(), reference.getUTCMinutes(), reference.getUTCSeconds()).getLunar()
    const previous = lunar.getPrevQi(false), next = lunar.getNextQi(false), general = generalByQi[previous.getName()]
    if (!general) throw new Error('当前中气不在本版月将表内，未生成盘面')
    board = buildLiurenBoard(lunar.getDayInGanZhiExact(), general, lunar.getTimeZhi())
    calendar = { instant: instant.toISOString(), referenceTime: reference.toISOString().slice(0, 19).replace('T', ' '), year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(), hour: lunar.getTimeInGanZhi(), qi: previous.getName(), qiAt: previous.getSolar().toYmdHms(), nextQi: next.getName(), nextQiAt: next.getSolar().toYmdHms(), timePolicy: 'UTC+08:00-clock-zi23', version: 'lunar-typescript@1.8.6' }
  }
  return { schemaVersion: 1, ruleVersion: LIUREN_RULE_VERSION, method: LIUREN_METHOD, createdAt: now.toISOString(), input, calendar, board, sources: LIUREN_SOURCES.map(source => ({ ...source })) }
}

/** Validate the saved structure and links, never re-run the transmission algorithm on history. */
export function isLiurenSnapshot(value: unknown): value is LiurenSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.ruleVersion !== LIUREN_RULE_VERSION || value.method !== LIUREN_METHOD || !validInstant(value.createdAt)) return false
  try { normalizeLiurenInput(value.input) } catch { return false }
  const board = value.board
  if (!object(board) || !validDay(board.day) || !validBranch(board.general) || !validBranch(board.hour) || board.shift !== mod(index(board.general) - index(board.hour)) || !['昼', '夜'].includes(board.dayPeriod) || !validBranch(board.noble) || !['顺', '逆'].includes(board.nobleDirection) || !validDay(board.xun)) return false
  if (!Array.isArray(board.voids) || board.voids.length !== 2 || !board.voids.every(validBranch) || new Set(board.voids).size !== 2 || !Array.isArray(board.palaces) || board.palaces.length !== 12) return false
  const expectedXun = LunarUtil.JIA_ZI[Math.floor(LunarUtil.getJiaZiIndex(board.day) / 10) * 10]
  if (board.xun !== expectedXun || board.voids[0] !== branches[mod(index(expectedXun[1]) + 10)] || board.voids[1] !== branches[mod(index(expectedXun[1]) + 11)]) return false
  const dayPeriod = index(board.hour) >= 3 && index(board.hour) <= 8 ? '昼' : '夜', stem = board.day[0]
  const noblePair = '甲戊庚'.includes(stem) ? '丑未' : '乙己'.includes(stem) ? '子申' : '丙丁'.includes(stem) ? '亥酉' : '壬癸'.includes(stem) ? '巳卯' : '午寅'
  const nobleEarth = mod(index(board.noble) - board.shift), direction = nobleEarth <= 4 || nobleEarth === 11 ? 1 : -1
  if (board.dayPeriod !== dayPeriod || board.noble !== noblePair[dayPeriod === '昼' ? 0 : 1] || board.nobleDirection !== (direction === 1 ? '顺' : '逆')) return false
  if (!board.palaces.every((cell: any, i: number) => object(cell) && cell.earth === branches[i] && cell.heaven === branches[mod(i + board.shift)] && gods.includes(cell.god) && cell.empty === board.voids.includes(cell.heaven)) || new Set(board.palaces.map((cell: any) => cell.god)).size !== 12) return false
  if (!board.palaces.every((cell: any, i: number) => cell.god === gods[mod((i - nobleEarth) * direction)])) return false
  if (!Array.isArray(board.lessons) || board.lessons.length !== 4 || !board.lessons.every((lesson: any, i: number) => object(lesson) && (i === 0 ? lesson.lower === board.day[0] : validBranch(lesson.lower)) && validBranch(lesson.upper) && lesson.relation === (controls(lesson.lower, lesson.upper) ? '下贼上' : controls(lesson.upper, lesson.lower) ? '上克下' : '无克'))) return false
  const sky = (branch: string) => branches[mod(index(branch) + board.shift)]
  if (board.lessons[0].upper !== sky(lodge[stems.indexOf(board.day[0])]) || board.lessons[1].lower !== board.lessons[0].upper || board.lessons[1].upper !== sky(board.lessons[1].lower) || board.lessons[2].lower !== board.day[1] || board.lessons[2].upper !== sky(board.day[1]) || board.lessons[3].lower !== board.lessons[2].upper || board.lessons[3].upper !== sky(board.lessons[3].lower)) return false
  if (!['complete', 'unsupported'].includes(board.status) || !['贼克', '比用', '涉害', '遥克', '昴星', '别责', '八专', '伏吟', '返吟', '未定'].includes(board.method) || !Array.isArray(board.transmissions) || board.transmissions.length !== (board.status === 'complete' ? 3 : 0) || !board.transmissions.every(validBranch) || !Array.isArray(board.explanation) || !board.explanation.length || !board.explanation.every((line: unknown) => typeof line === 'string' && line.length > 0)) return false
  if (value.input.mode === 'manual') { if (value.calendar !== null || board.day !== value.input.day || board.general !== value.input.general || board.hour !== value.input.hour) return false }
  else {
    const calendar = value.calendar
    if (!object(calendar) || !validInstant(calendar.instant) || calendar.version !== 'lunar-typescript@1.8.6' || calendar.timePolicy !== 'UTC+08:00-clock-zi23' || ![calendar.year, calendar.month, calendar.hour].every(validDay) || !generalByQi[calendar.qi] || !generalByQi[calendar.nextQi] || board.general !== generalByQi[calendar.qi] || board.hour !== calendar.hour[1]) return false
    if (![calendar.referenceTime, calendar.qiAt, calendar.nextQiAt].every(text => typeof text === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) && Number.isFinite(Date.parse(text.replace(' ', 'T') + '+08:00')))) return false
    const normalized = normalizeLiurenInput(value.input), instant = Date.parse(`${normalized.date}T${normalized.time}.000Z`) - normalized.utcOffsetMinutes * 60000
    if (calendar.instant !== new Date(instant).toISOString() || calendar.referenceTime !== new Date(instant + 480 * 60000).toISOString().slice(0, 19).replace('T', ' ') || calendar.referenceTime < calendar.qiAt || calendar.referenceTime >= calendar.nextQiAt) return false
  }
  return Array.isArray(value.sources) && value.sources.length > 0 && value.sources.every(source => object(source) && ['title', 'url', 'usage'].every(key => typeof source[key] === 'string' && source[key].length > 0))
}
