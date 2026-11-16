import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({ stdin: { contents: "export * from './src/domain/physiognomy'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, Date, console })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const reference = JSON.parse(await readFile(new URL('./fixtures/physiognomy-reference.json', import.meta.url), 'utf8'))
const plain = value => JSON.parse(JSON.stringify(value))
const input = overrides => ({ articleId: 'three-regions', date: '2026-10-03', title: '独立词语核对', note: '记录文献版本与词语差异。', ...overrides })
function memory() { const values = new Map(); return { values, getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) } }

test('term mappings agree with the separately registered primary-text correspondences', () => {
  for (const [id, key] of [['five-offices', 'fiveOffices'], ['three-regions', 'threeRegions'], ['five-mountains', 'fiveMountains'], ['four-rivers', 'fourRivers']]) {
    const article = api.getCulturalArticle(id)
    assert.deepEqual(plain(article.terms.map(term => [term.label, term.description])), reference[key])
    assert.equal(article.source.revision, `Wikisource oldid=${reference.encyclopediaRevision}`)
  }
  const regions = api.getCulturalArticle('three-regions')
  assert.equal(regions.diagram, 'three-regions')
  assert.match(regions.readingNote, /上府、中府、下府/)
})

test('historical criticism and disputed attribution retain their distinct primary references', () => {
  for (const source of reference.sources) assert.equal(api.getCulturalArticle(source.article).source.revision, `Wikisource oldid=${source.revision}`)
  assert.match(api.getCulturalArticle('authorship').summary, /不接受这个署名/)
  assert.match(api.getCulturalArticle('fei-xiang').summary, /质疑由形貌/)
  assert.match(api.getCulturalArticle('star-metaphors').readingNote, /不是七政四余/)
})

test('catalog search supports simplified and traditional aliases, categories and an empty result', () => {
  assert.equal(api.searchCulturalArticles().length, 8)
  assert.equal(new Set(api.searchCulturalArticles().map(item => item.id)).size, 8)
  for (const query of ['五岳', '五嶽', '  衡山  ']) assert.equal(api.searchCulturalArticles(query)[0].id, 'five-mountains')
  assert.equal(api.searchCulturalArticles('監察官')[0].id, 'five-offices')
  assert.equal(api.searchCulturalArticles('', 'history')[0].id, 'authorship')
  assert.equal(api.searchCulturalArticles('根本不存在的词条').length, 0)
  assert.equal(api.searchCulturalArticles('三停', 'history').length, 0)
  assert.throws(() => api.searchCulturalArticles('甲'.repeat(81)))
  assert.throws(() => api.searchCulturalArticles('', 'photos'))
  assert.throws(() => api.getCulturalArticle('missing'))
})

test('retrieved articles and nested references cannot mutate the shared content', () => {
  const article = api.getCulturalArticle('three-regions')
  article.summary = '修改'; article.source.url = 'https://example.com'; article.terms[0].description = '错误'
  const results = api.searchCulturalArticles(); results[0].aliases.push('外加词')
  assert.notEqual(api.getCulturalArticle('three-regions').summary, '修改')
  assert.ok(api.getCulturalArticle('three-regions').source.url.includes('oldid=1942595'))
  assert.equal(api.getCulturalArticle('three-regions').terms[0].description, '发际至眉')
  assert.equal(api.searchCulturalArticles('外加词').length, 0)
})

test('notes use valid civil dates and bounded user text without inventing absent fields', () => {
  assert.equal(api.createCulturalNote(input({ date: '2024-02-29' })).input.date, '2024-02-29')
  assert.equal(api.createCulturalNote(input({ title: '  标题  ', note: '  第一行\n第二行  ' })).input.note, '第一行\n第二行')
  assert.equal(api.createCulturalNote(input({ note: '𠮷'.repeat(2000) })).input.note.length, 4000)
  for (const date of ['2023-02-29', '2026-13-01', '2026-10-3', '1899-12-31', '2100-01-01']) assert.throws(() => api.createCulturalNote(input({ date })))
  for (const change of [{ title: '' }, { note: ' ' }, { title: 'x'.repeat(81) }, { note: '文'.repeat(2001) }, { title: '换\n行' }, { note: '\u0000' }, { articleId: 'missing' }]) assert.throws(() => api.createCulturalNote(input(change)))
})

test('saved notes restore the historical prose and source snapshot without re-querying a newer article', () => {
  const storage = memory(), repository = api.createCulturalNoteRepository(storage)
  const snapshot = api.createCulturalNote(input())
  snapshot.article.summary = '模拟保存时已校订的旧版释义，回看不得重新查表覆盖。'
  const record = repository.save(snapshot, '2026-10-03T08:00:00.000Z')
  snapshot.input.note = '后来修改'; record.snapshot.article.summary = '外部修改'
  const restored = api.createCulturalNoteRepository(storage).list()[0]
  assert.match(restored.snapshot.article.summary, /模拟保存时/)
  assert.equal(restored.snapshot.input.note, '记录文献版本与词语差异。')
  assert.deepEqual(JSON.parse(repository.exportJSON()).records, plain(repository.list()))
  restored.snapshot.input.title = '外部改动'; assert.equal(repository.list()[0].snapshot.input.title, '独立词语核对')
  assert.deepEqual([...storage.values.keys()], [api.PHYSIOGNOMY_STORAGE_KEY])
})

test('unknown versions, unsafe links and incomplete snapshots leave stored data untouched', () => {
  for (const alter of [value => { value.ruleVersion = 'future' }, value => { value.contentVersion = 'future' }, value => { value.article.source.url = 'javascript:alert(1)' }, value => { value.article.source.revision = 'wrong' }, value => { value.article.terms = [null] }, value => { value.input.date = '2023-02-29' }]) {
    const storage = memory(), repository = api.createCulturalNoteRepository(storage), snapshot = api.createCulturalNote(input())
    repository.save(snapshot); const before = storage.values.get(api.PHYSIOGNOMY_STORAGE_KEY)
    alter(snapshot); assert.equal(api.isCulturalNote(snapshot), false)
    assert.throws(() => repository.save(snapshot)); assert.equal(storage.values.get(api.PHYSIOGNOMY_STORAGE_KEY), before)
  }
  for (const raw of ['{broken', JSON.stringify({ schemaVersion: 2, kind: 'physiognomy-culture', records: [] })]) {
    const storage = memory(); storage.values.set(api.PHYSIOGNOMY_STORAGE_KEY, raw); const repo = api.createCulturalNoteRepository(storage)
    assert.throws(() => repo.list()); assert.throws(() => repo.save(api.createCulturalNote(input()))); assert.throws(() => repo.remove('x')); assert.throws(() => repo.exportJSON())
    assert.equal(storage.values.get(api.PHYSIOGNOMY_STORAGE_KEY), raw)
  }
})

test('fifty maximum-length notes fit; a fifty-first save never evicts prior records', () => {
  const storage = memory(), repo = api.createCulturalNoteRepository(storage), snapshot = api.createCulturalNote(input({ note: '𠮷'.repeat(2000), title: '题'.repeat(80) }))
  for (let i = 0; i < 50; i++) repo.save(snapshot, '2026-10-03T08:00:00.000Z')
  assert.equal(repo.list().length, 50); assert.equal(new Set(repo.list().map(record => record.id)).size, 50)
  const before = storage.values.get(api.PHYSIOGNOMY_STORAGE_KEY)
  assert.throws(() => repo.save(snapshot), /50/); assert.equal(storage.values.get(api.PHYSIOGNOMY_STORAGE_KEY), before)
  const id = repo.list()[20].id; repo.remove(id); assert.equal(repo.list().length, 49); assert.equal(repo.list().some(record => record.id === id), false)
})

test('storage failures do not report a save and retain the original input snapshot', () => {
  const snapshot = api.createCulturalNote(input()), original = plain(snapshot)
  const readFailure = api.createCulturalNoteRepository({ getItem: () => { throw new Error('permission') }, setItem: () => assert.fail('must not write') })
  assert.throws(() => readFailure.save(snapshot), /无法读取/)
  const quota = api.createCulturalNoteRepository({ getItem: () => '', setItem: () => { throw new Error('quota') } })
  assert.throws(() => quota.save(snapshot), /未确认成功/)
  assert.deepEqual(plain(snapshot), original)
})
