import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'
import { EquatorFromVector, Horizon, Observer, RotateVector, Rotation_ECT_EQD, SiderealTime, Spherical, VectorFromSphere } from 'astronomy-engine'

const fixtures = JSON.parse(await readFile(new URL('./fixtures/metaphysics-houses.json', import.meta.url), 'utf8'))
const bundle = await build({
  stdin: {
    contents: "export * from './src/domain/metaphysics/houses'; export { calculateWestern } from './src/domain/metaphysics/western'; export { normalizeBirth } from './src/domain/metaphysics/time'",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
// Share Date with the VM because Astronomy Engine intentionally checks instanceof Date.
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const { calculateHouses, wholeSignHouse, calculateWestern, normalizeBirth } = context.module.exports
const circularDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180)
const example = { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 }
const section = (chart, title) => chart.sections.find(item => item.title === title)

for (const fixture of fixtures.cases) {
  test(`ASC and MC match an independent official Swiss Ephemeris output: ${fixture.id}`, () => {
    const result = calculateHouses(new Date(fixture.instant), fixture.place)
    assert.equal(result.status, 'ready', result.reason)
    for (const angle of ['ascendant', 'midheaven']) {
      assert.ok(circularDistance(result[angle], fixture.expected[angle]) < fixtures.toleranceDegrees,
        `${angle}: got ${result[angle]}, independent reference ${fixture.expected[angle]}`)
    }
    assert.equal(result.cusps[0], fixture.expected.firstCusp)
    assert.equal(result.cusps.length, 12)
    assert.equal(new Set(result.cusps).size, 12)
    assert.ok(result.cusps.every(cusp => cusp >= 0 && cusp < 360 && cusp % 30 === 0))
  })
}

test('ASC is on the eastern geometric horizon and MC is on the upper meridian in either hemisphere', () => {
  for (const latitude of [-65.99, -45, 0, 45, 65.99]) {
    for (const longitude of [-179.9, -90, 0, 90, 179.9]) {
      const instant = new Date('2024-09-22T12:44:00Z')
      const observer = new Observer(latitude, longitude, 0)
      const result = calculateHouses(instant, { latitude, longitude })
      assert.equal(result.status, 'ready', result.reason)
      const equatorial = angle => EquatorFromVector(RotateVector(Rotation_ECT_EQD(instant), VectorFromSphere(new Spherical(0, angle, 1), instant)))
      const asc = equatorial(result.ascendant)
      const horizon = Horizon(instant, observer, asc.ra, asc.dec, '')
      assert.ok(Math.abs(horizon.altitude) < 1e-7)
      assert.ok(horizon.azimuth > 0 && horizon.azimuth < 180, `ASC must rise in east, got azimuth ${horizon.azimuth}`)
      const mc = equatorial(result.midheaven)
      assert.ok(Horizon(instant, observer, mc.ra, mc.dec, '').altitude > 0)
      assert.ok(circularDistance((SiderealTime(instant) * 15 + longitude + 360) % 360, mc.ra * 15) < 1e-7)
    }
  }
})

test('whole signs respect sign boundaries, precise ASC placement, and the 0/360 wrap', () => {
  for (const [longitude, ascendant, expected] of [
    [0, 0, 1], [29.999999, 29.999999, 1], [30, 29.999999, 2],
    [359.999999, 0, 12], [360, 0, 1], [-0.000001, 0, 12],
    [0, 359.999999, 2], [330, 359.999999, 1], [330, 360, 12],
    [1, 24.266189, 1], [24, 24.266189, 1], [151.8475191, 234.2783672, 11],
    [171.3552347, 278.481045, 9],
  ]) assert.equal(wholeSignHouse(longitude, ascendant), expected)
  assert.throws(() => wholeSignHouse(NaN, 0))
  assert.throws(() => wholeSignHouse(0, Infinity))
})

test('the two signed forms of the date-line longitude agree', () => {
  const instant = new Date('2024-09-22T12:44:00Z')
  const west = calculateHouses(instant, { latitude: -30, longitude: -180 })
  const east = calculateHouses(instant, { latitude: -30, longitude: 180 })
  assert.equal(west.status, 'ready')
  assert.equal(east.status, 'ready')
  assert.ok(circularDistance(west.ascendant, east.ascendant) < 1e-8)
  assert.ok(circularDistance(west.midheaven, east.midheaven) < 1e-8)
})

test('a place adds four axes, twelve whole signs, and exactly one house per body', () => {
  const western = calculateWestern(normalizeBirth({ ...example, place: { name: '上海', latitude: 31.2304, longitude: 121.4737 } }))
  assert.equal(western.status, 'ready')
  assert.match(western.title, /整宫制/)
  assert.ok(western.summary.some(fact => fact.label === '上升点 ASC'))
  assert.equal(section(western, '十二宫 · 整宫制').facts.length, 12)
  assert.match(section(western, '四轴与宫制').facts.find(fact => fact.label === '宫制').value, /不是 Placidus/)
  for (const fact of section(western, '十天体位置').facts) assert.match(fact.value, /· 第 (?:[1-9]|1[0-2]) 宫$/)
  const allOccupants = section(western, '十二宫 · 整宫制').facts.map(fact => fact.value).join('、')
  for (const fact of section(western, '十天体位置').facts) assert.equal(allOccupants.split(fact.label).length - 1, 1)
})

test('missing place leaves a complete basic chart with an explicit explanation', () => {
  const western = calculateWestern(normalizeBirth(example))
  assert.equal(western.status, 'ready')
  assert.match(western.title, /基础/)
  assert.equal(section(western, '十天体位置').facts.length, 10)
  assert.ok(section(western, '主要相位'))
  assert.equal(section(western, '十二宫 · 整宫制'), undefined)
  assert.match(western.limitations.join(' '), /未填写出生地点/)
  assert.ok(western.summary.every(fact => !fact.label.includes('ASC')))
})

test('unsupported polar latitudes and malformed locations cannot fabricate houses or erase basic positions', () => {
  const normalized = normalizeBirth(example)
  const basic = calculateWestern(normalized)
  const places = [null, {}, { latitude: '31', longitude: 0 }, { latitude: NaN, longitude: 0 },
    { latitude: 0, longitude: Infinity }, { latitude: 0, longitude: -181 },
    { latitude: 91, longitude: 0 }, { latitude: -91, longitude: 0 },
    ...[-90, -66.56, -66, 66, 66.56, 90].map(latitude => ({ latitude, longitude: 0 }))]
  for (const place of places) {
    const result = calculateHouses(normalized.instant, place)
    assert.equal(result.status, 'unavailable')
    assert.ok(result.reason)
    // This also exercises adapter defence when called without the normalizer.
    const western = calculateWestern({ ...normalized, profile: { ...normalized.profile, place } })
    assert.equal(western.status, 'ready')
    assert.deepEqual(section(western, '十天体位置'), section(basic, '十天体位置'))
    assert.deepEqual(section(western, '主要相位'), section(basic, '主要相位'))
    assert.equal(section(western, '十二宫 · 整宫制'), undefined)
    assert.match(western.limitations.join(' '), /无效|极圈/)
  }
  assert.equal(calculateHouses(new Date('invalid'), { latitude: 0, longitude: 0 }).status, 'unavailable')
})
