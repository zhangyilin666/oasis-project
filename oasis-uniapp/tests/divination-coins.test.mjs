import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundled = await build({ stdin: { contents: "export * from './src/domain/divination'; export * from './src/domain/divination/coins'; export * from './src/domain/divination/repository';", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const runtime = vm.createContext({ module: { exports: {} } })
vm.runInContext(bundled.outputFiles[0].text, runtime)
const api = runtime.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const context = { question: '怎样安排这周的阅读？', date: '2026-10-03', time: '12:30', utcOffset: 8 }
const draw = bytes => api.generateCoinInput(context, buffer => { assert.equal(buffer.length, 18); buffer.set(bytes) })

test('each fair three-coin combination is retained with the correct 1:3:3:1 outcome distribution', () => {
  const counts = { 6: 0, 7: 0, 8: 0, 9: 0 }
  for (let bits = 0; bits < 8; bits++) {
    const bytes = Array.from({ length: 18 }, (_, index) => (bits >> (index % 3)) & 1)
    const input = draw(bytes), value = 6 + (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1)
    counts[value]++
    assert.deepEqual(plain(input.lines), new Array(6).fill(value))
    assert.deepEqual(plain(input.coins), Array.from({ length: 6 }, () => [2 + (bits & 1), 2 + ((bits >> 1) & 1), 2 + ((bits >> 2) & 1)]))
  }
  assert.deepEqual(counts, { 6: 1, 7: 3, 8: 3, 9: 1 })
})

test('byte mapping has no modulo bias and does not force a moving line', () => {
  const faceCounts = { 2: 0, 3: 0 }
  for (let byte = 0; byte < 256; byte++) faceCounts[draw(new Array(18).fill(byte)).coins[0][0]]++
  assert.deepEqual(faceCounts, { 2: 128, 3: 128 })
  const staticDraw = draw(Array.from({ length: 18 }, (_, index) => index % 3 === 0 ? 1 : 0))
  assert.deepEqual(plain(api.calculateDivination(staticDraw).movingLines), [])
  assert.deepEqual(plain(api.calculateDivination(draw(new Array(18).fill(0))).movingLines), [1, 2, 3, 4, 5, 6])
})

test('the historical Xu to Song example preserves draw order and exactly the moving positions', () => {
  // 增删卜易/7, revision 2100290: bottom -> top [9,7,9,6,7,6].
  const input = draw([1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0])
  const result = api.calculateDivination(input)
  assert.equal(result.ruleVersion, 'liuyao-coins-v1')
  assert.deepEqual(plain(input.lines), [9, 7, 9, 6, 7, 6])
  assert.equal(result.original.name, '需')
  assert.equal(result.changed.name, '讼')
  assert.deepEqual(plain(result.movingLines), [1, 3, 4, 6])
  assert.ok(result.najia)
  const manual = api.calculateDivination({ ...context, method: 'liuyao-najia', lines: input.lines })
  assert.deepEqual(plain(result.najia), plain(manual.najia))
})

test('invalid context is rejected before drawing and unavailable secure randomness never silently falls back', () => {
  let calls = 0
  for (const bad of [{ question: '' }, { time: '24:00' }, { date: '1900-01-01', time: '00:00', utcOffset: 14 }]) {
    assert.throws(() => api.generateCoinInput({ ...context, ...bad }, () => { calls++ }))
  }
  assert.equal(calls, 0)
  assert.throws(() => api.generateCoinInput(context), /不支持安全随机/)
  assert.throws(() => api.generateCoinInput(context, () => { throw new Error('platform failure') }), /尚未生成卦象/)
})

test('malformed coin groups, sparse values, mismatched sums and wrong rule versions cannot be restored', () => {
  const input = draw(new Array(18).fill(0))
  const invalid = [[], new Array(6), [[2, 2, 2]], new Array(6).fill(new Array(3)), new Array(6).fill([2, 2, '2']), new Array(6).fill([2, 2, 1]), new Array(6).fill([2, 2, 2, 2])]
  for (const coins of invalid) assert.throws(() => api.calculateDivination({ ...input, coins }))
  assert.throws(() => api.calculateDivination({ ...input, lines: [7, 6, 6, 6, 6, 6] }), /不一致/)
  assert.throws(() => api.calculateDivination(input, 'liuyao-najia-v1'), /版本/)
})

test('saving and exporting retain the original coins without drawing again, alongside unchanged legacy records', () => {
  const memory = new Map(), storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) }
  const repo = api.createDivinationRepository(storage), input = draw([1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0])
  const legacy = repo.save(api.calculateDivination({ ...context, method: 'liuyao-manual', lines: [7, 7, 7, 8, 8, 8] }), '2026-10-03T03:00:00.000Z')
  const result = api.calculateDivination(input), record = repo.save(result, '2026-10-03T04:30:00.000Z')
  input.coins[0][0] = 2
  assert.equal(result.input.coins[0][0], 3)
  assert.deepEqual(plain(repo.list().find(item => item.id === legacy.id)), plain(legacy))
  const restored = repo.list().find(item => item.id === record.id)
  assert.deepEqual(plain(api.calculateDivination(restored.input, restored.ruleVersion)), plain(result))
  const exported = JSON.parse(repo.exportJSON())
  assert.deepEqual(exported.records[0].input.coins, plain(result.input.coins))
  assert.deepEqual(exported.records[0].result, plain(result))
})
