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
const persistence = await load('../src/domain/divination/repository.ts')
const plain = value => JSON.parse(JSON.stringify(value))
const input = (date, time = '12:00', utcOffset = 8) => ({ method: 'meihua-calendar', question: '记录时间起卦的传统规则', date, time, utcOffset })
const cast = (date, time, offset) => domain.calculateDivination(input(date, time, offset))

// Independent sources read 2026-10-03:
// https://zh.wikisource.org/zh-hans/梅花易數/卷一 (观梅占 / 牡丹占)
// https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2025c.txt
// The modern dates reproduce the classical numeric inputs; they are NOT dates
// claimed for the historical events. Expected hexagrams come from the classical text.
test('calendar method reproduces the classical Guanmei case through the HKO modern date', () => {
  const result = cast('2025-01-16', '15:00')
  assert.equal(result.ruleVersion, 'meihua-calendar-v1')
  assert.equal(result.questionInstant, '2025-01-16T07:00:00.000Z')
  assert.equal(result.calendar.beijingTime, '2025-01-16 15:00 UTC+08:00')
  assert.deepEqual(plain(result.calendar.numbers), { year: 5, month: 12, day: 17, time: 9 })
  assert.equal(result.calendar.lunar.year, 2024)
  assert.equal(result.calendar.lunar.yearBranch, '辰')
  assert.equal(result.calendar.timeBranch, '申')
  assert.equal(result.calendar.upperSum, 34)
  assert.equal(result.calendar.total, 43)
  assert.deepEqual([result.original.upper.name, result.original.lower.name, result.original.name, result.changed.name, result.mutual.name], ['兑', '离', '革', '咸', '姤'])
  assert.deepEqual(plain(result.movingLines), [1])
  assert.deepEqual([result.mutual.upper.name, result.mutual.lower.name], ['乾', '巽'])
  assert.deepEqual([result.bodyUse.body.name, result.bodyUse.use.name, result.bodyUse.relation], ['兑', '离', '用克体'])
})

test('calendar method reproduces the classical Peony case through the HKO modern date', () => {
  const result = cast('2025-04-13', '05:00')
  assert.deepEqual(plain(result.calendar.numbers), { year: 6, month: 3, day: 16, time: 4 })
  assert.equal(result.calendar.upperSum, 25)
  assert.equal(result.calendar.total, 29)
  assert.deepEqual([result.original.upper.name, result.original.lower.name, result.original.name, result.changed.name, result.mutual.name], ['乾', '巽', '姤', '鼎', '乾'])
  assert.deepEqual(plain(result.movingLines), [5])
  assert.deepEqual([result.bodyUse.body.name, result.bodyUse.use.name, result.bodyUse.relation], ['巽', '乾', '用克体'])
})

test('HKO lunar New Year changes year at midnight, before the separate Li Chun boundary', () => {
  const before = cast('2025-01-28', '23:59'), after = cast('2025-01-29', '00:00')
  assert.deepEqual([before.calendar.lunar.year, before.calendar.lunar.yearBranch, before.calendar.lunar.month, before.calendar.lunar.day], [2024, '辰', 12, 29])
  assert.deepEqual([after.calendar.lunar.year, after.calendar.lunar.yearBranch, after.calendar.lunar.month, after.calendar.lunar.day], [2025, '巳', 1, 1])
  assert.equal(before.calendar.timeBranch, '子')
  assert.equal(after.calendar.timeBranch, '子')
  assert.deepEqual(plain(after.calendar.numbers), { year: 6, month: 1, day: 1, time: 1 })
  assert.equal(after.calendar.upperNumber, 8) // upperSum 8: zero remainder means Kun.
  assert.equal(after.original.upper.name, '坤')
  const beforeLiChun = cast('2025-02-02')
  assert.equal(beforeLiChun.calendar.lunar.yearBranch, '巳')
  assert.equal(beforeLiChun.calendar.lunar.day, 5)
})

