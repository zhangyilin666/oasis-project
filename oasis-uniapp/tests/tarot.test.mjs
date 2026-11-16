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
const tarot = await load('../src/domain/tarot/index.ts')
const persistence = await load('../src/domain/tarot/repository.ts')
const plain = value => JSON.parse(JSON.stringify(value))
const single = () => ({
  question: '如何整理最近的工作节奏？', date: '2026-10-03', deckDescription: '我的韦特系实体牌', drawNotes: '实体牌洗牌后手动抽出。',
  spreadKind: 'single', spreadName: '单张关注', selections: [{ positionName: '当下关注', cardId: 'major-08', orientation: 'upright', note: '今天想留一些时间休息。' }], notes: '先把任务写清楚，再选择一件开始。',
})
function custom(count) {
  return { ...single(), spreadKind: 'custom', spreadName: '我的复盘牌阵', selections: Array.from({ length: count }, (_, i) => ({ positionName: `我的位置 ${i + 1}`, cardId: `major-${String(i).padStart(2, '0')}`, orientation: i % 2 ? 'reversed' : 'upright', note: `笔记 ${i + 1}` })) }
}
const snapshot = () => tarot.createTarotSnapshot(single())
function memoryStorage(initial) {
  const memory = new Map()
  if (initial !== undefined) memory.set(persistence.TAROT_STORAGE_KEY, initial)
  return { memory, getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) }
}

test('the catalog has 78 unique cards: 22 major and four independent 14-card suit groups', () => {
  // External factual references, read 2026-10-03:
  // V&A: https://www.vam.ac.uk/articles/tarot-cards (78 = 22 + 56; four suits).
  // Waite: https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3
  const cards = tarot.TAROT_CARDS
  assert.equal(cards.length, 78)
  assert.equal(new Set(cards.map(card => card.id)).size, 78)
  assert.equal(new Set(cards.map(card => card.name)).size, 78)
  assert.equal(new Set(cards.map(card => card.english)).size, 78)
  const counts = Object.fromEntries(['major', 'wands', 'cups', 'swords', 'pentacles'].map(group => [group, cards.filter(card => card.group === group).length]))
  assert.deepEqual(counts, { major: 22, wands: 14, cups: 14, swords: 14, pentacles: 14 })
  assert.equal(tarot.TAROT_NAME_VERSION, 'rws-names-zh-v1')
})

test('all major names and numbering match the fixed RWS naming specification', () => {
  // Independently listed Waite Part II headings, modernized short names:
  // https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_2
  // Strength/Fortitude VIII; Justice XI; Fool 0; World XXI.
  const expectedEnglish = ['The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance', 'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World']
  const expectedChinese = ['愚人', '魔术师', '女祭司', '皇后', '皇帝', '教皇', '恋人', '战车', '力量', '隐者', '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔', '高塔', '星星', '月亮', '太阳', '审判', '世界']
  for (let number = 0; number <= 21; number++) {
    const card = tarot.getTarotCard(`major-${String(number).padStart(2, '0')}`)
    assert.deepEqual([card.majorNumber, card.english, card.name, card.group, card.rank], [number, expectedEnglish[number], expectedChinese[number], 'major', null])
  }
})

test('every minor suit has Ace through Ten, Page, Knight, Queen and King, with isolated suit names', () => {
  // These fourteen rank headings are explicitly present under each of the four
  // suits in Waite Part III, rather than inferred from the catalog under test.
  const ranks = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'page', 'knight', 'queen', 'king']
  const englishRanks = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King']
  const chineseRanks = ['王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十', '侍从', '骑士', '王后', '国王']
  for (const [group, chinese, english] of [['wands', '权杖', 'Wands'], ['cups', '圣杯', 'Cups'], ['swords', '宝剑', 'Swords'], ['pentacles', '星币', 'Pentacles']]) {
    const cards = tarot.TAROT_CARDS.filter(card => card.group === group)
    assert.deepEqual(plain(cards.map(card => card.rank)), ranks)
    ranks.forEach((rank, index) => {
      const card = tarot.getTarotCard(`${group}-${rank}`)
      assert.deepEqual([card.name, card.english, card.majorNumber, card.rank], [`${chinese}${chineseRanks[index]}`, `${englishRanks[index]} of ${english}`, null, rank])
    })
  }
})

