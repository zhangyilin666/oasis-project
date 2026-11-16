import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'
import { taiyiReferences, taiyiUnresolvedReferences, taiyiGeneralReferences } from './fixtures/taiyi-reference.mjs'

const bundle = await build({ stdin: { contents: "export * from './src/domain/taiyi/index'; export * from './src/domain/taiyi/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const now = () => new Date('2026-10-03T08:00:00.000Z')
const input = changes => ({ ...api.emptyTaiyiInput(), name: '金镜岁计练习', year: '724', ...changes })
const snapshot = changes => api.createTaiyiSnapshot(input(changes), now())

for (const expected of taiyiReferences) {
  test(`independent 金镜 阳局 table ${expected.ju}`, () => {
    const actual = api.buildTaiyiYangBoard(expected.ju)
    for (const key of ['ju', 'taiyi', 'skyEye', 'strike', 'calculationSpirit']) assert.equal(actual[key], expected[key], key)
    assert.equal(actual.host.count, expected.hostCount)
    assert.equal(actual.guest.count, expected.guestCount)
    assert.equal(actual.status, 'complete')
    assert.equal(api.isTaiyiSnapshot(snapshot({ year: String(675 + expected.ju) })), true)
  })
}

for (const expected of taiyiGeneralReferences) {
  test(`independent general/assistant example ${expected.ju}`, () => {
    const actual = api.buildTaiyiYangBoard(expected.ju)
    for (const [key, record, field] of [['hostGeneral', actual.host, 'general'], ['hostAssistant', actual.host, 'assistant'], ['guestGeneral', actual.guest, 'general'], ['guestAssistant', actual.guest, 'assistant']]) if (key in expected) assert.equal(record[field], expected[key], key)
  })
}

for (const expected of taiyiUnresolvedReferences) {
  test(`book disagreement at ${expected.ju} remains explicit and never becomes a definitive host result`, () => {
    const actual = api.buildTaiyiYangBoard(expected.ju)
    assert.equal(actual.status, 'partial')
    assert.equal(actual.host.count, null); assert.equal(actual.host.general, null); assert.equal(actual.host.assistant, null)
    assert.equal(actual.host.steps.reduce((sum, step) => sum + step.amount, 0), expected.stepDerivedHostCount)
    assert.match(actual.host.unresolved, new RegExp(`表列主算 ${expected.printedHostCount}`))
    assert.equal(actual.guest.count, expected.guestCount)
    for (const key of ['taiyi', 'skyEye', 'strike', 'calculationSpirit']) assert.equal(actual[key], expected[key], key)
    assert.equal(api.isTaiyiSnapshot(snapshot({ year: String(675 + expected.ju) })), true)
  })
}

test('724 anchor preserves the independently stated 1,937,281 accumulated years and all arithmetic steps', () => {
  const value = snapshot()
  assert.equal(value.accumulated, 1937281)
  assert.equal(value.yearGanZhi, '甲子'); assert.equal(value.taiSui, '子'); assert.equal(value.combinedSpirit, '丑')
  assert.equal(value.cycle360, 121); assert.equal(value.ji, 3); assert.equal(value.cycle60, 1)
  assert.equal(value.cycle72, 49); assert.equal(value.cycle24, 1); assert.equal(value.cycle18, 13)
  assert.equal(value.board.taiyi, 1); assert.equal(value.board.skyEye, '巽'); assert.equal(value.board.host.count, 24)
  assert.match(value.epoch.note, /开元十五年甲子/)
  assert.match(value.yearPolicy, /不暗定立春、春节或 1 月 1 日年界/)
  assert.equal(api.isTaiyiSnapshot(value), true)
})

test('zero remainders mean the last ordinal, and the following year moves once to the first', () => {
  const final = snapshot({ year: '963' }), first = snapshot({ year: '964' })
  assert.equal(final.cycle360, 360); assert.equal(final.cycle60, 60); assert.equal(final.cycle72, 72); assert.equal(final.cycle24, 24); assert.equal(final.cycle18, 18); assert.equal(final.ji, 6)
  assert.equal(final.board.taiyi, 9); assert.equal(final.board.palaceYear, 3)
  assert.equal(first.cycle360, 1); assert.equal(first.cycle60, 1); assert.equal(first.cycle72, 1); assert.equal(first.cycle24, 1); assert.equal(first.cycle18, 1); assert.equal(first.ji, 1)
  assert.equal(first.board.taiyi, 1); assert.equal(first.board.palaceYear, 1)
  assert.equal(final.divisions.every(row => row.remainder === 0), true)
})

test('乾坤 sky-eye pauses, 太乙 skips five, and its numbering differs from 奇门', () => {
  assert.equal(api.buildTaiyiYangBoard(4).skyEye, '乾'); assert.equal(api.buildTaiyiYangBoard(5).skyEye, '乾')
  assert.equal(api.buildTaiyiYangBoard(17).skyEye, '坤'); assert.equal(api.buildTaiyiYangBoard(18).skyEye, '坤')
  assert.equal(api.buildTaiyiYangBoard(12).taiyi, 4); assert.equal(api.buildTaiyiYangBoard(13).taiyi, 6)
  assert.deepEqual(plain(api.buildTaiyiYangBoard(1).palaces.map(cell => cell.trigram)), [...'乾离艮震中兑坤坎巽'])
})

test('all 72 positions have coherent structure; pending textual conflicts persist across cycles', () => {
  for (let ju = 1; ju <= 72; ju++) {
    const value = snapshot({ year: String(675 + ju) })
    assert.equal(api.isTaiyiSnapshot(value), true, String(ju))
    const next = snapshot({ year: String(747 + ju) })
    assert.deepEqual(plain(value.board), plain(next.board))
  }
})

test('years are explicit labels, rejecting unsupported eras, numeric coercion and timestamps', () => {
  for (const year of ['', '0', '-1', '10000', '2024-01-01', '2024.5', '2e3', '02024', 2024]) assert.throws(() => snapshot({ year }))
  assert.throws(() => snapshot({ name: '' })); assert.throws(() => api.buildTaiyiYangBoard(0)); assert.throws(() => api.buildTaiyiYangBoard(73)); assert.throws(() => api.buildTaiyiYangBoard(1.5))
  assert.equal(snapshot({ year: ' 2026 ' }).input.year, '2026')
  assert.equal(api.isTaiyiSnapshot(snapshot({ year: '1' })), true)
  assert.equal(api.isTaiyiSnapshot(snapshot({ year: '9999' })), true)
})

test('repository keeps original snapshots, exports full arithmetic, and rejects corrupted or duplicate records', () => {
  let data, tick = 0
  const repository = api.createTaiyiRepository({ get: () => data, set: (_key, value) => { data = value } }, now, () => `taiyi-${++tick}`)
  const value = snapshot(), saved = repository.save(value)
  value.board.host.count = 99
  assert.equal(repository.list()[0].snapshot.board.host.count, 24)
  const listing = repository.list(); listing[0].snapshot.input.name = '改动'
  assert.equal(repository.list()[0].snapshot.input.name, '金镜岁计练习')
  assert.equal(api.exportTaiyiRecord(saved, now()).record.snapshot.accumulated, 1937281)
  assert.equal(repository.exportAll().records.length, 1)
  assert.equal(repository.remove(saved.id).length, 0)
  data = { version: 1, records: [{ ...saved, snapshot: { ...saved.snapshot, accumulated: 99 } }] }
  const before = JSON.stringify(data)
  assert.throws(() => repository.list()); assert.throws(() => repository.save(snapshot())); assert.equal(JSON.stringify(data), before)
  data = { version: 1, records: [saved, saved] }; assert.throws(() => repository.list())
})

test('partial charts preserve null fields through save/export, and the thirty-record limit is explicit', () => {
  let data, tick = 0
  const repository = api.createTaiyiRepository({ get: () => data, set: (_key, value) => { data = value } }, now, () => `partial-${++tick}`)
  const saved = repository.save(snapshot({ year: '714' }))
  assert.equal(saved.snapshot.board.ju, 39); assert.equal(saved.snapshot.board.host.count, null)
  assert.equal(api.exportTaiyiRecord(saved, now()).record.snapshot.board.host.count, null)
  for (let i = 1; i < 30; i++) repository.save(snapshot())
  assert.throws(() => repository.save(snapshot()), /30/)
  const failed = api.createTaiyiRepository({ get: () => undefined, set: () => { throw new Error('quota') } }, now)
  assert.throws(() => failed.save(snapshot()), /保存失败/)
})
