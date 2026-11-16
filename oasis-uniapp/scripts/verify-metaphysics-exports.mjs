// Synthetic acceptance records only. This does not inspect a browser or user storage.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const project = fileURLToPath(new URL('../', import.meta.url))
const output = new URL('../../docs/verification/exports/', import.meta.url)
const bundle = await build({
  stdin: { contents: `
    export * as charts from './src/domain/metaphysics/index';
    export * as archive from './src/domain/metaphysics/archive';
    export * as divination from './src/domain/divination/index';
    export * as divinationRecords from './src/domain/divination/repository';
    export * as almanac from './src/domain/almanac/index';
    export * as almanacRecords from './src/domain/almanac/repository';
    export * as tarot from './src/domain/tarot/index';
    export * as tarotRecords from './src/domain/tarot/repository';
    export * as practice from './src/domain/practice/index';
    export * as practiceRecords from './src/domain/practice/repository';
    export * as space from './src/domain/space/index';
    export * as spaceRecords from './src/domain/space/repository';
    export * as names from './src/domain/names/index';
    export * as jyotish from './src/domain/jyotish/index';
    export * as jyotishRecords from './src/domain/jyotish/repository';
    export * as dateSelection from './src/domain/date-selection/index';
    export * as dateSelectionRecords from './src/domain/date-selection/repository';
    export * as qimen from './src/domain/qimen/index';
    export * as qimenRecords from './src/domain/qimen/repository';
    export * as qizheng from './src/domain/qizheng/index';
    export * as qizhengRecords from './src/domain/qizheng/repository';
    export * as seasonalCare from './src/domain/seasonal-care/index';
    export * as seasonalCareRecords from './src/domain/seasonal-care/repository';
    export * as culture from './src/domain/physiognomy/index';
    export * as bazhai from './src/domain/bazhai/index';
    export * as liuren from './src/domain/liuren/index';
    export * as liurenRecords from './src/domain/liuren/repository';
    export * as flowStudy from './src/domain/flow-study/index';
    export * as flowStudyRecords from './src/domain/flow-study/repository';
    export * as westernStudy from './src/domain/western-study/index';
    export * as westernStudyRecords from './src/domain/western-study/repository';
    export * as taiyi from './src/domain/taiyi/index';
    export * as taiyiRecords from './src/domain/taiyi/repository';
    export * as crossReading from './src/domain/cross-reading/index';
    export * as crossReadingRecords from './src/domain/cross-reading/repository';
    export * as qizhengLodges from './src/domain/qizheng-lodges/index';
    export * as qizhengLodgesRecords from './src/domain/qizheng-lodges/repository';
  `, resolveDir: project, loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} }, Date, Intl, console, setTimeout, clearTimeout })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
await mkdir(output, { recursive: true })
const files = []
async function verifyFile(name, expected) {
  const serialized = JSON.stringify(expected, null, 2) + '\n'
  const target = new URL(name, output)
  await writeFile(target, serialized, 'utf8')
  const restored = await readFile(target, 'utf8')
  assert.equal(restored, serialized, `${name}: file bytes must survive write/read`)
  assert.deepEqual(JSON.parse(restored), plain(expected), `${name}: all exported fields must survive JSON parse`)
  files.push({ name, bytes: Buffer.byteLength(restored), sha256: createHash('sha256').update(restored).digest('hex') })
}

const sample = await api.charts.calculateExploration(
  { date: '2000-08-16', time: '23:30', gender: '女', utcOffset: 8, place: { name: '合成验收坐标', latitude: 31.23, longitude: 121.47 } },
  { observationDate: '2024-02-10', compareRules: true },
)
assert.ok(sample.charts.every(chart => chart.status === 'ready'))
assert.ok(sample.charts.filter(chart => chart.ruleProfile).length === 2)
await verifyFile('birth-rules-transits.json', api.archive.chartExport(sample, '合成验收样例', '2026-10-03T08:00:00.000Z'))

const memory = new Map()
const repository = api.divinationRecords.createDivinationRepository({ getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) })
const base = { question: '合成验收：学习记录', date: '2026-10-03', time: '15:33', utcOffset: 8 }
for (const input of [
  { ...base, method: 'liuyao-manual', lines: [9, 7, 7, 7, 7, 6] },
  { ...base, method: 'liuyao-najia', lines: [9, 7, 7, 7, 7, 6] },
  { ...base, method: 'meihua-two-numbers', numbers: [2, 3] },
  { ...base, method: 'meihua-calendar' },
]) repository.save(api.divination.calculateDivination(input), '2026-10-03T08:00:00.000Z')
const questions = JSON.parse(repository.exportJSON())
assert.equal(questions.records.length, 4)
await verifyFile('divination-four-methods.json', questions)