test('card lookups reject invalid identifiers and do not expose mutable shared catalog entries', () => {
  const card = tarot.getTarotCard('major-00')
  card.name = 'changed'
  assert.equal(tarot.getTarotCard('major-00').name, '愚人')
  assert.ok(Object.isFrozen(tarot.TAROT_CARDS))
  assert.ok(Object.isFrozen(tarot.TAROT_CARDS[0]))
  for (const id of ['', 'major-0', 'major-22', 'MAJOR-00', 'wands-11', 'coins-ace', 0, null, {}, '__proto__']) assert.throws(() => tarot.getTarotCard(id), /未知牌名/)
})

test('three-card snapshot has explicit position names, manual method, orientations and full card names', () => {
  const input = { ...single(), spreadKind: 'three', spreadName: '三张复盘', selections: [
    { positionName: '当前状况', cardId: 'major-00', orientation: 'upright', note: '第一张\n第二行' },
    { positionName: '需要留意', cardId: 'cups-queen', orientation: 'reversed', note: '' },
    { positionName: '行动思考', cardId: 'pentacles-ten', orientation: 'upright', note: '自己的记录' },
  ] }
  const result = tarot.createTarotSnapshot(input)
  assert.deepEqual([result.ruleVersion, result.nameVersion, result.recordingMethod, result.duplicatePolicy], ['tarot-manual-v1', 'rws-names-zh-v1', 'manual', 'single-deck-no-repeats'])
  assert.deepEqual(plain(result.cards.map(item => [item.position, item.positionName, item.card.name, item.orientation])), [[1, '当前状况', '愚人', 'upright'], [2, '需要留意', '圣杯王后', 'reversed'], [3, '行动思考', '星币十', 'upright']])
  assert.equal(result.cards[0].note, '第一张\n第二行')
  assert.deepEqual(plain(tarot.inputFromTarotSnapshot(result)), input)
  assert.ok(result.sources.some(source => source.url.includes('vam.ac.uk')))
  assert.ok(result.sources.some(source => source.url.endsWith('/Part_2')))
  assert.ok(result.conventions.some(line => line.includes('本版不随机抽牌')))
})

test('custom spreads preserve one to ten manually named ordered positions', () => {
  for (let count = 1; count <= 10; count++) {
    const input = custom(count), result = tarot.createTarotSnapshot(input)
    assert.equal(result.cards.length, count)
    assert.deepEqual(plain(result.cards.map(item => item.positionName)), input.selections.map(item => item.positionName))
    assert.deepEqual(plain(tarot.inputFromTarotSnapshot(result)), input)
  }
  for (const count of [0, 11]) assert.throws(() => tarot.createTarotSnapshot(custom(count)), /1 至 10/)
  assert.throws(() => tarot.createTarotSnapshot({ ...custom(3), selections: Array(3) }), /格式/)
})

test('duplicate cards are forbidden even with different orientations; each position must be named distinctly', () => {
  const input = custom(3)
  input.selections[1].cardId = input.selections[0].cardId
  assert.notEqual(input.selections[0].orientation, input.selections[1].orientation)
  assert.throws(() => tarot.createTarotSnapshot(input), /同一张牌只能选一次/)
  const duplicatePosition = custom(2)
  duplicatePosition.selections[1].positionName = '  ' + duplicatePosition.selections[0].positionName + '  '
  assert.throws(() => tarot.createTarotSnapshot(duplicatePosition), /位置名称不能重复/)
  assert.throws(() => tarot.createTarotSnapshot({ ...single(), selections: [{ ...single().selections[0], orientation: 'unknown' }] }), /正位或逆位/)
})

