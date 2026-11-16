import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/domain/birth-input/date.ts', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} } })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const bounds = { max: '2026-10-03' }
const toSolar = (calendar, year, month, day, range = bounds) => api.birthDateToSolar(calendar, { year, month, day }, range)

test('Gregorian century/leap years and short months reject stale days instead of clamping', () => {
  assert.equal(api.getBirthDays('solar', 1900, 2).length, 28)
  assert.equal(api.getBirthDays('solar', 2000, 2).length, 29)
  assert.equal(api.getBirthDays('solar', 2024, 2).length, 29)
  assert.equal(toSolar('solar', 2024, 2, 29), '2024-02-29')
  for (const [year, month, day] of [[1900, 2, 29], [2023, 2, 29], [2024, 4, 31], [2024, 2, 30], [2024, 0, 1], [2024, 13, 1]]) {
    assert.throws(() => toSolar('solar', year, month, day))
  }
})

// Independent anchors transcribed from the Hong Kong Observatory date tables:
// https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2023.pdf
// https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2025.pdf
const officialAnchors = [
  { iso: '2023-01-22', lunar: { year: 2023, month: 1, day: 1 } },
  { iso: '2023-03-22', lunar: { year: 2023, month: -2, day: 1 } },
  { iso: '2023-04-19', lunar: { year: 2023, month: -2, day: 29 } },
  { iso: '2023-04-20', lunar: { year: 2023, month: 3, day: 1 } },
  { iso: '2025-01-29', lunar: { year: 2025, month: 1, day: 1 } },
  { iso: '2025-07-25', lunar: { year: 2025, month: -6, day: 1 } },
  { iso: '2025-08-22', lunar: { year: 2025, month: -6, day: 29 } },
  { iso: '2025-08-23', lunar: { year: 2025, month: 7, day: 1 } },
]

test('both directions match independent New Year and leap-month boundary dates', () => {
  for (const { iso, lunar } of officialAnchors) {
    assert.deepEqual(plain(api.solarToBirthDate(iso, 'lunar')), lunar, iso)
    assert.equal(api.birthDateToSolar('lunar', lunar, bounds), iso)
    assert.equal(api.birthDateToSolar('solar', api.solarToBirthDate(iso, 'solar'), bounds), iso)
  }
})

test('lunar choices distinguish leap months and exclude months from adjacent years', () => {
  const months2023 = plain(api.getBirthMonths('lunar', 2023))
  const months2025 = plain(api.getBirthMonths('lunar', 2025))
  assert.deepEqual(months2023.map(item => item.value), [1, 2, -2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  assert.deepEqual(months2025.map(item => item.value), [1, 2, 3, 4, 5, 6, -6, 7, 8, 9, 10, 11, 12])
  assert.equal(months2023.find(item => item.value === -2).label, '闰二月')
  assert.equal(months2025.find(item => item.value === -6).label, '闰六月')
  assert.equal(api.getBirthMonths('lunar', 2024).length, 12)
  assert.deepEqual(plain(api.getBirthDays('lunar', 2025, -6)).at(-1), { value: 29, label: '廿九' })
  assert.throws(() => toSolar('lunar', 2025, -6, 30))
  assert.throws(() => toSolar('lunar', 2024, -6, 1))
  assert.throws(() => toSolar('lunar', 2025, -2, 1))
  assert.equal(api.formatLunarBirthDate('2025-07-25'), '农历 2025年闰六月初一')
})

test('1900 minimum can be restored through lunar year 1899 without allowing earlier births', () => {
  // Cross-checked independently against the installed lunar-python calendar.
  assert.equal(api.MIN_BIRTH_DATE, '1900-01-01')
  assert.deepEqual(plain(api.solarToBirthDate('1900-01-01', 'lunar')), { year: 1899, month: 12, day: 1 })
  assert.equal(toSolar('lunar', 1899, 12, 1), '1900-01-01')
  assert.equal(toSolar('lunar', 1899, 12, 30), '1900-01-30')
  assert.equal(toSolar('lunar', 1900, 1, 1), '1900-01-31')
  assert.throws(() => toSolar('lunar', 1899, 11, 29), /不能早于/)
  assert.throws(() => api.solarToBirthDate('1899-12-31', 'solar'))
})

test('explicit birth-date bounds apply after lunar conversion and include both endpoints', () => {
  const range = { min: '2025-07-25', max: '2025-08-22' }
  assert.equal(toSolar('lunar', 2025, -6, 1, range), range.min)
  assert.equal(toSolar('lunar', 2025, -6, 29, range), range.max)
  assert.throws(() => toSolar('lunar', 2025, 6, 30, range), /不能早于/)
  assert.throws(() => toSolar('lunar', 2025, 7, 1, range), /不能晚于/)
  assert.equal(toSolar('solar', 2026, 10, 3), bounds.max)
  assert.throws(() => toSolar('solar', 2026, 10, 4), /不能晚于/)
  assert.throws(() => toSolar('solar', 2026, 10, 3, { max: '2026-02-30' }))
  assert.throws(() => toSolar('solar', 2026, 10, 3, { min: '2026-10-04', max: '2026-10-03' }))
})

test('incomplete, coerced, and malformed values never become a default birthday', () => {
  for (const parts of [{}, { year: 2000 }, { year: 2000, month: 1 }, { year: 2000, month: 1, day: null }, { year: '2000', month: 1, day: 1 }, { year: 2000, month: 1, day: 1.5 }]) {
    assert.throws(() => api.birthDateToSolar('solar', parts, bounds))
  }
  for (const iso of ['', '2000-1-01', '2000-01-1', '2000-01-01T00:00:00Z', '2000-02-30', '2025-04-31']) {
    assert.throws(() => api.solarToBirthDate(iso, 'lunar'))
  }
  assert.throws(() => api.birthDateToSolar('solar', { year: 2000, month: 1, day: 1 }, {}))
})

test('time selection preserves midnight, exact minutes, and missing values', () => {
  for (const [value, hour, minute] of [['00:00', 0, 0], ['00:07', 0, 7], ['09:05', 9, 5], ['23:59', 23, 59]]) {
    assert.deepEqual(plain(api.parseBirthTime(value)), { hour, minute })
    assert.equal(api.formatBirthTime(hour, minute), value)
  }
  for (const value of ['', '9:05', '09:5', '24:00', '12:60', '12:00:00', '子时', ' 00:00']) assert.equal(api.parseBirthTime(value), null)
  for (const parts of [[null, null], [0, undefined], [undefined, 0], [24, 0], [12, 60], [1.5, 0], ['0', 0]]) {
    assert.throws(() => api.formatBirthTime(...parts))
  }
})
