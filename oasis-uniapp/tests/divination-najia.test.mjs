import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

async function load(path) {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node' })
  const context = vm.createContext({ module: { exports: {} } })
  vm.runInContext(bundle.outputFiles[0].text, context)
  return context.module.exports
}
const domain = await load('../src/domain/divination/index.ts')
const najia = await load('../src/domain/divination/najia.ts')
const persistence = await load('../src/domain/divination/repository.ts')
const plain = value => JSON.parse(JSON.stringify(value))
const input = (lines = [7, 7, 7, 7, 7, 7], date = '2026-06-29', time = '14:30', utcOffset = 8) => ({ method: 'liuyao-najia', question: '核对传统装卦事实', lines, date, time, utcOffset })
const cast = (...args) => domain.calculateDivination(input(...args))
const hex = name => domain.HEXAGRAMS.find(item => item.name === name)
const staticCast = (name, day = '甲戌') => najia.buildNajiaStructure(hex(name), hex(name), [], day)

// Independent named palace order transcribed from 增删卜易 八宫全图, not the XOR algorithm.
// https://zh.wikisource.org/wiki/增刪卜易/3/八卦各宮全圖
// Normalizations: 遯→遁, 恆→恒, 濟→济; source OCR 山雷顧 is 山雷颐.
const PALACES = [
  ['乾', '金', ['乾', '姤', '遁', '否', '观', '剥', '晋', '大有']],
  ['兑', '金', ['兑', '困', '萃', '咸', '蹇', '谦', '小过', '归妹']],
  ['离', '火', ['离', '旅', '鼎', '未济', '蒙', '涣', '讼', '同人']],
  ['震', '木', ['震', '豫', '解', '恒', '升', '井', '大过', '随']],
  ['巽', '木', ['巽', '小畜', '家人', '益', '无妄', '噬嗑', '颐', '蛊']],
  ['坎', '水', ['坎', '节', '屯', '既济', '革', '丰', '明夷', '师']],
  ['艮', '土', ['艮', '贲', '大畜', '损', '睽', '履', '中孚', '渐']],
  ['坤', '土', ['坤', '复', '临', '泰', '大壮', '夬', '需', '比']],
]
// Full 48 factual assignments: 增删卜易 浑天甲子章 + bopo/najia author const.py
// fixed commit 9cf119169d7eb8e48febc05274aebf3f7106d647; all rows bottom to top.
const ASSIGNMENTS = {
  乾: ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌'],
  兑: ['丁巳', '丁卯', '丁丑', '丁亥', '丁酉', '丁未'],
  离: ['己卯', '己丑', '己亥', '己酉', '己未', '己巳'],
  震: ['庚子', '庚寅', '庚辰', '庚午', '庚申', '庚戌'],
  巽: ['辛丑', '辛亥', '辛酉', '辛未', '辛巳', '辛卯'],
  坎: ['戊寅', '戊辰', '戊午', '戊申', '戊戌', '戊子'],
  艮: ['丙辰', '丙午', '丙申', '丙戌', '丙子', '丙寅'],
  坤: ['乙未', '乙巳', '乙卯', '癸丑', '癸亥', '癸酉'],
}
const ELEMENTS = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' }
const KIN_TABLE = {
  金: { 金: '兄弟', 木: '妻财', 水: '子孙', 火: '官鬼', 土: '父母' },
  木: { 金: '官鬼', 木: '兄弟', 水: '父母', 火: '子孙', 土: '妻财' },
  水: { 金: '父母', 木: '子孙', 水: '兄弟', 火: '妻财', 土: '官鬼' },
  火: { 金: '妻财', 木: '父母', 水: '官鬼', 火: '兄弟', 土: '子孙' },
  土: { 金: '子孙', 木: '官鬼', 水: '妻财', 火: '父母', 土: '兄弟' },
}

