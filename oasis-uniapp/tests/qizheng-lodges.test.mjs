import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

// Frozen before implementation, from original images and an independent printed text.
const reference = JSON.parse(await readFile(new URL('./fixtures/qizheng-lodges-reference.json', import.meta.url), 'utf8'))
const bundle = await build({ stdin: { contents: "export * from './src/domain/qizheng-lodges/index'; export * from './src/domain/qizheng-lodges/table'; export * from './src/domain/qizheng-lodges/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const { calculateQizhengLodges, buildLodgeTable, palaceAngleToArcseconds, splitPalaceArcseconds, formatPalaceArcseconds, formatLodgeArcseconds, LODGE_BASE_TABLE, validateQizhengLodgesSnapshot, createQizhengLodgesRepository, QIZHENG_LODGES_STORAGE_KEY } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const baseInput = { label: '原书太阳例', yearLabel: 1684, palace: 0, degree: 8, minute: 0, second: 0 }
const snapshot = overrides => calculateQizhengLodges({ ...baseInput, ...overrides })
const sexagesimal = (degree, minute, second = 0) => degree * 3600 + minute * 60 + second
const wrap = value => ((value % 1296000) + 1296000) % 1296000

test('original Lixiang Kaocheng worked example: Sun in initial palace 8° is Dou 2°10′', () => {
 const example = reference.originalWorkedExample
 const result = snapshot(example)
 assert.equal(result.result.mansion, example.mansion)
 assert.equal(result.result.withinArcseconds, sexagesimal(example.withinDegree, example.withinMinute, example.withinSecond))
 assert.equal(formatLodgeArcseconds(result.result.withinArcseconds), '2°10′00″')
 validateQizhengLodgesSnapshot(result)
})

for (const example of reference.independentPalaceStarts.matchedCases) test(`independent Qing Shi Gao palace start ${example.palace}: ${example.mansion}`, () => {
 const result = snapshot({ palace: example.palace, degree: 0 })
 assert.equal(result.result.mansion, example.mansion)
 assert.equal(result.result.withinArcseconds, sexagesimal(example.withinDegree, example.withinMinute))
})

test('two known printed disagreements remain explicit; selected edition is never patched to agree', () => {
 assert.equal(reference.independentPalaceStarts.matchedCases.length, 10)
 assert.equal(reference.independentPalaceStarts.documentedDisagreements.length, 2)
 for (const example of reference.independentPalaceStarts.documentedDisagreements) {
  const result = snapshot({ palace: example.palace, degree: 0 })
  assert.equal(result.result.mansion, example.mansion)
  const printed = sexagesimal(example.printedWithinDegree, example.printedWithinMinute)
  const selected = sexagesimal(example.selectedEditionWithinDegree, example.selectedEditionWithinMinute)
  assert.equal(result.result.withinArcseconds, selected)
  assert.equal(printed - selected, example.differenceArcminutes * 60)
  assert.ok(result.limitations.some(line => line.includes('4分和10分')))
 }
})

test('all 28 first-star boundaries reproduce inspected image transcriptions with unequal widths', () => {
 const table = buildLodgeTable(1684)
 assert.equal(table.length, 28)
 assert.equal(new Set(table.map(row => row.name)).size, 28)
 assert.equal(table.reduce((sum, row) => sum + row.widthArcseconds, 0), 1296000)
 for (const [index, expected] of reference.rows.entries()) {
  const actual = table[index]
  assert.equal(actual.name, expected.mansion)
  assert.equal(actual.startArcseconds, (expected.palace * 30 + expected.degree) * 3600 + expected.minute * 60)
  assert.equal(actual.sourceFigure, `SK1530_figure_${expected.figure}`)
 }
 assert.equal(table.find(row => row.name === '参').widthArcseconds, 81 * 60)
 assert.equal(table.find(row => row.name === '井').widthArcseconds, sexagesimal(30, 25))
 assert.ok(Object.isFrozen(LODGE_BASE_TABLE)); assert.ok(LODGE_BASE_TABLE.every(Object.isFrozen))
})

test('every cusp includes exact start, excludes its end, and handles ±1 arcsecond over the circular seam', () => {
 for (const yearLabel of [1684, 1722, 2000, 2099]) {
  const table = buildLodgeTable(yearLabel)
  for (const [index, row] of table.entries()) {
   const previous = table[(index + 27) % 28]
   const at = snapshot({ yearLabel, ...splitPalaceArcseconds(row.startArcseconds) })
   const before = snapshot({ yearLabel, ...splitPalaceArcseconds(wrap(row.startArcseconds - 1)) })
   const after = snapshot({ yearLabel, ...splitPalaceArcseconds(wrap(row.startArcseconds + 1)) })
   assert.equal(at.result.mansion, row.name); assert.equal(at.result.withinArcseconds, 0); assert.equal(at.result.atBoundary, true)
   assert.equal(before.result.mansion, previous.name); assert.equal(before.result.remainingArcseconds, 1); assert.equal(before.result.atBoundary, false)
   assert.equal(after.result.mansion, row.name); assert.equal(after.result.withinArcseconds, 1)
   validateQizhengLodgesSnapshot(at); validateQizhengLodgesSnapshot(before); validateQizhengLodgesSnapshot(after)
  }
 }
 assert.equal(snapshot({ palace: 0, degree: 0 }).result.mansion, '箕')
 assert.equal(snapshot({ yearLabel: 2099, palace: 0, degree: 0 }).result.mansion, '尾')
})

test('annual movement is exactly 51 arcseconds with full sexagesimal carry and product-year bounds', () => {
 const moved = snapshot({ yearLabel: 1722 })
 assert.equal(moved.yearsFromEpoch, 38); assert.equal(moved.shiftArcseconds, 1938)
 assert.equal(formatLodgeArcseconds(moved.shiftArcseconds), '0°32′18″')
 assert.equal(formatPalaceArcseconds(moved.table[0].startArcseconds), '初宫 6°22′18″')
 assert.equal(moved.result.withinArcseconds, sexagesimal(1, 37, 42))
 assert.equal(snapshot({ yearLabel: 2099 }).shiftArcseconds, 21165)
 for (const yearLabel of [1685, 1722, 1754, 2000, 2099]) assert.ok(snapshot({ yearLabel }).limitations[1].includes('没有核对'))
 for (const yearLabel of [1683, 2100, 1684.5, NaN, Infinity, '1684']) assert.throws(() => snapshot({ yearLabel }), /年标号/)
})

test('winter-solstice origin and degree-minute-second display never silently use decimal degrees', () => {
 for (const [palace, expected] of [[0, 270], [3, 0], [6, 90], [9, 180]]) assert.equal(snapshot({ palace, degree: 0 }).vernalOriginArcseconds, expected * 3600)
 assert.equal(palaceAngleToArcseconds({ palace: 11, degree: 29, minute: 59, second: 59 }), 1295999)
 assert.deepEqual(plain(splitPalaceArcseconds(108000)), { palace: 1, degree: 0, minute: 0, second: 0 })
 assert.equal(formatLodgeArcseconds(3599), '0°59′59″'); assert.equal(formatLodgeArcseconds(3600), '1°00′00″')
 assert.equal(formatPalaceArcseconds(1295999), '11宫 29°59′59″')
 for (const bad of [-1, 1296000, NaN, 1.5]) assert.throws(() => splitPalaceArcseconds(bad))
 for (const bad of [-1, 1296001, NaN, 1.5]) assert.throws(() => formatLodgeArcseconds(bad))
})

test('missing or invalid inputs reject explicitly, and calculation never mutates inputs or the base table', () => {
 const input = plain(baseInput), originalTable = plain(LODGE_BASE_TABLE)
 calculateQizhengLodges(input); assert.deepEqual(input, baseInput)
 for (const update of [{ label: '' }, { label: ' '.repeat(4) }, { label: '字'.repeat(31) }, { palace: undefined }, { palace: 12 }, { degree: 30 }, { minute: 60 }, { second: -1 }, { degree: 1.5 }, { degree: NaN }, { minute: '0' }]) assert.throws(() => snapshot(update))
 const one = snapshot(); one.table[0].startArcseconds = 0
 assert.deepEqual(plain(LODGE_BASE_TABLE), originalTable); assert.equal(snapshot().table[0].startArcseconds, 21000)
 assert.equal(snapshot().scope, 'historical-ecliptic-lodge-table-lookup')
 assert.ok(snapshot().limitations[3].includes('罗睺、计都、月孛、紫气'))
})

function storage() { let raw = ''; return { getItem: () => raw, setItem: (key, value) => { assert.equal(key, QIZHENG_LODGES_STORAGE_KEY); raw = value }, raw: () => raw } }
test('records save a complete immutable table, source metadata and note; review and export preserve values', () => {
 const store = storage(); let id = 0
 const repo = createQizhengLodgesRepository(store, () => new Date('2026-10-03T00:00:00Z'), () => `r${++id}`)
 const result = snapshot({ yearLabel: 2099 }), expected = plain(result)
 repo.save(' example ', 'source note', result); result.table[0].startArcseconds = 0
 const opened = repo.list()[0]; assert.deepEqual(plain(opened.snapshot), expected); assert.equal(opened.name, 'example')
 opened.note = 'changed'; opened.snapshot.input.label = 'changed'
 assert.equal(repo.list()[0].note, 'source note'); assert.equal(repo.list()[0].snapshot.input.label, baseInput.label)
 repo.save('base year', '', snapshot())
 assert.deepEqual(plain(repo.exportJSON().records), plain(repo.list()))
 assert.equal(repo.remove('r1').length, 1); assert.equal(repo.list()[0].snapshot.input.yearLabel, 1684)
})

test('corrupt versions, coordinates, rules and saved geometry stop writes while preserving original bytes', () => {
 const mutations = [s => { s.ruleVersion = 'new' }, s => { s.input.degree++ }, s => { s.rules.originInModernLongitude = 0 }, s => { s.rules.annualShiftArcseconds = 50 }, s => { s.table.pop() }, s => { s.table[0].baseStartArcseconds++ }, s => { s.table[0].widthArcseconds++ }, s => { s.result.withinArcseconds++ }, s => { s.result.atBoundary = true }, s => { s.sources = [] }]
 for (const mutate of mutations) {
  const store = storage(), repo = createQizhengLodgesRepository(store, () => new Date('2026-10-03T00:00:00Z'), () => 'record')
  repo.save('ok', '', snapshot()); const damaged = JSON.parse(store.raw()); mutate(damaged.records[0].snapshot)
  store.setItem(QIZHENG_LODGES_STORAGE_KEY, JSON.stringify(damaged)); const original = store.raw()
  assert.throws(() => repo.list(), /停止写入/); assert.throws(() => repo.save('new', '', snapshot()), /停止写入/)
  assert.throws(() => repo.remove('record'), /停止写入/); assert.equal(store.raw(), original)
 }
})

test('capacity, duplicate records, oversized notes and unavailable storage never report a successful save', () => {
 const store = storage(); let id = 0; const result = snapshot()
 const repo = createQizhengLodgesRepository(store, () => new Date('2026-10-03T00:00:00Z'), () => `r${++id}`)
 for (let i = 0; i < 20; i++) repo.save(`r${i}`, '', result)
 const original = store.raw(); assert.throws(() => repo.save('overflow', '', result), /最多保留20/); assert.equal(store.raw(), original)
 assert.throws(() => repo.save('x', 'x'.repeat(2001), result), /2000/)
 const duplicate = createQizhengLodgesRepository(storage(), () => new Date('2026-10-03T00:00:00Z'), () => 'same')
 duplicate.save('one', '', result); assert.throws(() => duplicate.save('two', '', result), /编号/)
 const failing = createQizhengLodgesRepository({ getItem: () => '', setItem: () => { throw new Error('quota') } })
 assert.throws(() => failing.save('x', '', result), /保存失败/)
 const unreadable = createQizhengLodgesRepository({ getItem: () => { throw new Error('denied') }, setItem: () => assert.fail('must not write') })
 assert.throws(() => unreadable.save('x', '', result), /停止写入/)
})
