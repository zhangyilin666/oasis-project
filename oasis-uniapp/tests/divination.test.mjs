import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

async function load(path) {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node' })
  const context = vm.createContext({ module: { exports: {} } })
  vm.runInContext(bundle.outputFiles[0].text, context)
  return context.module.exports
}
const domain = await load('../src/domain/divination/index.ts')
const persistence = await load('../src/domain/divination/repository.ts')
const plain = value => JSON.parse(JSON.stringify(value))
const context = { question: '如何记录这次讨论？', date: '2026-10-03', time: '12:30', utcOffset: 8 }
const manual = lines => domain.calculateDivination({ ...context, method: 'liuyao-manual', lines })
const meihua = (first, second) => domain.calculateDivination({ ...context, method: 'meihua-two-numbers', numbers: [first, second] })

test('all 64 hexagrams have unique complete bottom-to-top bit patterns and King Wen symbols', () => {
  assert.equal(domain.HEXAGRAMS.length, 64)
  assert.equal(new Set(domain.HEXAGRAMS.map(item => item.name)).size, 64)
  assert.equal(new Set(domain.HEXAGRAMS.map(item => item.lines.join(''))).size, 64)
  for (let pattern = 0; pattern < 64; pattern++) {
    const lines = Array.from({ length: 6 }, (_, bit) => (pattern >> bit) & 1)
    const hexagram = domain.hexagramFromLines(lines)
    assert.deepEqual(plain(hexagram.lines), lines)
    assert.equal(hexagram.symbol.codePointAt(0), 0x4dc0 + hexagram.number - 1)
  }
})

test('named reference hexagrams preserve lower/upper direction: Qian Kun Tai Pi Jiji Weiji Ge Gou', () => {
  // Public-domain 周易本義 卷1/卷2 references; input is bottom to top.
  const references = [
    ['111111', 1, '乾', '乾', '乾'], ['000000', 2, '坤', '坤', '坤'],
    ['111000', 11, '泰', '乾', '坤'], ['000111', 12, '否', '坤', '乾'],
    ['101010', 63, '既济', '离', '坎'], ['010101', 64, '未济', '坎', '离'],
    ['101110', 49, '革', '离', '兑'], ['011111', 44, '姤', '巽', '乾'],
    ['100010', 3, '屯', '震', '坎'], ['010001', 4, '蒙', '坎', '艮'],
  ]
  for (const [bits, number, name, lower, upper] of references) {
    const found = domain.hexagramFromLines([...bits].map(Number))
    assert.deepEqual([found.number, found.name, found.lower.name, found.upper.name], [number, name, lower, upper])
  }
})

test('all 4096 manual records change exactly the 6/9 lines, preserving every static line', () => {
  for (let encoded = 0; encoded < 4096; encoded++) {
    const values = Array.from({ length: 6 }, (_, index) => 6 + ((encoded >> (index * 2)) & 3))
    const result = manual(values)
    assert.deepEqual(plain(result.movingLines), values.flatMap((value, index) => value === 6 || value === 9 ? [index + 1] : []))
    values.forEach((value, index) => {
      assert.equal(result.original.lines[index], value % 2)
      assert.equal(result.changed.lines[index], value === 6 || value === 7 ? 1 : 0)
    })
    assert.equal(result.bodyUse, undefined)
    assert.equal(result.mutual, undefined)
  }
  assert.equal(manual([9, 9, 9, 9, 9, 9]).changed.name, '坤')
  assert.equal(manual([6, 6, 6, 6, 6, 6]).changed.name, '乾')
  assert.equal(manual([7, 7, 7, 7, 7, 7]).changed.name, '乾')
})

