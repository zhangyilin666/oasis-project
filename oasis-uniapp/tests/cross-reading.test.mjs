import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const modules = ['metaphysics', 'flow-study', 'jyotish', 'western-study', 'qizheng', 'qizheng-lodges', 'qimen', 'liuren', 'taiyi', 'divination', 'date-selection', 'tarot', 'almanac', 'space', 'bazhai', 'seasonal-care', 'practice', 'names', 'physiognomy']
const contents = ["export * from './src/domain/cross-reading'; export * from './src/domain/cross-reading/repository'; export { Solar } from 'lunar-typescript';", ...modules.map((name, i) => `export * as m${i} from './src/domain/${name}';`)].join('\n')
const bundle = await build({ stdin: { contents, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports, mod = Object.fromEntries(modules.map((name, i) => [name, api[`m${i}`]]))
const plain = value => JSON.parse(JSON.stringify(value)), savedAt = '2026-10-03T08:00:00.000Z'
const birth = { date: '2000-08-16', time: '04:30', utcOffset: 8, gender: '女', timePrecision: 'minute', place: { latitude: 31.2304, longitude: 121.4737 } }
const selection = (kind, snapshot, more = {}) => ({ kind, key: `${kind}:same-id`, record: { id: 'same-id', savedAt, snapshot, ...more } })
const spaceFacts = { ...mod.space.emptySpaceFacts(), name: '书房资料', bearingDegrees: 0, northReference: 'true', directionTarget: '已确认坐山轴线', measurementTool: '测绘资料', measurementBasis: '示例真北读数', measuredAt: '2026-10-03' }
const sourceList = [
  { kind: 'birth-charts', key: 'birth-charts:same-id', record: { id: 'same-id', savedAt, name: '旧三盘', result: await mod.metaphysics.calculateExploration(birth, { observationDate: '2024-02-05' }) } },
  selection('flow-study', mod['flow-study'].calculateFlowStudy({ name: '七层流限', birth, observation: { date: '2024-02-05', time: '12:00', utcOffset: 8 }, note: '核对年界' })),
  selection('jyotish', mod.jyotish.calculateJyotish(birth, { observationDate: '2024-02-05' }), { name: '印度记录' }),
  selection('western-study', mod['western-study'].calculateWesternStudy({ name: '甲', profile: birth }, { name: '乙', profile: { ...birth, date: '2000-09-16' } }), { name: '两份星盘', note: '不同人物，不推断关系' }),
  selection('qizheng', mod.qizheng.calculateQizheng({ date: '2024-02-05', time: '12:00', utcOffset: 8, timePrecision: 'minute' }), { name: '天文坐标', note: '' }),
  selection('qizheng-lodges', mod['qizheng-lodges'].calculateQizhengLodges({ label: '原书太阳例', yearLabel: 1684, palace: 0, degree: 8, minute: 0, second: 0 }), { name: '原始宿钤查算', note: '古籍例子，不是出生资料' }),
  selection('qimen', mod.qimen.createQimenSnapshot({ name: '奇门记录', date: '2024-02-05', time: '23:30:00', utcOffsetMinutes: 480, locationNote: '', question: '核对日界' }, new Date(savedAt))),
  selection('liuren', mod.liuren.createLiurenSnapshot({ ...mod.liuren.emptyLiurenInput(), name: '六壬古例', mode: 'manual', day: '甲子', general: '子', hour: '卯' }, new Date(savedAt))),
  selection('taiyi', mod.taiyi.createTaiyiSnapshot({ name: '开元锚年', year: '724', sourceNote: '只填岁年', question: '' }, new Date(savedAt))),
  { kind: 'divination', key: 'divination:same-id', record: { id: 'same-id', savedAt, ruleVersion: 'meihua-calendar-v1', input: { question: '传统时间口径', date: '2024-02-05', time: '23:30', utcOffset: 8, method: 'meihua-calendar' } } },
  selection('date-selection', mod['date-selection'].calculateDateSelection({ title: '出行窗口', startDate: '2026-06-28', endDate: '2026-06-30', activity: '出行', mode: 'practical-only', availableWeekdays: [0, 1, 2, 3, 4, 5, 6], excludedDates: [], venueNotes: '场地尚需确认' })),
  selection('tarot', mod.tarot.createTarotSnapshot({ question: '如何记录观察', date: '2026-10-03', deckDescription: '实体牌', drawNotes: '手动抽出', spreadKind: 'single', spreadName: '单张关注', selections: [{ positionName: '当下关注', cardId: 'major-08', orientation: 'upright', note: '自己的解释' }], notes: '自己的记录' })),
  { kind: 'almanac', key: 'almanac:same-id', record: { id: 'same-id', savedAt, result: mod.almanac.calculateAlmanac({ date: '2024-02-05', time: '12:00' }) } },
  selection('space', mod.space.createSpaceSnapshot(spaceFacts, new Date(savedAt))),
  selection('bazhai', mod.bazhai.calculateBazhai({ facts: spaceFacts, bearingRole: 'sitting', uncertaintyDegrees: 1 })),
  selection('seasonal-care', mod['seasonal-care'].createSeasonalCareSnapshot(mod['seasonal-care'].getSeasonalCareReading({ date: '2026-10-03', theme: 'all' }), { habit: '观察当地季节', status: 'observed', observation: '气温变化', note: '用户笔记' })),
  selection('practice', mod.practice.finishPracticeDraft(mod.practice.createPracticeDraft({ topicId: 'quiet-seat', durationMinutes: 1 }, Date.parse(savedAt) - 60000, 'same-id'), Date.parse(savedAt)), { savedAt: Date.parse(savedAt) }),
  selection('name-culture', mod.names.inspectName({ name: '张明', confirmedPronunciation: 'Zhāng Míng', notes: '字词资料' })),
  selection('physiognomy-culture', mod.physiognomy.createCulturalNote({ articleId: 'star-metaphors', date: '2026-10-03', title: '词义对照', note: '同名并非同物' })),
].map(plain)
const byKind = kind => plain(sourceList.find(item => item.kind === kind))
const buildReading = selections => api.createCrossReading({ topic: '不同资料如何表达时间与词语', note: '保留各自口径', selections }, savedAt)
const base = () => buildReading([byKind('tarot'), byKind('almanac')])
function memory() { const data = new Map(); let writes = 0; return { data, get writes() { return writes }, getItem: key => data.get(key), setItem(key, value) { writes++; data.set(key, value) } } }
const keys = { 'birth-charts': '__xiaoyi_local_charts_v1', 'flow-study': 'oasis.flow-study.records.v1', jyotish: 'oasis.jyotish.snapshots.v1', 'western-study': 'oasis.western-study.snapshots.v1', qizheng: 'oasis.qizheng.reference-snapshots.v1', 'qizheng-lodges': 'oasis.qizheng-lodges.snapshots.v1', qimen: '__oasis_qimen_records_v1', liuren: '__oasis_liuren_records_v1', taiyi: '__oasis_taiyi_records_v1', divination: 'oasis.divination.records.v1', 'date-selection': 'oasis.date-selection.records.v1', tarot: 'oasis.tarot.records.v1', almanac: 'oasis.almanac.snapshots.v1', space: '__oasis_space_records_v1', bazhai: 'oasis.bazhai.records.v1', 'seasonal-care': 'oasis.seasonal-care.records.v1', practice: 'oasis.practice.sessions.v1', 'name-culture': 'oasis.name-culture.records.v1', 'physiognomy-culture': 'oasis.physiognomy.notes.v1' }
function envelope(item) {
  if (['birth-charts', 'jyotish', 'western-study', 'qizheng', 'qizheng-lodges', 'qimen', 'liuren', 'taiyi', 'space'].includes(item.kind)) return { version: 1, records: [item.record] }
  if (['flow-study', 'date-selection', 'seasonal-care', 'name-culture', 'physiognomy-culture', 'bazhai'].includes(item.kind)) return { schemaVersion: 1, kind: item.kind, records: [item.record] }
  if (item.kind === 'practice') return { schemaVersion: 1, active: null, records: [item.record] }
  return { schemaVersion: 1, records: [item.record] }
}

test('all nineteen independent source families validate and retain complete originals', () => {
  assert.deepEqual(plain(api.CROSS_SOURCE_KINDS), sourceList.map(s => s.kind))
  for (const source of sourceList) {
    const pair = source.kind === 'tarot' ? byKind('almanac') : byKind('tarot')
    const result = plain(buildReading([source, pair]))
    assert.deepEqual(result.entries[0].selection, source, source.kind)
    assert.ok(result.entries[0].cards.length >= 1, source.kind)
    assert.ok(result.entries[0].cards.every(card => card.ruleVersion && card.facts.length && card.times.length && card.rules.length && card.sources.length), source.kind)
    for (const card of result.entries[0].cards) for (const fact of [...card.times, ...card.rules, ...card.facts]) assert.doesNotMatch(fact.value, /undefined|\[object Object\]/, source.kind)
    assert.equal(api.isCrossReadingSnapshot(result), true, source.kind)
  }
})

test('source catalog reads all stores without writes and isolates corruption per family', () => {
  const store = memory()
  for (const source of sourceList) store.data.set(keys[source.kind], JSON.stringify(envelope(source)))
  const catalog = api.listCrossReadingSources(store)
  assert.deepEqual(plain(catalog.errors), [])
  assert.equal(catalog.selections.length, 19)
  assert.equal(store.writes, 0)
  catalog.selections[0].record.name = 'modified copy'
  assert.equal(api.listCrossReadingSources(store).selections[0].record.name, '旧三盘')
  store.data.set(keys.divination, '{corrupt')
  const before = [...store.data.entries()]
  const partial = api.listCrossReadingSources(store)
  assert.deepEqual(plain(partial.errors.map(e => e.kind)), ['divination'])
  assert.equal(partial.selections.length, 18)
  assert.deepEqual([...store.data.entries()], before)
  assert.equal(store.writes, 0)
})

test('differences distinguish birth instants, observation instants, year/month/day and coordinate rules', () => {
  const result = plain(buildReading(['flow-study', 'western-study', 'qimen', 'liuren', 'taiyi', 'divination', 'almanac', 'physiognomy-culture'].map(byKind)))
  const ids = result.differences.map(d => d.id)
  for (const id of ['identity', 'contexts', 'timeBasis', 'yearBoundary', 'monthBoundary', 'dayBoundary', 'coordinateSystem', 'birth-instants', 'observation-instants', 'reconstruction', 'borrowed-names']) assert.ok(ids.includes(id), id)
  assert.match(result.differences.find(d => d.id === 'yearBoundary').detail, /立春交节瞬间/)
  assert.match(result.differences.find(d => d.id === 'yearBoundary').detail, /春节/)
  const taiyi = result.entries.find(e => e.selection.kind === 'taiyi').cards[0]
  assert.deepEqual(taiyi.observationInstants, [])
  assert.equal(taiyi.context, 'year-label')
  assert.match(taiyi.times[1].value, /不暗定立春、春节或 1 月 1 日年界/)
  assert.match(result.differences.find(d => d.id === 'identity').detail, /没有自动匹配身份/)
})

test('legacy birth archives without rule profile do not inherit current boundary assumptions', () => {
  const source = byKind('birth-charts')
  delete source.record.result.rulesVersion
  source.record.result.charts.forEach(chart => { delete chart.ruleProfile })
  const cards = buildReading([source, byKind('tarot')]).entries[0].cards
  for (const card of cards.filter(c => c.id !== 'western')) {
    assert.match(card.ruleVersion, /旧快照未单列/)
    for (const field of ['timeBasis', 'yearBoundary', 'monthBoundary', 'dayBoundary']) assert.match(card.comparison[field], /原快照未单列/)
  }
})

test('equivalent legacy UTC spellings are treated as one instant without changing originals', () => {
  const source = byKind('birth-charts')
  source.record.result.utcTime = source.record.result.utcTime.replace('.000Z', 'Z')
  const result = buildReading([source, byKind('flow-study')])
  assert.ok(!result.differences.some(d => d.id === 'birth-instants'))
  assert.equal(result.entries[0].selection.record.result.utcTime, source.record.result.utcTime)
})

test('legacy and automatic divination rule pairs reconstruct once with explicit provenance', () => {
  const cases = [
    ['liuyao-manual', 'divination-v1', { lines: [9, 7, 8, 8, 7, 6] }],
    ['meihua-two-numbers', 'divination-v1', { numbers: [8, 12] }],
    ['meihua-calendar', 'meihua-calendar-v1', {}],
    ['liuyao-najia', 'liuyao-najia-v1', { lines: [9, 7, 8, 8, 7, 6] }],
    ['liuyao-coins', 'liuyao-coins-v1', { lines: [9, 7, 8, 8, 7, 6], coins: [[3, 3, 3], [3, 2, 2], [3, 3, 2], [3, 3, 2], [3, 2, 2], [2, 2, 2]] }],
  ]
  for (const [method, ruleVersion, params] of cases) {
    const source = byKind('divination')
    source.record.ruleVersion = ruleVersion
    source.record.input = { question: '本次重建', date: '2024-02-05', time: '23:30', utcOffset: 8, method, ...params }
    const result = buildReading([source, byKind('tarot')]), entry = result.entries[0]
    assert.equal(entry.representation, 'reconstructed-from-input')
    assert.match(entry.provenance, /本次依原规则重建/)
    assert.deepEqual(plain(entry.reconstruction), plain(mod.divination.calculateDivination(source.record.input, ruleVersion)))
    assert.equal(api.isCrossReadingSnapshot(result), true)
  }
})

test('unknown divination rules and mismatched supported pairs refuse reconstruction', () => {
  for (const version of ['future-v1', 'divination-v1', 'liuyao-najia-v1']) {
    const source = byKind('divination'); source.record.ruleVersion = version
    assert.throws(() => buildReading([source, byKind('tarot')]), /版本|格式|无法读取/)
  }
})

test('reopening uses saved original copies and reconstruction without any calendar call or live source read', () => {
  const result = buildReading(['flow-study', 'divination', 'almanac', 'date-selection', 'seasonal-care'].map(byKind))
  const store = memory(), repo = api.createCrossReadingRepository(store), record = repo.save(result, savedAt)
  const original = api.Solar.fromYmdHms
  api.Solar.fromYmdHms = () => { throw new Error('fresh calendar forbidden') }
  try {
    const readOnlyCross = { getItem(key) { assert.equal(key, api.CROSS_READING_STORAGE_KEY); return store.data.get(key) }, setItem() { throw new Error('unexpected write') } }
    const reopened = api.createCrossReadingRepository(readOnlyCross).list()[0]
    assert.deepEqual(plain(reopened), plain(record))
    assert.ok(JSON.parse(api.createCrossReadingRepository(readOnlyCross).exportJSON()).records.length === 1)
  } finally { api.Solar.fromYmdHms = original }
})

test('snapshots are detached from selection input, saved output and later source deletion', () => {
  const chosen = [byKind('tarot'), byKind('almanac')], result = buildReading(chosen), before = plain(result)
  chosen[0].record.snapshot.question = 'later mutation'
  assert.deepEqual(plain(result), before)
  const store = memory(), repo = api.createCrossReadingRepository(store), saved = repo.save(result, savedAt)
  saved.snapshot.entries[0].selection.record.snapshot.question = 'mutated return'
  result.topic = 'mutated caller'
  const read = repo.list()[0]
  assert.deepEqual(plain(read.snapshot), before)
  assert.equal(store.data.size, 1)
  assert.ok(repo.exportJSON().includes('如何记录观察'))
})

test('selection bounds and identifiers reject duplicates without conflating ids across families', () => {
  assert.equal(base().entries.length, 2)
  assert.throws(() => buildReading([byKind('tarot')]), /2–8/)
  assert.throws(() => buildReading(sourceList.slice(0, 9)), /2–8/)
  assert.throws(() => buildReading([byKind('tarot'), byKind('tarot')]), /重复/)
  const invalid = byKind('tarot'); invalid.key = 'almanac:same-id'
  assert.throws(() => buildReading([invalid, byKind('almanac')]), /标识/)
  assert.equal(buildReading(sourceList.slice(0, 8)).entries.length, 8)
})

test('text limits trim input, preserve valid unicode, and reject empty or excessive themes', () => {
  const selections = [byKind('tarot'), byKind('almanac')]
  const result = api.createCrossReading({ topic: '  ' + '文'.repeat(100) + '  ', note: '注'.repeat(4000), selections }, savedAt)
  assert.equal(result.topic.length, 100); assert.equal(result.note.length, 4000)
  for (const topic of ['', '   ', '文'.repeat(101)]) assert.throws(() => api.createCrossReading({ topic, note: '', selections }, savedAt), /主题/)
  assert.throws(() => api.createCrossReading({ topic: 'a', note: '注'.repeat(4001), selections }, savedAt), /笔记/)
  assert.throws(() => api.createCrossReading({ topic: 'a', note: '', selections }, 'not-a-date'), /时间/)
})

test('canonical cards, differences, prompts and stored reconstruction are checked against saved originals', () => {
  const original = plain(buildReading([byKind('divination'), byKind('tarot')]))
  for (const mutate of [
    r => { r.ruleVersion = 'future' }, r => { r.contentVersion = 'future' },
    r => { r.entries[0].cards[0].facts[0].value = 'changed' }, r => { r.entries[0].title = 'changed' },
    r => { r.entries[0].representation = 'saved-snapshot' }, r => { r.entries[0].provenance = '原始快照' },
    r => { r.entries[0].reconstruction.original.name = 'changed' }, r => { r.entries[0].reconstruction.calendar.numbers.day = 99 },
    r => { r.entries[1].selection.record.snapshot.ruleVersion = 'future' }, r => { r.differences = [] },
    r => { r.readingPrompts[0].text = 'future predictions' }, r => { r.entries[1].reconstruction = r.entries[0].reconstruction },
  ]) { const modified = plain(original); mutate(modified); assert.equal(api.isCrossReadingSnapshot(modified), false) }
})

test('saved original unsafe source URLs never become clickable presentation links', () => {
  const birthRecord = byKind('birth-charts')
  birthRecord.record.result.charts[0].source.url = 'javascript:alert(1)'
  const result = buildReading([birthRecord, byKind('tarot')])
  assert.equal(result.entries[0].selection.record.result.charts[0].source.url, 'javascript:alert(1)')
  assert.equal(result.entries[0].cards[0].sources[0].url, '')
})

test('ten records save/reopen/export/delete and capacity errors leave prior data intact', () => {
  const store = memory(), repo = api.createCrossReadingRepository(store)
  for (let i = 0; i < 10; i++) repo.save(base(), savedAt)
  assert.equal(repo.list().length, 10)
  assert.equal(JSON.parse(repo.exportJSON()).records.length, 10)
  const before = store.data.get(api.CROSS_READING_STORAGE_KEY)
  assert.throws(() => repo.save(base(), savedAt), /10/)
  assert.equal(store.data.get(api.CROSS_READING_STORAGE_KEY), before)
  repo.remove(repo.list()[0].id); assert.equal(repo.list().length, 9)
})

test('corrupt envelopes and unknown snapshot versions block every mutation and export', () => {
  const sampleStore = memory(), sampleRepo = api.createCrossReadingRepository(sampleStore)
  sampleRepo.save(base(), savedAt)
  const good = JSON.parse(sampleStore.data.get(api.CROSS_READING_STORAGE_KEY))
  const broken = plain(good); broken.records[0].snapshot.contentVersion = 'unknown'
  for (const raw of ['{', JSON.stringify({ ...good, schemaVersion: 2 }), JSON.stringify({ ...good, kind: 'tarot' }), JSON.stringify(broken)]) {
    const store = memory(); store.data.set(api.CROSS_READING_STORAGE_KEY, raw)
    const repo = api.createCrossReadingRepository(store)
    for (const call of [() => repo.list(), () => repo.save(base()), () => repo.remove('anything'), () => repo.exportJSON()]) assert.throws(call)
    assert.equal(store.data.get(api.CROSS_READING_STORAGE_KEY), raw); assert.equal(store.writes, 0)
  }
})

test('quota and read errors are visible and never report a successful save', () => {
  const quota = api.createCrossReadingRepository({ getItem: () => undefined, setItem: () => { throw new Error('quota') } })
  assert.throws(() => quota.save(base()), /写入|存储|保存/)
  const unavailable = api.createCrossReadingRepository({ getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('must not write') } })
  assert.throws(() => unavailable.save(base()), /读取/)
})

test('oversized original snapshots are refused before writing instead of silently truncating', () => {
  const source = byKind('birth-charts')
  source.record.result.charts[0].sections.push({ title: '大段原始材料', facts: [{ label: '正文', value: '文'.repeat(850000) }] })
  assert.throws(() => buildReading([source, byKind('tarot')]), /原快照合计过大/)
})

test('Taiyi unresolved host counts remain blank while guest facts remain available', () => {
  const snapshot = mod.taiyi.createTaiyiSnapshot({ name: '待校勘局', year: '714', sourceNote: '', question: '' }, new Date(savedAt))
  assert.equal(snapshot.board.ju, 39)
  const result = buildReading([selection('taiyi', snapshot), byKind('tarot')])
  const facts = result.entries[0].cards[0].facts
  assert.match(facts.find(f => f.label === '主算与将位').value, /待校勘/)
  assert.doesNotMatch(facts.find(f => f.label === '客算与将位').value, /null|undefined/)
  assert.equal(result.entries[0].selection.record.snapshot.board.host.count, null)
})

test('Qing historical table retains the published lookup without becoming a modern astronomical moment', () => {
  const source = byKind('qizheng-lodges'), result = buildReading([source, byKind('qizheng')])
  const entry = result.entries[0], card = entry.cards[0]
  assert.equal(entry.selection.record.snapshot.result.mansion, '斗')
  assert.equal(entry.selection.record.snapshot.result.withinArcseconds, 7800)
  assert.equal(entry.selection.record.snapshot.table.length, 28)
  assert.equal(card.context, 'historical-table')
  assert.deepEqual(plain(card.birthInstants), [])
  assert.deepEqual(plain(card.observationInstants), [])
  assert.match(card.facts.find(f => f.label === '所在宿／宿内度').value, /斗 · 2°10′00″/)
  assert.match(card.times[1].value, /不把年标号当作出生年份/)
  const difference = result.differences.find(d => d.id === 'historical-modern-coordinates')
  assert.match(difference.detail, /古表推移不是该年的实测距星位置/)
  assert.match(difference.detail, /不能仅更换零点/)
})

test('historical annual shift, unknown version and corrupt family stay explicit in cross-reading', () => {
  const original = mod['qizheng-lodges'].calculateQizhengLodges({ label: '下一年标号', yearLabel: 1685, palace: 0, degree: 8, minute: 0, second: 0 })
  const source = selection('qizheng-lodges', original, { name: '年移示例', note: '' })
  const result = buildReading([source, byKind('tarot')])
  assert.equal(result.entries[0].selection.record.snapshot.shiftArcseconds, 51)
  assert.equal(result.entries[0].selection.record.snapshot.result.withinArcseconds, 7749)
  assert.match(result.entries[0].cards[0].notes.join(' '), /不能解释为该年的真实距星位置/)
  const broken = plain(source); broken.record.snapshot.ruleVersion = 'unknown'
  assert.throws(() => buildReading([broken, byKind('tarot')]), /格式|无法读取/)
  const store = memory(); store.data.set(keys['qizheng-lodges'], JSON.stringify(envelope(broken))); store.data.set(keys.tarot, JSON.stringify(envelope(byKind('tarot'))))
  const catalog = api.listCrossReadingSources(store)
  assert.deepEqual(plain(catalog.errors.map(e => e.kind)), ['qizheng-lodges'])
  assert.deepEqual(plain(catalog.selections.map(e => e.kind)), ['tarot'])
  assert.equal(store.writes, 0)
})



