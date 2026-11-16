import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { build } from 'esbuild'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const fixtures = JSON.parse(await readFile(new URL('./fixtures/metaphysics-bazi.json', import.meta.url), 'utf8'))
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/domain/metaphysics/index.ts', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const source = bundle.outputFiles[0].text
const context = vm.createContext({ module: { exports: {} }, console, setTimeout, clearTimeout })
vm.runInContext(source, context)
const calculate = async profile => JSON.parse(JSON.stringify(await context.module.exports.calculateExploration(profile)))
const example = { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 }
const chart = (result, id) => {
  const found = result.charts.find(item => item.id === id)
  assert.ok(found, `${id} chart is present`)
  assert.equal(found.status, 'ready', found.error)
  return found
}
const summary = (item, label) => {
  const fact = item.summary.find(value => value.label === label)
  assert.ok(fact, `${item.id} summary contains ${label}`)
  return fact.value
}
const section = (item, title) => {
  const found = item.sections.find(value => value.title === title)
  assert.ok(found, `${item.id} contains ${title}`)
  return found
}
const longitude = (item, name) => {
  const fact = section(item, '十天体位置').facts.find(value => value.label === name)
  assert.ok(fact, `${name} has a position`)
  const match = fact.value.match(/黄经\s*([\d.]+)°/)
  assert.ok(match, `${name} includes numeric ecliptic longitude`)
  const value = Number(match[1])
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 360)
  return value
}
const circularDifference = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

test('one birth profile produces three separately identified deterministic charts', async () => {
  const result = await calculate(example)
  assert.equal(result.schemaVersion, 1)
  assert.deepEqual(result.profile, example)
  assert.equal(result.utcTime, '2000-08-15T20:30:00.000Z')
  assert.deepEqual(result.charts.map(item => item.id).sort(), ['bazi', 'western', 'ziwei'])
  for (const id of ['bazi', 'ziwei', 'western']) {
    const item = chart(result, id)
    assert.ok(item.source.version)
    assert.ok(item.source.license)
    assert.ok(item.conventions.length)
    assert.ok(item.limitations.length)
  }
  assert.doesNotThrow(() => JSON.stringify(result))
})

const invalidProfiles = [
  ['missing birth time', { time: '' }],
  ['missing birth date', { date: '' }],
  ['impossible date', { date: '2023-02-29' }],
  ['overflowing day', { date: '2024-04-31' }],
  ['overflowing month', { date: '2024-13-01' }],
  ['short date', { date: '2000-8-16' }],
  ['invalid hour', { time: '24:00' }],
  ['invalid minute', { time: '04:60' }],
  ['missing hour', { time: '4:30' }],
  ['future date', { date: '2999-01-01' }],
  ['invalid positive UTC offset', { utcOffset: 15 }],
  ['invalid negative UTC offset', { utcOffset: -13 }],
  ['non-numeric UTC offset', { utcOffset: '8' }],
  ['non-finite UTC offset', { utcOffset: Infinity }],
  ['missing UTC offset', { utcOffset: undefined }],
  ['unsupported offset increment', { utcOffset: 8.1 }],
  ['unknown traditional gender', { gender: 'unknown' }],
  ['outside calendar coverage after timezone conversion', { date: '1900-01-01', time: '00:00', utcOffset: 14 }],
]
for (const [description, override] of invalidProfiles) {
  test(`invalid input is rejected before a chart is fabricated: ${description}`, async () => {
    await assert.rejects(() => calculate({ ...example, ...override }))
  })
}

test('a future instant within supported calendar years is rejected', async () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  await assert.rejects(() => calculate({ ...example, date: tomorrow, time: '23:59', utcOffset: 0 }))
})

// These expected values are fixed outputs of lunar-python, not recomputed with
// lunar-typescript. The fixture documents the shared ancestry of both libraries.
for (const fixture of fixtures.cases) {
  test(`Bazi matches fixed Python reference at ${fixture.id}`, async () => {
    const result = await calculate(fixture.profile)
    for (const id of ['bazi', 'ziwei', 'western']) chart(result, id)
    const bazi = chart(result, 'bazi')
    assert.equal(summary(bazi, '四柱'), fixture.expected.pillars.join(' '))
    assert.equal(summary(bazi, '日主'), fixture.expected.pillars[2][0])
    assert.deepEqual(Object.fromEntries(section(bazi, '五行数量').facts.map(fact => [fact.label, Number(fact.value)])), fixture.expected.elements)
    assert.equal(section(bazi, '八步大运').facts.length, 8)
    if (fixture.expected.lunar.month < 0) assert.match(summary(bazi, '农历'), /闰二月/)
  })
}

