import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/domain/names/index.ts', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const inspect = (name, confirmedPronunciation = '', notes = '') => api.inspectName({ name, confirmedPronunciation, notes })
function storage() {
  const data = new Map()
  return { data, getItem: key => data.get(key), setItem: (key, value) => { assert.equal(key, api.NAME_STORAGE_KEY); data.set(key, value) } }
}
const timestamp = '2026-10-03T08:00:00.000Z'

test('selected Unihan 17 fields match raw official reference lines, not a rebuilt runtime lookup', async () => {
  const raw = await readFile(new URL('./fixtures/unihan-17-reference.txt', import.meta.url), 'utf8')
  let checked = 0
  for (const line of raw.split(/\r?\n/).filter(line => line && !line.startsWith('#'))) {
    const [codePoint, field, value] = line.split('\t')
    const char = String.fromCodePoint(Number.parseInt(codePoint.slice(2), 16))
    const item = inspect(char).characters[0]
    const mapped = { kDefinition: 'definition', kMandarin: 'mandarin', kTotalStrokes: 'totalStrokes' }[field]
    assert.equal(item.codePoint, codePoint)
    if (mapped) assert.equal(item[mapped], value)
    else assert.deepEqual(plain(item[field === 'kSimplifiedVariant' ? 'simplified' : 'traditional'].map(item => item.codePoint)), value.split(' '))
    checked++
  }
  assert.equal(checked, 43)
  assert.equal(api.NAME_CHARACTER_COUNT, 116)
})

test('simplified, traditional, polyphonic and supplementary characters keep distinct original facts', () => {
  const result = inspect('张張乐樂行重𠮷', 'zhāng · yuè · háng · chóng · jí', '读音由用户确认')
  assert.deepEqual(plain(result.characters.map(char => char.totalStrokes)), ['7', '11', '5', '15', '6', '9', '6'])
  assert.equal(result.characters[2].mandarin, 'lè', 'the customary dictionary reading must not be relabeled as the confirmed name reading')
  assert.equal(result.characters[6].character, '𠮷')
  assert.equal(result.characters[6].codePoint, 'U+20BB7')
  assert.equal(result.input.confirmedPronunciation, 'zhāng · yuè · háng · chóng · jí')
  assert.equal(result.input.name, '张張乐樂行重𠮷')
})

test('compound surnames and separators remain user text while unsupported characters are not guessed', () => {
  const result = inspect('  歐陽·明 - A😀  ')
  assert.equal(result.input.name, '歐陽·明 - A😀')
  assert.deepEqual(plain(result.characters.map(char => char.status)), ['available', 'available', 'separator', 'available', 'separator', 'separator', 'separator', 'unavailable', 'unavailable'])
  assert.equal(result.characters.at(-1).definition, undefined)
  assert.equal(result.characters.at(-1).totalStrokes, undefined)
  assert.ok(result.conventions.some(text => text.includes('不自动拆分') || text.includes('不推断姓氏')))
})

test('all available dictionary facts, versions, license and sources are independently cloned', () => {
  const first = inspect('明')
  first.characters[0].definition = 'changed'
  first.sources[0].url = 'https://invalid.example'
  first.conventions.push('changed')
  const second = inspect('明')
  assert.equal(second.characters[0].definition, 'bright, light, brilliant; clear')
  assert.equal(second.data.version, '17.0.0')
  assert.equal(second.data.license, 'Unicode-3.0')
  assert.match(second.sources[0].url, /17\.0\.0\/ucd\/Unihan.zip$/)
  assert.equal(api.isNameSnapshot(second), true)
})

test('name validation counts Unicode scalars and rejects invalid input without coerced or truncated text', () => {
  for (const raw of [null, {}, { name: '明', notes: '' }, { name: 1, confirmedPronunciation: '', notes: '' }]) assert.throws(() => api.inspectName(raw))
  for (const name of ['', '  ', ' ·- ', '明\n安', '\uD800', '𠮷'.repeat(41)]) assert.throws(() => inspect(name))
  assert.equal(inspect('𠮷'.repeat(40)).characters.length, 40)
  assert.throws(() => inspect('明', '音'.repeat(121)), /读音/)
  assert.throws(() => inspect('明', '', '文'.repeat(2001)), /笔记/)
  assert.equal(inspect('明', '', '第一行\n第二行').input.notes, '第一行\n第二行')
})