test('all 64 palaces, stages and shi/ying match the independently transcribed named chart', () => {
  const stages = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']
  const positions = [[6, 3], [1, 4], [2, 5], [3, 6], [4, 1], [5, 2], [4, 1], [3, 6]]
  const seen = new Set()
  for (const [palace, element, names] of PALACES) names.forEach((name, stage) => {
    const actual = staticCast(name)
    assert.deepEqual(plain(actual.palace), { name: palace, element, stage: stages[stage], shiPosition: positions[stage][0], yingPosition: positions[stage][1] }, name)
    assert.deepEqual(actual.lines.filter(line => line.role).map(line => [line.position, line.role]).sort().toString(), positions[stage].map((p, i) => [p, i ? '应' : '世']).sort().toString(), name)
    seen.add(name)
  })
  assert.equal(seen.size, 64)
})

test('all 48 stem/branch assignments and 25 kin relations agree with fixed traditional tables', () => {
  for (const [name, assignments] of Object.entries(ASSIGNMENTS)) {
    const actual = staticCast(name)
    assert.deepEqual(plain(actual.lines.map(line => line.ganzhi)), assignments, name)
    for (const line of actual.lines) {
      assert.equal(line.stem + line.branch, line.ganzhi)
      assert.equal(line.element, ELEMENTS[line.branch])
      assert.equal(line.kin, KIN_TABLE[actual.palace.element][line.element])
    }
  }
  for (const [palace, row] of Object.entries(KIN_TABLE)) for (const [element, kin] of Object.entries(row)) assert.equal(najia.sixKin(palace, element), kin)
  assert.throws(() => najia.sixKin('木', '石'), /五行/)
})

test('fixed ichingpy functional cases independently check mixed trigrams and palace assignment', () => {
  // https://github.com/JinyangWang27/ichingpy/blob/01e50a25d7b1d696ff9c8b9fa5d718a5ca0f63a8/tests/functional/divination/six_lines/test_six_line_divination.py
  for (const [name, palace, shi, ying, stems] of [
    ['革', '坎', 4, 1, ['己卯', '己丑', '己亥', '丁亥', '丁酉', '丁未']],
    ['解', '震', 2, 5, ['戊寅', '戊辰', '戊午', '庚午', '庚申', '庚戌']],
    ['渐', '艮', 3, 6, ['丙辰', '丙午', '丙申', '辛未', '辛巳', '辛卯']],
  ]) {
    const actual = staticCast(name)
    assert.deepEqual([actual.palace.name, actual.palace.shiPosition, actual.palace.yingPosition], [palace, shi, ying])
    assert.deepEqual(plain(actual.lines.map(line => line.ganzhi)), stems)
  }
})

test('classical Guai to Gou keeps changed kin based on original Kun-earth palace', () => {
  // 增删卜易 八宫图后原文: 夬初、上动变姤, 丑土、戌土均仍为兄弟。
  const result = cast([9, 7, 7, 7, 7, 6])
  assert.equal(result.ruleVersion, 'liuyao-najia-v1')
  assert.deepEqual([result.original.name, result.changed.name, result.najia.palace.name], ['夬', '姤', '坤'])
  assert.deepEqual(plain(result.movingLines), [1, 6])
  assert.deepEqual(plain(result.najia.lines.filter(line => line.changed).map(line => [line.position, line.changed.ganzhi, line.changed.kin])), [[1, '辛丑', '兄弟'], [6, '壬戌', '兄弟']])
  assert.equal(staticCast('姤').lines[0].kin, '父母')
  assert.equal(result.mutual, undefined)
  assert.equal(result.bodyUse, undefined)
  assert.equal(result.calendar, undefined)
})