test('Ziwei matches the published official example, including all twelve palaces', async () => {
  // Fixed published example: https://docs.iztro.com/quick-start (accessed 2026-10-03).
  // An integration reference, not independent certification of Ziwei conventions.
  const ziwei = chart(await calculate(example), 'ziwei')
  assert.equal(summary(ziwei, '命宫'), '午 · 紫微')
  assert.equal(summary(ziwei, '身宫'), '戌 · 官禄')
  assert.equal(summary(ziwei, '五行局'), '木三局')
  assert.equal(summary(ziwei, '命主 / 身主'), '破军 / 文昌')
  assert.equal(ziwei.sections.length, 13)
  assert.match(section(ziwei, '命宫 · 壬午').facts.find(f => f.label === '主星').value, /紫微/)
  assert.match(section(ziwei, '官禄宫 · 丙戌 · 身宫').facts.find(f => f.label === '主星').value, /廉贞.*天府/)
  const mutations = section(ziwei, '生年四化').facts
  assert.deepEqual(mutations.map(f => f.label).sort(), ['化忌', '化权', '化科', '化禄'].sort())
})

test('Ziwei current-day convention keeps early and late Zi on the same civil day', async () => {
  const early = await calculate({ ...example, time: '00:30' })
  const late = await calculate({ ...example, time: '23:30' })
  const earlyZiwei = chart(early, 'ziwei')
  const lateZiwei = chart(late, 'ziwei')
  assert.deepEqual(lateZiwei.summary, earlyZiwei.summary)
  assert.deepEqual(lateZiwei.sections, earlyZiwei.sections)
  const earlyBazi = chart(early, 'bazi')
  const lateBazi = chart(late, 'bazi')
  // Fixed lunar-python 1.4.8 sect=2 reference for 2000-08-16, UTC+08:00.
  assert.equal(section(earlyBazi, '日柱').facts.find(f => f.label === '干支').value, '丙午')
  assert.equal(section(lateBazi, '日柱').facts.find(f => f.label === '干支').value, '丙午')
  assert.equal(section(earlyBazi, '时柱').facts.find(f => f.label === '干支').value, '戊子')
  assert.equal(section(lateBazi, '时柱').facts.find(f => f.label === '干支').value, '庚子')
})

test('custom global Ziwei tables cannot masquerade as the advertised default convention', async () => {
  // Export the real shared iztro instance and the adapter in one independent
  // bundle: setting its globals cannot contaminate the main test harness.
  const isolated = await build({
    stdin: {
      contents: "export { calculateExploration } from './src/domain/metaphysics/index'; export { astro } from 'iztro'",
      resolveDir: projectRoot, loader: 'ts',
    },
    bundle: true, write: false, format: 'cjs', platform: 'node',
  })
  const isolatedContext = vm.createContext({ module: { exports: {} }, console, setTimeout, clearTimeout })
  vm.runInContext(isolated.outputFiles[0].text, isolatedContext)
  const api = isolatedContext.module.exports
  api.astro.config({ mutagens: { 庚: ['天同', '武曲', '太阳', '太阴'] } })
  api.astro.config({ mutagens: {} })
  assert.ok(Object.keys(api.astro.getConfig().mutagens).length, 'empty config merges rather than resetting custom tables')
  const result = JSON.parse(JSON.stringify(await api.calculateExploration(example)))
  chart(result, 'bazi')
  chart(result, 'western')
  const failed = result.charts.find(item => item.id === 'ziwei')
  assert.equal(failed.status, 'error')
  assert.ok(failed.error)
  assert.deepEqual(failed.summary, [])
  assert.deepEqual(failed.sections, [])
  chart(await calculate(example), 'ziwei')
})

