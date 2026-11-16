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
const domain = await load('../src/domain/date-selection/index.ts')
const storage = await load('../src/domain/date-selection/repository.ts')
const plain = value => JSON.parse(JSON.stringify(value))
const input = (overrides = {}) => ({ title: '安排出行', startDate: '2026-06-28', endDate: '2026-06-30', activity: '出行', mode: 'practical-only', availableWeekdays: [0, 1, 2, 3, 4, 5, 6], excludedDates: [], venueNotes: '', ...overrides })
const june = domain.calculateDateSelection(input())
function memory(initial) {
  const data = new Map(initial === undefined ? [] : [[storage.DATE_SELECTION_STORAGE_KEY, initial]])
  return { data, getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }
}

test('four exact-name activities have positive, negative, missing and contradictory rule examples', () => {
  for (const activity of ['嫁娶', '出行', '入宅', '开市']) {
    assert.equal(domain.evaluateTraditionalActivity(activity, [activity], ['无']).status, 'pass')
    assert.equal(domain.evaluateTraditionalActivity(activity, ['无'], [activity]).status, 'conflict')
    assert.equal(domain.evaluateTraditionalActivity(activity, ['祭祀'], ['安葬']).status, 'not-covered')
    const both = domain.evaluateTraditionalActivity(activity, [activity], [activity])
    assert.equal(both.status, 'conflict')
    assert.match(both.reason, /同时列于宜和忌/)
    for (const general of ['无', '诸事不宜', '余事勿取', '馀事勿取']) assert.equal(domain.evaluateTraditionalActivity(activity, [general], [general]).status, 'not-covered')
  }
  assert.throws(() => domain.evaluateTraditionalActivity('投资', [], []), /支持范围/)
})

test('source-table fixtures are independently decoded from the author JavaScript table, not obtained by invoking the adapter', () => {
  // Primary source: 6tail/lunar-javascript, 4c45a59f79b856125516f31aefa8295035c16afd, lunar.js DAY_YI_JI.
  // Table month 甲午 = index 30 = 1E; days 癸酉/甲戌/乙亥 = 09/0A/0B.
  // YI_JI activity indices: 嫁娶 0F, 入宅 29, 开市 52, 出行 70.
  // Manually read encoded rows:
  // 09=3606121E2A:00076A74504089,5229702C7D
  // 0A=06121E2A36:0F110001708471292E1F20,0338805156
  // 0B=06121E2A36:111817000106702C2E71292A0D33802D302F4E2B44,0F522520
  // These verify adapter membership, not independent historical validity of the traditional table.
  const expected = [
    ['2026-06-28', '癸酉', ['not-covered', 'conflict', 'conflict', 'conflict']],
    ['2026-06-29', '甲戌', ['pass', 'pass', 'pass', 'not-covered']],
    ['2026-06-30', '乙亥', ['conflict', 'pass', 'pass', 'conflict']],
  ]
  for (const [date, dayGanZhi, statuses] of expected) {
    const facts = june.days.find(day => day.facts.date === date).facts
    assert.equal(facts.tableMonthGanZhi, '甲午')
    assert.equal(facts.dayGanZhi, dayGanZhi)
    for (let i = 0; i < 4; i++) assert.equal(domain.evaluateTraditionalActivity(['嫁娶', '出行', '入宅', '开市'][i], facts.yi, facts.ji).status, statuses[i])
  }
})

test('calendar facts include independent HKO Chinese New Year fixture and known weekdays', () => {
  // HKO T2025c.txt: 2025-01-29 is first lunar month, first day.
  const result = domain.calculateDateSelection(input({ startDate: '2025-01-29', endDate: '2025-01-29' }))
  assert.equal(result.days[0].facts.lunarLabel, '二〇二五年正月初一')
  assert.equal(result.days[0].facts.weekday, 3)
  assert.deepEqual(plain(june.days.map(day => day.facts.weekday)), [0, 1, 2])
  assert.equal(result.calendar.timeZone, 'UTC+08:00')
  assert.equal(result.calendar.sect, 1)
})