test('two-number remainder zero, all moving positions, mutual structure and upper/lower assignment', () => {
  const zero = meihua(8, 16)
  assert.equal(zero.original.name, '坤')
  assert.equal(zero.changed.name, '剥')
  assert.deepEqual(plain(zero.movingLines), [6])
  assert.equal(zero.mutual.name, '坤')
  assert.equal(meihua(1, 1).mutual.name, '乾')
  const known = meihua(2, 3)
  assert.equal(known.original.name, '革')
  assert.equal(known.original.upper.name, '兑')
  assert.equal(known.original.lower.name, '离')
  assert.equal(known.mutual.name, '姤')
  assert.deepEqual(plain(known.movingLines), [5])
  const seen = new Set()
  for (let a = 1; a <= 48; a++) for (let b = 1; b <= 48; b++) {
    const result = meihua(a, b), moving = result.movingLines[0]
    seen.add(moving)
    assert.ok(moving >= 1 && moving <= 6)
    assert.equal(result.original.lines.filter((line, i) => line !== result.changed.lines[i]).length, 1)
    assert.equal(result.bodyUse.usePosition, moving <= 3 ? '下卦' : '上卦')
    assert.equal(result.bodyUse.bodyPosition, moving <= 3 ? '上卦' : '下卦')
    assert.deepEqual(plain(result.mutual.lines), [result.original.lines[1], result.original.lines[2], result.original.lines[3], result.original.lines[2], result.original.lines[3], result.original.lines[4]])
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6])
})

test('body/use relation directions are not reversed, including every five-element pairing', () => {
  const elements = ['木', '火', '土', '金', '水']
  for (let index = 0; index < 5; index++) {
    assert.equal(domain.elementRelation(elements[index], elements[index]), '体用比和')
    assert.equal(domain.elementRelation(elements[index], elements[(index + 1) % 5]), '体生用')
    assert.equal(domain.elementRelation(elements[(index + 1) % 5], elements[index]), '用生体')
    assert.equal(domain.elementRelation(elements[index], elements[(index + 2) % 5]), '体克用')
    assert.equal(domain.elementRelation(elements[(index + 2) % 5], elements[index]), '用克体')
  }
  const lowerMoves = meihua(2, 11) // Sum 13 -> 1, upper Dui body, lower Li use.
  assert.equal(lowerMoves.bodyUse.body.name, '兑')
  assert.equal(lowerMoves.bodyUse.use.name, '离')
  assert.equal(lowerMoves.bodyUse.relation, '用克体')
  const upperMoves = meihua(2, 3) // Sum 5 -> 5, lower Li body, upper Dui use.
  assert.equal(upperMoves.bodyUse.body.name, '离')
  assert.equal(upperMoves.bodyUse.use.name, '兑')
  assert.equal(upperMoves.bodyUse.relation, '体克用')
})

test('input/time is reproducible and not silently changed or added to the two numbers', () => {
  const input = { ...context, method: 'meihua-two-numbers', numbers: [999999, 999999] }
  const a = domain.calculateDivination(input)
  assert.equal(a.questionInstant, '2026-10-03T04:30:00.000Z')
  assert.deepEqual(plain(a), plain(domain.calculateDivination(input)))
  const b = domain.calculateDivination({ ...input, time: '23:59', date: '2024-02-29', utcOffset: -3.5 })
  assert.deepEqual(plain(a.original), plain(b.original))
  assert.deepEqual(plain(a.changed), plain(b.changed))
  assert.equal(b.questionInstant, '2024-03-01T03:29:00.000Z')
  assert.equal(a.movingLines[0], 6)
  input.numbers[0] = 1
  assert.equal(a.input.numbers[0], 999999)
  a.original.lines[0] = 1 - a.original.lines[0]
  assert.equal(domain.hexagramFromLines([0, 0, 1, 0, 0, 1]).name, '艮')
})

test('invalid six-line, numeric, sparse and overflowing inputs are rejected', () => {
  for (const lines of [[], [6, 7, 8, 9, 6], [6, 7, 8, 9, 6, 7, 8], [6, 7, 8, 9, 6, '7'], [6, 7, 8, 9, 6, 10], [6, 7, 8, 9, 6, null], new Array(6)]) assert.throws(() => manual(lines))
  for (const number of [0, -1, 1.5, 1000000, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '2', null]) assert.throws(() => meihua(number, 1))
  assert.throws(() => domain.calculateDivination({ ...context, method: 'meihua-two-numbers', numbers: new Array(2) }))
  for (const text of ['', ' ', '1e3', '+2', '-1', '1.0', '1000000', '９', '0', 'Infinity']) assert.throws(() => domain.parseMeihuaNumber(text))
  assert.equal(domain.parseMeihuaNumber('999999'), 999999)
  assert.equal(domain.parseMeihuaNumber('000008'), 8)
  for (const lines of [new Array(6), [1, 1, 1, 1, 1, 2], [1, 1, 1], '111111']) assert.throws(() => domain.hexagramFromLines(lines))
})

