import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: "export * from './src/domain/metaphysics/time'; export * from './src/domain/metaphysics/timezone'; export * from './src/domain/metaphysics/archive'; export * from './src/domain/metaphysics/form'; export { calculateExploration } from './src/domain/metaphysics/index'",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
function load(overrides = {}) {
  const context = vm.createContext({ module: { exports: {} }, console, Date, Intl, setTimeout, clearTimeout, ...overrides })
  vm.runInContext(bundle.outputFiles[0].text, context)
  return context.module.exports
}
const api = load()
const plain = value => JSON.parse(JSON.stringify(value))
const profile = { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 }

// Fixed independent Python 3 zoneinfo / tzdata 2023.3 results, checked 2026-10-03.
// The implementation under test uses JavaScript Intl, not Python.
// IANA primary data also confirms the PRC DST rules, Shanghai LMT +08:05:43,
// Nepal +05:45, and US post-2007 rules:
// https://data.iana.org/time-zones/tzdb/asia
// https://data.iana.org/time-zones/tzdb/northamerica
// Reproduce: datetime.fromisoformat(wall).replace(tzinfo=ZoneInfo(zone), fold=n)
//           .astimezone(timezone.utc); round-trip UTC back to detect gaps.
const timeCases = [
  ['Shanghai 1988 summer time', '1988-07-01', '12:00', 'Asia/Shanghai', undefined, '1988-07-01T03:00:00.000Z', 9],
  ['Shanghai 1988 winter time', '1988-01-01', '12:00', 'Asia/Shanghai', undefined, '1988-01-01T04:00:00.000Z', 8],
  ['New York earlier repeated time', '2024-11-03', '01:30', 'America/New_York', 'earlier', '2024-11-03T05:30:00.000Z', -4],
  ['New York later repeated time', '2024-11-03', '01:30', 'America/New_York', 'later', '2024-11-03T06:30:00.000Z', -5],
  ['Kathmandu quarter-hour offset', '2000-01-01', '12:00', 'Asia/Kathmandu', undefined, '2000-01-01T06:15:00.000Z', 5.75],
  ['Shanghai historic seconds', '1900-06-01', '12:00', 'Asia/Shanghai', undefined, '1900-06-01T03:54:17.000Z', 8 + 343 / 3600],
  ['Lord Howe earlier half-hour fold', '2024-04-07', '01:45', 'Australia/Lord_Howe', 'earlier', '2024-04-06T14:45:00.000Z', 11],
  ['Lord Howe later half-hour fold', '2024-04-07', '01:45', 'Australia/Lord_Howe', 'later', '2024-04-06T15:15:00.000Z', 10.5],
]
for (const [description, date, time, timeZone, timeChoice, expectedInstant, expectedOffset] of timeCases) {
  test(`IANA conversion matches independent reference: ${description}`, () => {
    const result = api.normalizeBirth({ ...profile, date, time, timeZone, ...(timeChoice ? { timeChoice } : {}) })
    assert.equal(result.instant.toISOString(), expectedInstant)
    assert.ok(Math.abs(result.profile.utcOffset - expectedOffset) < 1e-12)
    assert.equal(result.profile.timeZone, timeZone)
    if (timeChoice) assert.equal(result.profile.timeChoice, timeChoice)
  })
}

test('historic second offset survives Beijing calendar conversion without minute rounding', () => {
  const result = api.normalizeBirth({ ...profile, date: '1900-06-01', time: '12:00', timeZone: 'Asia/Shanghai' })
  assert.equal(result.chinese.hour, 11)
  assert.equal(result.chinese.minute, 54)
  assert.equal(result.chinese.second, 17)
  assert.equal(result.chineseTime, '1900-06-01 11:54:17 UTC+08:00')
})

test('DST gaps and date-line skipped days never silently shift a birth time', () => {
  for (const timeChoice of [undefined, 'earlier', 'later']) {
    assert.throws(() => api.normalizeBirth({ ...profile, date: '2024-03-10', time: '02:30', timeZone: 'America/New_York', timeChoice }), /不存在/)
    assert.throws(() => api.normalizeBirth({ ...profile, date: '2011-12-30', time: '12:00', timeZone: 'Pacific/Apia', timeChoice }), /不存在/)
  }
})