test('practical-only mode preserves traditional conflicts without using them to remove a candidate', () => {
  assert.equal(june.summary.candidates, 3)
  assert.equal(june.days[0].rules[2].status, 'conflict')
  assert.equal(june.days[0].rules[2].applied, false)
  assert.equal(june.days[0].outcome, 'candidate')
  assert.equal(june.days[0].rules[3].status, 'not-covered')
  assert.equal(june.days[0].rules[3].applied, false)
})

test('enabled traditional rules distinguish conflict, positive membership and non-coverage', () => {
  const result = domain.calculateDateSelection(input({ activity: '开市', mode: 'require-yi' }))
  assert.deepEqual(plain(result.days.map(day => day.outcome)), ['conflict', 'not-covered', 'conflict'])
  assert.deepEqual(plain(result.summary), { total: 3, candidates: 0, conflicts: 2, notCovered: 1 })
  const travel = domain.calculateDateSelection(input({ mode: 'require-yi' }))
  assert.deepEqual(plain(travel.days.map(day => day.outcome)), ['conflict', 'candidate', 'candidate'])
})

test('weekday and excluded-date conflicts remain independent of favorable traditional membership', () => {
  const result = domain.calculateDateSelection(input({ mode: 'require-yi', availableWeekdays: [1, 3, 5], excludedDates: ['2026-06-29'], venueNotes: '场地尚未确认。' }))
  assert.equal(result.summary.candidates, 0)
  assert.equal(result.days[0].rules[0].status, 'conflict')
  assert.equal(result.days[1].rules[0].status, 'pass')
  assert.equal(result.days[1].rules[1].status, 'conflict')
  assert.equal(result.days[1].rules[2].status, 'pass')
  assert.equal(result.days[1].outcome, 'conflict')
  assert.match(result.days[1].rules[3].reason, /人工确认/)
  assert.equal(result.days.length, 3)
  assert.ok(result.days.every(day => day.rules.length === 4))
})

test('date windows are inclusive, support leap days and year boundaries, and stop at 31 days', () => {
  assert.deepEqual(plain(domain.dateSelectionDates('2024-02-28', '2024-03-01')), ['2024-02-28', '2024-02-29', '2024-03-01'])
  assert.deepEqual(plain(domain.dateSelectionDates('2025-12-31', '2026-01-01')), ['2025-12-31', '2026-01-01'])
  assert.equal(domain.dateSelectionDates('1900-01-01', '1900-01-31').length, 31)
  assert.equal(domain.calculateDateSelection(input({ startDate: '2099-12-31', endDate: '2099-12-31' })).days.length, 1)
  assert.equal(domain.calculateDateSelection(input({ startDate: '1900-01-01', endDate: '1900-01-01' })).days.length, 1)
  assert.throws(() => domain.dateSelectionDates('2026-01-01', '2026-02-01'), /31/)
  assert.throws(() => domain.dateSelectionDates('2026-01-02', '2026-01-01'), /31/)
  for (const date of ['1900-02-29', '2025-02-29', '2026-04-31', '1899-12-31', '2100-01-01', '2026-6-1', 'bad']) assert.throws(() => domain.dateSelectionDates(date, date), /日期/)
})

test('input normalization trims text and canonicalizes dates and weekdays without silently removing constraints', () => {
  const result = domain.normalizeDateSelectionInput(input({ title: '  周末安排  ', availableWeekdays: [6, 0], excludedDates: ['2026-06-30', '2026-06-28'], venueNotes: '  需确认场地  ' }))
  assert.equal(result.title, '周末安排')
  assert.equal(result.venueNotes, '需确认场地')
  assert.deepEqual(plain(result.availableWeekdays), [0, 6])
  assert.deepEqual(plain(result.excludedDates), ['2026-06-28', '2026-06-30'])
  const invalids = [ { title: '' }, { title: '字'.repeat(101) }, { venueNotes: '字'.repeat(1001) }, { activity: '自选事项' }, { mode: 'score' }, { availableWeekdays: [] }, { availableWeekdays: [1, 1] }, { availableWeekdays: [7] }, { availableWeekdays: [0.5] }, { excludedDates: ['2026-07-01'] }, { excludedDates: ['2026-06-29', '2026-06-29'] }, { excludedDates: ['2026-06-31'] } ]
  for (const overrides of invalids) assert.throws(() => domain.normalizeDateSelectionInput(input(overrides)))
})