// Independent astronomical reference: US Naval Observatory's published 2024
// seasons. The source uses US Eastern time, converted here with its ST/DT label.
// https://aa.usno.navy.mil/calculated/seasons?dst=true&submit=Get+Data&tz=5&tz_label=true&tz_sign=-1&year=2024
const seasons = [
  { date: '2024-03-20', time: '03:06', longitude: 0 },
  { date: '2024-06-20', time: '20:51', longitude: 90 },
  { date: '2024-09-22', time: '12:44', longitude: 180 },
  { date: '2024-12-21', time: '09:20', longitude: 270 },
]
for (const season of seasons) {
  test(`tropical Sun longitude agrees with the USNO seasonal reference: ${season.date}`, async () => {
    const western = chart(await calculate({ ...example, date: season.date, time: season.time, utcOffset: 0 }), 'western')
    assert.ok(circularDifference(longitude(western, '太阳'), season.longitude) <= 0.03,
      '0.03 degree tolerance allows minute-rounded references and displayed rounding, but rejects a J2000 equinox mixup')
    assert.equal(section(western, '十天体位置').facts.length, 10)
  })
}

test('lunar position agrees with the independently published March 2024 full moon', async () => {
  // HKO Almanac 2024, March: full moon 25 March 15:00 Hong Kong time.
  // https://www.hko.gov.hk/tc/gts/astron2024/files/HKO_almanac_2024.pdf
  const western = chart(await calculate({ ...example, date: '2024-03-25', time: '15:00', utcOffset: 8 }), 'western')
  const separation = circularDifference(longitude(western, '太阳'), longitude(western, '月亮'))
  assert.ok(Math.abs(separation - 180) < 0.1, `full-moon Sun/Moon separation was ${separation}`)
  assert.match(section(western, '主要相位').facts.find(f => f.label === '太阳 / 月亮').value, /对冲 180°/)
})

test('a failed adapter remains an error without replacing the other charts', async () => {
  const isolated = await build({
    entryPoints: [fileURLToPath(new URL('../src/domain/metaphysics/index.ts', import.meta.url))],
    bundle: true, write: false, format: 'cjs', platform: 'node',
    plugins: [{ name: 'unavailable-ziwei', setup(builder) {
      builder.onLoad({ filter: /metaphysics[\\/]ziwei\.ts$/ }, () => ({
        contents: 'export function calculateZiwei() { throw new Error("Engine unavailable") }', loader: 'ts',
      }))
    } }],
  })
  const isolatedContext = vm.createContext({ module: { exports: {} }, console, setTimeout, clearTimeout })
  vm.runInContext(isolated.outputFiles[0].text, isolatedContext)
  const result = JSON.parse(JSON.stringify(await isolatedContext.module.exports.calculateExploration(example)))
  chart(result, 'bazi')
  chart(result, 'western')
  const failed = result.charts.find(item => item.id === 'ziwei')
  assert.equal(failed.status, 'error')
  assert.ok(failed.error)
  assert.deepEqual(failed.summary, [])
  assert.deepEqual(failed.sections, [])
  assert.match(result.comparison[0].ziwei, /未生成/)
})

test('equivalent instants across offsets and civil dates produce identical chart facts', async () => {
  const profiles = [
    example,
    { ...example, date: '2000-08-15', time: '20:30', utcOffset: 0 },
    { ...example, date: '2000-08-15', time: '16:30', utcOffset: -4 },
    { ...example, date: '2000-08-16', time: '02:00', utcOffset: 5.5 },
    { ...example, date: '2000-08-16', time: '02:15', utcOffset: 5.75 },
  ]
  const results = await Promise.all(profiles.map(calculate))
  for (const result of results.slice(1)) {
    assert.equal(result.utcTime, results[0].utcTime)
    assert.equal(result.chineseTime, results[0].chineseTime)
    assert.deepEqual(result.charts, results[0].charts)
    assert.deepEqual(result.comparison, results[0].comparison)
  }
})

test('chart calculation does not inherit the device timezone', () => {
  const script = `${source}\nmodule.exports.calculateExploration(${JSON.stringify(example)}).then(result => process.stdout.write(JSON.stringify({ offset: new Date('2000-01-01T12:00:00Z').getTimezoneOffset(), result }))).catch(error => { console.error(error); process.exitCode = 1 })`
  const outputs = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map(TZ => {
    const child = spawnSync(process.execPath, ['-'], {
      input: script, encoding: 'utf8', cwd: projectRoot,
      env: { ...process.env, TZ }, maxBuffer: 8 * 1024 * 1024,
    })
    assert.equal(child.status, 0, child.stderr)
    return JSON.parse(child.stdout)
  })
  assert.deepEqual(outputs.map(item => item.offset), [0, 480, -540], 'the child processes must really use different device timezones')
  for (const output of outputs.slice(1)) assert.deepEqual(output.result, outputs[0].result)
})
