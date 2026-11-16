import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { build } from 'esbuild'

const fixtures = JSON.parse(await readFile(new URL('./fixtures/metaphysics-transits.json', import.meta.url), 'utf8'))
const bundle = await build({
  stdin: {
    contents: "export * from './src/domain/metaphysics/transits'; export * from './src/domain/metaphysics/positions'; export { calculateWestern } from './src/domain/metaphysics/western'; export { normalizeBirth } from './src/domain/metaphysics/time'",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const { calculateTransits, findTransitAspects, transitSections, calculatePositions, calculateWestern, normalizeBirth } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const birth = normalizeBirth({ date: '1990-01-01', time: '12:00', utcOffset: 8, gender: '女' })
const circularDifference = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const point = (name, longitude) => ({ name, longitude })

for (const fixture of fixtures.cases) {
  test(`noon snapshot matches independent official ten-body ephemeris: ${fixture.date}`, () => {
    const snapshot = calculateTransits(birth, fixture.date)
    assert.equal(snapshot.observation.utcTime, fixture.instant)
    assert.deepEqual(plain(snapshot.positions.map(position => position.body)), fixtures.bodyOrder)
    snapshot.positions.forEach((position, index) => {
      const error = circularDifference(position.longitude, fixture.longitudes[index])
      assert.ok(error < fixtures.toleranceDegrees, `${position.body}: got ${position.longitude}, reference ${fixture.longitudes[index]}, error ${error}`)
      assert.ok(position.longitude >= 0 && position.longitude < 360)
    })
  })
}

test('aspect geometry wraps through Aries, preserves opposition and excludes minor aspects', () => {
  const cases = [
    [359.5, 0.5, 0, 1], [0, 180, 180, 0], [180, 0, 180, 0],
    [0, 60, 60, 0], [0, 90, 90, 0], [0, 120, 120, 0],
    [300, 0, 60, 0], [270, 0, 90, 0], [240, 0, 120, 0],
  ]
  for (const [moving, fixed, angle, orb] of cases) {
    const result = findTransitAspects([point('行运', moving)], [point('本命', fixed)])
    assert.equal(result.length, 1)
    assert.equal(result[0].angle, angle)
    assert.equal(result[0].orb, orb)
  }
  for (const fixed of [30, 45, 135, 150]) {
    assert.equal(findTransitAspects([point('行运', 0)], [point('本命', fixed)]).length, 0)
  }
})

test('one-degree transit threshold is inclusive and tests raw values before display rounding', () => {
  for (const angle of [0, 60, 90, 120, 180]) {
    const inside = findTransitAspects([point('行运', 0)], [point('本命', angle + 0.99999)])
    const exact = findTransitAspects([point('行运', 0)], [point('本命', angle + 1)])
    const outside = findTransitAspects([point('行运', 0)], [point('本命', angle + 1.00001)])
    assert.equal(inside.length, 1)
    assert.equal(exact.length, 1)
    assert.equal(outside.length, 0)
  }
})

test('transit aspects keep all 100 directed pairs and same-body returns', () => {
  const positions = Array.from({ length: 10 }, (_, index) => point(`天体${index}`, 25))
  const result = findTransitAspects(positions, positions)
  assert.equal(result.length, 100)
  assert.equal(new Set(result.map(item => `${item.transit}/${item.natal}`)).size, 100)
  assert.equal(result.filter(item => item.transit === item.natal).length, 10)
  assert.ok(result.some(item => item.transit === '天体0' && item.natal === '天体1'))
  assert.ok(result.some(item => item.transit === '天体1' && item.natal === '天体0'))
  assert.ok(result.every(item => item.angle === 0 && item.orb === 0))
})

test('sorting uses unrounded angular error even when displayed errors would tie', () => {
  const result = findTransitAspects([point('行运', 0)], [point('远', 60.204), point('近', 60.201)])
  assert.deepEqual(plain(result.map(item => item.natal)), ['近', '远'])
  assert.equal(result[0].orb.toFixed(2), result[1].orb.toFixed(2))
  assert.ok(result[0].orb < result[1].orb)
})

test('an empty instant has an explicit empty state rather than an all-day claim', () => {
  const snapshot = calculateTransits(birth, '2024-03-20')
  snapshot.aspects = findTransitAspects([point('行运', 0)], [point('本命', 30)])
  assert.equal(snapshot.aspects.length, 0)
  const sections = transitSections(snapshot)
  assert.match(sections[0].caption, /2024-03-20 12:00.*UTC\+08:00.*仅代表该时刻/)
  assert.equal(sections[1].facts.length, 1)
  assert.match(sections[1].facts[0].value, /未出现.*不代表当天/)
})

test('observation metadata is reproducible and does not mutate natal positions or the profile', () => {
  const normalized = normalizeBirth({ date: '2000-08-16', time: '04:30', utcOffset: 8, gender: '女', place: { latitude: 31.2304, longitude: 121.4737 } })
  const before = plain(normalized.profile)
  const natal = calculateWestern(normalized)
  const observed = calculateWestern(normalized, { observationDate: '2024-03-20' })
  assert.deepEqual(plain(observed.observation), {
    date: '2024-03-20', timeZone: 'UTC+08:00', localTime: '12:00', utcTime: '2024-03-20T04:00:00.000Z',
    kind: 'transit-snapshot', orbDegrees: 1, ruleVersion: 'western-transit-v1',
  })
  assert.equal('observation' in natal, false)
  assert.deepEqual(plain(observed.sections.slice(0, natal.sections.length)), plain(natal.sections))
  assert.deepEqual(plain(observed.summary), plain(natal.summary))
  assert.deepEqual(plain(normalized.profile), before)
  assert.match(natal.sections.find(section => section.title === '主要相位').caption, /6°/)
  assert.match(observed.sections.at(-1).caption, /1°/)
  assert.match(observed.sections.at(-2).caption, /UTC 2024-03-20 04:00/)
  assert.ok(observed.sections.at(-1).facts.some(fact => /^行运.+ → 本命/.test(fact.label)))
})

test('same-day noon is allowed explicitly and no-date input adds no transit sections', () => {
  const afternoonBirth = normalizeBirth({ date: '2000-08-16', time: '18:00', utcOffset: 8, gender: '女' })
  const natal = calculateWestern(afternoonBirth)
  const sameDay = calculateWestern(afternoonBirth, { observationDate: '2000-08-16' })
  assert.equal(natal.sections.length, 2)
  assert.equal(sameDay.sections.length, 4)
  assert.equal(sameDay.observation.utcTime, '2000-08-16T04:00:00.000Z')
  assert.match(sameDay.conventions.join(' '), /中午可能早于/)
  assert.match(sameDay.limitations.join(' '), /出生时间误差.*月亮相位/)
})

test('places and gender do not change geocentric transit positions', () => {
  const options = { observationDate: '2024-03-20' }
  const variants = [
    { gender: '男', place: { latitude: -33.8688, longitude: 151.2093 } },
    { gender: '女', place: { latitude: 80, longitude: -90 }, timePrecision: 'approximate' },
    { gender: '女' },
  ]
  const charts = variants.map(variant => calculateWestern(normalizeBirth({ ...birth.profile, ...variant }), options))
  for (const chart of charts) {
    assert.deepEqual(plain(chart.sections.at(-2)), plain(charts[0].sections.at(-2)))
    assert.deepEqual(plain(chart.sections.at(-1)), plain(charts[0].sections.at(-1)))
    assert.match(chart.limitations.join(' '), /尚未计算行运四轴/)
  }
})

test('malformed, impossible, pre-birth and out-of-range observation dates are rejected', () => {
  for (const date of ['', '2024-3-20', '2024-02-30', '2023-02-29', '2024-13-01', '1989-12-31', '2100-01-01', 'not-a-date']) {
    assert.throws(() => calculateWestern(birth, { observationDate: date }), /观察日期/)
  }
  assert.throws(() => calculatePositions(new Date('invalid')), /UTC/)
})

test('noon conversion and positions stay identical across device timezones', () => {
  const script = `${bundle.outputFiles[0].text}\nconst input = module.exports.normalizeBirth({date:'1990-01-01',time:'12:00',utcOffset:8,gender:'女'}); process.stdout.write(JSON.stringify(module.exports.calculateTransits(input, '2024-03-20')));`
  const outputs = ['UTC', 'America/New_York', 'Asia/Tokyo'].map(timezone => {
    const result = spawnSync(process.execPath, ['-'], { input: script, env: { ...process.env, TZ: timezone }, encoding: 'utf8', maxBuffer: 1024 * 1024 })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
  })
  assert.deepEqual(outputs[1], outputs[0])
  assert.deepEqual(outputs[2], outputs[0])
})
