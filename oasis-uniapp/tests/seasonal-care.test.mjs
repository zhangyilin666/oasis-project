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
const domain = await load('../src/domain/seasonal-care/index.ts')
const persistence = await load('../src/domain/seasonal-care/repository.ts')
const plain = value => JSON.parse(JSON.stringify(value))
const reading = domain.getSeasonalCareReading({ date: '2026-10-03', theme: 'all' })
const personal = overrides => ({ habit: '记录晚间的起居节奏', status: 'observed', observation: '窗外的叶子开始变色。', note: '今晚先把第二天的安排写下来。', ...overrides })
const snapshot = domain.createSeasonalCareSnapshot(reading, personal())
function memory(initial) {
  const data = new Map(initial === undefined ? [] : [[persistence.SEASONAL_CARE_STORAGE_KEY, initial]])
  return { data, getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }
}

test('all 24 terms map once to the fixed four-li reading catalog', () => {
  const fixed = {
    spring: ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'], summer: ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'],
    autumn: ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'], winter: ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒'],
  }
  assert.deepEqual(plain(domain.CULTURAL_SEASON_TERMS), fixed)
  assert.equal(new Set(Object.values(fixed).flat()).size, 24)
  for (const [season, terms] of Object.entries(fixed)) for (const term of terms) assert.equal(domain.culturalSeasonForTerm(term), season)
  assert.throws(() => domain.culturalSeasonForTerm('长夏'), /不在本版/)
})

test('four short historical excerpts and exact chapter anchors match the inspected Suwen source', () => {
  // Primary text: Wikisource oldid=2083230, 四气调神大论篇第二, four opening paragraphs.
  const cards = domain.SEASONAL_CARE_CARDS.filter(card => card.layer === 'culture')
  assert.deepEqual(plain(cards.map(card => [card.id, card.excerpt])), [['culture-spring', '发陈'], ['culture-summer', '蕃秀'], ['culture-autumn', '容平'], ['culture-winter', '闭藏']])
  for (const card of cards) {
    assert.equal(card.source.url, 'https://zh.wikisource.org/w/index.php?title=黃帝內經/素問第一卷&oldid=2083230')
    assert.equal(card.source.publishedAt, null)
    assert.match(card.source.location, /四气调神大论篇第二/)
    assert.match(card.source.revision, /2083230/)
    assert.equal(card.theme, 'seasonal')
  }
})

