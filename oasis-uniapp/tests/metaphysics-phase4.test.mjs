import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: "export { calculateExploration } from './src/domain/metaphysics/index'; export * from './src/domain/metaphysics/archive'; export * from './src/domain/metaphysics/form'",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} }, console, Date, Intl, setTimeout, clearTimeout })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const birth = { date: '2000-08-16', time: '23:30', gender: '女', utcOffset: 8 }
const chart = (result, id) => {
  const value = result.charts.find(item => item.id === id)
  assert.equal(value?.status, 'ready', `${id} must have calculated successfully`)
  return value
}

test('form options round-trip comparison requests and clear them when an older archive is loaded', () => {
  const empty = api.emptyBirthExtras()
  assert.equal(empty.compareRules, false)
  assert.deepEqual(plain(api.optionsFromExtras(empty)), {})
  const requested = { observationDate: '2024-02-10', compareRules: true }
  const restored = api.extrasFromProfile(birth, requested)
  assert.deepEqual(plain(api.optionsFromExtras(restored)), requested)
  assert.deepEqual(plain(api.applyBirthExtras(birth, restored)), { ...birth, timePrecision: 'minute' }, 'comparison is a calculation option, not a birth attribute')
  assert.equal(api.extrasFromProfile(birth).compareRules, false)
  assert.deepEqual(plain(api.optionsFromExtras({ ...restored, compareRules: false })), { observationDate: '2024-02-10' })
})

test('comparison option reaches both Chinese adapters without replacing primary results or Western transits', async () => {
  const options = { observationDate: '2024-02-10' }
  const baseline = await api.calculateExploration(birth, options)
  const compared = await api.calculateExploration(birth, { ...options, compareRules: true })
  assert.equal(compared.rulesVersion, '4.0.0')
  assert.deepEqual(plain(compared.options), { ...options, compareRules: true })
  for (const id of ['bazi', 'ziwei']) {
    const current = chart(compared, id), original = chart(baseline, id)
    assert.deepEqual(plain(current.summary), plain(original.summary))
    assert.deepEqual(plain(current.sections.slice(0, original.sections.length)), plain(original.sections))
    assert.ok(current.sections.length > original.sections.length, `${id} must append comparison evidence`)
    assert.ok(current.ruleProfile.id && current.ruleProfile.version)
    assert.ok(current.ruleProfile.comparisonIds.length >= 2)
    assert.equal(original.ruleProfile, undefined)
  }
  assert.deepEqual(plain(chart(compared, 'western')), plain(chart(baseline, 'western')))
  const after = await api.calculateExploration(birth, { ...options, compareRules: false })
  assert.deepEqual(plain(after), plain(baseline), 'a later ordinary calculation must not inherit comparison configuration')
})

test('truthy malformed comparison options are rejected before adapters execute', async () => {
  for (const compareRules of ['true', 1, null, {}, []]) {
    await assert.rejects(api.calculateExploration(birth, { compareRules }), /规则对照/)
  }
})

test('comparison metadata and evidence survive save, serialized restore and export', async () => {
  const calculated = await api.calculateExploration(birth, { compareRules: true })
  const expected = plain(calculated)
  let data
  const storage = { get: () => data, set: (key, value) => { assert.equal(key, api.CHART_ARCHIVE_KEY); data = JSON.stringify(value) } }
  const archive = api.createChartArchive(storage, () => new Date('2026-10-03T08:00:00.000Z'), () => 'rules-sample')
  archive.save('规则对照验收', calculated)
  chart(calculated, 'bazi').ruleProfile.comparisonIds.push('changed-after-save')
  const restored = archive.list()[0]
  assert.deepEqual(plain(restored.result), expected)
  assert.equal(api.extrasFromProfile(restored.result.profile, restored.result.options).compareRules, true)
  const exported = api.chartExport(restored.result, restored.name, restored.savedAt)
  assert.deepEqual(plain(exported.result), expected)
  chart(exported.result, 'ziwei').ruleProfile.id = 'changed-export'
  assert.deepEqual(plain(archive.list()[0].result), expected)
})

test('malformed saved comparison options or metadata never overwrite the original archive', async () => {
  const valid = plain(await api.calculateExploration(birth, { compareRules: true }))
  for (const corrupt of [
    value => { value.options.compareRules = 'true' },
    value => { value.charts[0].ruleProfile = null },
    value => { value.charts[0].ruleProfile.comparisonIds = ['valid', 42] },
  ]) {
    const result = plain(valid)
    corrupt(result)
    const data = JSON.stringify({ version: 1, records: [{ id: 'saved', name: '旧资料', savedAt: '2026-10-03T08:00:00.000Z', result }] })
    const archive = api.createChartArchive({ get: () => data, set: () => assert.fail('corrupt archives must not be overwritten') })
    assert.throws(() => archive.list(), /格式异常/)
    assert.throws(() => archive.save('新资料', valid), /格式异常/)
    assert.throws(() => api.chartExport(result), /有效排盘/)
  }
})