test('repeated local times demand explicit choice instead of selecting a default', () => {
  assert.throws(() => api.normalizeBirth({ ...profile, date: '2024-11-03', time: '01:30', timeZone: 'America/New_York' }), /两次/)
  assert.throws(() => api.normalizeBirth({ ...profile, date: '2024-04-07', time: '01:45', timeZone: 'Australia/Lord_Howe' }), /两次/)
  assert.throws(() => api.normalizeBirth({ ...profile, timeChoice: 'compatible' }), /重复时刻/)
})

test('invalid IANA zones and invalid dates are rejected even when a manual offset is supplied', () => {
  for (const timeZone of ['Mars/Olympus', 'Asia/Shanghai invalid', '+08:00', 'A'.repeat(101)]) {
    assert.throws(() => api.normalizeBirth({ ...profile, timeZone }), /IANA|时区/)
  }
  for (const date of ['1900-02-29', '2023-02-29', '2024-04-31', '2024-13-01']) {
    assert.throws(() => api.normalizeBirth({ ...profile, date, timeZone: 'Asia/Shanghai' }), /有效日期/)
  }
  assert.throws(() => api.normalizeBirth({ ...profile, timePrecision: 'unknown' }), /时间精度/)
})

test('Intl-unavailable devices show a manual-offset fallback while manual conversion still works', () => {
  for (const intl of [undefined, {}, { DateTimeFormat: function () { return {} } }]) {
    const fallback = load({ Intl: intl })
    assert.throws(() => fallback.normalizeBirth({ ...profile, timeZone: 'Asia/Shanghai' }), /手动 UTC 偏移/)
    assert.equal(fallback.normalizeBirth(profile).instant.toISOString(), '2000-08-15T20:30:00.000Z')
  }
})

test('incomplete device timezone parts produce a readable fallback rather than a fabricated instant', () => {
  const broken = load({ Intl: { DateTimeFormat: function () { return { formatToParts: () => [] } } } })
  assert.throws(() => broken.normalizeBirth({ ...profile, timeZone: 'Asia/Shanghai' }), /设备时区数据不可用.*手动 UTC 偏移/)
})

test('normalization isolates nested place data from future edits to the input profile', () => {
  const source = { ...profile, place: { name: '原地点', latitude: 0, longitude: 0 } }
  const normalized = api.normalizeBirth(source)
  source.place.latitude = 50
  normalized.profile.place.name = '改名'
  assert.equal(normalized.profile.place.latitude, 0)
  assert.equal(source.place.name, '原地点')
})

test('observation dates allow birth day and supported future dates but reject invalid days and bounds', () => {
  for (const date of ['2000-08-16', '2024-02-29', '2099-12-31']) {
    assert.doesNotThrow(() => api.validateObservationDate(date, profile.date))
  }
  for (const date of ['', '2024-2-29', '2024-02-30', '2023-02-29', '2024-13-01', '2000-08-15', '2100-01-01']) {
    assert.throws(() => api.validateObservationDate(date, profile.date), /观察日期/)
  }
})

test('birth extras retain zero coordinates, trim names, and round-trip optional fields', () => {
  const extras = { ...api.emptyBirthExtras(), timeZone: ' Asia/Kathmandu ', timeChoice: 'later', timePrecision: 'approximate', placeEnabled: true, placeName: ' 原点 ', latitude: ' +0 ', longitude: ' -.0 ', observationDate: '2024-02-29' }
  const result = api.applyBirthExtras(profile, extras)
  assert.equal(result.timeZone, 'Asia/Kathmandu')
  assert.equal(result.timeChoice, 'later')
  assert.equal(result.timePrecision, 'approximate')
  assert.equal(result.place.latitude, 0)
  assert.equal(Math.abs(result.place.longitude), 0)
  assert.equal(result.place.name, '原点')
  const restored = api.extrasFromProfile(result, { observationDate: extras.observationDate })
  assert.equal(restored.observationDate, '2024-02-29')
  assert.equal(restored.placeEnabled, true)
  assert.equal(restored.timeZone, result.timeZone)
  assert.deepEqual(plain(api.applyBirthExtras(profile, restored)), plain(result))
  assert.deepEqual(profile, { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 })
})