test('4096 moving/static inputs preserve line order, original palace and changed-trigram assignments', () => {
  for (let code = 0; code < 4096; code++) {
    let remaining = code
    const values = Array.from({ length: 6 }, () => { const value = [6, 7, 8, 9][remaining % 4]; remaining = Math.floor(remaining / 4); return value })
    const originalLines = values.map(value => value % 2)
    const changedLines = values.map(value => value === 6 || value === 7 ? 1 : 0)
    const moving = values.flatMap((value, index) => value === 6 || value === 9 ? [index + 1] : [])
    const original = domain.hexagramFromLines(originalLines), changed = domain.hexagramFromLines(changedLines)
    const result = najia.buildNajiaStructure(original, changed, moving, '甲戌')
    const palaceElement = PALACES.find(([, , names]) => names.includes(original.name))[1]
    result.lines.forEach((line, index) => {
      assert.equal(line.position, index + 1)
      assert.equal(line.value, originalLines[index])
      assert.equal(line.isMoving, moving.includes(index + 1))
      assert.equal(Boolean(line.changed), line.isMoving)
      const currentGanzhi = ASSIGNMENTS[index < 3 ? original.lower.name : original.upper.name][index]
      assert.equal(line.ganzhi, currentGanzhi)
      assert.equal(line.kin, KIN_TABLE[palaceElement][ELEMENTS[currentGanzhi[1]]])
      assert.equal(line.isVoid, ['申', '酉'].includes(line.branch))
      if (line.changed) {
        const expectedGanzhi = ASSIGNMENTS[index < 3 ? changed.lower.name : changed.upper.name][index]
        assert.equal(line.changed.ganzhi, expectedGanzhi)
        assert.equal(line.changed.value, changedLines[index])
        assert.equal(line.changed.kin, KIN_TABLE[palaceElement][ELEMENTS[expectedGanzhi[1]]])
        assert.equal(line.changed.isVoid, ['申', '酉'].includes(line.changed.branch))
      }
    })
  }
})

test('hidden-kin candidates match independent classical cases, including the same-position flying line', () => {
  // https://www.shidianguji.com/book/XYXZSBY/chapter/1lzxsny7d9s7d
  // 飞伏神章: 姤财二、遁子初、贲父二、蹇财二; no interpretation copied.
  // 谦 fixed author fixture: yaomancy/liuyao-engine 53291663... tests/test_feifu.py.
  for (const [name, position, kin, hidden, flying] of [
    ['姤', 2, '妻财', '甲寅', '辛亥'], ['遁', 1, '子孙', '甲子', '丙辰'],
    ['贲', 2, '父母', '丙午', '己丑'], ['蹇', 2, '妻财', '丁卯', '丙午'],
    ['谦', 2, '妻财', '丁卯', '丙午'], ['泰', 2, '父母', '乙巳', '甲寅'],
  ]) {
    const actual = staticCast(name)
    assert.ok(actual.missingKin.includes(kin), name)
    assert.equal(actual.lines[position - 1].hidden?.ganzhi, hidden, name)
    assert.equal(actual.lines[position - 1].hidden?.kin, kin, name)
    assert.equal(actual.lines[position - 1].ganzhi, flying, name)
  }
  for (const [name] of PALACES) assert.equal(staticCast(name).lines.some(line => line.hidden), false)
})

test('all 64 charts retain every missing-kin candidate, with no invented present-kin candidate', () => {
  let multiple = 0
  for (const [palace, element, names] of PALACES) for (const name of names) {
    const actual = staticCast(name)
    const present = new Set(actual.lines.map(line => line.kin))
    const expected = ASSIGNMENTS[palace].flatMap((ganzhi, index) => {
      const kin = KIN_TABLE[element][ELEMENTS[ganzhi[1]]]
      return present.has(kin) ? [] : [[index + 1, ganzhi, kin]]
    })
    assert.deepEqual(plain(actual.lines.filter(line => line.hidden).map(line => [line.position, line.hidden.ganzhi, line.hidden.kin])), expected, name)
    if (expected.length > 1) multiple++
  }
  assert.ok(multiple > 0, 'must actually cover charts with multiple missing-kin candidates')
})

test('all ten day stems start and rotate six spirits according to the classical table', () => {
  const expected = {
    甲: '青龙 朱雀 勾陈 腾蛇 白虎 玄武', 乙: '青龙 朱雀 勾陈 腾蛇 白虎 玄武',
    丙: '朱雀 勾陈 腾蛇 白虎 玄武 青龙', 丁: '朱雀 勾陈 腾蛇 白虎 玄武 青龙',
    戊: '勾陈 腾蛇 白虎 玄武 青龙 朱雀', 己: '腾蛇 白虎 玄武 青龙 朱雀 勾陈',
    庚: '白虎 玄武 青龙 朱雀 勾陈 腾蛇', 辛: '白虎 玄武 青龙 朱雀 勾陈 腾蛇',
    壬: '玄武 青龙 朱雀 勾陈 腾蛇 白虎', 癸: '玄武 青龙 朱雀 勾陈 腾蛇 白虎',
  }
  for (const [stem, spirits] of Object.entries(expected)) assert.deepEqual(plain(najia.sixSpirits(stem)), spirits.split(' '))
  assert.throws(() => najia.sixSpirits('子'), /日干/)
})

