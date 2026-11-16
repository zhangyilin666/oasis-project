import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: "export { calculateExploration } from './src/domain/metaphysics/index'; export * from './src/domain/metaphysics/archive'",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} }, console, Date, Intl, setTimeout, clearTimeout })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const profile = { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 }
const chart = (result, id) => {
  const found = result.charts.find(item => item.id === id)
  assert.ok(found, `missing ${id} chart`)
  assert.equal(found.status, 'ready', `${id} failed to calculate`)
  return found
}

test('exploration forwards one observation date to both flow adapters and retains the natal chart', async () => {
  const natal = await api.calculateExploration(profile)
  const dated = await api.calculateExploration(profile, { observationDate: '2026-10-03' })
  assert.deepEqual(plain(dated.options), { observationDate: '2026-10-03' })
  assert.equal(dated.rulesVersion, '4.0.0')
  const western = chart(dated, 'western')
  assert.deepEqual(plain(western.observation), {
    date: '2026-10-03', timeZone: 'UTC+08:00', localTime: '12:00',
    utcTime: '2026-10-03T04:00:00.000Z', kind: 'transit-snapshot',
    orbDegrees: 1, ruleVersion: 'western-transit-v1',
  })
  assert.equal(western.sections.find(section => section.title === '行运十天体 · 指定时刻')?.facts.length, 10)
  assert.ok(western.sections.some(section => section.title === '行运对本命相位'))
  assert.deepEqual(plain(western.summary), plain(chart(natal, 'western').summary))
  assert.deepEqual(plain(western.sections.filter(section => !section.title.startsWith('行运'))), plain(chart(natal, 'western').sections))
  assert.deepEqual(plain(chart(dated, 'bazi')), plain(chart(natal, 'bazi')))
  const ziweiDate = chart(dated, 'ziwei').sections.find(section => section.title === '运限概览')?.facts.find(fact => fact.label === '观察日期')
  assert.equal(ziweiDate?.value, '2026-10-03 12:00 · 北京时间 UTC+08:00')
  assert.match(dated.comparison.find(row => row.theme === '时间变化').western, /2026-10-03.*12:00.*行运/)
})

test('omitting an observation date produces natal-only results without an invented transit snapshot', async () => {
  const result = await api.calculateExploration(profile)
  assert.deepEqual(plain(result.options), {})
  for (const item of result.charts) assert.equal(item.observation, undefined)
  assert.ok(chart(result, 'western').sections.every(section => !section.title.startsWith('行运')))
  assert.ok(chart(result, 'ziwei').sections.every(section => section.title !== '运限概览'))
  assert.match(result.comparison.find(row => row.theme === '时间变化').western, /填写观察日期/)
})

test('historical birth DST does not turn the observation noon into historical Shanghai noon', async () => {
  // Shanghai used UTC+09 in July 1988; the product observation convention stays UTC+08.
  const result = await api.calculateExploration({ ...profile, date: '1988-07-01', time: '12:00', timeZone: 'Asia/Shanghai' }, { observationDate: '1988-07-01' })
  assert.equal(result.utcTime, '1988-07-01T03:00:00.000Z')
  assert.equal(result.timeResolution.utcOffset, 9)
  assert.equal(chart(result, 'western').observation.utcTime, '1988-07-01T04:00:00.000Z')
  assert.equal(chart(result, 'western').observation.timeZone, 'UTC+08:00')
})

test('exploration rejects invalid observation dates before adapter error isolation can hide them', async () => {
  for (const observationDate of ['2026-02-29', '2000-08-15', '2100-01-01']) {
    await assert.rejects(api.calculateExploration(profile, { observationDate }), /观察日期/)
  }
})

function legacyResult(withObservationDate) {
  return {
    schemaVersion: 1, profile: { ...profile }, utcTime: '2000-08-15T20:30:00.000Z', chineseTime: '2000-08-16 04:30 UTC+08:00',
    ...(withObservationDate ? { options: { observationDate: '2024-02-29' }, rulesVersion: '2.0.0' } : {}),
    charts: ['bazi', 'ziwei', 'western'].map(id => ({
      id, title: id, status: 'ready', summary: [{ label: '原事实', value: '保存时的本命结果' }],
      sections: [{ title: '原有章节', facts: [{ label: '保存值', value: '未经重算' }] }], conventions: ['原规则'], limitations: ['原限制'],
      source: { title: '原引擎', url: 'https://example.com', version: 'legacy', license: 'MIT' },
    })),
    comparison: [{ theme: '时间变化', bazi: '原八字大运', ziwei: '原紫微运限', western: '尚未接入行运', note: '原说明' }], notices: ['原有提示'],
  }
}

for (const withObservationDate of [false, true]) {
  test(`legacy snapshot ${withObservationDate ? 'with a phase-two observation date' : 'without optional metadata'} remains unchanged on read and export`, () => {
    const result = legacyResult(withObservationDate)
    const record = { id: 'legacy', name: '旧档案', savedAt: '2026-10-01T00:00:00.000Z', result }
    const persisted = JSON.stringify({ version: 1, records: [record] })
    const storage = { get: () => persisted, set: () => assert.fail('reading or exporting a legacy snapshot must not write storage') }
    const restored = api.createChartArchive(storage).list()[0]
    assert.deepEqual(plain(restored), record)
    const exported = api.chartExport(restored.result, restored.name, restored.savedAt)
    assert.deepEqual(plain(exported.result), result)
    assert.equal(exported.savedAt, record.savedAt)
    assert.equal(chart(exported.result, 'western').observation, undefined)
    assert.equal(exported.result.comparison[0].western, '尚未接入行运')
    assert.equal(exported.result.rulesVersion, withObservationDate ? '2.0.0' : undefined)
  })
}

test('a real phase-three transit survives save, JSON reload, and export as an immutable snapshot', async () => {
  const calculated = await api.calculateExploration(profile, { observationDate: '2026-10-03' })
  const expected = plain(calculated)
  let data
  const storage = { get: () => data, set: (key, value) => { assert.equal(key, api.CHART_ARCHIVE_KEY); data = JSON.stringify(value) } }
  const archive = api.createChartArchive(storage, () => new Date('2026-10-03T06:00:00.000Z'), () => 'phase-three')
  const saved = archive.save('行运快照', calculated)
  chart(calculated, 'western').observation.date = '2099-12-31'
  chart(saved.result, 'western').sections.find(section => section.title === '行运十天体 · 指定时刻').facts[0].value = '修改返回值'
  const restored = archive.list()[0]
  assert.deepEqual(plain(restored.result), expected)
  const exported = api.chartExport(restored.result, restored.name, restored.savedAt)
  assert.deepEqual(plain(exported.result), expected)
  assert.equal(exported.savedAt, '2026-10-03T06:00:00.000Z')
  chart(exported.result, 'western').observation.utcTime = '2099-12-31T04:00:00.000Z'
  assert.deepEqual(plain(archive.list()[0].result), expected)
})