test('HKO leap sixth month keeps month number 6 and its leap flag throughout the whole month', () => {
  const references = [
    ['2025-06-25', 6, 1, false], ['2025-07-24', 6, 30, false],
    ['2025-07-25', 6, 1, true], ['2025-08-08', 6, 15, true],
    ['2025-08-09', 6, 16, true], ['2025-08-22', 6, 29, true], ['2025-08-23', 7, 1, false],
  ]
  for (const [date, month, day, leap] of references) {
    const result = cast(date)
    assert.deepEqual([result.calendar.lunar.month, result.calendar.lunar.day, result.calendar.lunar.isLeapMonth], [month, day, leap], date)
    assert.equal(result.calendar.numbers.month, month)
    assert.equal(result.calendar.lunar.label.includes('闰'), leap)
  }
  const ordinary = cast('2025-06-25'), leap = cast('2025-07-25')
  assert.deepEqual(plain(ordinary.calendar.numbers), plain(leap.calendar.numbers))
  assert.equal(ordinary.original.name, leap.original.name)
  assert.equal(ordinary.changed.name, leap.changed.name)
})

test('23:00 starts Zi without advancing the lunar date; midnight advances only the date; 01:00 starts Chou', () => {
  const references = [
    ['2025-01-16', '22:59', 17, '亥', 12],
    ['2025-01-16', '23:00', 17, '子', 1],
    ['2025-01-16', '23:59', 17, '子', 1],
    ['2025-01-17', '00:00', 18, '子', 1],
    ['2025-01-17', '00:59', 18, '子', 1],
    ['2025-01-17', '01:00', 18, '丑', 2],
  ]
  for (const [date, time, day, branch, number] of references) {
    const result = cast(date, time)
    assert.deepEqual([result.calendar.lunar.day, result.calendar.timeBranch, result.calendar.numbers.time], [day, branch, number])
  }
  assert.equal(cast('2025-01-17', '01:00').movingLines[0], 1) // 5 + 12 + 18 + 2 = 37.
})

test('zero moving-line remainder means the sixth line, and all twelve hour branches use 1-based numbers', () => {
  // 2025-01-16 is lunar 12/17 in a Chen year, giving 34 before the hour.
  // Chou contributes 2, making 36 exactly, with the sixth moving line.
  const zero = cast('2025-01-16', '01:00')
  assert.equal(zero.calendar.total, 36)
  assert.deepEqual(plain(zero.movingLines), [6])
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  branches.forEach((branch, index) => {
    const hour = index === 0 ? 0 : index * 2 - 1
    const result = cast('2025-01-16', `${String(hour).padStart(2, '0')}:00`)
    assert.equal(result.calendar.timeBranch, branch)
    assert.equal(result.calendar.numbers.time, index + 1)
  })
})

test('the same UTC instant has the same calendar facts and hexagrams across offsets and day boundaries', () => {
  const reference = cast('2025-01-16', '15:00', 8)
  const equivalents = [
    ['2025-01-16', '07:00', 0], ['2025-01-16', '02:00', -5],
    ['2025-01-15', '19:00', -12], ['2025-01-16', '21:00', 14],
    ['2025-01-16', '12:45', 5.75], ['2025-01-16', '16:00', 9],
  ]
  for (const [date, time, offset] of equivalents) {
    const actual = cast(date, time, offset)
    assert.equal(actual.questionInstant, reference.questionInstant)
    assert.deepEqual(plain(actual.calendar), plain(reference.calendar))
    assert.deepEqual(plain(actual.original), plain(reference.original))
    assert.deepEqual(plain(actual.changed), plain(reference.changed))
    assert.equal(actual.input.utcOffset, offset)
    assert.equal(actual.input.date, date)
  }
})

