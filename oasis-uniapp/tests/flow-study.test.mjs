import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const bundle = await build({ stdin: { contents: "export * from './src/domain/flow-study'; export * from './src/domain/flow-study/repository'; export { withFlowZiweiRules } from './src/domain/flow-study/ziwei'; export { astro } from 'iztro'; export { Solar } from 'lunar-typescript'; export { default as language } from 'iztro/lib/i18n'", resolveDir: root, loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const source = bundle.outputFiles[0].text, context = vm.createContext({ module: { exports: {} }, console })
vm.runInContext(source, context)
const api = context.module.exports, plain = value => JSON.parse(JSON.stringify(value))
const birth = { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 }
const input = (date = '2023-08-28', time = '00:30', profile = birth, observationExtra = {}) => ({ name: '规则核对', birth: profile, observation: { date, time, utcOffset: 8, ...observationExtra }, note: '' })
const calc = (...args) => plain(api.calculateFlowStudy(input(...args)))
const scope = (snapshot, id) => snapshot.ziwei.scopes.find(s => s.id === id)
const mutations = (snapshot, id) => scope(snapshot, id).mutations.map(m => m.star)

test('published iztro example fixes natal/year/month/day/hour layers and their four transformations', () => {
  // Primary published fixture: https://docs.iztro.com/quick-start (accessed 2026-10-03).
  // Documentation age 23 is from an older birthday convention; current normal age is derived separately below.
  const result = calc()
  assert.equal(result.ziwei.lunarDate, '二〇二三年七月十三')
  assert.deepEqual(result.bazi.birthPillars, ['庚辰', '甲申', '丙午', '庚寅'])
  for (const [id, index, ganZhi, four] of [
    ['origin', 4, '庚辰', ['太阳', '武曲', '太阴', '天同']],
    ['decadal', 2, '庚辰', ['太阳', '武曲', '太阴', '天同']],
    ['yearly', 1, '癸卯', ['破军', '巨门', '太阴', '贪狼']],
    ['monthly', 3, '庚申', ['太阳', '武曲', '太阴', '天同']],
    ['daily', 3, '戊午', ['贪狼', '太阴', '右弼', '天机']],
    ['hourly', 3, '壬子', ['天梁', '紫微', '左辅', '武曲']],
  ]) { assert.equal(scope(result, id).palaceIndex, index); assert.equal(scope(result, id).ganZhi, ganZhi); assert.deepEqual(mutations(result, id), four) }
  assert.deepEqual(scope(result, 'daily').mutations.map(m => [m.natalPalace, m.branch]), [['迁移', '子'], ['仆役', '亥'], ['夫妻', '辰'], ['兄弟', '巳']])
})

test('small limit derives normal age and palace-stem transformations from published natal ages', () => {
  // 2023 - 2000 + 1 = 24. Published 亥/仆役 palace ages [12,24,36,...], stem 丁.
  // 丁四化 according to the official iztro table: 太阴/天同/天机/巨门.
  const result = calc()
  assert.equal(result.ziwei.nominalAge, 24)
  assert.equal(scope(result, 'age').palaceIndex, 9)
  assert.equal(scope(result, 'age').ganZhi, '丁亥')
  assert.deepEqual(mutations(result, 'age'), ['太阴', '天同', '天机', '巨门'])
  assert.ok(scope(result, 'age').flowStars.every(a => a.length === 0))
})

test('Bazi exact Li Chun and Ziwei Spring Festival boundaries stay distinct', () => {
  // HKO 2024: Li Chun Feb 4; Lunar New Year Feb 10.
  // Fixed cross-language lunar-python 1.4.8 regression: 2024-02-04 16:26/16:28.
  const before = calc('2024-02-04', '16:26'), after = calc('2024-02-04', '16:28')
  assert.deepEqual(before.bazi.observationPillars, ['癸卯', '乙丑', '戊戌', '庚申'])
  assert.deepEqual(after.bazi.observationPillars, ['甲辰', '丙寅', '戊戌', '庚申'])
  assert.equal(before.bazi.solarYear, 2023); assert.equal(after.bazi.solarYear, 2024)
  for (const r of [before, after, calc('2024-02-09')]) { assert.equal(scope(r, 'yearly').ganZhi, '癸卯'); assert.equal(r.ziwei.nominalAge, 24) }
  const springFestival = calc('2024-02-10', '00:00')
  assert.equal(scope(springFestival, 'yearly').ganZhi, '甲辰'); assert.equal(springFestival.ziwei.nominalAge, 25)
})

test('twelve 2026 Jie transitions agree with independent NAOJ minute data and hand-derived pillars', () => {
  // NAOJ 2026 暦要項 uses JST; these are the published minutes minus one hour.
  // https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou262.html
  // 庚寅 begins the 丙午 solar year by 五虎遁; following months increment the 60-cycle.
  const rows = [
    ['2026-01-05', '16:23', '己丑'], ['2026-02-04', '04:02', '庚寅'],
    ['2026-03-05', '21:59', '辛卯'], ['2026-04-05', '02:40', '壬辰'],
    ['2026-05-05', '19:49', '癸巳'], ['2026-06-05', '23:48', '甲午'],
    ['2026-07-07', '09:57', '乙未'], ['2026-08-07', '19:43', '丙申'],
    ['2026-09-07', '22:41', '丁酉'], ['2026-10-08', '14:29', '戊戌'],
    ['2026-11-07', '17:52', '己亥'], ['2026-12-07', '10:53', '庚子'],
  ]
  const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥'
  for (const [date, time, next] of rows) {
    const center = Date.parse(`${date}T${time}:00Z`)
    const at = minutes => { const s = new Date(center + minutes * 60_000).toISOString(); return calc(s.slice(0, 10), s.slice(11, 16)) }
    const before = at(-2), after = at(2), month = after.bazi.months.find(m => m.current)
    assert.equal(after.bazi.currentMonth.ganZhi, next)
    assert.equal(before.bazi.currentMonth.ganZhi, stems[(stems.indexOf(next[0]) + 9) % 10] + branches[(branches.indexOf(next[1]) + 11) % 12])
    assert.ok(Math.abs(Date.parse(month.start.replace(' ', 'T') + 'Z') - center) <= 120_000)
  }
})

test('annual month intervals are twelve consecutive half-open spans and ten-god facts use the natal day master', () => {
  const result = calc(), months = result.bazi.months
  assert.equal(months.length, 12); assert.equal(months.filter(m => m.current).length, 1)
  for (let i = 1; i < 12; i++) assert.equal(months[i].start, months[i - 1].end)
  assert.equal(result.bazi.dayMaster, '丙')
  assert.deepEqual(result.bazi.yearly, { ganZhi: '癸卯', stemGod: '正官', hidden: [{ stem: '乙', god: '正印' }] })
  assert.deepEqual(result.bazi.currentMonth, { ganZhi: '庚申', stemGod: '偏财', hidden: [{ stem: '庚', god: '偏财' }, { stem: '壬', god: '七杀' }, { stem: '戊', god: '食神' }] })
})

test('leap-month fifteenth/sixteenth changes Ziwei monthly/day palace under published HKO calendar', () => {
  // HKO 2023: Apr 5 = 闰二月十五, Apr 6 = 闰二月十六.
  // 寅-index monthly 10/11; daily adds lunar day - 1 => 0/2.
  const first = calc('2023-04-05'), second = calc('2023-04-06')
  assert.equal(scope(first, 'monthly').ganZhi, '乙卯'); assert.equal(scope(first, 'monthly').palaceIndex, 10)
  assert.equal(scope(second, 'monthly').ganZhi, '丙辰'); assert.equal(scope(second, 'monthly').palaceIndex, 11)
  assert.equal(scope(first, 'daily').palaceIndex, 0); assert.equal(scope(second, 'daily').palaceIndex, 2)
  const b1 = calc('2024-02-10', '00:30', { ...birth, date: '2023-04-05' })
  const b2 = calc('2024-02-10', '00:30', { ...birth, date: '2023-04-06' })
  assert.equal(scope(b1, 'monthly').palaceIndex, 3); assert.equal(scope(b2, 'monthly').palaceIndex, 2)
})

test('early Zi, late Zi and midnight follow explicit per-system day boundaries', () => {
  const early = calc(), late = calc('2023-08-28', '23:30'), next = calc('2023-08-29', '00:00')
  assert.equal(late.ziwei.inputTimeIndex, 12); assert.equal(late.ziwei.effectiveTimeIndex, 0)
  assert.deepEqual(scope(early, 'daily'), scope(late, 'daily'))
  assert.deepEqual(scope(early, 'hourly'), scope(late, 'hourly'))
  assert.equal(late.bazi.observationPillars[2], '戊午'); assert.equal(late.bazi.observationPillars[3], '甲子')
  assert.equal(scope(late, 'hourly').ganZhi, '壬子')
  assert.equal(next.bazi.observationPillars[2], '己未'); assert.equal(scope(next, 'daily').ganZhi, '己未')
  assert.equal(scope(next, 'daily').palaceIndex, 4)
})

test('childhood and beyond-limit ages never fabricate a default Jia-Zi scope', () => {
  const newborn = calc('2000-08-16', '04:30')
  assert.equal(scope(newborn, 'decadal').label, '童限'); assert.equal(scope(newborn, 'decadal').status, 'ready')
  const old = calc('2099-12-31', '23:59', { ...birth, date: '1900-08-16' })
  for (const id of ['decadal', 'age']) {
    assert.equal(scope(old, id).status, 'unavailable'); assert.equal(scope(old, id).ganZhi, null)
    assert.deepEqual(scope(old, id).mutations, []); assert.equal(scope(old, id).palaceIndex, null)
  }
  assert.equal(scope(old, 'hourly').status, 'ready')
  assert.equal(old.bazi.yearEnd.slice(0, 4), '2100')
})

test('range begins at 1900 even when its solar year begins in 1899', () => {
  const result = calc('1900-01-01', '00:00', { ...birth, date: '1900-01-01', time: '00:00' })
  assert.equal(result.bazi.solarYear, 1899)
  assert.equal(result.ziwei.nominalAge, 1)
})

test('small-limit 120/121 boundary marks only unsupported layer unavailable', () => {
  const profile = { ...birth, date: '1900-08-16' }
  const inRange = calc('2019-08-16', '12:00', profile), out = calc('2020-08-16', '12:00', profile)
  assert.equal(inRange.ziwei.nominalAge, 120); assert.equal(scope(inRange, 'age').status, 'ready')
  assert.equal(out.ziwei.nominalAge, 121); assert.equal(scope(out, 'age').status, 'unavailable')
  assert.equal(scope(out, 'decadal').status, 'ready')
})

test('equivalent UTC instants keep the same facts while retaining the different raw inputs', () => {
  const a = calc(), b = calc('2023-08-27', '16:30', { ...birth, date: '2000-08-15', time: '20:30', utcOffset: 0 }, { utcOffset: 0 })
  assert.deepEqual(a.bazi, b.bazi); assert.deepEqual(a.ziwei, b.ziwei)
  assert.equal(a.observationTime.utcTime, b.observationTime.utcTime)
  assert.notDeepEqual(a.input, b.input)
})

test('IANA observations reject nonexistent/fold times and preserve the selected instant', () => {
  assert.throws(() => calc('2024-03-10', '02:30', birth, { timeZone: 'America/New_York' }), /不存在/)
  assert.throws(() => calc('2024-11-03', '01:30', birth, { timeZone: 'America/New_York' }), /两次/)
  const early = calc('2024-11-03', '01:30', birth, { timeZone: 'America/New_York', timeChoice: 'earlier' })
  const late = calc('2024-11-03', '01:30', birth, { timeZone: 'America/New_York', timeChoice: 'later' })
  assert.equal(early.observationTime.utcTime, '2024-11-03T05:30:00.000Z'); assert.equal(late.observationTime.utcTime, '2024-11-03T06:30:00.000Z')
  assert.equal(early.observationTime.resolvedUtcOffset, -4); assert.equal(late.observationTime.resolvedUtcOffset, -5)
  assert.equal(early.input.observation.utcOffset, -4); assert.equal(late.input.observation.utcOffset, -5)
})

for (const side of ['birth', 'observation']) test(`IANA ${side} ignores inactive manual offsets and archives the resolved offset`, () => {
  for (const offset of [NaN, Infinity, 100, 8]) {
    const data = input('2024-11-03', '01:30')
    data[side] = { ...data[side], date: '2024-11-03', time: '01:30', utcOffset: offset, timeZone: 'America/New_York', timeChoice: 'later' }
    if (side === 'birth') data.observation = { date: '2024-11-04', time: '12:00', utcOffset: 8 }
    const result = plain(api.calculateFlowStudy(data))
    assert.equal(result.input[side].utcOffset, -5)
    assert.equal(result[side + 'Time'].resolvedUtcOffset, -5)
    assert.equal(result[side + 'Time'].utcTime, '2024-11-03T06:30:00.000Z')
    for (const field of ['date', 'time', 'timeZone', 'timeChoice']) assert.equal(result.input[side][field], data[side][field])
    assert.ok(Object.is(data[side].utcOffset, offset), 'calculation must not mutate the form input')
    const repo = api.createFlowStudyRepository(storage())
    repo.save(result, '2026-10-03T12:00:00.000Z')
    assert.deepEqual(plain(repo.list()[0].snapshot), result)
    assert.deepEqual(JSON.parse(repo.exportJSON()).records[0].snapshot, result)
  }
})

test('historical IANA offsets with seconds remain exact in both snapshots', () => {
  const result = calc('1900-01-02', '12:00', { ...birth, date: '1900-01-01', time: '12:00', timeZone: 'Asia/Shanghai' }, { timeZone: 'Asia/Shanghai' })
  assert.equal(result.birthTime.utcTime, '1900-01-01T03:54:17.000Z')
  assert.equal(result.observationTime.utcTime, '1900-01-02T03:54:17.000Z')
  assert.equal(result.birthTime.beijingTime, '1900-01-01 11:54:17')
})

test('observation validation checks exact instant rather than only matching birth date', () => {
  assert.throws(() => calc('2000-08-16', '04:29'), /早于出生时刻/)
  assert.doesNotThrow(() => calc('2000-08-16', '04:30'))
  assert.throws(() => calc('2000-08-16', '10:00', birth, { utcOffset: 14 }), /早于出生时刻/)
  assert.doesNotThrow(() => calc('2099-12-31', '12:00'))
})

test('invalid input ranges, dates, times and timezones fail before saving', () => {
  for (const [date, time, extra] of [['2024-02-30', '12:00', {}], ['2024-2-01', '12:00', {}], ['2100-01-01', '12:00', {}], ['1899-12-31', '12:00', {}], ['2024-02-01', '24:00', {}], ['2024-02-01', '', {}], ['2024-02-01', '12:00', { utcOffset: 8.1 }], ['2099-12-31', '23:59', { utcOffset: -12 }], ['2024-02-01', '12:00', { timeZone: 'Not/AZone' }]]) assert.throws(() => calc(date, time, birth, extra))
  assert.throws(() => api.calculateFlowStudy({ ...input(), name: ' ' }), /名称/)
  assert.throws(() => api.calculateFlowStudy({ ...input(), note: 'x'.repeat(2001) }), /2000/)
})

test('global scalar settings, custom tables and language restore on successful and failed calculations', () => {
  api.language.changeLanguage('en-US')
  api.astro.config({ yearDivide: 'exact', horoscopeDivide: 'exact', dayDivide: 'forward', ageDivide: 'birthday', algorithm: 'zhongzhou', mutagens: { 甲: ['紫微', '天机', '太阳', '武曲'] }, brightness: { 紫微: Array(12).fill('庙') } })
  const before = plain(api.astro.getConfig()), language = api.language.language
  const result = calc()
  assert.equal(scope(result, 'yearly').ganZhi, '癸卯')
  assert.deepEqual(plain(api.astro.getConfig()), before); assert.equal(api.language.language, language)
  assert.throws(() => api.withFlowZiweiRules(() => { throw new Error('injected failure') }), /injected failure/)
  assert.deepEqual(plain(api.astro.getConfig()), before); assert.equal(api.language.language, language)
})

test('results are independent of device timezone', () => {
  const script = `${source}\nprocess.stdout.write(JSON.stringify(module.exports.calculateFlowStudy(${JSON.stringify(input())})));`
  const results = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map(TZ => {
    const child = spawnSync(process.execPath, ['-'], { input: script, encoding: 'utf8', cwd: root, env: { ...process.env, TZ }, maxBuffer: 8 * 1024 * 1024 })
    assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout)
  })
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[0], results[2])
})

function storage() { const map = new Map(); return { map, getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) } }

