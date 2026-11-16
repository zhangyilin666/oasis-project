import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { build } from 'esbuild'

const fixtures = JSON.parse(await readFile(new URL('./fixtures/western-study-reference.json', import.meta.url), 'utf8'))
const bundle = await build({ stdin: { contents: "export * from './src/domain/western-study/index'; export * from './src/domain/western-study/houses'; export * from './src/domain/western-study/synastry'; export * from './src/domain/western-study/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const { calculateWesternStudy, calculateStudyPerson, equalAscendantCusps, equalAscendantHouse, findSynastryAspects, validateWesternStudySnapshot, createWesternStudyRepository, WESTERN_STUDY_STORAGE_KEY } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const difference = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const person = id => { const chart = fixtures.charts.find(item => item.id === id); return { name: id, profile: plain(chart.profile) } }
const a = person('a2000'), b = person('b2000')
const snapshot = () => calculateWesternStudy(a, b)
const key = aspect => `${aspect.aBody}/${aspect.bBody}/${aspect.angle}`
const point = (longitude, body = 'Sun') => ({ longitude, body, name: body })
let maxHouseDifference = 0, maxPlanetDifference = 0, maxAspectDifference = 0

for (const fixture of fixtures.houses) test(`independent Swiss equal-house cusps and angles: ${fixture.id}`, () => {
  const result = calculateStudyPerson({ name: fixture.id, profile: { date: fixture.instant.slice(0, 10), time: '12:00', utcOffset: 0, gender: '女', timePrecision: 'minute', place: fixture.place } }, 'A')
  assert.equal(result.houses.status, 'ready')
  for (const [actual, expected] of [[result.houses.ascendant, fixture.ascendant], [result.houses.midheaven, fixture.midheaven], ...result.houses.equalAscendant.cusps.map((cusp, i) => [cusp, fixture.cusps[i]])]) {
    const error = difference(actual, expected); maxHouseDifference = Math.max(maxHouseDifference, error)
    assert.ok(error < fixtures.houseToleranceDegrees, `${actual} vs ${expected}`)
  }
})

for (const fixture of fixtures.charts) test(`independent ten-body longitudes and own UTC: ${fixture.id}`, () => {
  const result = calculateStudyPerson(person(fixture.id), 'A')
  assert.equal(result.utcTime, fixture.instant)
  assert.deepEqual(plain(result.positions.map(item => item.body)), fixtures.bodyOrder)
  result.positions.forEach((position, i) => {
    const error = difference(position.longitude, fixture.longitudes[i]); maxPlanetDifference = Math.max(maxPlanetDifference, error)
    assert.ok(error < fixtures.positionToleranceDegrees, `${position.body}: ${position.longitude} vs ${fixture.longitudes[i]}`)
  })
})

for (const fixture of fixtures.comparisons) test(`complete independent cross-chart aspect set: ${fixture.a}/${fixture.b}`, () => {
  const result = calculateWesternStudy(person(fixture.a), person(fixture.b))
  assert.equal(result.synastry.pairsConsidered, 100)
  assert.equal(result.synastry.orbDegrees, 6)
  assert.deepEqual(plain(result.synastry.aspects.map(key).sort()), fixture.expectedAspects.map(key).sort())
  for (const expected of fixture.expectedAspects) {
    const actual = result.synastry.aspects.find(item => key(item) === key(expected))
    for (const name of ['separation', 'orb']) {
      const error = Math.abs(actual[name] - expected[name]); maxAspectDifference = Math.max(maxAspectDifference, error)
      assert.ok(error < fixtures.aspectToleranceDegrees, `${key(actual)} ${name}: ${error}`)
    }
  }
  assert.ok(result.synastry.aspects.every((item, i, rows) => i === 0 || rows[i - 1].orb <= item.orb))
  validateWesternStudySnapshot(result)
})

test('all twelve equal-house cusps include their boundary with wrap and whole-sign differences', () => {
  for (const asc of [0, 24.2718817, 153.0916314, 359.99]) {
    const cusps = equalAscendantCusps(asc)
    cusps.forEach((cusp, i) => {
      assert.equal(equalAscendantHouse(cusp, asc), i + 1)
      assert.equal(equalAscendantHouse(cusp + 1e-7, asc), i + 1)
      assert.equal(equalAscendantHouse(cusp - 1e-7, asc), (i + 11) % 12 + 1)
    })
  }
  const single = calculateWesternStudy(person('a1950'))
  assert.equal(single.mode, 'house-comparison'); assert.equal(single.participants.length, 1); assert.equal(single.synastry, null)
  const h = single.participants[0].houses
  assert.notEqual(h.midheaven, h.equalAscendant.cusps[9])
  assert.equal(h.equalAscendant.midheavenHouse, 9)
  assert.ok(single.participants[0].positions.some(position => position.wholeSignHouse !== position.equalAscendantHouse))
  validateWesternStudySnapshot(single)
  assert.throws(() => equalAscendantHouse(NaN, 0)); assert.throws(() => equalAscendantCusps(Infinity))
})

test('major aspects include exactly six degrees, exclude just outside, and handle circular separation', () => {
  for (const angle of [0, 60, 90, 120, 180]) {
    assert.equal(findSynastryAspects([point(0)], [point(angle)])[0].angle, angle)
    const direction = angle === 180 ? -1 : 1
    assert.equal(findSynastryAspects([point(0)], [point(angle + direction * 6)])[0].orb, 6)
    assert.equal(findSynastryAspects([point(0)], [point(angle + direction * (6 + 1e-7))]).length, 0)
    assert.equal(findSynastryAspects([point(0)], [point(angle + direction * (6 - 1e-7))]).length, 1)
  }
  assert.equal(findSynastryAspects([point(359)], [point(1)])[0].separation, 2)
  for (const minor of [30, 45, 135, 150]) assert.equal(findSynastryAspects([point(0)], [point(minor)]).length, 0)
  assert.throws(() => findSynastryAspects([point(NaN)], [point(0)]))
})

test('A/B roles preserve all 100 ordered body pairs, same-body comparisons and swapped symmetry', () => {
  const points = fixtures.bodyOrder.map(body => point(25, body))
  const all = findSynastryAspects(points, points)
  assert.equal(all.length, 100); assert.equal(new Set(all.map(key)).size, 100)
  assert.ok(all.some(item => item.aBody === 'Sun' && item.bBody === 'Moon'))
  assert.ok(all.some(item => item.aBody === 'Moon' && item.bBody === 'Sun'))
  assert.equal(all.filter(item => item.aBody === item.bBody).length, 10)
  const ab = snapshot(), ba = calculateWesternStudy(b, a)
  assert.deepEqual(plain(ab.synastry.aspects.map(key).sort()), plain(ba.synastry.aspects.map(item => `${item.bBody}/${item.aBody}/${item.angle}`).sort()))
  for (const item of ab.synastry.aspects) { const swapped = ba.synastry.aspects.find(other => other.aBody === item.bBody && other.bBody === item.aBody && other.angle === item.angle); assert.ok(Math.abs(item.orb - swapped.orb) < 1e-10) }
  assert.equal(ab.participants[0].utcTime, ba.participants[1].utcTime)
})

test('IANA timezones resolve each person independently, with fold and gap errors scoped by role', () => {
  const aa = plain(a), bb = plain(b)
  aa.profile.timeZone = 'America/New_York'; aa.profile.utcOffset = 8
  bb.profile.timeZone = 'Asia/Shanghai'; bb.profile.utcOffset = -5
  const result = calculateWesternStudy(aa, bb)
  assert.equal(result.participants[0].profile.utcOffset, -5); assert.equal(result.participants[1].profile.utcOffset, 8)
  assert.deepEqual(plain(result.participants.map(p => p.utcTime)), ['2000-01-01T04:00:00.000Z', '2000-08-16T04:00:00.000Z'])
  const fold = { name: 'Fold', profile: { ...aa.profile, date: '2024-11-03', time: '01:30' } }
  assert.throws(() => calculateWesternStudy(a, fold), /B 的资料.*重复/)
  const early = calculateStudyPerson({ ...fold, profile: { ...fold.profile, timeChoice: 'earlier' } }, 'B')
  const late = calculateStudyPerson({ ...fold, profile: { ...fold.profile, timeChoice: 'later' } }, 'B')
  assert.equal(Date.parse(late.utcTime) - Date.parse(early.utcTime), 3600000)
  assert.throws(() => calculateWesternStudy(a, { ...fold, profile: { ...fold.profile, date: '2024-03-10', time: '02:30' } }), /B 的资料/)
  validateWesternStudySnapshot(result)
})

test('missing place, approximate time and unsupported latitude disable only the affected person’s houses', () => {
  for (const update of [{ place: undefined }, { timePrecision: 'approximate' }, { place: { latitude: 66, longitude: 0 } }, { place: { latitude: -66, longitude: 0 } }]) {
    const result = calculateWesternStudy({ ...a, profile: { ...a.profile, ...update } }, b)
    assert.equal(result.participants[0].houses.status, 'unavailable')
    assert.equal(result.participants[1].houses.status, 'ready')
    assert.equal(result.participants[0].positions.length, 10)
    assert.ok(result.participants[0].positions.every(p => p.wholeSignHouse === null && p.equalAscendantHouse === null))
    assert.deepEqual(plain(result.synastry.aspects), plain(snapshot().synastry.aspects))
    validateWesternStudySnapshot(result)
  }
})

test('invalid names, dates, unknown clock and coordinates reject explicitly without mutating inputs', () => {
  const before = plain(a); snapshot(); assert.deepEqual(a, before)
  for (const update of [{ time: '' }, { date: '2024-02-30' }, { date: '2099-01-01' }, { utcOffset: NaN }, { place: { latitude: 91, longitude: 0 } }]) assert.throws(() => calculateWesternStudy({ ...a, profile: { ...a.profile, ...update } }, b), /A 的资料/)
  assert.throws(() => calculateWesternStudy(a, { ...b, name: '' }), /B 的资料/)
  assert.throws(() => calculateWesternStudy({ ...a, name: 'a'.repeat(31) }), /A 的资料/)
})

function storage() { let raw = ''; return { getItem: () => raw, setItem: (key, value) => { assert.equal(key, WESTERN_STUDY_STORAGE_KEY); raw = value }, raw: () => raw } }
test('both modes retain complete immutable saved snapshots and notes, and export without recalculation', () => {
  const store = storage(); let id = 0
  const repo = createWesternStudyRepository(store, () => new Date('2026-10-03T00:00:00Z'), () => `r${++id}`)
  const result = snapshot(); const expected = plain(result)
  repo.save(' pair ', 'original note', result)
  result.participants[0].positions[0].longitude = 0
  const opened = repo.list()[0]; assert.deepEqual(plain(opened.snapshot), expected); assert.equal(opened.name, 'pair')
  opened.note = 'changed'; opened.snapshot.participants[0].name = 'changed'
  assert.equal(repo.list()[0].note, 'original note'); assert.equal(repo.list()[0].snapshot.participants[0].name, a.name)
  repo.save('single', '', calculateWesternStudy(a))
  assert.deepEqual(plain(repo.exportJSON().records), plain(repo.list()))
  assert.equal(repo.remove('r1').length, 1); assert.equal(repo.list()[0].snapshot.mode, 'house-comparison')
})

test('corrupt rules, incomplete aspect sets and mismatched saved inputs stop writes and preserve original bytes', () => {
  const mutations = [s => { s.ruleVersion = 'unknown' }, s => { s.participants[0].profile.time = '22:00' }, s => { s.participants[0].houses.equalAscendant.cusps[1] += 1 }, s => { s.synastry.aspects.pop() }, s => { s.synastry.aspects[0].aBody = 'Unknown' }, s => { s.synastry.orbDegrees = 8 }, s => { s.sources = [] }]
  for (const mutate of mutations) {
    const store = storage(); const repo = createWesternStudyRepository(store, () => new Date('2026-10-03T00:00:00Z'), () => 'record')
    repo.save('ok', '', snapshot()); const damaged = JSON.parse(store.raw()); mutate(damaged.records[0].snapshot)
    store.setItem(WESTERN_STUDY_STORAGE_KEY, JSON.stringify(damaged)); const original = store.raw()
    assert.throws(() => repo.list(), /停止写入/); assert.throws(() => repo.save('new', '', snapshot()), /停止写入/)
    assert.equal(store.raw(), original)
  }
})

test('capacity, duplicate IDs, oversized notes and storage failures do not report a successful save', () => {
  const store = storage(); let id = 0; const result = snapshot()
  const repo = createWesternStudyRepository(store, () => new Date('2026-10-03T00:00:00Z'), () => `r${++id}`)
  for (let i = 0; i < 20; i++) repo.save(`r${i}`, '', result)
  const original = store.raw(); assert.throws(() => repo.save('overflow', '', result), /最多保留20/); assert.equal(store.raw(), original)
  assert.throws(() => repo.save('x', 'x'.repeat(2001), result), /2000/)
  const duplicate = createWesternStudyRepository(storage(), () => new Date('2026-10-03T00:00:00Z'), () => 'same')
  duplicate.save('one', '', result); assert.throws(() => duplicate.save('two', '', result), /编号/)
  const failing = createWesternStudyRepository({ getItem: () => '', setItem: () => { throw new Error('quota') } })
  assert.throws(() => failing.save('x', '', result), /保存失败/)
  const unreadable = createWesternStudyRepository({ getItem: () => { throw new Error('denied') }, setItem: () => assert.fail('must not write') })
  assert.throws(() => unreadable.save('x', '', result), /停止写入/)
})

test('independent A/B UTC and all results are identical across device timezones', () => {
  const script = `${bundle.outputFiles[0].text}\nprocess.stdout.write(JSON.stringify(module.exports.calculateWesternStudy(${JSON.stringify(a)},${JSON.stringify(b)})))`
  const results = ['UTC', 'Asia/Shanghai', 'America/New_York'].map(TZ => {
    const run = spawnSync(process.execPath, ['-'], { input: script, env: { ...process.env, TZ }, encoding: 'utf8', maxBuffer: 2000000 })
    assert.equal(run.status, 0, run.stderr); return run.stdout
  })
  assert.equal(results[0], results[1]); assert.equal(results[1], results[2])
})

test('report independent reference maximum errors', () => {
  console.log(`Western study independent maximum degrees: houses=${maxHouseDifference}, planets=${maxPlanetDifference}, aspects=${maxAspectDifference}`)
})