test('preset counts, names and positions cannot silently become a different spread', () => {
  for (const input of [
    { ...single(), spreadKind: 'random' }, { ...single(), spreadName: '三张复盘' },
    { ...single(), selections: [...single().selections, { ...single().selections[0], cardId: 'major-09' }] },
    { ...single(), spreadKind: 'three', spreadName: '三张复盘' },
    { ...single(), selections: [{ ...single().selections[0], positionName: '未来注定' }] },
  ]) assert.throws(() => tarot.createTarotSnapshot(input), /牌阵|位置/)
})

test('hand-entered dates retain their civil date, enforce valid leap days and stay in the declared range', () => {
  for (const date of ['1900-01-01', '2000-02-29', '2004-02-29', '2099-12-31']) assert.equal(tarot.createTarotSnapshot({ ...single(), date }).date, date)
  for (const date of ['1899-12-31', '2100-01-01', '1900-02-29', '2026-02-29', '2026-02-30', '2026-04-31', '2026-1-01', '2026-01-01T00:00:00Z', '', 'not-a-date']) assert.throws(() => tarot.createTarotSnapshot({ ...single(), date }), /日期/)
})

test('text fields enforce declared limits, reject wrong types and preserve internal newlines', () => {
  const input = { ...custom(1), question: '问'.repeat(200), deckDescription: '组'.repeat(100), drawNotes: '过'.repeat(200), spreadName: '阵'.repeat(60), notes: '记'.repeat(2000) }
  input.selections[0].positionName = '位'.repeat(40)
  input.selections[0].note = '牌'.repeat(500)
  assert.equal(tarot.createTarotSnapshot(input).notes.length, 2000)
  for (const [key, limit] of [['question', 200], ['deckDescription', 100], ['drawNotes', 200], ['spreadName', 60], ['notes', 2000]]) {
    assert.throws(() => tarot.createTarotSnapshot({ ...input, [key]: '字'.repeat(limit + 1) }), /字/)
    assert.throws(() => tarot.createTarotSnapshot({ ...input, [key]: 1 }), /格式/)
  }
  for (const key of ['question', 'deckDescription', 'spreadName']) assert.throws(() => tarot.createTarotSnapshot({ ...input, [key]: '   ' }), /字/)
  for (const [key, limit] of [['positionName', 40], ['note', 500]]) assert.throws(() => tarot.createTarotSnapshot({ ...input, selections: [{ ...input.selections[0], [key]: '字'.repeat(limit + 1) }] }), /字/)
  const normalized = tarot.createTarotSnapshot({ ...single(), question: '  问题  ', notes: '  第一行\n第二行  ' })
  assert.equal(normalized.question, '问题')
  assert.equal(normalized.notes, '第一行\n第二行')
  for (const value of [null, [], 42, 'text']) assert.throws(() => tarot.createTarotSnapshot(value), /格式/)
})

test('unknown versions and tampered full snapshots fail validation before restoration', () => {
  const changes = [
    record => { record.ruleVersion = 'tarot-manual-v2' }, record => { record.nameVersion = 'rws-names-zh-v2' },
    record => { delete record.nameVersion }, record => { record.recordingMethod = 'random' },
    record => { record.duplicatePolicy = 'multiple-decks' }, record => { record.cards[0].position = 0 },
    record => { record.cards[0].card.name = '别的名字' }, record => { record.cards[0].card.english = 'Another card' },
    record => { record.cards[0].card.rank = 'ace' }, record => { record.cards[0].card.majorNumber = 11 },
    record => { record.cards[0].card.group = 'cups' }, record => { record.cards[0].card.id = 'major-99' },
    record => { record.cards[0].orientation = 'sideways' }, record => { record.conventions.pop() },
    record => { record.sources[0].url = 'https://example.invalid/' }, record => { delete record.sources },
    record => { record.question = ` ${record.question} ` }, record => { record.cards[0].note += ' ' },
  ]
  for (const change of changes) {
    const value = plain(snapshot()); change(value)
    assert.throws(() => tarot.validateTarotSnapshot(value))
    assert.throws(() => tarot.inputFromTarotSnapshot(value))
  }
  const reordered = plain(tarot.createTarotSnapshot(custom(3)))
  reordered.cards.reverse()
  assert.throws(() => tarot.validateTarotSnapshot(reordered), /顺序/)
})