const dateSnapshot = api.almanac.calculateAlmanac({ date: '2026-10-03', time: '12:00' })
await verifyFile('almanac-snapshot.json', dateSnapshot)
const dateMemory = new Map()
const dateRepository = api.almanacRecords.createAlmanacRepository({ getItem: key => dateMemory.get(key), setItem: (key, value) => dateMemory.set(key, value) })
dateRepository.save(dateSnapshot, '2026-10-03T08:00:00.000Z')
await verifyFile('almanac-collection.json', JSON.parse(dateRepository.exportJSON()))
const syntheticStorage = () => {
  const values = new Map()
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
}
const tarotRepository = api.tarotRecords.createTarotRepository(syntheticStorage())
const tarotSnapshot = api.tarot.createTarotSnapshot({
  question: '合成验收：学习复盘', date: '2026-10-03', deckDescription: 'RWS 文字样例', drawNotes: '手工选牌',
  spreadKind: 'three', spreadName: '三张复盘', notes: '保存完整正逆位及独立牌组版本。',
  selections: api.tarot.TAROT_PRESETS.three.positions.map((positionName, i) => ({ positionName, cardId: api.tarot.TAROT_CARDS[i].id, orientation: i === 1 ? 'reversed' : 'upright', note: `第 ${i + 1} 张验收笔记` })),
})
tarotRepository.save(tarotSnapshot, '2026-10-03T08:00:00.000Z')
await verifyFile('tarot-records.json', JSON.parse(tarotRepository.exportJSON()))
const practiceRepository = api.practiceRecords.createPracticeRepository(syntheticStorage())
const startAt = Date.parse('2026-10-03T08:00:00.000Z')
let practice = api.practice.createPracticeDraft({ topicId: 'notice-sounds', durationMinutes: 5 }, startAt, 'synthetic-practice')
practice = api.practice.updatePracticeNote(api.practice.projectPracticeDraft(practice, startAt + 301000), '合成验收：后台经过五分钟后正常完成。')
practiceRepository.saveDraft(practice)
practiceRepository.saveRecord(practice.id, practice.note, startAt + 302000)
await verifyFile('practice-records.json', JSON.parse(practiceRepository.exportJSON()))
const spaceStorage = syntheticStorage()
let spaceId = 0
const spaceRepository = api.spaceRecords.createSpaceRepository({ get: spaceStorage.getItem, set: spaceStorage.setItem }, () => new Date(startAt), () => `synthetic-space-${++spaceId}`)
spaceRepository.save(api.space.createSpaceSnapshot({ ...api.space.emptySpaceFacts(), name: '合成验收：未测量方向' }, new Date(startAt)))
spaceRepository.save(api.space.createSpaceSnapshot({ ...api.space.emptySpaceFacts(), name: '合成验收：磁北零度', bearingDegrees: 0, northReference: 'magnetic', measurementTool: '验收指南针' }, new Date(startAt)))
assert.equal(spaceRepository.list()[0].snapshot.facts.bearingDegrees, 0)
assert.equal(spaceRepository.list()[1].snapshot.facts.bearingDegrees, null)
await verifyFile('space-records.json', spaceRepository.exportAll())
const namesRepository = api.names.createNameRepository(syntheticStorage())
namesRepository.save(api.names.inspectName({ name: '歐陽明·𠮷', confirmedPronunciation: '人工确认读音样例', notes: '合成验收：繁体、分隔符、补充平面字符不替换。' }))
await verifyFile('name-culture-records.json', JSON.parse(namesRepository.exportJSON()))
const jyotishRepository = api.jyotishRecords.createJyotishRepository(syntheticStorage(), () => new Date(startAt), () => 'synthetic-jyotish')
jyotishRepository.save('合成验收：印度占星', api.jyotish.calculateJyotish({ date: '2000-08-16', time: '12:00', gender: '女', utcOffset: 8, timePrecision: 'minute', place: { latitude: 31.23, longitude: 121.47 } }, { observationDate: '2026-10-03' }))
await verifyFile('jyotish-records.json', jyotishRepository.exportJSON())
const selectionRepository = api.dateSelectionRecords.createDateSelectionRepository(syntheticStorage())
selectionRepository.save(api.dateSelection.calculateDateSelection({ title: '合成验收：十月周末出行', startDate: '2026-10-03', endDate: '2026-10-10', activity: '出行', mode: 'require-yi', availableWeekdays: [0, 6], excludedDates: ['2026-10-04'], venueNotes: '场地与同行人仍需确认' }))
await verifyFile('date-selection-records.json', JSON.parse(selectionRepository.exportJSON()))
const qimenStorage = syntheticStorage()
const qimenRepository = api.qimenRecords.createQimenRepository({ get: qimenStorage.getItem, set: qimenStorage.setItem }, () => new Date(startAt), () => 'synthetic-qimen')
qimenRepository.save(api.qimen.createQimenSnapshot({ name: '合成验收：公开阳遁样例', date: '2024-01-01', time: '12:00', utcOffsetMinutes: 480, locationNote: '', question: '复核完整九宫' }, new Date(startAt)))
await verifyFile('qimen-records.json', qimenRepository.exportAll())
const qizhengRepository = api.qizhengRecords.createQizhengRepository(syntheticStorage(), () => new Date(startAt), () => 'synthetic-qizheng')
qizhengRepository.save('合成验收：七政天文对照', '保留现代角度口径，古历四余及宿度未开放。', api.qizheng.calculateQizheng({ date: '2000-01-01', time: '12:00', utcOffset: 0, timePrecision: 'minute' }))
await verifyFile('qizheng-records.json', qizhengRepository.exportJSON())
const seasonalRepository = api.seasonalCareRecords.createSeasonalCareRepository(syntheticStorage())
seasonalRepository.save(api.seasonalCare.createSeasonalCareSnapshot(api.seasonalCare.getSeasonalCareReading({ date: '2026-10-03', theme: 'all' }), { habit: '合成验收：作息观察', status: 'observed', observation: '记录实际天气，不套用地区季候。', note: '资料来源随快照保存。' }))
await verifyFile('seasonal-care-records.json', JSON.parse(seasonalRepository.exportJSON()))
const cultureRepository = api.culture.createCulturalNoteRepository(syntheticStorage())
cultureRepository.save(api.culture.createCulturalNote({ articleId: 'three-regions', date: '2026-10-03', title: '合成验收：三停版本核对', note: '记录原文定位、概念差别和原创示意。' }))
await verifyFile('physiognomy-records.json', JSON.parse(cultureRepository.exportJSON()))
const bazhaiRepository = api.bazhai.createBazhaiRepository(syntheticStorage())
bazhaiRepository.save(api.bazhai.calculateBazhai({ facts: { ...api.space.emptySpaceFacts(), name: '合成验收：坐北八宅', bearingDegrees: 180, northReference: 'true', directionTarget: '已确认房屋朝向轴线', measurementTool: '合成测绘资料', measurementBasis: '合成验收，已注明真北及±1度范围。', measuredAt: '2026-10-03' }, bearingRole: 'facing', uncertaintyDegrees: 1 }))
await verifyFile('bazhai-records.json', JSON.parse(bazhaiRepository.exportJSON()))
const liurenStorage = syntheticStorage()
const liurenRepository = api.liurenRecords.createLiurenRepository({ get: liurenStorage.getItem, set: liurenStorage.setItem }, () => new Date(startAt), () => 'synthetic-liuren')
liurenRepository.save(api.liuren.createLiurenSnapshot({ ...api.liuren.emptyLiurenInput(), name: '合成验收：六壬古例', mode: 'manual', day: '甲子', general: '子', hour: '卯' }, new Date(startAt)))
await verifyFile('liuren-records.json', liurenRepository.exportAll())
const flowStudyRepository = api.flowStudyRecords.createFlowStudyRepository(syntheticStorage())
flowStudyRepository.save(api.flowStudy.calculateFlowStudy({ name: '合成验收：流日流时', birth: { date: '2000-08-16', time: '04:30', gender: '女', utcOffset: 8 }, observation: { date: '2023-08-28', time: '00:30', utcOffset: 8 }, note: '按公开样例展开各层四化和十二节月界。' }))
await verifyFile('flow-study-records.json', JSON.parse(flowStudyRepository.exportJSON()))
const westernStudyRepository = api.westernStudyRecords.createWesternStudyRepository(syntheticStorage(), () => new Date(startAt), () => 'synthetic-western-study')
westernStudyRepository.save('合成验收：双人相位', '保存双方独立资料与100种相位比较中的命中项。', api.westernStudy.calculateWesternStudy({ name: '合成A', profile: { date: '2000-08-16', time: '12:00', gender: '女', utcOffset: 8, timePrecision: 'minute', place: { latitude: 31.23, longitude: 121.47 } } }, { name: '合成B', profile: { date: '2000-01-01', time: '12:00', gender: '男', utcOffset: 0, timePrecision: 'minute', place: { latitude: 51.48, longitude: 0 } } }))
await verifyFile('western-study-records.json', westernStudyRepository.exportJSON())
const taiyiStorage = syntheticStorage()
let taiyiId = 0
const taiyiRepository = api.taiyiRecords.createTaiyiRepository({ get: taiyiStorage.getItem, set: taiyiStorage.setItem }, () => new Date(startAt), () => `synthetic-taiyi-${++taiyiId}`)
for (const year of ['724', '714']) taiyiRepository.save(api.taiyi.createTaiyiSnapshot({ name: `合成验收：太乙${year}`, year, sourceNote: '四库本724锚', question: '核对完整局及冲突字段保留' }, new Date(startAt)))
assert.equal(taiyiRepository.list()[0].snapshot.board.host.count, null)
await verifyFile('taiyi-records.json', taiyiRepository.exportAll())
const crossReadingRepository = api.crossReadingRecords.createCrossReadingRepository(syntheticStorage())
const crossSelections = [
  ['flow-study', flowStudyRepository.list()[0]],
  ['western-study', westernStudyRepository.list()[0]],
  ['qizheng', qizhengRepository.list()[0]],
  ['divination', repository.list()[0]],
  ['taiyi', taiyiRepository.list()[0]],
  ['bazhai', bazhaiRepository.list()[0]],
  ['seasonal-care', seasonalRepository.list()[0]],
  ['physiognomy-culture', cultureRepository.list()[0]],
].map(([kind, record]) => ({ kind, key: api.crossReading.sourceKey(kind, record.id), record }))
const crossSnapshot = api.crossReading.createCrossReading({ topic: '合成验收：不同资料如何保留各自依据', note: '八种来源完整复制；太乙待校勘留空，易卦只在本次明确重建。', selections: crossSelections }, '2026-10-03T08:00:00.000Z')
crossReadingRepository.save(crossSnapshot)
assert.equal(crossSnapshot.entries.length, 8)
assert.equal(crossSnapshot.entries.find(entry => entry.selection.kind === 'taiyi').selection.record.snapshot.board.host.count, null)
assert.ok(crossSnapshot.entries.find(entry => entry.selection.kind === 'divination').reconstruction)
const lodgesRepository = api.qizhengLodgesRecords.createQizhengLodgesRepository(syntheticStorage(), () => new Date(startAt), () => 'synthetic-qizheng-lodges')
lodgesRepository.save('合成验收：原书太阳宿度', '保留1684基准原表与古例初宫8度。', api.qizhengLodges.calculateQizhengLodges({ label: '原书太阳例', yearLabel: 1684, palace: 0, degree: 8, minute: 0, second: 0 }))
assert.equal(lodgesRepository.list()[0].snapshot.result.mansion, '斗')
assert.equal(lodgesRepository.list()[0].snapshot.result.withinArcseconds, 7800)
await verifyFile('qizheng-lodges-records.json', lodgesRepository.exportJSON())
crossReadingRepository.save(api.crossReading.createCrossReading({
  topic: '合成验收：古表与现代七政分别保留', note: '古法年标号不转为出生时刻，也不把现代黄经直接套入。',
  selections: [['qizheng-lodges', lodgesRepository.list()[0]], ['qizheng', qizhengRepository.list()[0]]].map(([kind, record]) => ({ kind, key: api.crossReading.sourceKey(kind, record.id), record })),
}, '2026-10-03T08:00:00.000Z'))
assert.equal(crossReadingRepository.list().length, 2)
assert.ok(crossReadingRepository.list()[0].snapshot.differences.some(item => item.id === 'historical-modern-coordinates'))
await verifyFile('cross-reading-records.json', JSON.parse(crossReadingRepository.exportJSON()))
const manifest = {
  verifiedAt: new Date().toISOString(),
  method: 'production serializers → UTF-8 disk files → read back → exact bytes and parsed field equality',
  input: 'Synthetic fixtures only; no user account, browser storage, credentials or personal records accessed.',
  boundary: 'This verifies export content on disk. It does not certify an actual browser download, Android, iPhone Safari or WeChat device behavior.',
  files,
}
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log(JSON.stringify(manifest, null, 2))
