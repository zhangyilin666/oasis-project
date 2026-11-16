import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  stdin: { contents: "export {calculateBazi} from './src/domain/metaphysics/bazi'; export {calculateZiwei} from './src/domain/metaphysics/ziwei'; export {normalizeBirth} from './src/domain/metaphysics/time'; export {astro} from 'iztro'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
function load() {
  const context = vm.createContext({ module: { exports: {} }, console })
  vm.runInContext(bundle.outputFiles[0].text, context)
  return context.module.exports
}
const api = load()
const plain = value => JSON.parse(JSON.stringify(value))
const profile = { date: '2000-08-16', time: '23:30', gender: '女', utcOffset: 8 }
const calculate = (system, changes = {}, options = { compareRules: true }, instance = api) => plain(instance[system](instance.normalizeBirth({ ...profile, ...changes }), options))
const section = (chart, title) => {
  const found = chart.sections.find(item => item.title === `规则对照 · ${title}`)
  assert.ok(found, `missing comparison ${title}`)
  return found
}
const fact = (chart, title, label) => {
  const found = section(chart, title).facts.find(item => item.label === label)
  assert.ok(found, `missing ${title}/${label}`)
  return found.value
}
const baseConfig = { mutagens: {}, brightness: {}, yearDivide: 'normal', ageDivide: 'normal', dayDivide: 'current', horoscopeDivide: 'normal', algorithm: 'default' }

for (const [system, count] of [['calculateBazi', 6], ['calculateZiwei', 13]]) {
  test(`${system}: comparisons are opt-in and keep all main facts unchanged`, () => {
    const main = calculate(system, {}, {})
    assert.equal(main.sections.length, count)
    assert.equal(main.ruleProfile, undefined)
    assert.deepEqual(calculate(system, {}, { compareRules: false }), main)
    const compared = calculate(system)
    assert.deepEqual(compared.summary, main.summary)
    assert.deepEqual(compared.sections.slice(0, count), main.sections)
    assert.equal(compared.sections.length, count + 3)
    assert.equal(compared.ruleProfile.comparisonIds.length, 2)
    assert.deepEqual(calculate(system, {}, {}), main)
  })
}

test('Bazi late-Zi comparison matches fixed lunar-python 1.4.8 references for both independent parameters', () => {
  // Generated with Python, not the TypeScript engine under test, 2026-10-03.
  // Shared upstream lineage means cross-language agreement, not independent tradition certification.
  // Solar.fromYmdHms(2000,8,16,23,30,0).getLunar().getEightChar(); setSect(day); getYun(0,yun).
  const chart = calculate('calculateBazi')
  for (const [title, pillars, gods, start, interval] of [
    ['主盘口径', '庚辰 甲申 丙午 庚子', '偏财／偏印／日主／偏财', '2003-09-26 23:30:00', '3年 1月 10日 0时'],
    ['晚子日柱归次日', '庚辰 甲申 丁未 庚子', '正财／正印／日主／正财', '2003-09-26 23:30:00', '3年 1月 10日 0时'],
    ['起运按分钟折算', '庚辰 甲申 丙午 庚子', '偏财／偏印／日主／偏财', '2003-10-09 07:30:00', '3年 1月 22日 8时'],
  ]) {
    assert.equal(fact(chart, title, '四柱'), pillars)
    assert.equal(fact(chart, title, '天干十神（年／月／日／时）'), gods)
    assert.equal(fact(chart, title, '起运日期'), `${start} · 北京时间 UTC+08:00`)
    assert.equal(fact(chart, title, '起运间隔'), interval)
    assert.equal(fact(chart, title, '大运方向'), '逆行')
  }
  assert.match(fact(chart, '晚子日柱归次日', '与主盘所列字段差异'), /日主：丙 → 丁/)
  assert.match(fact(chart, '起运按分钟折算', '与主盘所列字段差异'), /起运日期/)
})

test('Bazi forward-start fixture differs by minutes without changing the day convention outside late Zi', () => {
  // Fixed lunar-python 1.4.8 output for a yin-year female, 1990-01-01 12:00.
  const chart = calculate('calculateBazi', { date: '1990-01-01', time: '12:00' })
  assert.equal(fact(chart, '主盘口径', '四柱'), '己巳 丙子 丙寅 甲午')
  assert.equal(fact(chart, '主盘口径', '大运方向'), '顺行')
  assert.match(fact(chart, '主盘口径', '起运日期'), /^1991-06-21 12:00:00/)
  assert.match(fact(chart, '起运按分钟折算', '起运日期'), /^1991-06-24 06:00:00/)
  assert.match(fact(chart, '晚子日柱归次日', '与主盘所列字段差异'), /未见差异/)
})

test('Bazi comparison obeys the 23:00 day boundary without shifting midnight twice', () => {
  for (const [date, time, main, alternative] of [
    ['2000-08-16', '22:59', '丙', '丙'], ['2000-08-16', '23:00', '丙', '丁'],
    ['2000-08-17', '00:00', '丁', '丁'],
  ]) {
    const chart = calculate('calculateBazi', { date, time })
    assert.equal(fact(chart, '主盘口径', '日主'), main)
    assert.equal(fact(chart, '晚子日柱归次日', '日主'), alternative)
  }
})

test('Bazi previews keep the exact Li Chun instant for year/month even when only the day or Yun rule changes', () => {
  // Fixed Python fixtures straddle 2024 Li Chun, HKO published UTC+08 16:27 minute.
  // https://www.hko.gov.hk/tc/gts/astron2024/files/HKO_almanac_2024.pdf (24 solar terms).
  for (const [time, expected] of [['16:26', '癸卯 乙丑 戊戌 庚申'], ['16:28', '甲辰 丙寅 戊戌 庚申']]) {
    const chart = calculate('calculateBazi', { date: '2024-02-04', time })
    for (const title of ['主盘口径', '晚子日柱归次日', '起运按分钟折算']) assert.equal(fact(chart, title, '四柱'), expected)
  }
})

test('Ziwei year comparison matches HKO calendar anchors and hand-derived palace/bureau rules', () => {
  // HKO: 2024-02-05 = 癸卯年腊月廿六; Li Chun Feb 4, New Year Feb 10.
  // https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2024e.pdf
  // At 子 hour, month 12 => 命身丑. 五虎遁: 癸年丑=乙丑, 甲年丑=丁丑.
  // 乙丑纳音金 => 金四局; 丁丑纳音水 => 水二局. Rules: https://docs.iztro.com/learn/setup
  const chart = calculate('calculateZiwei', { date: '2024-02-05', time: '00:30' })
  assert.equal(fact(chart, '主盘口径', '农历日期（引擎原值）'), '二〇二三年腊月廿六')
  assert.match(fact(chart, '主盘口径', '干支日期（引擎原值）'), /^癸卯 /)
  assert.match(fact(chart, '立春日年界', '干支日期（引擎原值）'), /^甲辰 /)
  assert.match(fact(chart, '主盘口径', '命宫'), /^乙丑 /)
  assert.match(fact(chart, '立春日年界', '命宫'), /^丁丑 /)
  assert.equal(fact(chart, '主盘口径', '五行局'), '金四局')
  assert.equal(fact(chart, '立春日年界', '五行局'), '水二局')
  for (const name of ['破军', '巨门', '太阴', '贪狼']) assert.ok(fact(chart, '主盘口径', '生年四化').includes(name))
  for (const name of ['廉贞', '破军', '武曲', '太阳']) assert.ok(fact(chart, '立春日年界', '生年四化').includes(name))
})

test('Ziwei exact means the Li Chun date in lunar-lite, not the astronomical instant', () => {
  for (const [date, time, normal, exact] of [
    ['2024-02-03', '20:30', '癸卯', '癸卯'], ['2024-02-04', '00:30', '癸卯', '甲辰'],
    ['2024-02-04', '20:30', '癸卯', '甲辰'], ['2024-02-10', '00:30', '甲辰', '甲辰'],
  ]) {
    const chart = calculate('calculateZiwei', { date, time })
    assert.equal(fact(chart, '主盘口径', '干支日期（引擎原值）').slice(0, 2), normal)
    assert.equal(fact(chart, '立春日年界', '干支日期（引擎原值）').slice(0, 2), exact)
    assert.match(fact(chart, '立春日年界', '年界说明'), /不是立春交节瞬间/)
  }
})

test('Ziwei late-Zi preview changes the effective day while retaining input calendar text', () => {
  // HKO 2000 calendar: Aug 16 = lunar 7/17. At 子 hour 命宫申, 庚年甲申=水二局.
  // Manual 紫微: day17, add1 /2=9, odd add goes back1 => 酉; day18 /2=9 => 戌.
  // https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2000e.pdf; https://docs.iztro.com/learn/setup
  const chart = calculate('calculateZiwei')
  assert.equal(fact(chart, '主盘口径', '农历日期（引擎原值）'), '二〇〇〇年七月十七')
  assert.equal(fact(chart, '晚子归次日', '农历日期（引擎原值）'), '二〇〇〇年七月十七')
  assert.equal(fact(chart, '主盘口径', '五行局'), '水二局')
  assert.match(fact(chart, '主盘口径', '紫微星落宫'), /^酉 /)
  assert.match(fact(chart, '晚子归次日', '紫微星落宫'), /^戌 /)
  assert.match(fact(chart, '晚子归次日', '与主盘所列字段差异'), /紫微星落宫/)
  assert.match(section(chart, '晚子归次日').caption, /未完成各方案全盘独立验收/)
})

test('Ziwei forward preview exposes its lunar-month edge behavior instead of claiming a full civil-day shift', () => {
  // HKO 2023: Apr 5/6 are leap month 2 days 15/16. At 子 hour, month2=>卯, month3=>辰.
  // https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2023e.pdf
  const before = calculate('calculateZiwei', { date: '2023-04-05' })
  const after = calculate('calculateZiwei', { date: '2023-04-06' })
  assert.match(fact(before, '主盘口径', '命宫'), /^乙卯 /)
  assert.match(fact(after, '主盘口径', '命宫'), /^丙辰 /)
  assert.match(fact(after, '晚子归次日', '命宫'), /^乙卯 /)
  assert.match(fact(after, '晚子归次日', '闰月处理'), /不作后半月进月/)
  const newYearEve = calculate('calculateZiwei', { date: '2024-02-09' })
  assert.equal(fact(newYearEve, '晚子归次日', '农历日期（引擎原值）'), '二〇二三年腊月三十')
  assert.match(fact(newYearEve, '晚子归次日', '干支日期（引擎原值）'), /^癸卯 /)
  assert.match(fact(newYearEve, '晚子归次日', '日界说明'), /并非把公历整体加一天/)
})

test('alternating Ziwei comparisons and observations never changes the main chart or leaves global settings', () => {
  const options = { observationDate: '2024-02-05' }
  const main = calculate('calculateZiwei', {}, options)
  for (const changes of [{}, { date: '2024-02-05', time: '00:30' }, { date: '2023-04-06', time: '23:30' }]) {
    calculate('calculateZiwei', changes, { compareRules: true, observationDate: '2026-10-03' })
    assert.deepEqual(plain(api.astro.getConfig()), baseConfig)
    assert.deepEqual(calculate('calculateZiwei', {}, options), main)
  }
  const compared = calculate('calculateZiwei', {}, { ...options, compareRules: true })
  assert.deepEqual(compared.sections.slice(0, main.sections.length), main.sections)
})

test('undeclared Ziwei tables are rejected and cleared so the next call can recover', () => {
  const isolated = load()
  const main = calculate('calculateZiwei', {}, {}, isolated)
  isolated.astro.config({ mutagens: { 庚: ['天同', '武曲', '太阳', '太阴'] }, brightness: { 贪狼: Array(12).fill('旺') }, yearDivide: 'exact', dayDivide: 'forward' })
  assert.throws(() => calculate('calculateZiwei', {}, { compareRules: true }, isolated), /未声明/)
  assert.deepEqual(plain(isolated.astro.getConfig()), baseConfig)
  assert.deepEqual(calculate('calculateZiwei', {}, {}, isolated), main)
})

test('an exception during a comparison clears mutable Ziwei tables and restores main parameters', () => {
  const isolated = load()
  let calls = 0
  isolated.astro.loadPlugin(function () {
    if (++calls === 3) {
      isolated.astro.config({ mutagens: { 庚: ['天同', '武曲', '太阳', '太阴'] }, dayDivide: 'forward' })
      throw new Error('comparison fixture interruption')
    }
  })
  assert.throws(() => calculate('calculateZiwei', {}, { compareRules: true }, isolated), /fixture interruption/)
  assert.deepEqual(plain(isolated.astro.getConfig()), baseConfig)
  assert.equal(calculate('calculateZiwei', {}, {}, isolated).sections.length, 13)
})