test('snapshots save, reopen and export original facts without recalculating', () => {
  const store = storage(), repo = api.createFlowStudyRepository(store), result = calc()
  const record = plain(repo.save(result, '2026-10-03T12:00:00.000Z'))
  result.input.name = 'external mutation'; result.ziwei.scopes[0].mutations[0].star = 'other'
  assert.equal(repo.list()[0].snapshot.input.name, '规则核对')
  const original = api.Solar.fromYmdHms
  api.Solar.fromYmdHms = () => { throw new Error('must not recalculate') }
  try { assert.deepEqual(plain(repo.list()[0]), record); assert.deepEqual(JSON.parse(repo.exportJSON()).records[0], record) } finally { api.Solar.fromYmdHms = original }
  const reopened = repo.list(); reopened[0].snapshot.input.note = 'changed'
  assert.equal(repo.list()[0].snapshot.input.note, '')
  repo.remove(record.id); assert.equal(repo.list().length, 0)
})

test('twenty full snapshots fit capacity and the twenty-first does not overwrite', () => {
  const store = storage(), repo = api.createFlowStudyRepository(store), result = api.calculateFlowStudy({ ...input(), name: '字'.repeat(40), note: '记'.repeat(2000) })
  for (let i = 0; i < 20; i++) repo.save(result, '2026-10-03T12:00:00.000Z')
  assert.equal(repo.list().length, 20); assert.equal(new Set(repo.list().map(r => r.id)).size, 20)
  const before = store.map.get(api.FLOW_STUDY_STORAGE_KEY)
  assert.throws(() => repo.save(result), /20/); assert.equal(store.map.get(api.FLOW_STUDY_STORAGE_KEY), before)
})

