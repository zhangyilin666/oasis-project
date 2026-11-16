import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { build } from 'esbuild'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const bundle = await build({
  stdin: { contents: "export { calculateZiwei } from './src/domain/metaphysics/ziwei'; export { normalizeBirth } from './src/domain/metaphysics/time'; export { astro } from 'iztro'", resolveDir: projectRoot, loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const source = bundle.outputFiles[0].text
const context = vm.createContext({ module: { exports: {} }, console })
vm.runInContext(source, context)
const api = context.module.exports
const example = { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 }
const calculate = (observationDate, profile = example) => JSON.parse(JSON.stringify(api.calculateZiwei(api.normalizeBirth(profile), { observationDate })))
const section = (chart, title) => {
  const found = chart.sections.find(item => item.title === title)
  assert.ok(found, `missing ${title}`)
  return found
}
const fact = (chart, title, label) => {
  const found = section(chart, title).facts.find(item => item.label === label)
  assert.ok(found, `missing ${title}/${label}`)
  return found.value
}
const mutations = (chart, title) => section(chart, title).facts.filter(item => /^化[禄权科忌]$/.test(item.label)).map(item => item.value.split(' · ')[0])

test('observation is optional and leaves the original thirteen natal sections intact', () => {
  const natal = calculate(undefined)
  const withFlow = calculate('2023-08-28')
  assert.equal(natal.sections.length, 13)
  assert.equal(withFlow.sections.length, 18)
  assert.deepEqual(withFlow.sections.slice(0, 13), natal.sections)
  assert.deepEqual(withFlow.summary, natal.summary)
  assert.deepEqual(calculate('2023-08-28'), withFlow)
})

test('cycles match the fixed published iztro quick-start example for 2023-08-28', () => {
  // Published reference, not a second invocation of the engine under test:
  // https://docs.iztro.com/quick-start, accessed 2026-10-03.
  // This checks integration with the stated convention, not scientific validity.
  const chart = calculate('2023-08-28')
  assert.equal(fact(chart, '运限概览', '观察农历'), '二〇二三年七月十三')
  assert.equal(fact(chart, '运限概览', '虚岁'), '24岁')
  assert.equal(fact(chart, '当前大限', '命宫落宫'), '辰 · 本命夫妻宫')
  assert.equal(fact(chart, '当前大限', '运限干支'), '庚辰')
  assert.deepEqual(mutations(chart, '当前大限'), ['太阳', '武曲', '太阴', '天同'])
  assert.equal(fact(chart, '流年', '命宫落宫'), '卯 · 本命子女宫')
  assert.equal(fact(chart, '流年', '运限干支'), '癸卯')
  assert.deepEqual(mutations(chart, '流年'), ['破军', '巨门', '太阴', '贪狼'])
  assert.equal(fact(chart, '流年', '命宫流曜'), '流魁、流昌')
  assert.equal(fact(chart, '流月', '命宫落宫'), '巳 · 本命兄弟宫')
  assert.equal(fact(chart, '流月', '运限干支'), '庚申')
  assert.deepEqual(mutations(chart, '流月'), ['太阳', '武曲', '太阴', '天同'])
})

test('timeline starts at the wood-three age, runs backward for a yang-year woman, and marks the current decade', () => {
  // Hand-derived from the published natal example: 庚辰 female, 命宫午,
  // 木三局 => ages 3-12 at 午, 13-22 at 巳, 23-32 at 辰.
  const chart = calculate('2023-08-28')
  const rows = section(chart, '大限时间轴').facts
  assert.equal(rows.length, 12)
  assert.deepEqual(rows.slice(0, 3), [
    { label: '3–12岁', value: '午 · 本命命宫 · 壬午 · 农历 2002–2011年' },
    { label: '13–22岁', value: '巳 · 本命兄弟宫 · 辛巳 · 农历 2012–2021年' },
    { label: '23–32岁 · 当前', value: '辰 · 本命夫妻宫 · 庚辰 · 农历 2022–2031年' },
  ])
  assert.match(fact(chart, '运限概览', '大限顺逆'), /^逆行/)
  assert.match(section(chart, '当前大限').caption, /23–32岁.*2022–2031/)
})

test('all four year-polarity and gender combinations follow the documented decade direction', () => {
  // 庚(2000)=阳, 辛(2001)=阴. Rule: 阳男阴女顺；阴男阳女逆.
  for (const [date, gender, expected] of [
    ['2000-08-16', '男', '顺行'], ['2000-08-16', '女', '逆行'],
    ['2001-08-16', '男', '逆行'], ['2001-08-16', '女', '顺行'],
  ]) {
    const chart = calculate('2024-02-10', { ...example, date, gender })
    assert.ok(fact(chart, '运限概览', '大限顺逆').startsWith(expected))
    const branches = section(chart, '大限时间轴').facts.slice(0, 2).map(item => '子丑寅卯辰巳午未申酉戌亥'.indexOf(item.value[0]))
    assert.equal((branches[1] - branches[0] + 12) % 12, expected === '顺行' ? 1 : 11)
  }
})

test('yearly cycle and nominal age switch at Spring Festival, not at Li Chun', () => {
  // Independent calendar anchor: HKO 2024 calendar, Feb 4 Li Chun,
  // Feb 10 lunar 正月初一. https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2024e.pdf
  for (const date of ['2024-02-03', '2024-02-05', '2024-02-09']) {
    const chart = calculate(date)
    assert.equal(fact(chart, '流年', '运限干支'), '癸卯')
    assert.equal(fact(chart, '运限概览', '虚岁'), '24岁')
  }
  const newYear = calculate('2024-02-10')
  assert.equal(fact(newYear, '流年', '运限干支'), '甲辰')
  assert.equal(fact(newYear, '流年', '命宫落宫'), '辰 · 本命夫妻宫')
  assert.equal(fact(newYear, '运限概览', '虚岁'), '25岁')
  assert.equal(fact(newYear, '流月', '运限干支'), '丙寅')
})

test('leap-month day fifteen and sixteen change the monthly palace and stems together', () => {
  // HKO 2023 calendar: Apr 5 = 闰二月十五, Apr 6 = 闰二月十六.
  // Manual monthly indices (寅=0): 癸卯 index 1 - birth month 7
  // + birth 寅-hour index 2 + effective month 2/3 => 10/11 => 子/丑.
  // 癸-year 五虎遁 gives 乙卯 month 2, 丙辰 month 3.
  const before = calculate('2023-04-05')
  const after = calculate('2023-04-06')
  assert.equal(fact(before, '运限概览', '观察农历'), '二〇二三年闰二月十五')
  assert.equal(fact(after, '运限概览', '观察农历'), '二〇二三年闰二月十六')
  assert.equal(fact(before, '流月', '命宫落宫'), '子 · 本命迁移宫')
  assert.equal(fact(after, '流月', '命宫落宫'), '丑 · 本命疾厄宫')
  assert.equal(fact(before, '流月', '运限干支'), '乙卯')
  assert.equal(fact(after, '流月', '运限干支'), '丙辰')
})

test('birth in the second half of a leap month is included in the monthly palace calculation', () => {
  // Using the same HKO dates as births at 寅 hour: target 2024 正月,
  // index 2 - effective birth month 2/3 + hour 2 + target month 1
  // => index 3/2 => 巳/辰. Fixed arithmetic, not engine-derived fixtures.
  const first = calculate('2024-02-10', { ...example, date: '2023-04-05' })
  const second = calculate('2024-02-10', { ...example, date: '2023-04-06' })
  assert.match(fact(first, '流月', '命宫落宫'), /^巳 /)
  assert.match(fact(second, '流月', '命宫落宫'), /^辰 /)
})

test('childhood is labeled explicitly and first decade starts at the configured nominal age', () => {
  const newborn = calculate('2000-08-16', { ...example, time: '16:30' })
  assert.match(fact(newborn, '运限概览', '观察日期'), /^2000-08-16 12:00/)
  assert.equal(fact(newborn, '运限概览', '虚岁'), '1岁')
  assert.ok(section(newborn, '当前童限'))
  assert.equal(newborn.sections.some(item => item.title === '当前大限'), false)
  const firstDecade = calculate('2003-01-01')
  assert.equal(fact(firstDecade, '运限概览', '虚岁'), '3岁')
  assert.match(section(firstDecade, '当前大限').caption, /^3–12岁/)
})

test('dates beyond the twelve decades do not fabricate a current decade', () => {
  const chart = calculate('2099-12-31', { ...example, date: '1900-08-16' })
  assert.match(fact(chart, '当前大限', '计算范围'), /超出本命盘十二大限/)
  assert.equal(section(chart, '当前大限').facts.some(item => item.label === '化禄'), false)
  assert.ok(section(chart, '流年'))
})

for (const observationDate of ['', '2024-2-10', '2024-02-30', '1899-12-31', '2100-01-01', '2000-08-15']) {
  test(`invalid or pre-birth observation date is rejected: ${JSON.stringify(observationDate)}`, () => {
    assert.throws(() => calculate(observationDate), /观察日期/)
  })
}

test('adapter resets external scalar conventions before selecting cycles', () => {
  api.astro.config({ yearDivide: 'exact', horoscopeDivide: 'exact', ageDivide: 'birthday', dayDivide: 'forward' })
  const chart = calculate('2024-02-05')
  assert.equal(fact(chart, '流年', '运限干支'), '癸卯')
  assert.equal(fact(chart, '运限概览', '虚岁'), '24岁')
})

test('observation results are identical across device timezones and equivalent birth offsets', () => {
  const script = `${source}\nconst p=${JSON.stringify(example)}; const o={observationDate:'2023-04-06'}; const result=module.exports.calculateZiwei(module.exports.normalizeBirth(p),o); process.stdout.write(JSON.stringify({offset:new Date('2000-01-01T12:00:00Z').getTimezoneOffset(),result}));`
  const outputs = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map(TZ => {
    const child = spawnSync(process.execPath, ['-'], { input: script, encoding: 'utf8', cwd: projectRoot, env: { ...process.env, TZ }, maxBuffer: 8 * 1024 * 1024 })
    assert.equal(child.status, 0, child.stderr)
    return JSON.parse(child.stdout)
  })
  assert.deepEqual(outputs.map(item => item.offset), [0, 480, -540])
  for (const item of outputs.slice(1)) assert.deepEqual(item.result, outputs[0].result)
  assert.deepEqual(calculate('2023-04-06', { ...example, date: '2000-08-15', time: '20:30', utcOffset: 0 }), outputs[0].result)
})