test('all sixty valid days belong to the correct xun and pair of void branches', () => {
  // Explicit sixty-day sequence from lunar author 干支 API; xun pairs from 增删卜易 旬空章.
  const groups = [
    ['甲子 乙丑 丙寅 丁卯 戊辰 己巳 庚午 辛未 壬申 癸酉', '戌亥'],
    ['甲戌 乙亥 丙子 丁丑 戊寅 己卯 庚辰 辛巳 壬午 癸未', '申酉'],
    ['甲申 乙酉 丙戌 丁亥 戊子 己丑 庚寅 辛卯 壬辰 癸巳', '午未'],
    ['甲午 乙未 丙申 丁酉 戊戌 己亥 庚子 辛丑 壬寅 癸卯', '辰巳'],
    ['甲辰 乙巳 丙午 丁未 戊申 己酉 庚戌 辛亥 壬子 癸丑', '寅卯'],
    ['甲寅 乙卯 丙辰 丁巳 戊午 己未 庚申 辛酉 壬戌 癸亥', '子丑'],
  ]
  for (const [sequence, empty] of groups) for (const day of sequence.split(' ')) {
    assert.deepEqual(plain(najia.dayXun(day)), { xun: sequence.slice(0, 2), voidBranches: [...empty] }, day)
  }
  for (const bad of ['甲丑', '甲', '', '子甲', '甲子日']) assert.throws(() => najia.dayXun(bad), /六十甲子/)
})

test('calendar anchor from independent engine example keeps day, month, spirit and void facts aligned', () => {
  // https://github.com/yaomancy/liuyao-engine/blob/53291663a4c733c4cbdfa174a8d3075475c07fd3/README.md
  // 2026-06-29 14:30 Beijing: 丙午 / 甲午 / 甲戌 / 辛未, 旬空申酉.
  const result = cast()
  assert.equal(result.questionInstant, '2026-06-29T06:30:00.000Z')
  assert.equal(result.najia.calendar.beijingTime, '2026-06-29 14:30 UTC+08:00')
  assert.deepEqual([result.najia.calendar.monthBranch, result.najia.calendar.dayGanzhi, result.najia.xun], ['午', '甲戌', '甲戌'])
  assert.deepEqual(plain(result.najia.voidBranches), ['申', '酉'])
  assert.equal(result.najia.lines[0].spirit, '青龙')
  assert.equal(result.najia.lines[4].isVoid, true)
  assert.equal(result.najia.calendar.monthStart.name, '芒种')
})