test('clearing optional extras on an existing profile removes its previous zone, fold, and place', () => {
  const old = { ...profile, timeZone: 'America/New_York', timeChoice: 'later', place: { name: '旧地点', latitude: 40, longitude: -74 } }
  const result = api.applyBirthExtras(old, api.emptyBirthExtras())
  assert.equal(result.timeZone, undefined)
  assert.equal(result.timeChoice, undefined)
  assert.equal(result.place, undefined)
  assert.ok(old.place, 'editing produces a new profile without mutating the original')
})

test('choosing a custom zone requires a name instead of silently calculating with the manual offset', () => {
  for (const timeZone of ['', '   ']) {
    assert.throws(() => api.applyBirthExtras(profile, { ...api.emptyBirthExtras(), customTimeZone: true, timeZone }), /填写自定义 IANA 时区/)
  }
  const explicit = api.applyBirthExtras(profile, { ...api.emptyBirthExtras(), customTimeZone: true, timeZone: ' Australia/Lord_Howe ' })
  assert.equal(explicit.timeZone, 'Australia/Lord_Howe')
  assert.equal(api.applyBirthExtras(profile, api.emptyBirthExtras()).timeZone, undefined, 'an explicit manual selection still works')
})

test('restoring a saved profile replaces custom-entry selection state while preserving its timezone', () => {
  let extras = { ...api.emptyBirthExtras(), customTimeZone: true, timeZone: 'Custom/unfinished' }
  extras = api.extrasFromProfile({ ...profile, timeZone: 'Asia/Shanghai' })
  assert.equal(extras.customTimeZone, false)
  assert.equal(extras.timeZone, 'Asia/Shanghai')
  extras = api.extrasFromProfile(profile)
  assert.equal(extras.customTimeZone, false)
  assert.equal(extras.timeZone, '')
  assert.doesNotThrow(() => api.applyBirthExtras(profile, extras))
  const customSaved = api.extrasFromProfile({ ...profile, timeZone: 'Australia/Lord_Howe' })
  assert.equal(customSaved.customTimeZone, false)
  assert.equal(customSaved.timeZone, 'Australia/Lord_Howe', 'zones outside the picker list keep their stored IANA value')
  assert.equal(api.applyBirthExtras(profile, customSaved).timeZone, 'Australia/Lord_Howe')
})

test('enabled location input requires explicit decimal coordinates and range validation', () => {
  for (const [latitude, longitude] of [['', '0'], ['0', ' '], ['NaN', '0'], ['0x10', '0'], ['1e2', '0']]) {
    assert.throws(() => api.applyBirthExtras(profile, { ...api.emptyBirthExtras(), placeEnabled: true, latitude, longitude }), /经纬度/)
  }
  for (const [latitude, longitude] of [['91', '0'], ['0', '-181']]) {
    assert.throws(() => api.normalizeBirth(api.applyBirthExtras(profile, { ...api.emptyBirthExtras(), placeEnabled: true, latitude, longitude })), /纬度|经度/)
  }
})

function validResult() {
  return {
    schemaVersion: 1, profile: { ...profile, place: { name: '原点', latitude: 0, longitude: 0 } },
    utcTime: '2000-08-15T20:30:00.000Z', chineseTime: '2000-08-16 04:30 UTC+08:00',
    options: { observationDate: '2024-02-29' }, rulesVersion: '2.0.0', timeResolution: { mode: 'manual', utcOffset: 8 },
    charts: ['bazi', 'ziwei', 'western'].map(id => ({
      id, title: id, status: 'ready', summary: [{ label: '原值', value: '保留值' }], sections: [{ title: '原分节', facts: [{ label: '原事实', value: '原结果' }] }],
      conventions: ['规则'], limitations: ['限制'], source: { title: '引擎', url: 'https://example.com', version: 'test', license: 'MIT' },
    })),
    comparison: [{ theme: '主题', bazi: '八字', ziwei: '紫微', western: '星盘', note: '各自规则' }], notices: ['说明'],
  }
}