test('calendar input and converted UTC/Beijing dates must stay within 1900–2099', () => {
  for (const params of [
    ['1899-12-31', '23:59', -12], ['2100-01-01', '00:00', 14],
    ['1900-01-01', '00:00', 8], // UTC lands in 1899 although Beijing remains in range.
    ['1900-01-01', '00:00', 14], // Both converted dates land in 1899.
    ['2099-12-31', '23:59', -12], // UTC lands in 2100.
    ['2099-12-31', '16:00', 0], // UTC in range; Beijing lands in 2100.
    ['2025-02-29', '12:00', 8], ['2025-01-01', '24:00', 8], ['2025-01-01', '12:00', 8.1],
  ]) assert.throws(() => cast(...params), /日期|时间|偏移|之间|时刻/)
  assert.equal(cast('1900-01-01', '08:00', 8).questionInstant, '1900-01-01T00:00:00.000Z')
  assert.equal(cast('2099-12-31', '23:59', 8).calendar.beijingTime, '2099-12-31 23:59 UTC+08:00')
  // Old v1 methods retain their previous range semantics when reopened.
  const old = domain.calculateDivination({ ...input('1900-01-01', '00:00', 8), method: 'meihua-two-numbers', numbers: [2, 3] }, 'divination-v1')
  assert.equal(old.questionInstant, '1899-12-31T16:00:00.000Z')
})

test('calendar needs no numbers and returns traceable rules, engine, sources and isolated result data', () => {
  const raw = input('2025-04-13', '05:00'), result = domain.calculateDivination(raw)
  assert.deepEqual(plain(result.input), raw)
  assert.equal(result.input.numbers, undefined)
  assert.deepEqual(plain(result.calendar.engine), { name: 'lunar-typescript', version: '1.8.6' })
  assert.deepEqual(plain(result.calendar.rules), {
    timeBasis: 'fixed-utc8', yearBoundary: 'lunar-new-year', dayBoundary: 'midnight',
    leapMonthPolicy: 'same-number', mutualPolicy: 'original-structure', bodyUsePolicy: 'moving-trigram-is-use',
  })
  assert.ok(result.calculation.some(line => line.includes('25 + 4 = 29')))
  assert.ok(result.calendar.sources.some(source => source.url.includes('梅花易數')))
  assert.ok(result.calendar.sources.some(source => source.url.includes('hko.gov.hk')))
  assert.ok(result.calendar.conventions.some(text => text.includes('本工具约定')))
  raw.date = '2025-01-01'
  assert.equal(result.input.date, '2025-04-13')
  result.calendar.rules.timeBasis = 'changed'
  result.calendar.sources[0].url = 'changed'
  assert.equal(cast('2025-04-13').calendar.rules.timeBasis, 'fixed-utc8')
  assert.notEqual(cast('2025-04-13').calendar.sources[0].url, 'changed')
})

function memoryStorage() {
  const memory = new Map()
  return { memory, getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) }
}

test('legacy literal records and calendar records coexist, restore with their version, and export all facts', () => {
  const storage = memoryStorage()
  const legacy = [
    { id: 'old-manual', savedAt: '2026-10-03T05:00:00.000Z', ruleVersion: 'divination-v1', input: { question: '旧六爻', date: '2025-01-16', time: '15:00', utcOffset: 8, method: 'liuyao-manual', lines: [7, 7, 7, 8, 8, 8] } },
    { id: 'old-numbers', savedAt: '2026-10-03T05:00:00.000Z', ruleVersion: 'divination-v1', input: { question: '旧两数', date: '2025-01-16', time: '15:00', utcOffset: 8, method: 'meihua-two-numbers', numbers: [2, 3] } },
  ]
  storage.memory.set(persistence.DIVINATION_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records: legacy }))
  const repo = persistence.createDivinationRepository(storage)
  assert.deepEqual(plain(repo.list()), legacy)
  const created = repo.save(cast('2025-01-16', '15:00'), '2026-10-03T05:00:00.000Z')
  assert.equal(created.ruleVersion, 'meihua-calendar-v1')
  assert.deepEqual(plain(repo.list().slice(1)), legacy)
  const restored = domain.calculateDivination(repo.list()[0].input, repo.list()[0].ruleVersion)
  assert.equal(restored.changed.name, '咸')
  const exported = JSON.parse(repo.exportJSON())
  assert.equal(exported.schemaVersion, 1)
  assert.equal(exported.records.length, 3)
  assert.equal(exported.records[0].result.calendar.engine.version, '1.8.6')
  assert.equal(exported.records[0].result.calendar.beijingTime, '2025-01-16 15:00 UTC+08:00')
  assert.equal(exported.records[0].result.calendar.sources.length, 4)
  assert.equal(exported.records[1].result.original.name, '泰')
  assert.equal(exported.records[1].result.calendar, undefined)
  assert.equal(exported.records[2].result.original.name, '革')
  assert.deepEqual(exported.records[2].result.movingLines, [5]) // Two numbers stay 2 + 3, independent of clock.
  assert.equal(exported.records[2].result.calendar, undefined)
})

