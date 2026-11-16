import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'
import { liurenReferences } from './fixtures/liuren-reference.mjs'

const bundle = await build({ stdin: { contents: "export * from './src/domain/liuren/index'; export * from './src/domain/liuren/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const now = () => new Date('2026-10-03T08:00:00.000Z')
const input = changes => ({ ...api.emptyLiurenInput(), name: '古例核对', mode: 'manual', day: '甲子', general: '子', hour: '卯', ...changes })
const snapshot = changes => api.createLiurenSnapshot(input(changes), now())

for (const expected of liurenReferences) {
  test(`independent ancient example: ${expected.id}`, () => {
    const actual = api.buildLiurenBoard(expected.day, expected.general, expected.hour)
    assert.equal(actual.palaces.map(cell => cell.heaven).join(''), expected.sky)
    assert.deepEqual(plain(actual.lessons.map(lesson => lesson.lower + lesson.upper)), expected.lessons)
    assert.equal(actual.transmissions.join(''), expected.transmissions)
    if (expected.transmissionGods) assert.deepEqual(plain(actual.transmissions.map(branch => actual.palaces.find(cell => cell.heaven === branch).god)), expected.transmissionGods)
    assert.equal(actual.method, expected.method)
    assert.equal(actual.status, 'complete')
    assert.equal(api.isLiurenSnapshot(snapshot({ day: expected.day, general: expected.general, hour: expected.hour })), true)
  })
}

test('涉害 counts exclude both endpoints and retain the independently stated depths', () => {
  const a = api.buildLiurenBoard('丁卯', '亥', '丑')
  assert.match(a.explanation.join(''), /亥5重/)
  assert.match(a.explanation.join(''), /丑1重/)
  const b = api.buildLiurenBoard('庚子', '申', '戌')
  assert.match(b.explanation.join(''), /午2重/)
  assert.match(b.explanation.join(''), /戌1重/)
})

test('伏吟 returning to initial uses middle opposition, as the separate 卯日 passage states', () => {
  for (const day of ['丁卯', '己卯', '辛卯']) assert.equal(api.buildLiurenBoard(day, '午', '午').transmissions.join(''), '卯子午')
})

test('all 720 structural combinations are finite and explicitly complete or unsupported, without claiming external correctness for all', () => {
  for (const day of api.LIUREN_DAYS) for (const general of api.LIUREN_BRANCHES) {
    const value = snapshot({ day, general, hour: '子' })
    assert.equal(api.isLiurenSnapshot(value), true, `${day}/${general}`)
    assert.equal(new Set(value.board.palaces.map(cell => cell.heaven)).size, 12)
    assert.equal(value.board.transmissions.length, value.board.status === 'complete' ? 3 : 0)
  }
})

test('noble uses the declared day/night branches and reverses from its earth position; 甲子旬空戌亥', () => {
  const daytime = api.buildLiurenBoard('甲子', '子', '卯')
  assert.equal(daytime.dayPeriod, '昼'); assert.equal(daytime.noble, '丑'); assert.equal(daytime.nobleDirection, '顺')
  assert.equal(daytime.palaces.find(cell => cell.heaven === '丑').god, '贵人')
  assert.equal(daytime.palaces.find(cell => cell.earth === '巳').god, '腾蛇')
  assert.deepEqual(plain(daytime.voids), ['戌', '亥'])
  const night = api.buildLiurenBoard('甲子', '未', '酉')
  assert.equal(night.dayPeriod, '夜'); assert.equal(night.noble, '未'); assert.equal(night.nobleDirection, '逆')
  assert.equal(night.palaces.find(cell => cell.earth === '申').god, '腾蛇')
})

test('calendar switches month-general at the exact 中气, not the adjacent 节气', () => {
  const before = snapshot({ mode: 'calendar', date: '2024-06-21', time: '04:50:59' })
  const at = snapshot({ mode: 'calendar', date: '2024-06-21', time: '04:51:00' })
  assert.equal(before.calendar.qi, '小满'); assert.equal(before.board.general, '申')
  assert.equal(before.calendar.nextQiAt, '2024-06-21 04:51:00')
  assert.equal(at.calendar.qi, '夏至'); assert.equal(at.board.general, '未')
  assert.equal(at.calendar.qiAt, before.calendar.nextQiAt)
  const followingJie = snapshot({ mode: 'calendar', date: '2024-07-07', time: '12:00' })
  assert.equal(followingJie.board.general, '未')
  assert.equal(api.isLiurenSnapshot(at), true)
})

test('explicit offsets identify the same instant and 23:00 advances the day only once', () => {
  const a = snapshot({ mode: 'calendar', date: '2024-01-01', time: '12:00' })
  const b = snapshot({ mode: 'calendar', date: '2024-01-01', time: '04:00', utcOffsetMinutes: 0 })
  assert.deepEqual(plain(a.calendar), plain(b.calendar)); assert.deepEqual(plain(a.board), plain(b.board))
  const before = snapshot({ mode: 'calendar', date: '2024-01-01', time: '22:59:59' })
  const at = snapshot({ mode: 'calendar', date: '2024-01-01', time: '23:00:00' })
  const after = snapshot({ mode: 'calendar', date: '2024-01-02', time: '00:00:00' })
  assert.equal(before.board.day, '甲子'); assert.equal(at.board.day, '乙丑'); assert.deepEqual(plain(at.board), plain(after.board))
})

test('invalid inputs fail before constructing a board; manual mode does not fabricate calendar dates', () => {
  for (const changes of [{ day: '甲丑' }, { general: '' }, { hour: 'a' }, { name: '' }, { mode: 'calendar', date: '2024-02-30', time: '12:00' }, { mode: 'calendar', date: '2024-01-01', time: '24:00' }, { mode: 'calendar', date: '2024-01-01', time: '12:00', utcOffsetMinutes: 481 }]) assert.throws(() => snapshot(changes))
  assert.equal(snapshot().calendar, null)
  assert.equal(snapshot().input.date, '')
  assert.throws(() => api.buildLiurenBoard('甲丑', '子', '卯'))
})

test('repository preserves snapshots, exports full records and blocks corrupt storage and duplicate ids', () => {
  let store, tick = 0
  const repository = api.createLiurenRepository({ get: () => store, set: (_key, value) => { store = value } }, now, () => `liuren-${++tick}`)
  const value = snapshot(), saved = repository.save(value)
  value.board.transmissions[0] = '酉'
  assert.equal(repository.list()[0].snapshot.board.transmissions.join(''), '午卯子')
  const listed = repository.list(); listed[0].snapshot.input.name = '外部修改'
  assert.equal(repository.list()[0].snapshot.input.name, '古例核对')
  assert.equal(api.exportLiurenRecord(saved, now()).record.snapshot.ruleVersion, api.LIUREN_RULE_VERSION)
  assert.equal(repository.exportAll().records.length, 1)
  assert.equal(repository.remove(saved.id).length, 0)
  store = { version: 1, records: [{ ...saved, snapshot: { ...saved.snapshot, board: { ...saved.snapshot.board, transmissions: ['假'] } } }] }
  const original = JSON.stringify(store)
  assert.throws(() => repository.list()); assert.throws(() => repository.save(snapshot()))
  assert.equal(JSON.stringify(store), original)
  store = { version: 1, records: [saved, saved] }; assert.throws(() => repository.list())
  store = undefined
  const duplicate = api.createLiurenRepository({ get: () => store, set: (_key, value) => { store = value } }, now, () => 'same')
  duplicate.save(snapshot()); assert.throws(() => duplicate.save(snapshot()))
})

test('record cap and failed writes never silently report a successful save', () => {
  let store, tick = 0
  const repository = api.createLiurenRepository({ get: () => store, set: (_key, value) => { store = value } }, now, () => `id-${++tick}`)
  for (let i = 0; i < 30; i++) repository.save(snapshot())
  assert.throws(() => repository.save(snapshot()), /30/)
  assert.equal(repository.list().length, 30)
  const failed = api.createLiurenRepository({ get: () => undefined, set: () => { throw new Error('quota') } }, now)
  assert.throws(() => failed.save(snapshot()), /保存失败/)
})

test('saved snapshot linkage rejects altered 旬空, 贵人 and calendar offset metadata', () => {
  const values = [snapshot(), snapshot(), snapshot({ mode: 'calendar', date: '2024-06-21', time: '12:00' })]
  values[0].board.voids = ['子', '丑']
  values[1].board.noble = '巳'
  values[2].calendar.instant = '2024-06-21T05:00:00.000Z'
  for (const value of values) assert.equal(api.isLiurenSnapshot(value), false)
})