test('all twelve month boundaries bracket independent NAOJ 2026 solar-term times', () => {
  // NAOJ primary annual table (Japan UTC+9), converted to fixed UTC+8 below.
  // https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou262.html
  // Published values are minute-rounded: ±2 min brackets validate independently,
  // without treating their display minute as an exact second.
  const references = [
    ['01-05', '16:23', '小寒', '子', '丑'], ['02-04', '04:02', '立春', '丑', '寅'],
    ['03-05', '21:59', '惊蛰', '寅', '卯'], ['04-05', '02:40', '清明', '卯', '辰'],
    ['05-05', '19:49', '立夏', '辰', '巳'], ['06-05', '23:48', '芒种', '巳', '午'],
    ['07-07', '09:57', '小暑', '午', '未'], ['08-07', '19:43', '立秋', '未', '申'],
    ['09-07', '22:41', '白露', '申', '酉'], ['10-08', '14:29', '寒露', '酉', '戌'],
    ['11-07', '17:52', '立冬', '戌', '亥'], ['12-07', '10:53', '大雪', '亥', '子'],
  ]
  for (const [date, time, name, before, after] of references) {
    const middle = Date.parse(`2026-${date}T${time}:00Z`)
    const at = millis => { const text = new Date(millis).toISOString(); return cast(undefined, text.slice(0, 10), text.slice(11, 16)).najia.calendar }
    assert.equal(at(middle - 120000).monthBranch, before, name)
    const changed = at(middle + 120000)
    assert.equal(changed.monthBranch, after, name)
    assert.equal(changed.monthStart.name, name)
    const calculatedBoundary = Date.parse(changed.monthStart.beijingTime.replace(' UTC+08:00', '').replace(' ', 'T') + 'Z')
    assert.ok(Math.abs(calculatedBoundary - middle) < 120000, name)
    // Input has minute precision. Floor/ceil around the engine's exact boundary
    // checks integration chooses Exact month, rather than the whole civil day API.
    assert.equal(at(calculatedBoundary - calculatedBoundary % 60000 - 60000).monthBranch, before, name)
    assert.equal(at(calculatedBoundary - calculatedBoundary % 60000 + 60000).monthBranch, after, name)
  }
})

test('midnight alone changes day and derived facts; lunar New Year does not change month branch', () => {
  for (const time of ['22:59', '23:00', '23:59']) {
    const chart = cast(undefined, '2026-06-29', time).najia
    assert.equal(chart.calendar.dayGanzhi, '甲戌')
    assert.equal(chart.lines[0].spirit, '青龙')
    assert.deepEqual(plain(chart.voidBranches), ['申', '酉'])
  }
  assert.equal(cast(undefined, '2026-06-30', '00:00').najia.calendar.dayGanzhi, '乙亥')
  assert.equal(cast(undefined, '2026-06-28', '23:59').najia.xun, '甲子')
  assert.equal(cast(undefined, '2026-06-29', '00:00').najia.xun, '甲戌')
  for (const date of ['2026-02-16', '2026-02-17']) assert.equal(cast(undefined, date).najia.calendar.monthBranch, '寅')
})

test('equivalent instants across manual offsets give identical facts and preserve original input', () => {
  const reference = cast()
  for (const [date, time, offset] of [
    ['2026-06-29', '06:30', 0], ['2026-06-29', '02:30', -4], ['2026-06-28', '18:30', -12],
    ['2026-06-29', '20:30', 14], ['2026-06-29', '12:15', 5.75], ['2026-06-29', '15:30', 9],
  ]) {
    const actual = cast(undefined, date, time, offset)
    assert.equal(actual.questionInstant, reference.questionInstant)
    assert.deepEqual(plain(actual.najia), plain(reference.najia))
    assert.equal(actual.input.utcOffset, offset)
    assert.equal(actual.input.time, time)
  }
  const first = cast(undefined, '2026-11-01', '01:30', -4), second = cast(undefined, '2026-11-01', '01:30', -5)
  assert.notEqual(first.questionInstant, second.questionInstant) // explicit repeated-time choice
  assert.notEqual(first.najia.calendar.beijingTime, second.najia.calendar.beijingTime)
})

test('input validation and UTC/Beijing supported range do not relax old-method semantics', () => {
  for (const lines of [[], [7, 7, 7, 7, 7], [7, 7, 7, 7, 7, '7'], [7, 7, 7, 7, 7, 5], Array(6)]) assert.throws(() => cast(lines), /爻值/)
  for (const [date, time, offset] of [['1900-01-01', '00:00', 8], ['2099-12-31', '23:59', -12], ['2099-12-31', '16:00', 0], ['2026-02-29', '12:00', 8], ['2026-01-01', '24:00', 8]]) assert.throws(() => cast(undefined, date, time, offset), /日期|时间|之间/)
  assert.equal(cast(undefined, '1900-01-01', '08:00').questionInstant, '1900-01-01T00:00:00.000Z')
  assert.equal(cast(undefined, '2099-12-31', '23:59').najia.calendar.beijingTime, '2099-12-31 23:59 UTC+08:00')
  const old = domain.calculateDivination({ ...input(undefined, '1900-01-01', '00:00'), method: 'liuyao-manual' }, 'divination-v1')
  assert.equal(old.questionInstant, '1899-12-31T16:00:00.000Z')
  assert.equal(old.najia, undefined)
})