test('question, calendar, time, offset and method are strictly validated', () => {
  for (const override of [{ question: '' }, { question: '   ' }, { question: '问'.repeat(201) }, { date: '2023-02-29' }, { date: '2024-04-31' }, { date: '2024-13-01' }, { date: '1899-12-31' }, { date: '2100-01-01' }, { date: '2026-1-01' }, { time: '24:00' }, { time: '00:60' }, { time: '' }, { utcOffset: '8' }, { utcOffset: NaN }, { utcOffset: 8.1 }, { utcOffset: 15 }, { utcOffset: -12.25 }, { method: 'random' }]) {
    assert.throws(() => domain.calculateDivination({ ...context, method: 'meihua-two-numbers', numbers: [1, 2], ...override }))
  }
  assert.throws(() => domain.calculateDivination(null))
})

function memoryStorage() {
  const memory = new Map()
  return { memory, getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) }
}

test('local records restore exact inputs, use unique ids, export facts and delete only the selected record', () => {
  const storage = memoryStorage(), repo = persistence.createDivinationRepository(storage)
  assert.deepEqual(plain(repo.list()), [])
  const a = repo.save(meihua(2, 3), '2026-10-03T05:00:00.000Z')
  const b = repo.save(manual([6, 7, 8, 9, 8, 7]), '2026-10-03T05:00:00.000Z')
  assert.notEqual(a.id, b.id)
  assert.equal(repo.list()[0].id, b.id)
  const exported = JSON.parse(repo.exportJSON())
  assert.equal(exported.kind, 'oasis-divination-records')
  assert.equal(exported.records[1].result.original.name, '革')
  assert.deepEqual(exported.records[1].input, plain(meihua(2, 3).input))
  assert.equal(storage.memory.size, 1)
  assert.ok(storage.memory.has(persistence.DIVINATION_STORAGE_KEY))
  repo.remove(a.id)
  assert.deepEqual(repo.list().map(item => item.id).join(','), b.id)
  assert.throws(() => repo.remove('missing'))
})

test('the 51st save fails without silently discarding older records', () => {
  const storage = memoryStorage(), repo = persistence.createDivinationRepository(storage)
  for (let i = 0; i < 50; i++) repo.save(meihua(i + 1, 8))
  const before = storage.memory.get(persistence.DIVINATION_STORAGE_KEY)
  assert.throws(() => repo.save(meihua(51, 8)), /50/)
  assert.equal(storage.memory.get(persistence.DIVINATION_STORAGE_KEY), before)
  assert.equal(repo.list().length, 50)
})

test('corrupt/unknown storage is never overwritten and denied/quota writes preserve existing records', () => {
  const storage = memoryStorage(), repo = persistence.createDivinationRepository(storage)
  for (const raw of ['{', '{}', '{"schemaVersion":2,"records":[]}', '{"schemaVersion":1,"records":[{}]}']) {
    storage.memory.set(persistence.DIVINATION_STORAGE_KEY, raw)
    assert.throws(() => repo.list(), /保留/)
    assert.throws(() => repo.save(meihua(1, 2)), /保留/)
    assert.equal(storage.memory.get(persistence.DIVINATION_STORAGE_KEY), raw)
  }
  storage.memory.clear()
  const record = repo.save(meihua(1, 2))
  const quotaRepo = persistence.createDivinationRepository({ getItem: storage.getItem, setItem: () => { throw new Error('quota') } })
  assert.throws(() => quotaRepo.save(meihua(2, 3)), /保存失败/)
  assert.throws(() => quotaRepo.remove(record.id), /保存失败/)
  assert.equal(repo.list().length, 1)
  const denied = persistence.createDivinationRepository({ getItem: () => { throw new Error('denied') }, setItem: () => assert.fail('must not write') })
  assert.throws(() => denied.save(meihua(1, 2)), /存储权限/)
})