test('input, snapshots, restored input and catalog cannot mutate each other', () => {
  const input = single(), result = tarot.createTarotSnapshot(input), original = plain(result)
  input.question = 'changed'; input.selections[0].note = 'changed'
  assert.deepEqual(plain(result), original)
  const restored = tarot.inputFromTarotSnapshot(result)
  restored.selections[0].cardId = 'major-09'
  assert.equal(result.cards[0].card.id, 'major-08')
  const validated = tarot.validateTarotSnapshot(result)
  validated.cards[0].card.name = 'changed'; validated.conventions[0] = 'changed'; validated.sources[0].url = 'changed'
  assert.deepEqual(plain(result), original)
  result.cards[0].card.name = 'changed'; result.conventions[0] = 'changed'; result.sources[0].url = 'changed'
  assert.deepEqual(plain(snapshot()), original)
})

test('save/reload/view/export keeps a complete snapshot without rerolling, reordering or losing notes', () => {
  const storage = memoryStorage(), firstRepo = persistence.createTarotRepository(storage)
  const value = tarot.createTarotSnapshot(custom(10)), expected = plain(value)
  const saved = firstRepo.save(value, '2026-10-03T05:06:07.000Z')
  value.cards[0].note = 'mutation after saving'
  value.cards[1].card.name = 'mutation after saving'
  saved.snapshot.cards[2].orientation = 'reversed'
  const reloaded = persistence.createTarotRepository(storage)
  const record = reloaded.list()[0]
  assert.equal(record.savedAt, '2026-10-03T05:06:07.000Z')
  assert.deepEqual(plain(record.snapshot), expected)
  const exported = JSON.parse(reloaded.exportJSON())
  assert.equal(exported.schemaVersion, 1)
  assert.equal(exported.kind, 'oasis-tarot-records')
  assert.deepEqual(exported.records[0].snapshot, expected)
  assert.equal(exported.records[0].snapshot.cards[1].orientation, 'reversed')
  assert.equal(exported.records[0].snapshot.cards[9].note, '笔记 10')
  record.snapshot.cards[0].card.name = 'local result mutation'
  assert.deepEqual(plain(reloaded.list()[0].snapshot), expected)
  const stored = JSON.parse(storage.memory.get(persistence.TAROT_STORAGE_KEY))
  assert.deepEqual(stored.records[0].snapshot, expected)
})

test('same-millisecond saves have unique ids; the 51st does not discard older records', () => {
  const storage = memoryStorage(), repo = persistence.createTarotRepository(storage), value = snapshot()
  for (let index = 0; index < 50; index++) repo.save(value, '2026-10-03T05:06:07.000Z')
  assert.equal(repo.list().length, 50)
  assert.equal(new Set(repo.list().map(record => record.id)).size, 50)
  const before = storage.memory.get(persistence.TAROT_STORAGE_KEY)
  assert.throws(() => repo.save(value), /50/)
  assert.equal(storage.memory.get(persistence.TAROT_STORAGE_KEY), before)
})

test('malformed and unknown-version storage is never overwritten, deleted or exported as valid', () => {
  const valid = { id: 'saved', savedAt: '2026-10-03T05:06:07.000Z', snapshot: plain(snapshot()) }
  const records = bad => JSON.stringify({ schemaVersion: 1, records: bad })
  const invalid = [
    0, {}, 'not JSON', '{', 'null', JSON.stringify({ schemaVersion: 2, records: [] }),
    records([null]), records([valid, valid]), records([{ ...valid, id: '' }]),
    records([{ ...valid, savedAt: '2026-02-30T05:06:07.000Z' }]),
    records([{ ...valid, snapshot: { ...valid.snapshot, nameVersion: 'unknown' } }]),
    records([{ ...valid, snapshot: { ...valid.snapshot, ruleVersion: 'unknown' } }]),
    records([{ ...valid, snapshot: { ...valid.snapshot, date: '2026-02-30' } }]),
    records(Array.from({ length: 51 }, (_, i) => ({ ...valid, id: `id-${i}` }))),
    'x'.repeat(1_000_001),
  ]
  for (const raw of invalid) {
    const storage = memoryStorage(raw), repo = persistence.createTarotRepository(storage)
    for (const operation of [() => repo.list(), () => repo.save(snapshot()), () => repo.remove('saved'), () => repo.exportJSON()]) assert.throws(operation, /保留/)
    assert.equal(storage.memory.get(persistence.TAROT_STORAGE_KEY), raw)
  }
  for (const initial of ['', null, undefined]) assert.equal(persistence.createTarotRepository(memoryStorage(initial)).list().length, 0)
})