test('unknown and mismatched method/rule pairs are rejected on read, write, restore and export without overwriting', () => {
  const good = cast('2025-01-16', '15:00')
  const oldInput = { ...input('2025-01-16'), method: 'meihua-two-numbers', numbers: [2, 3] }
  for (const [badInput, badVersion] of [
    [good.input, 'divination-v1'], [good.input, 'meihua-calendar-v2'], [good.input, undefined],
    [oldInput, 'meihua-calendar-v1'], [oldInput, 'divination-v2'],
  ]) {
    const storage = memoryStorage(), repo = persistence.createDivinationRepository(storage)
    const raw = JSON.stringify({ schemaVersion: 1, records: [{ id: 'bad', savedAt: '2026-10-03T05:00:00.000Z', input: badInput, ruleVersion: badVersion }] })
    storage.memory.set(persistence.DIVINATION_STORAGE_KEY, raw)
    assert.throws(() => repo.list(), /保留/)
    assert.throws(() => repo.exportJSON(), /保留/)
    assert.throws(() => repo.save(good), /保留/)
    assert.throws(() => repo.remove('bad'), /保留/)
    assert.equal(storage.memory.get(persistence.DIVINATION_STORAGE_KEY), raw)
    if (badVersion !== undefined) assert.throws(() => domain.calculateDivination(badInput, badVersion), /版本/)
    storage.memory.clear()
    assert.throws(() => repo.save({ ...good, input: badInput, ruleVersion: badVersion }), /版本/)
    assert.equal(storage.memory.size, 0)
  }
})

test('calendar records inherit capacity, malformed-date and storage-failure protections', () => {
  const storage = memoryStorage(), repo = persistence.createDivinationRepository(storage), result = cast('2025-01-16', '15:00')
  for (let index = 0; index < 50; index++) repo.save(result, '2026-10-03T05:00:00.000Z')
  const full = storage.memory.get(persistence.DIVINATION_STORAGE_KEY)
  assert.throws(() => repo.save(result), /50/)
  assert.equal(storage.memory.get(persistence.DIVINATION_STORAGE_KEY), full)
  assert.equal(new Set(repo.list().map(record => record.id)).size, 50)
  storage.memory.clear()
  const record = repo.save(result)
  const raw = JSON.parse(storage.memory.get(persistence.DIVINATION_STORAGE_KEY))
  raw.records[0].input.date = '2025-02-30'
  const corrupt = JSON.stringify(raw)
  storage.memory.set(persistence.DIVINATION_STORAGE_KEY, corrupt)
  assert.throws(() => repo.save(result), /保留/)
  assert.equal(storage.memory.get(persistence.DIVINATION_STORAGE_KEY), corrupt)
  storage.memory.clear()
  repo.save(result)
  const before = storage.memory.get(persistence.DIVINATION_STORAGE_KEY)
  const denied = persistence.createDivinationRepository({ getItem: storage.getItem, setItem: () => { throw new Error('quota') } })
  assert.throws(() => denied.save(result), /保存失败/)
  assert.equal(storage.memory.get(persistence.DIVINATION_STORAGE_KEY), before)
  assert.ok(record.id)
})