function memoryStore(initial) {
  let data = initial
  let writes = 0
  const keys = []
  return {
    get(key) { keys.push(['get', key]); return data },
    set(key, value) { keys.push(['set', key]); data = value; writes++ },
    get data() { return data }, get writes() { return writes }, get keys() { return keys },
  }
}
function archiveFor(storage, makeId) {
  let next = 0
  return api.createChartArchive(storage, () => new Date('2026-10-03T00:00:00Z'), makeId || (() => `chart-${++next}`))
}

test('a real calculation reloads as the same persisted snapshot, with rule and time metadata intact', async () => {
  const calculated = plain(await api.calculateExploration({ ...profile, timeZone: 'Asia/Shanghai', place: { latitude: 31.2304, longitude: 121.4737 } }))
  const storage = memoryStore()
  const saved = archiveFor(storage).save(' 我的三盘 ', calculated)
  assert.equal(saved.name, '我的三盘')
  const persistedJson = JSON.stringify(storage.data)
  const readOnly = { get: () => persistedJson, set() { assert.fail('reading a snapshot must not write storage') } }
  const restored = archiveFor(readOnly).list()
  assert.equal(restored.length, 1)
  assert.deepEqual(plain(restored[0]), plain(saved))
  assert.deepEqual(plain(restored[0].result), calculated)
  assert.equal(restored[0].result.timeResolution.mode, 'iana')
  assert.equal(restored[0].result.rulesVersion, calculated.rulesVersion)
  assert.ok(storage.keys.every(([, key]) => key === api.CHART_ARCHIVE_KEY))
})

test('archive input, saved return values, and list results cannot alias persisted nested data', () => {
  const storage = memoryStore()
  const archive = archiveFor(storage)
  const result = validResult()
  const saved = archive.save('一号', result)
  result.profile.place.name = '修改入参'
  result.charts[0].summary[0].value = '修改事实'
  saved.result.charts[1].sections[0].facts[0].value = '修改返回'
  saved.name = '修改名称'
  const listed = archive.list()
  listed[0].result.charts[2].conventions.push('修改列表')
  listed.pop()
  const actual = archive.list()[0]
  assert.equal(actual.name, '一号')
  assert.equal(actual.result.profile.place.name, '原点')
  assert.equal(actual.result.charts[0].summary[0].value, '保留值')
  assert.equal(actual.result.charts[1].sections[0].facts[0].value, '原结果')
  assert.equal(actual.result.charts[2].conventions.length, 1)
})

test('storage read and write errors are surfaced without reporting a successful save or delete', () => {
  let writes = 0
  const unreadable = archiveFor({ get() { throw new Error('blocked') }, set() { writes++ } })
  assert.throws(() => unreadable.list(), /无法读取/)
  assert.throws(() => unreadable.save('样例', validResult()), /无法读取/)
  assert.throws(() => unreadable.remove('any'), /无法读取/)
  assert.equal(writes, 0)
  const storage = memoryStore()
  const original = archiveFor(storage).save('原档案', validResult())
  const before = JSON.stringify(storage.data)
  const unwritable = archiveFor({ get: key => storage.get(key), set() { throw new Error('quota') } }, () => 'new-id')
  assert.throws(() => unwritable.save('新档案', validResult()), /保存失败/)
  assert.throws(() => unwritable.remove(original.id), /保存失败/)
  assert.equal(JSON.stringify(storage.data), before)
})