test('failed writes and reads preserve previous storage and failed saves never mutate caller snapshots', () => {
  const storage = memoryStorage(), repo = persistence.createTarotRepository(storage), value = snapshot()
  const saved = repo.save(value), before = storage.memory.get(persistence.TAROT_STORAGE_KEY)
  const fullStorage = persistence.createTarotRepository({ getItem: storage.getItem, setItem: () => { throw new Error('quota') } })
  assert.throws(() => fullStorage.save(value), /保存失败/)
  assert.throws(() => fullStorage.remove(saved.id), /保存失败/)
  assert.equal(storage.memory.get(persistence.TAROT_STORAGE_KEY), before)
  assert.deepEqual(plain(value), plain(snapshot()))
  const denied = persistence.createTarotRepository({ getItem: () => { throw new Error('denied') }, setItem: () => assert.fail('must never write after read failure') })
  for (const operation of [() => denied.list(), () => denied.save(value), () => denied.remove(saved.id), () => denied.exportJSON()]) assert.throws(operation, /读取/)
})

test('invalid save timestamps and versions leave an empty repository untouched', () => {
  const storage = memoryStorage(), repo = persistence.createTarotRepository(storage)
  for (const date of ['not-a-date', '2026-02-30T00:00:00.000Z', '2026-10-03', '2026-10-03T05:06:07Z', '2026-10-03T13:06:07.000+08:00']) assert.throws(() => repo.save(snapshot(), date), /时间/)
  assert.throws(() => repo.save({ ...snapshot(), nameVersion: 'other-version' }), /版本/)
  assert.equal(storage.memory.size, 0)
})

test('delete removes only the selected snapshot and missing ids do not cause a write', () => {
  const storage = memoryStorage(), repo = persistence.createTarotRepository(storage)
  const first = repo.save(snapshot(), '2026-10-03T05:06:07.000Z')
  const second = repo.save(tarot.createTarotSnapshot(custom(2)), '2026-10-03T05:06:07.000Z')
  repo.remove(first.id)
  assert.deepEqual(plain(repo.list().map(record => record.id)), [second.id])
  const before = storage.memory.get(persistence.TAROT_STORAGE_KEY)
  assert.throws(() => repo.remove(first.id), /不存在/)
  assert.equal(storage.memory.get(persistence.TAROT_STORAGE_KEY), before)
})

test('fifty snapshots at all declared text limits remain readable and exportable', () => {
  const input = custom(10)
  input.question = '问'.repeat(200); input.deckDescription = '组'.repeat(100); input.drawNotes = '过'.repeat(200); input.spreadName = '阵'.repeat(60); input.notes = '记'.repeat(2000)
  input.selections.forEach((selection, index) => { selection.positionName = `${index}${'位'.repeat(39)}`; selection.note = '牌'.repeat(500) })
  const value = tarot.createTarotSnapshot(input), storage = memoryStorage(), repo = persistence.createTarotRepository(storage)
  for (let i = 0; i < 50; i++) repo.save(value, '2026-10-03T05:06:07.000Z')
  assert.equal(repo.list().length, 50)
  assert.ok(storage.memory.get(persistence.TAROT_STORAGE_KEY).length < 1_000_000)
  assert.equal(JSON.parse(repo.exportJSON()).records[49].snapshot.cards[9].note.length, 500)
})