test('sect1 declaration and month facts use the entire jie day including before a late-day boundary', () => {
  // NAOJ 2026 calendar: Jingzhe March 5 22:59 JST = 21:59 UTC+8, after sample noon.
  // Source https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou262.html.
  const result = domain.calculateDateSelection(input({ startDate: '2026-03-04', endDate: '2026-03-05' }))
  assert.equal(result.days[0].facts.tableMonthGanZhi, '庚寅')
  assert.equal(result.days[1].facts.tableMonthGanZhi, '辛卯')
  assert.ok(result.conventions.some(text => text.includes('交节所在日 00:00')))
})

test('fixed civil-date outputs do not change with device timezone', () => {
  const old = process.env.TZ
  try {
    const snapshots = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map(zone => { process.env.TZ = zone; return JSON.stringify(domain.calculateDateSelection(input({ startDate: '2026-03-08', endDate: '2026-03-09' }))) })
    assert.equal(snapshots[0], snapshots[1]); assert.equal(snapshots[1], snapshots[2])
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old }
})

test('snapshots preserve complete facts, versions, source links and every day log in isolated copies', () => {
  assert.equal(domain.isDateSelectionSnapshot(june), true)
  const validated = domain.validateDateSelectionSnapshot(june)
  assert.deepEqual(plain(validated), plain(june))
  validated.days[0].facts.yi.push('新增项')
  validated.input.availableWeekdays.pop()
  validated.sources[0].title = '修改'
  assert.equal(june.days[0].facts.yi.includes('新增项'), false)
  assert.equal(june.input.availableWeekdays.length, 7)
  assert.notEqual(domain.DATE_SELECTION_SOURCES[0].title, '修改')
  assert.equal(Object.isFrozen(domain.DATE_SELECTION_SOURCES[0]), true)
  assert.match(june.conventions.join(''), /2345/)
})

test('snapshot validation rejects unknown versions, extra fields, dropped dates and altered decision logs', () => {
  const mutations = [
    snap => { snap.ruleVersion = 'date-selection-v2' }, snap => { snap.tableVersion = 'new-table' }, snap => { snap.calendar.sect = 2 },
    snap => { snap.days.pop() }, snap => { snap.days.reverse() }, snap => { snap.days[0].rules[2].status = 'pass' },
    snap => { snap.days[0].rules[2].reason = '保证成功' }, snap => { snap.days[0].outcome = 'conflict' }, snap => { snap.summary.candidates = 99 },
    snap => { snap.sources[0].url = 'https://example.com' }, snap => { snap.conventions.pop() }, snap => { snap.input.title = ' 安排出行 ' },
    snap => { snap.days[0].facts.weekday = 1 }, snap => { snap.days[0].facts.dayGanZhi = '甲丑' }, snap => { snap.days[0].facts.yi = [] },
    snap => { snap.days[0].facts.extra = 'x' }, snap => { snap.input.extra = 'x' }, snap => { snap.extra = 'x' },
  ]
  for (const mutate of mutations) { const snapshot = plain(june); mutate(snapshot); assert.equal(domain.isDateSelectionSnapshot(snapshot), false); assert.throws(() => domain.validateDateSelectionSnapshot(snapshot), /格式异常|版本/) }
})

