import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'
import { qimenReferences } from './fixtures/qimen-reference.mjs'

const bundle = await build({ stdin: { contents: "export * from './src/domain/qimen/index'; export * from './src/domain/qimen/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const now = () => new Date('2026-10-03T08:00:00.000Z')
const input = changes => ({ name: '参考盘', date: '2024-01-01', time: '12:00:00', utcOffsetMinutes: 480, locationNote: '', question: '', ...changes })
const snapshot = changes => api.createQimenSnapshot(input(changes), now())

for (const expected of qimenReferences) {
  test(`full nine-palace independent reference: ${expected.id} (${expected.sourceType})`, () => {
    const actual = snapshot({ date: expected.date, time: expected.time })
    assert.equal(actual.term, expected.term)
    assert.equal(actual.yuan, expected.yuan)
    assert.equal(actual.day, expected.day)
    assert.equal(actual.board.hour, expected.hour)
    assert.equal(actual.board.dun, expected.dun)
    assert.equal(actual.board.ju, expected.ju)
    assert.equal(actual.board.chiefStar, expected.chief)
    assert.equal(actual.board.chiefPalace, expected.chiefPalace)
    assert.equal(actual.board.chiefGate, expected.gate)
    assert.equal(actual.board.gatePalace, expected.gatePalace)
    assert.deepEqual(plain(actual.board.palaces.map(({ earth, heaven, star, gate, god, earthGuest, heavenGuest }) => [earth, heaven, star, gate, god, earthGuest, heavenGuest])), expected.cells)
    assert.equal(api.isQimenSnapshot(actual), true)
  })
}

test('precise library boundary changes the term at the instant, with all inputs in fixed UTC+08:00', () => {
  const before = snapshot({ date: '2024-06-21', time: '04:50:59' })
  const at = snapshot({ date: '2024-06-21', time: '04:51:00' })
  assert.equal(before.term, '芒种')
  assert.equal(before.nextTermAt, '2024-06-21 04:51:00')
  assert.equal(at.term, '夏至')
  assert.equal(at.termAt, before.nextTermAt)
  assert.equal(before.board.dun, 'yang')
  assert.equal(at.board.dun, 'yin')
  assert.equal(before.board.hour, at.board.hour)
  const winterBefore = snapshot({ date: '2023-12-22', time: '11:27:19' })
  const winterAt = snapshot({ date: '2023-12-22', time: '11:27:20' })
  assert.equal(winterBefore.term, '大雪')
  assert.equal(winterAt.term, '冬至')
  assert.equal(winterBefore.board.dun, 'yin')
  assert.equal(winterAt.board.dun, 'yang')
})

test('equivalent explicit offsets produce the same board and calendar without using device time zone', () => {
  const a = snapshot()
  const b = snapshot({ date: '2024-01-01', time: '04:00', utcOffsetMinutes: 0 })
  const c = snapshot({ date: '2023-12-31', time: '23:00', utcOffsetMinutes: -300 })
  const d = snapshot({ time: '09:45', utcOffsetMinutes: 345 })
  for (const value of [b, c, d]) {
    assert.equal(value.instant, a.instant)
    assert.equal(value.referenceTime, a.referenceTime)
    assert.equal(value.day, a.day)
    assert.deepEqual(plain(value.board), plain(a.board))
  }
  assert.equal(b.input.time, '04:00:00')
  assert.equal(a.timePolicy, 'UTC+08:00-clock-zi23')
  assert.equal(api.formatOffset(-330), 'UTC−05:30')
})

test('23:00 advances the day once; midnight keeps the same day and hour rather than advancing twice', () => {
  const before = snapshot({ time: '22:59:59' })
  const at = snapshot({ time: '23:00:00' })
  const after = snapshot({ date: '2024-01-02', time: '00:00:00' })
  assert.equal(before.day, '甲子')
  assert.equal(at.day, '乙丑')
  assert.equal(at.board.hour, '丙子')
  assert.equal(after.day, at.day)
  assert.deepEqual(plain(after.board), plain(at.board))
  assert.equal(at.input.date, '2024-01-01')
})

test('center as chief origin, hour-stem destination and raw gate destination follow separate explicit rules', () => {
  const origin = api.buildQimenBoard('yin', 9, '乙巳')
  assert.equal(origin.xunPalace, 5)
  assert.equal(origin.chiefStar, '天禽')
  assert.equal(origin.gateRawPalace, 4) // not 1: counting begins at original 5, not hosted 2
  const hourAtCenter = api.buildQimenBoard('yang', 1, '壬申')
  assert.equal(hourAtCenter.chiefPalace, 2)
  assert.equal(hourAtCenter.palaces[1].star, '天蓬')
  const gateAtCenter = api.buildQimenBoard('yang', 1, '戊辰')
  assert.equal(gateAtCenter.gateRawPalace, 5)
  assert.equal(gateAtCenter.gatePalace, 2)
  assert.equal(gateAtCenter.palaces[1].gate, '休门')
  const jiaAtCenter = api.buildQimenBoard('yang', 1, '甲辰')
  assert.equal(jiaAtCenter.chiefStar, '天禽')
  assert.equal(jiaAtCenter.chiefPalace, 2)
  assert.equal(jiaAtCenter.palaces[1].heavenGuest, '壬')
  assert.equal(jiaAtCenter.palaces[4].earth, '壬')
  assert.equal(jiaAtCenter.palaces[4].star, '')
})

test('public-domain example anchors: yang one Yi-Chou and Bing-Yin chiefs and gates', () => {
  const yi = api.buildQimenBoard('yang', 1, '乙丑')
  const bing = api.buildQimenBoard('yang', 1, '丙寅')
  assert.equal(yi.chiefStar, '天蓬'); assert.equal(yi.chiefPalace, 9); assert.equal(yi.gatePalace, 2)
  assert.equal(bing.chiefPalace, 8); assert.equal(bing.gatePalace, 3)
})

test('all 1080 basic boards conserve nine stems/stars and eight gates/gods; this is an invariant check, not external truth', () => {
  const gan = '甲乙丙丁戊己庚辛壬癸', zhi = '子丑寅卯辰巳午未申酉戌亥'
  for (const dun of ['yang', 'yin']) for (let ju = 1; ju <= 9; ju++) for (let hour = 0; hour < 60; hour++) {
    const board = api.buildQimenBoard(dun, ju, gan[hour % 10] + zhi[hour % 12])
    const cells = board.palaces, outer = cells.filter(cell => cell.palace !== 5)
    assert.equal(new Set(cells.map(cell => cell.earth)).size, 9)
    assert.equal(new Set(outer.flatMap(cell => [cell.heaven, cell.heavenGuest]).filter(Boolean)).size, 9)
    assert.equal(new Set(outer.flatMap(cell => cell.star.split('、'))).size, 9)
    assert.equal(new Set(outer.map(cell => cell.gate)).size, 8)
    assert.equal(new Set(outer.map(cell => cell.god)).size, 8)
    assert.ok(cells[board.chiefPalace - 1].star.includes(board.chiefStar))
    assert.equal(cells[board.gatePalace - 1].gate, board.chiefGate)
  }
})

test('inputs reject missing facts, invalid dates, clock overflows and unsupported offset instead of guessing', () => {
  for (const changes of [{ name: '' }, { date: '' }, { time: '' }, { date: '2023-02-29' }, { date: '2024-02-30' }, { time: '24:00' }, { time: '12:60' }, { time: '12:00:60' }, { utcOffsetMinutes: null }, { utcOffsetMinutes: 841 }, { utcOffsetMinutes: -721 }, { utcOffsetMinutes: 8 }, { utcOffsetMinutes: '480' }, { date: '1899-12-31' }, { date: '2100-01-01' }, { date: '1900-01-01', time: '00:00', utcOffsetMinutes: 840 }, { name: '名'.repeat(41) }, { question: '问'.repeat(501) }]) assert.throws(() => snapshot(changes))
  assert.equal(snapshot({ date: '2024-02-29' }).input.date, '2024-02-29')
  assert.throws(() => api.createQimenSnapshot(input(), new Date('bad')), /当前时间/)
  for (const args of [['yin', 0, '甲子'], ['yin', 10, '甲子'], ['other', 1, '甲子'], ['yang', 1, '甲丑'], ['yang', 1, '??']]) assert.throws(() => api.buildQimenBoard(...args))
})

function memory(initial) { let data = initial, writes = 0; return { get() { return data }, set(key, value) { assert.equal(key, api.QIMEN_STORAGE_KEY); data = value; writes++ }, get data() { return data }, get writes() { return writes } } }
function repository(storage, makeId) { let id = 0; return api.createQimenRepository(storage, now, makeId || (() => `qimen-${++id}`)) }

test('complete snapshots persist/reload/export unchanged and do not alias inputs or later form changes', () => {
  const storage = memory(), archive = repository(storage), original = snapshot({ question: '记录当时的思路', locationNote: '地点只作备注' })
  const saved = archive.save(original)
  const unchanged = plain(saved)
  original.board.palaces[0].heaven = '改'
  saved.snapshot.input.name = '改'
  const reopened = repository({ get: () => JSON.stringify(storage.data), set() { assert.fail('must never write on read/export') } })
  assert.deepEqual(plain(reopened.list()[0]), unchanged)
  assert.deepEqual(plain(reopened.exportAll().records[0]), unchanged)
  assert.deepEqual(plain(api.exportQimenRecord(reopened.list()[0], now()).record), unchanged)
  const listed = archive.list(); listed[0].snapshot.board.palaces[0].star = '改'
  assert.deepEqual(plain(archive.list()[0]), unchanged)
  assert.equal(api.exportQimenRecord(archive.list()[0], now()).format, 'oasis-qimen-record')
})

test('30-record cap never evicts and delete is scoped to the exact ID', () => {
  const storage = memory(), archive = repository(storage), value = snapshot()
  for (let index = 0; index < 30; index++) archive.save(value)
  const before = JSON.stringify(storage.data)
  assert.throws(() => archive.save(value), /30/)
  assert.equal(JSON.stringify(storage.data), before)
  assert.equal(archive.remove('qimen-15').length, 29)
  assert.equal(archive.list().some(record => record.id === 'qimen-15'), false)
  const writes = storage.writes
  archive.remove('missing')
  assert.equal(storage.writes, writes)
})

test('unknown versions, malformed rows and duplicate IDs stop all writes and preserve original storage', () => {
  const original = { id: 'kept', savedAt: now().toISOString(), snapshot: snapshot() }
  const bad = patch => { const record = plain(original); patch(record.snapshot); return { version: 1, records: [record] } }
  for (const data of ['{broken', [], { version: 2, records: [] }, { version: 1, records: [original, original] },
    bad(value => { value.ruleVersion = 'future' }), bad(value => { value.board.palaces.pop() }),
    bad(value => { value.board.palaces[1].earthGuest = '' }), bad(value => { value.board.palaces[4].gate = '死门' }),
    bad(value => { value.board.palaces[0].god = value.board.palaces[1].god }), bad(value => { value.input.date = '2024-02-30' }),
    bad(value => { value.calendarVersion = 'future' }), bad(value => { value.board.chiefPalace = 5 }), bad(value => { value.sources = [] }),
  ]) {
    const storage = memory(data), archive = repository(storage), before = JSON.stringify(data)
    assert.throws(() => archive.list(), /无法读取|格式异常/)
    assert.throws(() => archive.save(snapshot()), /无法读取|格式异常/)
    assert.throws(() => archive.remove('kept'), /无法读取|格式异常/)
    assert.equal(storage.writes, 0)
    assert.equal(JSON.stringify(storage.data), before)
  }
})

test('read failures, write failures, conflicting IDs and cross-storage access cannot claim a successful save', () => {
  let writes = 0
  assert.throws(() => repository({ get() { throw new Error('blocked') }, set() { writes++ } }).save(snapshot()), /无法读取/)
  assert.equal(writes, 0)
  const storage = memory(), archive = repository(storage, () => 'same')
  const first = archive.save(snapshot())
  assert.throws(() => archive.save(snapshot()), /编号冲突/)
  const unwritable = repository({ get: () => storage.data, set() { throw new Error('quota') } })
  assert.throws(() => unwritable.save(snapshot()), /保存失败/)
  assert.throws(() => unwritable.remove(first.id), /保存失败/)
  const isolated = repository({ get(key) { assert.equal(key, '__oasis_qimen_records_v1'); return storage.data }, set() { assert.fail('export cannot write') } })
  assert.doesNotMatch(JSON.stringify(isolated.exportAll()), /accessToken|"token"|password/)
})
