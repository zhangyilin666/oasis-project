import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  stdin: { contents: "export * from './src/domain/space/index'; export * from './src/domain/space/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const now = () => new Date('2026-10-03T08:00:00.000Z')
const facts = changes => ({ ...api.emptySpaceFacts(), name: '我的书房', ...changes })
const snapshot = changes => api.createSpaceSnapshot(facts(changes), now())
function memory(initial) {
  let data = initial
  let writes = 0
  const keys = []
  return { get(key) { keys.push(key); return data }, set(key, value) { keys.push(key); data = value; writes++ }, get data() { return data }, get writes() { return writes }, get keys() { return keys } }
}
function repository(storage, id) { let sequence = 0; return api.createSpaceRepository(storage, now, id || (() => `space-${++sequence}`)) }

test('a name-only record remains unmeasured rather than inventing a zero-degree bearing', () => {
  const result = snapshot()
  assert.equal(result.ruleVersion, 'space-record-v1')
  assert.equal(result.scope, 'facts-only')
  assert.equal(result.facts.bearingDegrees, null)
  assert.equal(result.facts.northReference, 'unknown')
  assert.equal(result.directionStatus, 'unmeasured')
  assert.match(result.directionNote, /不补出朝向或盘法/)
  assert.equal(api.parseBearing('  '), null)
  assert.equal(api.parseBearing('0'), 0)
  assert.equal(snapshot({ bearingDegrees: 0, northReference: 'true' }).directionStatus, 'true-recorded')
})

test('bearing uses an explicit half-open circle and decimal input without silent modulo conversion', () => {
  for (const [text, expected] of [['0', 0], ['90', 90], ['182.5', 182.5], ['359.999', 359.999], [' .5 ', 0.5]]) assert.equal(api.parseBearing(text), expected)
  for (const text of ['360', '720', '-1', '-0', 'NaN', 'Infinity', '0x10', '1e2', '90°', '90,5', '北']) assert.throws(() => api.parseBearing(text), /度数|十进制/)
  for (const bearingDegrees of [-0.001, 360, Infinity, NaN, '90', undefined]) assert.throws(() => snapshot({ bearingDegrees }), /方向度数/)
})

test('unknown and magnetic references preserve raw readings without a fabricated true bearing', () => {
  const unknown = snapshot({ bearingDegrees: 182.5 })
  assert.equal(unknown.directionStatus, 'reference-unknown')
  assert.match(unknown.directionNote, /不推断方位/)
  const magnetic = snapshot({ bearingDegrees: 182.5, northReference: 'magnetic', measuredAt: '2024-02-29', measurementTool: '指南针' })
  assert.equal(magnetic.facts.bearingDegrees, 182.5)
  assert.equal(magnetic.facts.northReference, 'magnetic')
  assert.equal(magnetic.directionStatus, 'magnetic-only')
  assert.match(magnetic.directionNote, /不换算真北/)
  assert.equal(magnetic.trueBearing, undefined)
  assert.equal(magnetic.fengShuiChart, undefined)
  assert.equal(snapshot({ northReference: 'magnetic' }).directionStatus, 'unmeasured')
})

test('facts preserve optional unknown dates and periods while rejecting invalid dates and reference types', () => {
  const result = snapshot({ name: '  书房  ', locationNote: '某城区', buildingPeriod: '约2010年，待核实', moveInPeriod: '不详', notes: '第一行\n第二行' })
  assert.equal(result.facts.name, '书房')
  assert.equal(result.facts.measuredAt, '')
  assert.equal(result.facts.moveInPeriod, '不详')
  assert.equal(result.facts.notes, '第一行\n第二行')
  for (const measuredAt of ['2024-02-30', '2023-02-29', '2024-2-9', '1899-12-31', '2100-01-01']) assert.throws(() => snapshot({ measuredAt }), /测量日期/)
  for (const northReference of ['north', '', null, { toString: () => 'true' }]) assert.throws(() => snapshot({ northReference }), /真北、磁北/)
  assert.throws(() => api.createSpaceSnapshot(facts(), new Date('invalid')), /当前时间/)
})

test('blank names and oversized text fail before storage, without dropping user text silently', () => {
  for (const changes of [{ name: ' \n ' }, { name: '名'.repeat(41) }, { locationNote: '地'.repeat(201) }, { layoutDescription: '室'.repeat(1501) }, { measurementBasis: '据'.repeat(501) }, { notes: '记'.repeat(1501) }]) assert.throws(() => snapshot(changes), /名称|名字|最多/)
  assert.equal(snapshot({ notes: '记'.repeat(1500) }).facts.notes.length, 1500)
})

test('snapshot generation isolates source inputs and source metadata from later edits', () => {
  const input = facts({ layoutDescription: '两室一厅', measurementBasis: '工具明确标注磁北', northReference: 'magnetic', bearingDegrees: 270 })
  const result = api.createSpaceSnapshot(input, now())
  input.layoutDescription = '后来修改'
  result.sources[0].title = '修改返回来源'
  assert.equal(result.facts.layoutDescription, '两室一厅')
  assert.match(snapshot().sources[0].title, /NOAA/)
})

test('a saved full snapshot reloads from JSON and exports exactly as recorded', () => {
  const original = snapshot({ locationNote: '成都附近', layoutDescription: '一室一厅', directionTarget: '书桌朝窗外', bearingDegrees: 359.5, northReference: 'magnetic', measurementTool: '手持指南针', measuredAt: '2024-02-29', measurementBasis: '离开金属物测三次，读数略有变化', buildingPeriod: '约2015年', moveInPeriod: '2024秋', notes: '下午窗边采光较亮' })
  const storage = memory()
  const saved = repository(storage).save(original)
  const json = JSON.stringify(storage.data)
  const readOnly = { get: () => json, set() { assert.fail('reading/exporting cannot write or recalculate a snapshot') } }
  const reopened = repository(readOnly).list()[0]
  assert.deepEqual(plain(reopened), plain(saved))
  assert.deepEqual(plain(api.exportSpaceRecord(reopened, now()).record), plain(saved))
  assert.deepEqual(plain(repository(readOnly).exportAll().records), [plain(saved)])
  assert.equal(saved.savedAt, '2026-10-03T08:00:00.000Z')
  assert.ok(storage.keys.every(key => key === '__oasis_space_records_v1'))
})

test('input, save results, lists and exports cannot alias stored nested snapshot fields', () => {
  const storage = memory()
  const archive = repository(storage)
  const input = snapshot({ bearingDegrees: 0, northReference: 'true' })
  const saved = archive.save(input)
  input.facts.name = '改入参'
  saved.snapshot.facts.bearingDegrees = 250
  const listed = archive.list()
  listed[0].snapshot.sources[0].title = '改来源'
  api.exportSpaceRecord(archive.list()[0], now()).record.snapshot.facts.name = '改导出'
  archive.exportAll().records[0].snapshot.facts.name = '改整包'
  const actual = archive.list()[0]
  assert.equal(actual.snapshot.facts.name, '我的书房')
  assert.equal(actual.snapshot.facts.bearingDegrees, 0)
  assert.match(actual.snapshot.sources[0].title, /NOAA/)
})

test('thirty records are retained without eviction when a thirty-first save is refused', () => {
  const storage = memory()
  const archive = repository(storage)
  for (let index = 0; index < 30; index++) archive.save(snapshot({ name: `房间${index}` }))
  const before = JSON.stringify(storage.data)
  assert.throws(() => archive.save(snapshot()), /30/)
  assert.equal(storage.writes, 30)
  assert.equal(JSON.stringify(storage.data), before)
  assert.equal(archive.list()[0].snapshot.facts.name, '房间29')
  assert.equal(archive.list()[29].snapshot.facts.name, '房间0')
})

test('deletion removes only the chosen ID and a missing ID causes no write', () => {
  const storage = memory()
  const archive = repository(storage)
  const first = archive.save(snapshot())
  const second = archive.save(snapshot())
  const third = archive.save(snapshot({ name: '另一处' }))
  assert.deepEqual(plain(archive.remove(second.id)), plain([third, first]))
  const writes = storage.writes
  assert.deepEqual(plain(archive.remove('missing')), plain([third, first]))
  assert.equal(storage.writes, writes)
})

test('corrupt and future-version archives block save/delete and retain original data unchanged', () => {
  const record = { id: 'original', savedAt: now().toISOString(), snapshot: snapshot() }
  const envelope = value => ({ version: 1, records: [{ ...record, snapshot: value }] })
  const malformed = [
    '{bad-json', [], { version: 2, records: [] }, { version: 1, records: [record, record] },
    envelope({ ...record.snapshot, ruleVersion: 'space-record-v2' }),
    envelope({ ...record.snapshot, facts: { ...record.snapshot.facts, bearingDegrees: 360 } }),
    envelope({ ...record.snapshot, facts: { ...record.snapshot.facts, measuredAt: '2024-02-30' } }),
    envelope({ ...record.snapshot, directionStatus: 'true-recorded' }),
    envelope({ ...record.snapshot, sources: [] }),
  ]
  for (const data of malformed) {
    const storage = memory(data)
    const archive = repository(storage)
    const before = JSON.stringify(storage.data)
    assert.throws(() => archive.list(), /无法读取|格式异常/)
    assert.throws(() => archive.save(snapshot()), /无法读取|格式异常/)
    assert.throws(() => archive.remove('original'), /无法读取|格式异常/)
    assert.equal(storage.writes, 0)
    assert.equal(JSON.stringify(storage.data), before)
  }
})

test('read/write failures and duplicate IDs never report a successful archive operation', () => {
  let writes = 0
  const unreadable = repository({ get() { throw new Error('blocked') }, set() { writes++ } })
  assert.throws(() => unreadable.save(snapshot()), /无法读取/)
  assert.throws(() => unreadable.remove('original'), /无法读取/)
  assert.equal(writes, 0)
  const storage = memory()
  const archive = repository(storage, () => 'same-id')
  const original = archive.save(snapshot())
  const before = JSON.stringify(storage.data)
  assert.throws(() => archive.save(snapshot()), /编号冲突/)
  const unwritable = repository({ get: key => storage.get(key), set() { throw new Error('quota') } })
  assert.throws(() => unwritable.save(snapshot()), /保存失败/)
  assert.throws(() => unwritable.remove(original.id), /保存失败/)
  assert.equal(JSON.stringify(storage.data), before)
})

test('the dedicated archive and export never read unrelated account storage', () => {
  let saved
  const archive = repository({
    get(key) { assert.equal(key, api.SPACE_STORAGE_KEY); return saved },
    set(key, data) { assert.equal(key, api.SPACE_STORAGE_KEY); saved = data },
  })
  archive.save(snapshot())
  const exported = archive.exportAll()
  assert.equal(exported.format, 'oasis-space-records')
  assert.equal(exported.formatVersion, 1)
  assert.equal(exported.records.length, 1)
  assert.doesNotMatch(JSON.stringify(exported), /accessToken|"token"|password/)
  assert.throws(() => api.exportSpaceRecord({ id: 'bad' }), /有效空间档案/)
})