test('repository stores snapshots and reopening/exporting does not recalculate historical facts', () => {
  const mem = memory(), repo = storage.createDateSelectionRepository(mem)
  const record = repo.save(june, '2026-10-03T00:00:00.000Z')
  assert.deepEqual(plain(repo.list()[0].snapshot), plain(june))
  assert.equal(JSON.parse(repo.exportJSON()).kind, 'date-selection')
  assert.deepEqual(JSON.parse(repo.exportJSON()).records[0].snapshot, plain(june))
  record.snapshot.days[0].facts.yi.push('篡改返回值')
  assert.equal(repo.list()[0].snapshot.days[0].facts.yi.includes('篡改返回值'), false)
  const read = repo.list(); read[0].snapshot.input.title = '改名'
  assert.equal(repo.list()[0].snapshot.input.title, '安排出行')
  repo.remove(record.id)
  assert.equal(repo.list().length, 0)
})

test('20 full 31-day snapshots fit, duplicate timestamps remain unique and the 21st record preserves stored data', () => {
  const mem = memory(), repo = storage.createDateSelectionRepository(mem)
  const full = domain.calculateDateSelection(input({ title: '字'.repeat(100), venueNotes: '字'.repeat(1000), startDate: '2026-10-01', endDate: '2026-10-31' }))
  for (let i = 0; i < 20; i++) repo.save(full, '2026-10-03T00:00:00.000Z')
  const before = mem.data.get(storage.DATE_SELECTION_STORAGE_KEY)
  assert.equal(repo.list().length, 20)
  assert.equal(new Set(repo.list().map(record => record.id)).size, 20)
  assert.throws(() => repo.save(full), /最多保存 20/)
  assert.equal(mem.data.get(storage.DATE_SELECTION_STORAGE_KEY), before)
  assert.throws(() => repo.remove('missing'), /不存在/)
})

test('corrupt or mismatched envelopes block reads, saves, deletes and export without replacing existing data', () => {
  const good = { schemaVersion: 1, kind: 'date-selection', records: [{ id: 'saved-1', savedAt: '2026-10-03T00:00:00.000Z', snapshot: plain(june) }] }
  const badVersion = plain(good); badVersion.records[0].snapshot.ruleVersion = 'future'
  const badKind = plain(good); badKind.kind = 'tarot'
  const duplicates = plain(good); duplicates.records.push(plain(duplicates.records[0]))
  const malformedDay = plain(good); malformedDay.records[0].snapshot.days[0].rules = []
  for (const raw of ['broken-json', '{}', JSON.stringify(badVersion), JSON.stringify(badKind), JSON.stringify(duplicates), JSON.stringify(malformedDay)]) {
    const mem = memory(raw), repo = storage.createDateSelectionRepository(mem)
    for (const operation of [() => repo.list(), () => repo.save(june), () => repo.remove('saved-1'), () => repo.exportJSON()]) { assert.throws(operation, /原始数据已保留/); assert.equal(mem.data.get(storage.DATE_SELECTION_STORAGE_KEY), raw) }
  }
})

test('storage errors and rejected snapshots leave previous persisted records intact', () => {
  const mem = memory(), repo = storage.createDateSelectionRepository(mem)
  repo.save(june)
  const before = mem.data.get(storage.DATE_SELECTION_STORAGE_KEY)
  const broken = plain(june); broken.days[0].outcome = 'conflict'
  assert.throws(() => repo.save(broken), /内容不完整/)
  assert.throws(() => repo.save(june, '2026-02-30T00:00:00.000Z'), /保存时间/)
  const quota = storage.createDateSelectionRepository({ getItem: mem.getItem, setItem: () => { throw new Error('quota') } })
  assert.throws(() => quota.save(june), /未确认成功/)
  assert.equal(mem.data.get(storage.DATE_SELECTION_STORAGE_KEY), before)
  const denied = storage.createDateSelectionRepository({ getItem: () => { throw new Error('denied') }, setItem: () => assert.fail('must not write') })
  assert.throws(() => denied.list(), /无法读取/)
  assert.throws(() => denied.save(june), /无法读取/)
})