test('a saved snapshot survives repository recreation, preserves old definitions and never requeries them', () => {
  const store = storage(), repo = api.createNameRepository(store)
  const snapshot = inspect('明', 'míng', '测试笔记')
  const saved = repo.save(snapshot, timestamp)
  const expected = plain(saved.snapshot)
  snapshot.input.notes = 'changed after save'
  saved.snapshot.characters[0].definition = 'changed return value'
  assert.deepEqual(plain(api.createNameRepository(store).list()[0].snapshot), expected)
  const envelope = JSON.parse(store.data.get(api.NAME_STORAGE_KEY))
  envelope.records[0].snapshot.characters[0].definition = 'historically saved definition'
  store.data.set(api.NAME_STORAGE_KEY, JSON.stringify(envelope))
  assert.equal(api.createNameRepository(store).list()[0].snapshot.characters[0].definition, 'historically saved definition')
  assert.equal(JSON.parse(repo.exportJSON()).records[0].snapshot.characters[0].definition, 'historically saved definition')
})

test('store maintains same-instant IDs, hard capacity, explicit deletion and stable exports', () => {
  const store = storage(), repo = api.createNameRepository(store), snapshot = inspect('林清和')
  for (let i = 0; i < 50; i++) repo.save(snapshot, timestamp)
  const records = repo.list()
  assert.equal(new Set(records.map(record => record.id)).size, 50)
  const before = store.data.get(api.NAME_STORAGE_KEY)
  assert.throws(() => repo.save(snapshot, timestamp), /最多保存 50/)
  assert.equal(store.data.get(api.NAME_STORAGE_KEY), before)
  const target = records[17].id
  repo.remove(target)
  assert.deepEqual(plain(repo.list().map(record => record.id)), plain(records.filter(record => record.id !== target).map(record => record.id)))
  assert.throws(() => repo.remove('missing'), /不存在/)
  const exported = JSON.parse(repo.exportJSON())
  assert.equal(exported.kind, 'name-culture')
  assert.deepEqual(exported.records, plain(repo.list()))
})

test('unknown versions, unsafe sources, malformed data and sparse snapshots fail without overwriting', () => {
  const valid = inspect('明')
  const variants = [
    value => { value.ruleVersion = 'name-culture-v99' },
    value => { value.dataVersion = 'future' },
    value => { value.characters[0].codePoint = 'U+0000' },
    value => { delete value.characters[0] },
    value => { value.sources[0].url = 'javascript:alert(1)' },
    value => { value.data.license = 'unknown' },
  ]
  for (const corrupt of variants) {
    const store = storage(), repo = api.createNameRepository(store), snapshot = plain(valid)
    corrupt(snapshot)
    assert.equal(api.isNameSnapshot(snapshot), false)
    assert.throws(() => repo.save(snapshot, timestamp), /记录内容/)
    assert.equal(store.data.size, 0)
    const bad = JSON.stringify({ schemaVersion: 1, kind: 'name-culture', records: [{ id: 'old', savedAt: timestamp, snapshot }] })
    store.data.set(api.NAME_STORAGE_KEY, bad)
    assert.throws(() => repo.list(), /已停止写入/)
    assert.throws(() => repo.save(valid, timestamp), /已停止写入/)
    assert.throws(() => repo.remove('old'), /已停止写入/)
    assert.equal(store.data.get(api.NAME_STORAGE_KEY), bad)
  }
})

test('read and quota failures are explicit; failed writes retain the original value', () => {
  const snapshot = inspect('林明')
  assert.throws(() => api.createNameRepository({ getItem() { throw Error('denied') }, setItem() {} }).list(), /存储权限/)
  const store = storage()
  api.createNameRepository(store).save(snapshot, timestamp)
  const before = store.data.get(api.NAME_STORAGE_KEY)
  const repo = api.createNameRepository({ getItem: store.getItem, setItem() { throw Error('quota') } })
  assert.throws(() => repo.save(snapshot, timestamp), /未确认成功/)
  assert.equal(store.data.get(api.NAME_STORAGE_KEY), before)
  assert.throws(() => repo.save(snapshot, '2026-02-30T08:00:00.000Z'), /保存时间/)
})