test('result carries conventions, engine and sources without shared mutable output', () => {
  const originalInput = input(), result = domain.calculateDivination(originalInput)
  assert.deepEqual(plain(result.najia.rules), {
    timeBasis: 'fixed-utc8', monthBoundary: 'exact-jie', dayBoundary: 'midnight',
    kinBasis: 'original-palace-element', changedKinBasis: 'original-palace-element',
    hiddenPolicy: 'all-missing-kin-from-pure-palace', changedPolicy: 'moving-lines-only',
  })
  assert.deepEqual(plain(result.najia.calendar.engine), { name: 'lunar-typescript', version: '1.8.6' })
  assert.ok(result.calculation.some(step => step.includes('六神')))
  assert.ok(result.najia.sources.some(source => source.url.includes('shidianguji.com')))
  originalInput.lines[0] = 6
  assert.equal(result.input.lines[0], 7)
  result.najia.rules.timeBasis = 'mutated'
  result.najia.sources[0].url = 'mutated'
  result.najia.lines[0].ganzhi = 'mutated'
  const next = cast()
  assert.equal(next.najia.rules.timeBasis, 'fixed-utc8')
  assert.notEqual(next.najia.sources[0].url, 'mutated')
  assert.equal(next.najia.lines[0].ganzhi, '甲子')
})

function memoryStorage() {
  const memory = new Map()
  return { memory, getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) }
}
test('all four method/version pairs coexist and restore/export by their own rule version', () => {
  const storage = memoryStorage(), repo = persistence.createDivinationRepository(storage)
  const inputs = [
    { ...input(), method: 'liuyao-manual' }, { ...input(), method: 'meihua-two-numbers', numbers: [2, 3] },
    { ...input(), method: 'meihua-calendar' }, input([9, 7, 7, 7, 7, 6]),
  ]
  const expectedVersions = ['divination-v1', 'divination-v1', 'meihua-calendar-v1', 'liuyao-najia-v1']
  inputs.forEach((value, i) => {
    const result = domain.calculateDivination(value)
    assert.equal(result.ruleVersion, expectedVersions[i])
    repo.save(result, '2026-10-03T05:00:00.000Z')
  })
  const records = repo.list()
  assert.equal(records.length, 4)
  const restored = domain.calculateDivination(records[0].input, records[0].ruleVersion)
  assert.equal(restored.najia.lines[0].changed.kin, '兄弟')
  assert.equal(JSON.parse(repo.exportJSON()).records[0].result.najia.rules.changedKinBasis, 'original-palace-element')
  assert.equal(records[3].ruleVersion, 'divination-v1')
  assert.equal(domain.calculateDivination(records[3].input, records[3].ruleVersion).najia, undefined)
  for (const value of inputs) for (const version of [...new Set(expectedVersions), 'unknown']) {
    if (domain.calculateDivination(value).ruleVersion === version) continue
    assert.throws(() => domain.calculateDivination(value, version), /版本/)
    const badStorage = memoryStorage(), badRepo = persistence.createDivinationRepository(badStorage)
    const raw = JSON.stringify({ schemaVersion: 1, records: [{ id: 'bad', savedAt: '2026-10-03T05:00:00.000Z', input: value, ruleVersion: version }] })
    badStorage.memory.set(persistence.DIVINATION_STORAGE_KEY, raw)
    for (const action of [() => badRepo.list(), () => badRepo.exportJSON(), () => badRepo.remove('bad'), () => badRepo.save(cast())]) assert.throws(action, /保留/)
    assert.equal(badStorage.memory.get(persistence.DIVINATION_STORAGE_KEY), raw)
    badStorage.memory.clear()
    assert.throws(() => badRepo.save({ ...cast(), input: value, ruleVersion: version }), /版本/)
    assert.equal(badStorage.memory.size, 0)
  }
})
