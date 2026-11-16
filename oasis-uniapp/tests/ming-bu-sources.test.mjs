import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: "export * from './src/domain/cross-reading'; export * from './src/domain/cross-reading/repository'; export { ACTIVE_CROSS_SOURCE_KINDS } from './src/domain/metaphysics/navigation'; export * as almanac from './src/domain/almanac'; export * as practice from './src/domain/practice';",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const savedAt = '2026-10-03T08:00:00.000Z'
const closedKinds = ['birth-charts', 'space', 'bazhai', 'seasonal-care', 'practice', 'physiognomy-culture']
const closedKeys = ['__xiaoyi_local_charts_v1', '__oasis_space_records_v1', 'oasis.bazhai.records.v1', 'oasis.seasonal-care.records.v1', 'oasis.practice.sessions.v1', 'oasis.physiognomy.notes.v1']
const almanacKey = 'oasis.almanac.snapshots.v1'
const practiceKey = 'oasis.practice.sessions.v1'
const almanacRecord = { id: 'almanac-one', savedAt, result: api.almanac.calculateAlmanac({ date: '2024-02-05', time: '12:00' }) }
const practiceRecord = {
  id: 'practice-one', savedAt: Date.parse(savedAt),
  snapshot: api.practice.finishPracticeDraft(api.practice.createPracticeDraft({ topicId: 'quiet-seat', durationMinutes: 1 }, Date.parse(savedAt) - 60000, 'practice-one'), Date.parse(savedAt)),
}
function storage() {
  const data = new Map([
    [almanacKey, JSON.stringify({ schemaVersion: 1, records: [almanacRecord] })],
    [practiceKey, JSON.stringify({ schemaVersion: 1, active: null, records: [practiceRecord] })],
  ])
  const reads = []
  let writes = 0
  return { data, reads, get writes() { return writes }, getItem(key) { reads.push(key); return data.get(key) }, setItem(key, value) { writes++; data.set(key, value) } }
}

test('the Ming/Bu catalog reads only enabled families and leaves closed records untouched', () => {
  const store = storage()
  for (const key of closedKeys) store.data.set(key, '{unread legacy data')
  store.data.set('oasis.tarot.records.v1', '{broken enabled data')
  const before = [...store.data.entries()]
  const catalog = api.listCrossReadingSources(store, api.ACTIVE_CROSS_SOURCE_KINDS)

  assert.equal(api.ACTIVE_CROSS_SOURCE_KINDS.length, 13)
  assert.deepEqual(plain(api.ACTIVE_CROSS_SOURCE_KINDS), plain(api.CROSS_SOURCE_KINDS.filter(kind => !closedKinds.includes(kind))))
  assert.deepEqual(plain(catalog.selections.map(item => item.kind)), ['almanac'])
  assert.deepEqual(plain(catalog.errors.map(error => error.kind)), ['tarot'])
  assert.equal(catalog.counts.almanac, 1)
  assert.deepEqual(Object.keys(catalog.counts), plain(api.CROSS_SOURCE_KINDS))
  for (const kind of closedKinds) assert.equal(catalog.counts[kind], 0)
  for (const key of closedKeys) assert.ok(!store.reads.includes(key), key)
  assert.deepEqual([...store.data.entries()], before)
  assert.equal(store.writes, 0)
})

test('the optional filter preserves the full legacy default and never duplicates a source', () => {
  const store = storage()
  const all = api.listCrossReadingSources(store)
  assert.equal(api.CROSS_SOURCE_KINDS.length, 19)
  assert.deepEqual(plain(all.selections.map(item => item.kind)), ['almanac', 'practice'])
  assert.deepEqual(plain(all.errors), [])
  for (const key of closedKeys) assert.ok(store.reads.includes(key), key)

  store.reads.length = 0
  const empty = api.listCrossReadingSources(store, [])
  assert.deepEqual(plain(empty.selections), [])
  assert.deepEqual(plain(empty.errors), [])
  assert.ok(Object.values(empty.counts).every(count => count === 0))
  assert.deepEqual(store.reads, [])

  const single = api.listCrossReadingSources(store, ['almanac', 'almanac'])
  assert.deepEqual(plain(single.selections.map(item => item.kind)), ['almanac'])
  assert.deepEqual(store.reads, [almanacKey])
  assert.equal(store.writes, 0)
})

test('existing mixed snapshots still reopen and export after the active catalog excludes their source', () => {
  const store = storage()
  const original = plain(api.createCrossReading({ topic: '原有练习与黄历同读', note: '保留历史来源', selections: api.listCrossReadingSources(store).selections }, savedAt))
  const repository = api.createCrossReadingRepository(store)
  repository.save(original)

  assert.deepEqual(plain(api.listCrossReadingSources(store, api.ACTIVE_CROSS_SOURCE_KINDS).selections.map(item => item.kind)), ['almanac'])
  store.data.delete(practiceKey)
  store.data.delete(almanacKey)
  assert.deepEqual(plain(api.listCrossReadingSources(store, api.ACTIVE_CROSS_SOURCE_KINDS).selections), [])

  const restored = repository.list()[0]
  assert.equal(api.isCrossReadingSnapshot(restored.snapshot), true)
  assert.deepEqual(plain(restored.snapshot), original)
  assert.deepEqual(JSON.parse(repository.exportJSON()).records[0].snapshot, original)
  assert.equal(store.writes, 1)
})