test('version corruption and inconsistent times/months/layers block read/save/delete/export and preserve bytes', () => {
  for (const mutate of [
    s => { s.ruleVersion = 'future-v2' }, s => { s.bazi.engine = 'future' }, s => { s.ziwei.config.dayDivide = 'forward' },
    s => { s.observationTime.utcTime = '2023-08-27T16:31:00.000Z' }, s => { s.bazi.months[0].end = s.bazi.months[1].end },
    s => { s.bazi.months[0].current = true }, s => { s.ziwei.scopes[5].mutations[0].natalIndex = 0 }, s => { s.ziwei.scopes[2].palaceIndex = 0 },
    s => { s.ziwei.scopes[6].palaceNames[3] = '兄弟' }, s => { s.sources[0].url = 'https://unknown.invalid' },
  ]) {
    const store = storage(), repo = api.createFlowStudyRepository(store), result = calc()
    repo.save(result, '2026-10-03T12:00:00.000Z')
    const data = JSON.parse(store.map.get(api.FLOW_STUDY_STORAGE_KEY)); mutate(data.records[0].snapshot)
    const corrupted = JSON.stringify(data); store.map.set(api.FLOW_STUDY_STORAGE_KEY, corrupted)
    for (const fn of [() => repo.list(), () => repo.save(result), () => repo.remove(data.records[0].id), () => repo.exportJSON()]) assert.throws(fn, /格式异常|不兼容/)
    assert.equal(store.map.get(api.FLOW_STUDY_STORAGE_KEY), corrupted)
  }
})

test('storage read failures, quota failures and unknown schema never claim a save', () => {
  const result = calc()
  assert.throws(() => api.createFlowStudyRepository({ getItem: () => { throw new Error('blocked') }, setItem() {} }).list(), /无法读取/)
  assert.throws(() => api.createFlowStudyRepository({ getItem: () => '', setItem() { throw new Error('quota') } }).save(result), /未确认成功/)
  const store = storage(); store.map.set(api.FLOW_STUDY_STORAGE_KEY, '{bad json')
  assert.throws(() => api.createFlowStudyRepository(store).save(result), /格式异常/)
  assert.equal(store.map.get(api.FLOW_STUDY_STORAGE_KEY), '{bad json')
})