test('corrupt persisted envelopes stop all writes and preserve their exact original data', () => {
  const record = { id: 'old', name: '旧档案', savedAt: '2026-10-03T00:00:00Z', result: validResult() }
  const malformed = [
    '{not-json', [], { version: 2, records: [] }, { version: 1, records: 'invalid' },
    { version: 1, records: [record, record] },
    { version: 1, records: [{ ...record, result: { ...validResult(), charts: [] } }] },
    { version: 1, records: [{ ...record, result: { ...validResult(), profile: { ...profile, date: 'not-a-date' } } }] },
    { version: 1, records: [{ ...record, result: { ...validResult(), profile: { ...profile, gender: 'invalid' } } }] },
  ]
  for (const bad of malformed) {
    const storage = memoryStore(bad)
    const archive = archiveFor(storage)
    const before = JSON.stringify(bad)
    assert.throws(() => archive.list(), /无法读取|格式异常/, `invalid data was accepted: ${before}`)
    assert.throws(() => archive.save('新记录', validResult()), /无法读取|格式异常/)
    assert.throws(() => archive.remove('old'), /无法读取|格式异常/)
    assert.equal(storage.writes, 0)
    assert.equal(JSON.stringify(storage.data), before)
  }
})

test('the 30-record limit rejects new saves without evicting any existing snapshot', () => {
  const storage = memoryStore()
  const archive = archiveFor(storage)
  for (let index = 0; index < 30; index++) archive.save(`档案 ${index}`, validResult())
  const before = JSON.stringify(storage.data)
  assert.equal(archive.list().length, 30)
  assert.throws(() => archive.save('第 31 份', validResult()), /30/)
  assert.equal(storage.writes, 30)
  assert.equal(JSON.stringify(storage.data), before)
})

test('deleting a record removes only its ID and leaves each remaining snapshot intact', () => {
  const storage = memoryStore()
  const archive = archiveFor(storage)
  const first = archive.save('同名', validResult())
  const second = archive.save('同名', validResult())
  const third = archive.save('另一份', validResult())
  const remaining = archive.remove(second.id)
  assert.deepEqual(plain(remaining), plain([third, first]))
  remaining[0].result.profile.place.name = '修改返回'
  assert.equal(archive.list()[0].result.profile.place.name, '原点')
  const unchanged = archive.remove('nonexistent-id')
  assert.deepEqual(plain(unchanged), plain([third, first]))
})

test('duplicate IDs and all-failed results do not overwrite existing archives', () => {
  const storage = memoryStore()
  const archive = archiveFor(storage, () => 'same-id')
  archive.save('第一份', validResult())
  const before = JSON.stringify(storage.data)
  assert.throws(() => archive.save('第二份', validResult()), /编号冲突/)
  const failed = validResult()
  for (const chart of failed.charts) chart.status = 'error'
  assert.throws(() => archive.save('失败结果', failed), /至少一个/)
  assert.equal(JSON.stringify(storage.data), before)
})

test('export includes a detached chart snapshot and metadata without reading unrelated tokens', () => {
  const isolated = load({
    localStorage: { getItem() { assert.fail('chart export must not read browser credentials') } },
    uni: { getStorageSync() { assert.fail('chart export must not read application credentials') } },
    token: 'unrelated-auth-token', accessToken: 'unrelated-access-token',
  })
  const result = validResult()
  const exported = isolated.chartExport(result, '导出样例', '2026-10-03T00:00:00Z')
  assert.equal(exported.format, 'xiaoyi-chart')
  assert.equal(exported.formatVersion, 1)
  assert.equal(exported.name, '导出样例')
  assert.equal(exported.savedAt, '2026-10-03T00:00:00Z')
  assert.ok(Number.isFinite(Date.parse(exported.exportedAt)))
  assert.deepEqual(plain(exported.result), result)
  assert.doesNotMatch(JSON.stringify(exported), /unrelated-auth-token|unrelated-access-token|"token"|"accessToken"/)
  exported.result.charts[0].summary[0].value = '改导出'
  assert.equal(result.charts[0].summary[0].value, '保留值')
  assert.throws(() => isolated.chartExport({}), /有效排盘/)
})
