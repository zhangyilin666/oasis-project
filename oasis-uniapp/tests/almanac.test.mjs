import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { build } from 'esbuild'

const fixtures = JSON.parse(await readFile(new URL('./fixtures/almanac-reference.json', import.meta.url), 'utf8'))
const bundle = await build({ stdin: { contents: "export * from './src/domain/almanac'; export * from './src/domain/almanac/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const { calculateAlmanac, shiftAlmanacDate, getAlmanacToday, createAlmanacRepository, ALMANAC_STORAGE_KEY, MAX_ALMANAC_RECORDS } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const at = (date, time) => calculateAlmanac({ date, time })

test('13 independent HKO lunar dates cover New Year, ordinary/leap month and civil year ends', () => {
  for (const { date, ...expected } of fixtures.lunarCases) {
    const { year, month, day, isLeapMonth } = at(date).lunar
    assert.deepEqual({ year, month, day, isLeapMonth }, expected, date)
  }
  assert.match(at('2023-03-22').lunar.label, /闰二月初一/)
})

test('six HKO daily ganzhi samples agree at noon and remain on the civil date after 23:00', () => {
  for (const { date, ganzhi } of fixtures.dayGanzhiCases) {
    for (const time of ['00:00', '12:00', '23:00', '23:59']) assert.equal(at(date, time).ganzhi.day, ganzhi, `${date} ${time}`)
  }
  assert.equal(at('2024-02-09', '23:59').ganzhi.day, '癸卯')
  assert.equal(at('2024-02-10', '00:00').ganzhi.day, '甲辰')
})

test('48 independent minute-resolution HKO terms agree within the stated tolerance and switch before/after', t => {
  let maxDifference = 0
  for (const [name, beijingTime] of fixtures.solarTerms) {
    const reference = Date.parse(`${beijingTime.replace(' ', 'T')}:00+08:00`)
    const inputAt = delta => { const local = new Date(reference + delta * 60000 + 8 * 3600000).toISOString(); return at(local.slice(0, 10), local.slice(11, 16)) }
    const before = inputAt(-2), after = inputAt(2)
    assert.equal(before.solarTerms.next.name, name, beijingTime)
    assert.equal(after.solarTerms.current, name, beijingTime)
    assert.equal(after.solarTerms.previous.utcTime, before.solarTerms.next.utcTime)
    const difference = Math.abs(Date.parse(after.solarTerms.previous.utcTime) - reference) / 1000
    maxDifference = Math.max(maxDifference, difference)
    assert.ok(difference <= fixtures.solarTermToleranceSeconds, `${beijingTime}: ${difference}s`)
    assert.ok(before.solarTerms.previous.utcTime <= before.observation.utcTime)
    assert.ok(after.observation.utcTime < after.solarTerms.next.utcTime)
  }
  t.diagnostic(`Largest difference from published minute: ${maxDifference} seconds`)
})

test('an exact representable term instant belongs to the new interval, including zhongqi', () => {
  const before = at('2024-06-21', '04:50'), exact = at('2024-06-21', '04:51')
  assert.equal(before.solarTerms.current, '芒种')
  assert.equal(exact.solarTerms.current, '夏至')
  assert.equal(exact.solarTerms.previous.utcTime, exact.observation.utcTime)
  assert.equal(exact.solarTerms.previous.kind, '中气')
  assert.equal(exact.solarTerms.next.name, '小暑')
})

test('lunar year, solar term year and exact twelve-jie month have distinct boundaries', () => {
  const before = at('2024-02-04', '16:27'), after = at('2024-02-04', '16:28')
  assert.deepEqual(plain(before.ganzhi), { lunarYear: '癸卯', solarTermYear: '癸卯', solarTermMonth: '乙丑', day: '戊戌' })
  assert.deepEqual(plain(after.ganzhi), { lunarYear: '癸卯', solarTermYear: '甲辰', solarTermMonth: '丙寅', day: '戊戌' })
  assert.equal(at('2024-02-09', '23:59').ganzhi.lunarYear, '癸卯')
  assert.equal(at('2024-02-10', '00:00').ganzhi.lunarYear, '甲辰')
  assert.equal(at('2024-03-05', '10:22').ganzhi.solarTermMonth, '丙寅')
  assert.equal(at('2024-03-05', '10:23').ganzhi.solarTermMonth, '丁卯')
  assert.equal(at('2024-03-20', '11:06').ganzhi.solarTermMonth, at('2024-03-20', '11:07').ganzhi.solarTermMonth)
})

test('traditional whole-day Yi/Ji is independent of the selected time and is explicitly sourced', () => {
  const before = at('2024-02-04', '00:00'), after = at('2024-02-04', '23:59')
  assert.deepEqual(plain(before.traditional), plain(after.traditional))
  assert.equal(before.traditional.monthGanZhi, '丙寅')
  assert.notEqual(before.ganzhi.solarTermMonth, before.traditional.monthGanZhi)
  assert.match(before.traditional.sourceUrl, /6tail\.cn.*yiji/)
  assert.match(before.traditional.convention, /整日.*00:00/)
  assert.ok(before.sources.some(source => source.role === 'reference'))
  assert.ok(before.sources.some(source => source.role === 'traditional'))
})

test('term lookup crosses calendar years and both supported endpoints', () => {
  const january = at('2024-01-01')
  assert.equal(january.solarTerms.previous.name, '冬至')
  assert.match(january.solarTerms.previous.beijingTime, /^2023-/)
  assert.equal(january.solarTerms.next.name, '小寒')
  for (const date of ['1900-01-01', '2099-12-31']) {
    const result = at(date)
    assert.ok(result.solarTerms.previous.utcTime <= result.observation.utcTime)
    assert.ok(result.observation.utcTime < result.solarTerms.next.utcTime)
  }
  assert.match(at('2099-12-31').solarTerms.next.beijingTime, /^2100-/)
})

test('defaults, UTC conversion, leap-day navigation and UTC+8 today are deterministic', () => {
  assert.equal(at('2024-02-29').input.time, '12:00')
  assert.equal(at('2024-02-29').observation.utcTime, '2024-02-29T04:00:00.000Z')
  assert.equal(shiftAlmanacDate('2024-02-28', 1), '2024-02-29')
  assert.equal(shiftAlmanacDate('2024-03-01', -1), '2024-02-29')
  assert.equal(shiftAlmanacDate('2023-12-31', 1), '2024-01-01')
  assert.equal(shiftAlmanacDate('2024-01-01', -1), '2023-12-31')
  assert.equal(getAlmanacToday(new Date('2024-02-09T15:59:59Z')), '2024-02-09')
  assert.equal(getAlmanacToday(new Date('2024-02-09T16:00:00Z')), '2024-02-10')
})

test('invalid and unsupported inputs fail explicitly without coercion or date rollover', () => {
  for (const date of ['', '2024-2-01', '2024-02-30', '1900-02-29', '2023-02-29', '2024-00-01', '2024-13-01', '2024-01-00', '1899-12-31', '2100-01-01', 20240201, null]) assert.throws(() => at(date))
  for (const time of ['', '24:00', '12:60', '1:00', '12:00:00', null, 1200]) assert.throws(() => at('2024-02-10', time))
  assert.throws(() => calculateAlmanac(null))
  assert.throws(() => shiftAlmanacDate('1900-01-01', -1))
  assert.throws(() => shiftAlmanacDate('2099-12-31', 1))
  assert.throws(() => shiftAlmanacDate('2024-01-01', 2))
  assert.throws(() => getAlmanacToday(new Date('invalid')))
})

test('the entire result is unchanged across UTC, New York and Tokyo device zones', () => {
  const script = `${bundle.outputFiles[0].text}\nprocess.stdout.write(JSON.stringify(module.exports.calculateAlmanac({date:'2024-02-04',time:'16:28'})))`
  const outputs = ['UTC', 'America/New_York', 'Asia/Tokyo'].map(TZ => {
    const result = spawnSync(process.execPath, ['-'], { input: script, encoding: 'utf8', env: { ...process.env, TZ }, maxBuffer: 5 * 1024 * 1024 })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  })
  assert.equal(outputs[0], outputs[1]); assert.equal(outputs[1], outputs[2])
})

function memoryStorage() {
  const values = new Map()
  let writes = 0
  return { values, get writes() { return writes }, getItem: key => values.get(key), setItem(key, value) { writes++; values.set(key, value) } }
}

test('snapshot storage survives repository recreation and preserves historical values without recalculation', () => {
  const storage = memoryStorage(), repository = createAlmanacRepository(storage), result = plain(at('2023-03-22'))
  result.solarTerms.precisionNote = '保存当时的参考说明'
  result.engine.version = '1.8.5'
  const saved = repository.save(result, '2026-10-03T08:00:00.000Z')
  result.lunar.label = 'caller mutation'
  const restored = createAlmanacRepository(storage).list()[0]
  assert.deepEqual(plain(restored), plain(saved))
  assert.equal(restored.result.solarTerms.precisionNote, '保存当时的参考说明')
  assert.equal(restored.result.engine.version, '1.8.5')
  assert.notEqual(restored.result.lunar.label, 'caller mutation')
  assert.equal(restored.result.ruleVersion, 'almanac-v1')
  assert.deepEqual(JSON.parse(repository.exportJSON()).records, [plain(saved)])
  assert.deepEqual([...storage.values.keys()], [ALMANAC_STORAGE_KEY])
})

test('same-millisecond saves are unique, capacity is bounded, and delete affects only its record', () => {
  const storage = memoryStorage(), repository = createAlmanacRepository(storage), result = at('2024-02-10')
  for (let i = 0; i < MAX_ALMANAC_RECORDS; i++) repository.save(result, '2026-10-03T08:00:00.000Z')
  const records = repository.list()
  assert.equal(new Set(records.map(record => record.id)).size, MAX_ALMANAC_RECORDS)
  const original = storage.values.get(ALMANAC_STORAGE_KEY)
  assert.throws(() => repository.save(result), /20/)
  assert.equal(storage.values.get(ALMANAC_STORAGE_KEY), original)
  repository.remove(records[5].id)
  assert.equal(repository.list().length, MAX_ALMANAC_RECORDS - 1)
  assert.ok(!repository.list().some(record => record.id === records[5].id))
  assert.throws(() => repository.remove('missing'), /不存在/)
})

test('corrupt, incomplete, unknown-version and unsafe-link snapshots remain untouched by any mutation', () => {
  const clean = { schemaVersion: 1, records: [{ id: 'saved', savedAt: '2026-10-03T08:00:00.000Z', result: plain(at('2024-02-10')) }] }
  const corruptions = ['{broken', JSON.stringify({ ...clean, schemaVersion: 2 }), JSON.stringify({ ...clean, records: [clean.records[0], clean.records[0]] })]
  for (const mutate of [r => { delete r.lunar }, r => { r.ruleVersion = 'future' }, r => { r.traditional.sourceUrl = 'javascript:alert(1)' }, r => { r.solarTerms.previous.utcTime = r.solarTerms.next.utcTime }, r => { r.traditional.yi = 'not an array' }, r => { r.input.date = '2024-02-30' }]) {
    const candidate = plain(clean); mutate(candidate.records[0].result); corruptions.push(JSON.stringify(candidate))
  }
  for (const raw of corruptions) {
    const storage = memoryStorage(); storage.values.set(ALMANAC_STORAGE_KEY, raw)
    const repository = createAlmanacRepository(storage)
    assert.throws(() => repository.list(), /保留/)
    assert.throws(() => repository.save(at('2024-02-11')), /保留/)
    assert.throws(() => repository.remove('saved'), /保留/)
    assert.throws(() => repository.exportJSON(), /保留/)
    assert.equal(storage.values.get(ALMANAC_STORAGE_KEY), raw)
    assert.equal(storage.writes, 0)
  }
})

test('storage permission/quota failures are explicit and do not claim success', () => {
  const unreadable = createAlmanacRepository({ getItem() { throw new Error('denied') }, setItem() { assert.fail('must not write') } })
  assert.throws(() => unreadable.list(), /无法读取/)
  assert.throws(() => unreadable.save(at('2024-02-10')), /无法读取/)
  const unwritable = createAlmanacRepository({ getItem() { return undefined }, setItem() { throw new Error('quota') } })
  assert.throws(() => unwritable.save(at('2024-02-10')), /保存失败/)
})
