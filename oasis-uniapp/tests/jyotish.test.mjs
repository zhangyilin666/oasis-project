import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { build } from 'esbuild'

const fixtures = JSON.parse(await readFile(new URL('./fixtures/jyotish-reference.json', import.meta.url), 'utf8'))
const bundle = await build({ stdin: { contents: "export * from './src/domain/jyotish/index'; export * from './src/domain/jyotish/astronomy'; export * from './src/domain/jyotish/rules'; export * from './src/domain/jyotish/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const { calculateJyotish, calculateSiderealPositions, navamsaPosition, moonNakshatra, calculateVimshottari, currentDasha, createJyotishRepository, JYOTISH_STORAGE_KEY, validateJyotishSnapshot } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const difference = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const profile = { date: '2000-01-01', time: '12:00', gender: '女', utcOffset: 0, timePrecision: 'minute', place: { latitude: 28.6139, longitude: 77.209 } }
const snapshot = () => calculateJyotish(profile, { observationDate: '2024-03-20' })

for (const fixture of fixtures.cases) test(`independent sidereal seven-body ephemeris and Lahiri baseline: ${fixture.date}`, () => {
  const result = calculateSiderealPositions(new Date(fixture.date + 'T12:00:00Z'))
  assert.deepEqual(plain(result.positions.map(p => p.body)), fixtures.bodyOrder)
  assert.ok(Math.abs(result.ayanamsa.trueDegrees - fixture.ayanamsa) * 3600 < fixtures.ayanamsaToleranceArcseconds)
  result.positions.forEach((position, index) => assert.ok(difference(position.longitude, fixture.longitudes[index]) < fixtures.longitudeToleranceDegrees, `${position.body}: ${position.longitude} vs ${fixture.longitudes[index]}`))
})
for (const fixture of fixtures.houses) test(`independent sidereal ASC/MC and whole-sign cusps: ${fixture.place.name}`, () => {
  const result = calculateJyotish({ ...profile, date: fixture.date, place: fixture.place }, { observationDate: '2024-03-20' })
  assert.equal(result.houses.status, 'ready')
  assert.ok(difference(result.houses.ascendant.longitude, fixture.ascendant) < 0.03)
  assert.ok(difference(result.houses.midheaven.longitude, fixture.midheaven) < 0.03)
  assert.deepEqual(plain(result.houses.cusps), Array.from({ length: 12 }, (_, i) => (fixture.firstCusp + 30 * i) % 360))
  validateJyotishSnapshot(result)
})
test('Parashari D9 agrees with two textbook worked examples', () => {
  for (const fixture of fixtures.textbook.d9Example16) {
    assert.equal(navamsaPosition(fixture.longitude).sign, fixture.d9Sign)
    assert.ok(Math.abs(navamsaPosition(fixture.longitude).longitude - fixture.d9Longitude) < 1e-10)
  }
})
test('all D9 and 27 nakshatra boundaries use right-open intervals and preserve wrap', () => {
  for (let i = 0; i < 108; i++) {
    const boundary = i * 10 / 3
    assert.equal(navamsaPosition(boundary).signIndex, i % 12)
    assert.equal(navamsaPosition(boundary + 1e-7).signIndex, i % 12)
    assert.equal(navamsaPosition(boundary - 1e-7).signIndex, (i + 11) % 12)
    assert.equal(moonNakshatra(boundary + 1e-7).pada, i % 4 + 1)
  }
  for (let i = 0; i < 27; i++) {
    const boundary = i * 40 / 3
    assert.equal(moonNakshatra(boundary).index, i)
    assert.equal(moonNakshatra(boundary + 1e-7).index, i)
    assert.equal(moonNakshatra(boundary - 1e-7).index, (i + 26) % 27)
  }
  assert.equal(moonNakshatra(360).index, 0)
  assert.equal(moonNakshatra(0).remainingFraction, 1)
  assert.throws(() => moonNakshatra(NaN))
})
test('Vimshottari textbook Moon gives independent balance and Julian-year end', () => {
  const f = fixtures.textbook.dashaExample50
  const moon = moonNakshatra(f.moonLongitude)
  assert.equal(moon.name, f.nakshatra); assert.equal(moon.pada, f.pada); assert.equal(moon.lord, f.lord)
  assert.ok(Math.abs(moon.remainingFraction - f.remainingFraction) < 1e-12)
  assert.ok(Math.abs(moon.remainingYears - f.remainingYears) < 1e-12)
  const periods = calculateVimshottari(new Date(f.birthUtc), f.moonLongitude)
  assert.equal(periods[0].endUtc, f.firstEndJulianYearUtc)
  assert.deepEqual(plain(periods.map(p => p.lord)), ['Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus', 'Sun', 'Moon'])
  assert.equal(periods[0].antardashas[0].years, 49 / 120)
  assert.notEqual(currentDasha(periods, new Date(f.birthUtc)).antar, 'Mars', 'Birth need not be in first antar of the initial maha')
})
test('full maha and antar durations cover 120 years without overlaps or gaps', () => {
  for (const moon of [0, 13.3333, 71, 302.3833333333333, 359.999999]) {
    const periods = calculateVimshottari(new Date('2000-01-01T12:00:00Z'), moon)
    assert.equal(Date.parse(periods[8].endUtc) - Date.parse(periods[0].startUtc), 120 * 365.25 * 86400000)
    periods.forEach((period, i) => {
      if (i) assert.equal(period.startUtc, periods[i - 1].endUtc)
      assert.equal(period.antardashas[0].startUtc, period.startUtc)
      assert.equal(period.antardashas[8].endUtc, period.endUtc)
      assert.ok(Math.abs(period.antardashas.reduce((sum, sub) => sum + sub.years, 0) - period.years) < 1e-10)
      period.antardashas.forEach((sub, j) => { if (j) assert.equal(sub.startUtc, period.antardashas[j - 1].endUtc) })
    })
    const edge = new Date(periods[0].endUtc)
    assert.equal(currentDasha(periods, new Date(edge.getTime() - 1)).maha, periods[0].lord)
    assert.equal(currentDasha(periods, edge).maha, periods[1].lord)
    assert.equal(currentDasha(periods, new Date(periods[8].endUtc)), null)
  }
})
test('missing place, approximate time and extreme latitude disable only houses', () => {
  for (const p of [{ ...profile, place: undefined }, { ...profile, timePrecision: 'approximate' }, { ...profile, place: { latitude: 66, longitude: 0 } }]) {
    const result = calculateJyotish(p, { observationDate: '2024-03-20' })
    assert.equal(result.houses.status, 'unavailable'); assert.equal(result.positions.length, 7)
    assert.ok(result.positions.every(position => position.house === null)); validateJyotishSnapshot(result)
  }
  assert.throws(() => calculateJyotish({ ...profile, time: '' }))
  assert.throws(() => calculateJyotish({ ...profile, date: '2000-02-30' }))
  assert.throws(() => calculateJyotish(profile, { observationDate: '2024-02-30' }))
  assert.throws(() => calculateJyotish(profile, { observationDate: '2024-99-99' }))
})
test('IANA fold/gap validation and resolved offset are preserved in snapshot', () => {
  const base = { ...profile, date: '2023-11-05', time: '01:30', timeZone: 'America/New_York', place: undefined }
  assert.throws(() => calculateJyotish(base))
  const early = calculateJyotish({ ...base, timeChoice: 'earlier' }, { observationDate: '2024-03-20' })
  const late = calculateJyotish({ ...base, timeChoice: 'later' }, { observationDate: '2024-03-20' })
  assert.equal(Date.parse(late.birthUtc) - Date.parse(early.birthUtc), 3600000)
  validateJyotishSnapshot(early); validateJyotishSnapshot(late)
  assert.throws(() => calculateJyotish({ ...base, date: '2023-03-12', time: '02:30' }))
})
test('observations before birth or beyond computed cycle have explicit empty current period', () => {
  assert.equal(calculateJyotish(profile, { observationDate: '1999-12-31' }).vimshottari.active, null)
  const result = calculateJyotish({ ...profile, date: '1900-01-01' }, { observationDate: '2099-12-31' })
  assert.equal(result.vimshottari.active, null); validateJyotishSnapshot(result)
})
test('local snapshot roundtrip is immutable and deletion/export preserve other records', () => {
  let raw = ''; let id = 0
  const repo = createJyotishRepository({ getItem: key => { assert.equal(key, JYOTISH_STORAGE_KEY); return raw }, setItem: (key, value) => { assert.equal(key, JYOTISH_STORAGE_KEY); raw = value } }, () => new Date('2026-01-01T00:00:00Z'), () => `id-${++id}`)
  const original = snapshot(); const first = repo.save('第一份', original); repo.save('第二份', original)
  original.positions[0].longitude = 10; first.snapshot.positions[0].name = 'changed'
  assert.notEqual(repo.list()[1].snapshot.positions[0].longitude, 10)
  assert.equal(repo.list()[1].snapshot.positions[0].name, '太阳')
  assert.equal(repo.exportJSON().records.length, 2)
  assert.equal(repo.remove(first.id).length, 1)
  assert.equal(repo.list()[0].name, '第二份')
})
test('corrupt/unknown archives and failing storage are never silently overwritten', () => {
  const original = snapshot()
  for (const payload of ['{', JSON.stringify({ version: 2, records: [] }), JSON.stringify({ version: 1, records: [{ id: 'x', name: 'a', savedAt: '2026-01-01T00:00:00.000Z', snapshot: { ...original, ruleVersion: 'future' } }] })]) {
    let writes = 0
    const repo = createJyotishRepository({ getItem: () => payload, setItem: () => writes++ })
    assert.throws(() => repo.list()); assert.throws(() => repo.save('test', original)); assert.throws(() => repo.remove('x')); assert.equal(writes, 0)
  }
  const repo = createJyotishRepository({ getItem: () => '', setItem: () => { throw new Error('quota') } })
  assert.throws(() => repo.save('test', original), /保存失败/)
  const broken = plain(original); broken.vimshottari.periods[0].antardashas[1].startUtc = '2000-01-01T00:00:00.000Z'
  assert.throws(() => validateJyotishSnapshot(broken))
})
test('archive capacity, duplicate ids and read failures leave stored records untouched', () => {
  let raw = ''; let id = 0
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value } }
  const repo = createJyotishRepository(storage, () => new Date('2026-01-01T00:00:00Z'), () => `item-${++id}`)
  const chart = snapshot()
  for (let i = 0; i < 20; i++) repo.save(String(i), chart)
  const full = raw
  assert.throws(() => repo.save('overflow', chart), /20/); assert.equal(raw, full)
  repo.remove('item-1')
  const collision = createJyotishRepository(storage, () => new Date('2026-01-01T00:00:00Z'), () => 'item-2')
  const before = raw; assert.throws(() => collision.save('duplicate', chart), /编号/); assert.equal(raw, before)
  let writes = 0
  const unreadable = createJyotishRepository({ getItem: () => { throw new Error('blocked') }, setItem: () => writes++ })
  assert.throws(() => unreadable.save('new', chart)); assert.equal(writes, 0)
})
test('serialized chart does not depend on device timezone', () => {
  const code = `${bundle.outputFiles[0].text}\nconsole.log(JSON.stringify(module.exports.calculateJyotish(${JSON.stringify(profile)}, {observationDate:'2024-03-20'})))`
  const outputs = ['UTC', 'America/New_York', 'Asia/Tokyo'].map(TZ => {
    const result = spawnSync(process.execPath, ['-'], { input: code, env: { ...process.env, TZ }, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr); return result.stdout
  })
  assert.equal(outputs[0], outputs[1]); assert.equal(outputs[1], outputs[2])
})
