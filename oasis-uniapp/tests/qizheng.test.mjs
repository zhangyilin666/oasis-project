import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { build } from 'esbuild'

const fixture = JSON.parse(await readFile(new URL('./fixtures/qizheng-reference.json', import.meta.url), 'utf8'))
const bundle = await build({ stdin: { contents: "export * from './src/domain/qizheng/index'; export * from './src/domain/qizheng/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const { calculateQizheng, calculateQizhengPositions, normalizeQizhengMoment, formatRightAscension, createQizhengRepository, validateQizhengSnapshot, QIZHENG_STORAGE_KEY } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const difference = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const moment = { date: '2000-01-01', time: '12:00', utcOffset: 8, timePrecision: 'minute' }

for (const item of fixture.cases) test(`independent seven-governor ecliptic and equatorial reference: ${item.date}`, () => {
  const positions = calculateQizhengPositions(new Date(item.date + 'T04:00:00Z'))
  assert.deepEqual(plain(positions.map(p => p.body)), fixture.bodyOrder)
  positions.forEach((p, index) => {
    const expected = item.values[index]
    const actual = [p.longitude, p.latitude, p.rightAscensionDegrees, p.declination]
    actual.forEach((value, column) => assert.ok((column % 2 === 0 ? difference(value, expected[column]) : Math.abs(value - expected[column])) < fixture.toleranceDegrees, `${item.date} ${p.body} ${fixture.columns[column]} ${value} vs ${expected[column]}`))
    assert.ok(Math.abs(p.rightAscensionDegrees - p.rightAscensionHours * 15) < 1e-10)
    assert.ok(Math.abs(p.northPolarDistance - (90 - expected[3])) < fixture.toleranceDegrees)
  })
})
test('reference right ascension decimal unit is independently checked against sexagesimal hours', () => {
  for (const key of ['Sun', 'Moon']) {
    const item = fixture.rightAscensionUnitCheck[key]
    const [, hours, minutes, seconds] = item.sexagesimal.match(/^(\d+)h(\d+)'([\d.]+)$/)
    const degrees = (Number(hours) + Number(minutes) / 60 + Number(seconds) / 3600) * 15
    assert.ok(Math.abs(degrees - item.decimal) < 0.000001)
  }
})
test('snapshot preserves modern units and explicitly omits unverified traditional chart features', () => {
  const input = { ...moment, gender: '女', place: { latitude: 31.2304, longitude: 121.4737 } }
  const before = plain(input); const result = calculateQizheng(input)
  assert.deepEqual(plain(input), before)
  assert.equal(result.utcTime, '2000-01-01T04:00:00.000Z')
  assert.equal(result.coordinates.circleDegrees, 360)
  assert.equal(result.positions.length, 7)
  assert.deepEqual(plain(result.unavailable.map(item => item.id)), ['luohou', 'jidu', 'yuebei', 'ziqi', 'xiudu', 'minggong'])
  assert.ok(result.unavailable.every(item => item.status === 'unavailable' && !Object.hasOwn(item, 'longitude')))
  assert.ok(result.positions.every(item => !Object.hasOwn(item, 'sign') && !Object.hasOwn(item, 'house') && !Object.hasOwn(item, 'mansion')))
  assert.equal(Object.hasOwn(result.moment, 'gender'), false)
  assert.equal(Object.hasOwn(result.moment, 'place'), false)
  validateQizhengSnapshot(result)
})
test('time normalization rejects missing/invalid values and resolves IANA folds and gaps', () => {
  for (const changed of [{ date: '2000-02-30' }, { date: '1899-12-31' }, { date: '2100-01-01' }, { time: '' }, { time: '24:00' }, { timePrecision: undefined }, { utcOffset: 8.1 }, { utcOffset: 15 }, { timeChoice: 'guess' }]) assert.throws(() => normalizeQizhengMoment({ ...moment, ...changed }))
  const fold = { ...moment, date: '2023-11-05', time: '01:30', timeZone: 'America/New_York' }
  assert.throws(() => normalizeQizhengMoment(fold))
  const early = normalizeQizhengMoment({ ...fold, timeChoice: 'earlier' })
  const late = normalizeQizhengMoment({ ...fold, timeChoice: 'later' })
  assert.equal(late.instant - early.instant, 3600000)
  assert.equal(early.moment.utcOffset, -4); assert.equal(late.moment.utcOffset, -5)
  assert.throws(() => normalizeQizhengMoment({ ...fold, date: '2023-03-12', time: '02:30' }))
  const edge = normalizeQizhengMoment({ ...moment, date: '1900-01-01', time: '00:00', utcOffset: 14 })
  assert.equal(edge.instant.toISOString(), '1899-12-31T10:00:00.000Z')
  const future = calculateQizheng({ ...moment, date: '2099-12-31', time: '23:59', utcOffset: -12 })
  assert.equal(future.utcTime, '2100-01-01T11:59:00.000Z'); validateQizhengSnapshot(future)
})
test('approximate sampling is labelled and RA formatting wraps without impossible 24h output', () => {
  assert.match(calculateQizheng({ ...moment, timePrecision: 'approximate' }).limitations.join(''), /大约/)
  assert.equal(formatRightAscension(0), '00时00分00秒')
  assert.equal(formatRightAscension(23.99999999), '00时00分00秒')
  assert.equal(formatRightAscension(-1), '23时00分00秒')
  assert.equal(formatRightAscension(18 + 43 / 60 + 38.4463 / 3600), '18时43分38秒')
  assert.throws(() => formatRightAscension(NaN))
})
test('snapshots retain coordinates and notes without recomputation or mutable aliases', () => {
  let raw = ''; let id = 0
  const repo = createQizhengRepository({ getItem: key => { assert.equal(key, QIZHENG_STORAGE_KEY); return raw }, setItem: (_, value) => { raw = value } }, () => new Date('2026-10-03T00:00:00Z'), () => `record-${++id}`)
  const chart = calculateQizheng(moment)
  const first = repo.save('参考', '原始笔记', chart)
  chart.positions[0].longitude = 10; first.snapshot.positions[0].longitude = 20
  assert.notEqual(repo.list()[0].snapshot.positions[0].longitude, 10)
  assert.notEqual(repo.list()[0].snapshot.positions[0].longitude, 20)
  assert.equal(repo.list()[0].note, '原始笔记')
  repo.save('第二份', '', calculateQizheng(moment))
  assert.equal(repo.exportJSON().records.length, 2)
  assert.equal(repo.remove(first.id).length, 1)
  assert.equal(repo.list()[0].name, '第二份')
})
test('corrupt/unknown archives, quota failures and inconsistent coordinate units never overwrite silently', () => {
  const chart = calculateQizheng(moment)
  for (const raw of ['{', JSON.stringify({ version: 2, records: [] }), JSON.stringify({ version: 1, records: [{ id: 'a', name: 'a', note: '', savedAt: '2026-01-01T00:00:00.000Z', snapshot: { ...chart, ruleVersion: 'future' } }] })]) {
    let writes = 0
    const repo = createQizhengRepository({ getItem: () => raw, setItem: () => writes++ })
    assert.throws(() => repo.list()); assert.throws(() => repo.save('new', '', chart)); assert.throws(() => repo.remove('a')); assert.equal(writes, 0)
  }
  const blocked = createQizhengRepository({ getItem: () => '', setItem: () => { throw new Error('quota') } })
  assert.throws(() => blocked.save('new', '', chart), /保存失败/)
  const inconsistent = plain(chart); inconsistent.positions[0].rightAscensionHours = inconsistent.positions[0].rightAscensionDegrees
  assert.throws(() => validateQizhengSnapshot(inconsistent))
})
test('archive capacity, duplicate ids and read failures preserve stored content', () => {
  let raw = ''; let id = 0
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value } }
  const repo = createQizhengRepository(storage, () => new Date('2026-01-01T00:00:00Z'), () => `item-${++id}`)
  const chart = calculateQizheng(moment)
  for (let i = 0; i < 20; i++) repo.save(String(i), '', chart)
  const full = raw; assert.throws(() => repo.save('full', '', chart), /20/); assert.equal(raw, full)
  repo.remove('item-1'); const before = raw
  const collision = createQizhengRepository(storage, () => new Date('2026-01-01T00:00:00Z'), () => 'item-2')
  assert.throws(() => collision.save('duplicate', '', chart), /编号/); assert.equal(raw, before)
  let writes = 0; const unreadable = createQizhengRepository({ getItem: () => { throw new Error('blocked') }, setItem: () => writes++ })
  assert.throws(() => unreadable.save('new', '', chart)); assert.equal(writes, 0)
})
test('UTC arithmetic and complete results do not depend on device timezone', () => {
  const code = `${bundle.outputFiles[0].text}\nconsole.log(JSON.stringify(module.exports.calculateQizheng(${JSON.stringify(moment)})))`
  const outputs = ['UTC', 'America/New_York', 'Asia/Tokyo'].map(TZ => { const result = spawnSync(process.execPath, ['-'], { input: code, env: { ...process.env, TZ }, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout })
  assert.equal(outputs[0], outputs[1]); assert.equal(outputs[1], outputs[2])
})