test('public-health sources have checked publication dates, locations and narrow fact summaries', () => {
  const fixtures = [
    ['health-food', 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet', '2026-01-26', /营养充足、平衡、适量、多样/],
    ['health-movement', 'https://www.who.int/news-room/fact-sheets/detail/physical-activity', '2024-06-26', /通勤、家务和休闲/],
    ['health-routine', 'https://www.cdc.gov/sleep/about/index.html', '2024-05-15', /相近时间入睡和起床/],
  ]
  for (const [id, url, date, claim] of fixtures) {
    const card = domain.SEASONAL_CARE_CARDS.find(item => item.id === id)
    assert.equal(card.layer, 'public-health'); assert.equal(card.season, 'all'); assert.equal(card.source.url, url); assert.equal(card.source.publishedAt, date); assert.equal(card.source.checkedAt, '2026-10-03'); assert.ok(card.source.location); assert.match(card.summary, claim)
    assert.equal(card.excerpt, '')
  }
  assert.equal(domain.SEASONAL_CARE_CARDS.length, 7)
  assert.equal(new Set(domain.SEASONAL_CARE_CARDS.map(card => card.id)).size, 7)
})

test('independent NAOJ 2026 boundaries respect noon rather than assigning the whole jie day to the next season', () => {
  // https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou262.html, JST minus 1 h:
  // Li Chun Feb 4 04:02; Li Xia May 5 19:49; Li Qiu Aug 7 19:43; Li Dong Nov 7 17:52 UTC+8.
  const fixtures = [
    ['2026-02-03', '大寒', 'winter'], ['2026-02-04', '立春', 'spring'],
    ['2026-05-05', '谷雨', 'spring'], ['2026-05-06', '立夏', 'summer'],
    ['2026-08-07', '大暑', 'summer'], ['2026-08-08', '立秋', 'autumn'],
    ['2026-11-07', '霜降', 'autumn'], ['2026-11-08', '立冬', 'winter'],
  ]
  for (const [date, term, season] of fixtures) {
    const value = domain.getSeasonalCareReading({ date, theme: 'all' })
    assert.equal(value.calendar.currentTerm, term); assert.equal(value.calendar.season, season)
    assert.equal(value.cultureCards[0].id, `culture-${season}`)
    assert.equal(value.calendar.sampleTime, '12:00'); assert.equal(value.calendar.utcTime, `${date}T04:00:00.000Z`)
    assert.equal(domain.isSeasonalCareReading(value), true)
  }
})

test('lunar new year and supported endpoints preserve valid calendar facts and chronology', () => {
  // HKO T2025c.txt: 2025-01-29 is first lunar month, first day, before Li Chun.
  const newYear = domain.getSeasonalCareReading({ date: '2025-01-29', theme: 'all' })
  assert.equal(newYear.calendar.lunarLabel, '二〇二五年正月初一')
  assert.equal(newYear.calendar.season, 'winter')
  for (const date of ['1900-01-01', '2099-12-31', '2024-02-29', '2026-01-01', '2026-12-31']) {
    const value = domain.getSeasonalCareReading({ date, theme: 'all' })
    assert.equal(domain.isSeasonalCareReading(value), true)
    assert.ok(Date.parse(value.calendar.previous.utcTime) <= Date.parse(value.calendar.utcTime))
    assert.ok(Date.parse(value.calendar.next.utcTime) > Date.parse(value.calendar.utcTime))
  }
})

test('theme filtering keeps the two layers separate and general health cards are identical across four seasons', () => {
  const healthIds = ['health-food', 'health-movement', 'health-routine']
  for (const date of ['2026-03-01', '2026-06-01', '2026-09-01', '2026-12-01']) {
    const all = domain.getSeasonalCareReading({ date, theme: 'all' })
    assert.equal(all.cultureCards.length, 1); assert.deepEqual(plain(all.healthCards.map(card => card.id)), healthIds)
    assert.deepEqual(plain(all.healthCards), plain(reading.healthCards))
    const culture = domain.getSeasonalCareReading({ date, theme: 'seasonal' })
    assert.equal(culture.cultureCards.length, 1); assert.equal(culture.healthCards.length, 0)
    for (const theme of ['food', 'movement', 'routine']) {
      const filtered = domain.getSeasonalCareReading({ date, theme })
      assert.equal(filtered.cultureCards.length, 0); assert.equal(filtered.healthCards.length, 1); assert.equal(filtered.healthCards[0].id, `health-${theme}`)
      assert.equal(domain.isSeasonalCareReading(filtered), true)
    }
  }
})

test('invalid dates/themes are rejected instead of returning invented content', () => {
  for (const date of ['1900-02-29', '2025-02-29', '2026-04-31', '2026-10-00', '2026-1-1', '1899-12-31', '2100-01-01', '', 'bad']) assert.throws(() => domain.getSeasonalCareReading({ date, theme: 'all' }))
  for (const theme of ['diagnosis', '', 'spring', null]) assert.throws(() => domain.getSeasonalCareReading({ date: '2026-10-03', theme }), /主题/)
  assert.throws(() => domain.selectSeasonalCareCards('long-summer', 'all'))
  assert.throws(() => domain.selectSeasonalCareCards('toString', 'all'))
})

test('catalog entries and returned results are isolated and metadata is immutable', () => {
  assert.equal(Object.isFrozen(domain.SEASONAL_CARE_CARDS), true)
  assert.equal(Object.isFrozen(domain.SEASONAL_CARE_CARDS[0].source), true)
  const copy = domain.getSeasonalCareReading({ date: '2026-10-03', theme: 'all' })
  copy.cultureCards[0].source.title = '改动'; copy.healthCards[0].summary = '改动'; copy.conventions.push('改动')
  assert.notEqual(reading.cultureCards[0].source.title, '改动')
  assert.notEqual(domain.SEASONAL_CARE_CARDS[4].summary, '改动')
  assert.equal(domain.SEASONAL_CARE_CONVENTIONS.includes('改动'), false)
  assert.notEqual(snapshot.reading, reading)
  assert.deepEqual(plain(snapshot.reading), plain(reading))
})

test('notes preserve user-selected status and text without deriving a health score', () => {
  for (const status of ['observed', 'planned', 'done']) {
    const value = domain.createSeasonalCareSnapshot(reading, personal({ habit: '  自己的安排  ', status, note: '第一行\n第二行' }))
    assert.equal(value.personal.status, status); assert.equal(value.personal.habit, '自己的安排'); assert.equal(value.personal.note, '第一行\n第二行')
    assert.deepEqual(Object.keys(value.personal), ['habit', 'status', 'observation', 'note'])
    assert.equal(domain.isSeasonalCareSnapshot(value), true)
  }
  for (const change of [{ habit: '' }, { habit: '字'.repeat(101) }, { status: 'healthy' }, { observation: '字'.repeat(1001) }, { note: '字'.repeat(2001) }, { note: null }]) assert.throws(() => domain.createSeasonalCareSnapshot(reading, personal(change)))
})

test('timezone changes do not change the fixed UTC+8 reading', () => {
  const old = process.env.TZ
  try {
    const values = ['UTC', 'Asia/Tokyo', 'America/New_York'].map(zone => { process.env.TZ = zone; return JSON.stringify(domain.getSeasonalCareReading({ date: '2026-11-07', theme: 'all' })) })
    assert.equal(values[0], values[1]); assert.equal(values[1], values[2])
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old }
})

test('reading validation rejects wrong versions, reversed intervals, altered cards and contradictory season facts', () => {
  const mutations = [
    value => { value.ruleVersion = 'future' }, value => { value.contentVersion = 'future' }, value => { value.query.theme = 'food' },
    value => { value.calendar.timeZone = 'UTC' }, value => { value.calendar.sampleTime = '00:00' }, value => { value.calendar.season = 'winter' },
    value => { value.calendar.previous.utcTime = value.calendar.next.utcTime }, value => { value.calendar.currentTerm = '立春' }, value => { value.calendar.next.kind = 'wrong' },
    value => { value.calendar.source.url = 'https://example.com' }, value => { value.healthCards[0].summary = '可以治病' }, value => { value.cultureCards[0].source.checkedAt = '2020-01-01' },
    value => { value.healthCards.reverse() }, value => { value.healthCards.pop() }, value => { value.conventions.pop() }, value => { value.extra = true },
    value => { value.calendar.extra = true }, value => { value.query.extra = true },
  ]
  for (const mutate of mutations) { const value = plain(reading); mutate(value); assert.equal(domain.isSeasonalCareReading(value), false); assert.throws(() => domain.createSeasonalCareSnapshot(value, personal()), /格式异常|版本/) }
})

test('full snapshot validation rejects extra fields, unsupported note status and noncanonical stored input', () => {
  for (const mutate of [value => { value.ruleVersion = 'future' }, value => { value.personal.habit = ' 不规范空格 ' }, value => { value.personal.status = 'scored' }, value => { value.personal.extra = true }, value => { value.extra = true }]) {
    const value = plain(snapshot); mutate(value); assert.equal(domain.isSeasonalCareSnapshot(value), false); assert.throws(() => domain.validateSeasonalCareSnapshot(value), /格式异常|版本/)
  }
  const copy = domain.validateSeasonalCareSnapshot(snapshot); copy.personal.note = '改动'
  assert.notEqual(copy.personal.note, snapshot.personal.note)
})

test('save, reopen and export preserve complete historical card/source snapshots without recomputing the date', () => {
  const mem = memory(), repo = persistence.createSeasonalCareRepository(mem), record = repo.save(snapshot, '2026-10-03T00:00:00.000Z')
  assert.deepEqual(plain(repo.list()[0].snapshot), plain(snapshot))
  const exported = JSON.parse(repo.exportJSON()); assert.equal(exported.kind, 'seasonal-care'); assert.deepEqual(exported.records[0].snapshot, plain(snapshot))
  record.snapshot.personal.note = '改动返回对象'
  assert.notEqual(repo.list()[0].snapshot.personal.note, '改动返回对象')
  repo.remove(record.id); assert.equal(repo.list().length, 0)
})

test('50 full snapshots at every note limit fit; the 51st leaves existing data untouched', () => {
  const mem = memory(), repo = persistence.createSeasonalCareRepository(mem)
  const full = domain.createSeasonalCareSnapshot(reading, personal({ habit: '字'.repeat(100), observation: '字'.repeat(1000), note: '字'.repeat(2000) }))
  for (let i = 0; i < 50; i++) repo.save(full, '2026-10-03T00:00:00.000Z')
  assert.equal(repo.list().length, 50); assert.equal(new Set(repo.list().map(record => record.id)).size, 50)
  const before = mem.data.get(persistence.SEASONAL_CARE_STORAGE_KEY)
  assert.throws(() => repo.save(full), /最多保存 50/); assert.equal(mem.data.get(persistence.SEASONAL_CARE_STORAGE_KEY), before)
  assert.equal(JSON.parse(repo.exportJSON()).records.length, 50)
})

test('corrupt records and unknown versions block all operations and preserve the raw storage value', () => {
  const good = { schemaVersion: 1, kind: 'seasonal-care', records: [{ id: 'saved-1', savedAt: '2026-10-03T00:00:00.000Z', snapshot: plain(snapshot) }] }
  const unknown = plain(good); unknown.records[0].snapshot.reading.contentVersion = 'future'
  const other = plain(good); other.kind = 'tarot'
  const invalid = plain(good); invalid.records[0].snapshot.reading.healthCards[0].source.url = 'https://example.com'
  const duplicates = plain(good); duplicates.records.push(plain(duplicates.records[0]))
  for (const raw of ['not-json', '{}', JSON.stringify(unknown), JSON.stringify(other), JSON.stringify(invalid), JSON.stringify(duplicates)]) {
    const mem = memory(raw), repo = persistence.createSeasonalCareRepository(mem)
    for (const operation of [() => repo.list(), () => repo.save(snapshot), () => repo.remove('saved-1'), () => repo.exportJSON()]) { assert.throws(operation, /原始数据已保留/); assert.equal(mem.data.get(persistence.SEASONAL_CARE_STORAGE_KEY), raw) }
  }
})

test('storage failures and invalid snapshots do not destroy previously saved notes', () => {
  const mem = memory(), repo = persistence.createSeasonalCareRepository(mem); repo.save(snapshot)
  const before = mem.data.get(persistence.SEASONAL_CARE_STORAGE_KEY), invalid = plain(snapshot); invalid.personal.status = 'invalid'
  assert.throws(() => repo.save(invalid), /内容不完整/)
  assert.throws(() => repo.save(snapshot, '2026-02-30T00:00:00.000Z'), /保存时间/)
  const quota = persistence.createSeasonalCareRepository({ getItem: mem.getItem, setItem: () => { throw new Error('quota') } })
  assert.throws(() => quota.save(snapshot), /未确认成功/); assert.equal(mem.data.get(persistence.SEASONAL_CARE_STORAGE_KEY), before)
  const denied = persistence.createSeasonalCareRepository({ getItem: () => { throw new Error('denied') }, setItem: () => assert.fail('must not write') })
  assert.throws(() => denied.save(snapshot), /无法读取/)
})
