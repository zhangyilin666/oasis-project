import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({ stdin: { contents: "export * from './src/domain/bazhai'; export { emptySpaceFacts } from './src/domain/space'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs' })
const context = vm.createContext({ module: { exports: {} }, Date, console })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const fixture = JSON.parse(await readFile(new URL('./fixtures/bazhai-reference.json', import.meta.url), 'utf8'))
const plain = value => JSON.parse(JSON.stringify(value))
const input = (change = {}, facts = {}) => ({ facts: { ...api.emptySpaceFacts(), name: '合成空间', bearingDegrees: 0, northReference: 'true', directionTarget: '已确认坐山轴线', measurementTool: '示例测绘资料', measurementBasis: '合成参考：资料已换算真北，记录原依据。', measuredAt: '2026-10-03', ...facts }, bearingRole: 'sitting', uncertaintyDegrees: 1, ...change })
const memory = () => { const data = new Map(); return { data, getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) } }

test('all 64 palace names agree with independently transcribed Yangzhai Shishu chants', () => {
  const names = { 生: '生气', 天: '天医', 延: '延年', 绝: '绝命', 祸: '祸害', 五: '五鬼', 六: '六煞' }
  for (const chant of fixture.chants) {
    const chars = [...chant], index = fixture.clockwise.indexOf(chars[0]), sectors = api.bazhaiForTrigram(chars[0])
    assert.equal(sectors.find(sector => sector.trigram === chars[0]).star, '伏位')
    chars.slice(1).forEach((short, offset) => {
      const target = fixture.clockwise[(index + offset + 1) % 8]
      assert.equal(sectors.find(sector => sector.trigram === target).star, names[short], `${chars[0]}至${target}`)
    })
    assert.equal(new Set(sectors.map(sector => sector.star)).size, 8)
  }
})
test('Xieji line changes and historical star aliases remain explicit', () => {
  const qian = api.bazhaiForTrigram('乾')
  const expected = [['兑', [3], '贪狼'], ['震', [2,3], '廉贞'], ['坤', [1,2,3], '武曲'], ['坎', [1,3], '文曲'], ['巽', [1], '禄存'], ['艮', [1,2], '巨门'], ['离', [2], '破军'], ['乾', [], '辅弼']]
  for (const [name, lines, star] of expected) {
    const sector = qian.find(item => item.trigram === name)
    assert.deepEqual(plain(sector.changedLines), lines); assert.equal(sector.traditionalStar, star)
  }
  assert.throws(() => api.bazhaiForTrigram('中'))
  assert.match(api.calculateBazhai(input()).sources[1].rights, /天乙.*天医/)
})
test('all eight centers and clockwise half-open boundaries use the declared modern convention', () => {
  for (const [degrees, trigram] of fixture.centers) {
    assert.equal(api.calculateBazhai(input({}, { bearingDegrees: degrees })).baseTrigram, trigram)
    const boundary = (degrees + 22.5) % 360
    assert.equal(api.calculateBazhai(input({ uncertaintyDegrees: 0 }, { bearingDegrees: boundary - 0.001 })).baseTrigram, trigram)
    const next = fixture.centers[(fixture.centers.findIndex(item => item[0] === degrees) + 1) % 8][1]
    assert.equal(api.calculateBazhai(input({ uncertaintyDegrees: 0 }, { bearingDegrees: boundary })).baseTrigram, next)
    assert.equal(api.calculateBazhai(input({ uncertaintyDegrees: 0 }, { bearingDegrees: boundary + 0.001 })).baseTrigram, next)
  }
  assert.equal(api.calculateBazhai(input({}, { bearingDegrees: 359 })).baseTrigram, '坎')
})
test('facing direction is explicitly reversed, original measured facts stay intact', () => {
  const result = api.calculateBazhai(input({ bearingRole: 'facing' }, { bearingDegrees: 180, directionTarget: '房屋朝向' }))
  assert.equal(result.sittingDegrees, 0); assert.equal(result.facingDegrees, 180); assert.equal(result.baseTrigram, '坎')
  assert.equal(result.input.facts.bearingDegrees, 180); assert.match(result.steps[1], /转180°/)
  assert.equal(result.group, '东四宅')
  assert.equal(api.calculateBazhai(input({}, { bearingDegrees: 315 })).group, '西四宅')
})
test('uncertainty touching a boundary rejects a unique base and never defaults unknown to zero', () => {
  assert.equal(api.calculateBazhai(input({ uncertaintyDegrees: 0.4 }, { bearingDegrees: 22 })).baseTrigram, '坎')
  for (const value of [0.5, 1, 22.49]) assert.throws(() => api.calculateBazhai(input({ uncertaintyDegrees: value }, { bearingDegrees: 22 })), /分界/)
  for (const value of [null, undefined, '', NaN, Infinity, -1, 22.5]) assert.throws(() => api.calculateBazhai(input({ uncertaintyDegrees: value })), /不确定度/)
  assert.throws(() => api.calculateBazhai(input({ uncertaintyDegrees: 0.1 }, { bearingDegrees: 337.5 })), /分界/)
})
test('missing and magnetic readings, invalid dates and unstated measurement roles do not generate a chart', () => {
  for (const change of [{ bearingDegrees: null }, { northReference: 'unknown' }, { northReference: 'magnetic' }, { directionTarget: '' }, { measurementTool: '' }, { measurementBasis: '' }, { measuredAt: '' }, { measuredAt: '2026-02-29' }, { bearingDegrees: 360 }, { bearingDegrees: -1 }]) assert.throws(() => api.calculateBazhai(input({}, change)))
  for (const bearingRole of ['', 'north', null]) assert.throws(() => api.calculateBazhai(input({ bearingRole })))
})
test('snapshot returns isolated inputs and all data needed for historical replay', () => {
  const original = input(), snapshot = api.calculateBazhai(original)
  original.facts.name = '被改动'
  snapshot.sources[0].title = '被改动'
  const fresh = api.calculateBazhai(input())
  assert.equal(fresh.input.facts.name, '合成空间'); assert.notEqual(fresh.sources[0].title, '被改动')
  assert.equal(fresh.steps.length, 4); assert.equal(fresh.limitations.length, 4); assert.equal(api.isBazhaiSnapshot(fresh), true)
})
test('validator rejects altered orientation, direction cells, sources and future versions', () => {
  const snapshot = api.calculateBazhai(input())
  for (const modify of [s=>s.ruleVersion='future',s=>s.sittingDegrees=45,s=>s.baseTrigram='乾',s=>s.group='西四宅',s=>s.sectors[0].star='生气',s=>s.sectors[1].changedLines=[],s=>s.sources[0].url='javascript:alert(1)',s=>s.input.facts.northReference='magnetic',s=>s.steps.pop()]) {
    const bad = plain(snapshot); modify(bad); assert.equal(api.isBazhaiSnapshot(bad), false)
  }
})
test('save, reopen and export retain historical prose and cannot alias stored records', () => {
  const storage = memory(), repo = api.createBazhaiRepository(storage), snapshot = api.calculateBazhai(input())
  snapshot.steps[0] = '保存时的校订步骤说明'
  const record = repo.save(snapshot, '2026-10-03T09:00:00.000Z')
  record.snapshot.input.facts.name = '修改返回值'
  snapshot.sectors[0].explanation = '修改输入'
  const reopened = api.createBazhaiRepository(storage).list()[0]
  assert.equal(reopened.snapshot.steps[0], '保存时的校订步骤说明')
  assert.equal(reopened.snapshot.input.facts.name, '合成空间')
  assert.notEqual(reopened.snapshot.sectors[0].explanation, '修改输入')
  assert.deepEqual(JSON.parse(repo.exportJSON()).records[0], plain(reopened))
})
test('thirty maximum-text snapshots fit; capacity and corrupt data never evict records', () => {
  const storage = memory(), repo = api.createBazhaiRepository(storage)
  const snapshot = api.calculateBazhai(input({}, { name:'字'.repeat(40), locationNote:'字'.repeat(200), layoutDescription:'字'.repeat(1500), directionTarget:'字'.repeat(120), measurementTool:'字'.repeat(100), measurementBasis:'字'.repeat(500), buildingPeriod:'字'.repeat(100), moveInPeriod:'字'.repeat(100), notes:'字'.repeat(1500) }))
  for(let i=0;i<30;i++) repo.save(snapshot,'2026-10-03T09:00:00.000Z')
  assert.equal(new Set(repo.list().map(item=>item.id)).size,30)
  const before = storage.data.get(api.BAZHAI_STORAGE_KEY)
  assert.throws(()=>repo.save(snapshot),/最多/); assert.equal(storage.data.get(api.BAZHAI_STORAGE_KEY),before)
  storage.data.set(api.BAZHAI_STORAGE_KEY,'{broken')
  for(const call of [()=>repo.list(),()=>repo.save(snapshot),()=>repo.remove('id'),()=>repo.exportJSON()]) assert.throws(call,/原始数据已保留/)
  assert.equal(storage.data.get(api.BAZHAI_STORAGE_KEY),'{broken')
})
test('storage failures never report a successful save or lose the prior snapshot', () => {
  const storage=memory(),repo=api.createBazhaiRepository(storage),snapshot=api.calculateBazhai(input())
  const record=repo.save(snapshot),before=storage.data.get(api.BAZHAI_STORAGE_KEY)
  storage.setItem=()=>{throw new Error('quota')}
  assert.throws(()=>repo.save(snapshot),/未确认成功/);assert.throws(()=>repo.remove(record.id),/未确认成功/)
  assert.equal(storage.data.get(api.BAZHAI_STORAGE_KEY),before)
})
