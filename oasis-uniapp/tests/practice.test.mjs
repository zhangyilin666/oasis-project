import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({ stdin: { contents: "export * from './src/domain/practice'; export * from './src/domain/practice/repository'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, console, Date, Math })
vm.runInContext(bundle.outputFiles[0].text, context)
const { PRACTICE_TOPICS, createPracticeDraft, projectPracticeDraft, pausePracticeDraft, resumePracticeDraft, finishPracticeDraft, updatePracticeNote, practiceRemainingMs, formatPracticeTime, createPracticeRepository, PRACTICE_STORAGE_KEY, MAX_PRACTICE_RECORDS } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const start = (minutes = 5, now = 100000, id = 'practice-test') => createPracticeDraft({ topicId: 'quiet-seat', durationMinutes: minutes }, now, id)

function memoryStorage() {
  const values = new Map()
  let writes = 0
  return { values, get writes() { return writes }, getItem: key => values.get(key), setItem(key, value) { writes++; values.set(key, value) } }
}

test('three original topics and every integer minute from 1 through 60 are selectable', () => {
  assert.deepEqual(plain(PRACTICE_TOPICS.map(topic => topic.title)), ['安静坐一会', '留意周围声音', '整理今日思绪'])
  for (const topic of PRACTICE_TOPICS) assert.ok(topic.guidance.length === 3 && topic.introduction)
  for (let minutes = 1; minutes <= 60; minutes++) {
    const draft = start(minutes)
    assert.equal(draft.durationMinutes, minutes)
    assert.equal(practiceRemainingMs(draft), minutes * 60000)
    assert.equal(draft.ruleVersion, 'practice-timer-v1')
  }
  for (const minutes of [0, 61, 1.1, NaN, '5', null]) assert.throws(() => start(minutes), /1–60/)
  assert.throws(() => createPracticeDraft({ topicId: 'missing', durationMinutes: 5 }), /主题/)
})

test('running time uses wall-clock differences rather than the number of interval ticks', () => {
  const initial = start(5), before = plain(initial)
  const oneLateTick = projectPracticeDraft(initial, 173456)
  let manyTicks = initial
  for (const now of [100250, 101000, 122222, 150000, 173456]) manyTicks = projectPracticeDraft(manyTicks, now)
  assert.equal(oneLateTick.elapsedMs, 73456)
  assert.deepEqual(plain(manyTicks), plain(oneLateTick))
  assert.deepEqual(plain(initial), before)
})

test('paused time is excluded and a resumed session only counts its new running interval', () => {
  let now = 100000, draft = start(5, now)
  now += 15234; draft = pausePracticeDraft(draft, now)
  assert.equal(draft.status, 'paused'); assert.equal(draft.elapsedMs, 15234); assert.equal(draft.anchorAt, null)
  now += 1000000; draft = projectPracticeDraft(draft, now)
  assert.equal(draft.elapsedMs, 15234)
  draft = resumePracticeDraft(draft, now)
  now += 24000; draft = pausePracticeDraft(draft, now)
  assert.equal(draft.elapsedMs, 39234)
  assert.equal(practiceRemainingMs(draft), 260766)
})

test('hidden-tab and refreshed-session recovery includes all elapsed background time', () => {
  const storage = memoryStorage(), first = createPracticeRepository(storage)
  let now = 100000, draft = start(5, now)
  first.saveDraft(draft)
  now += 20000; draft = projectPracticeDraft(draft, now); first.saveDraft(draft)
  // No timer ticks happen for the next 90 seconds; a new repository models a reload.
  now += 90000
  const restored = createPracticeRepository(storage).load().active
  assert.equal(restored.elapsedMs, 20000)
  const resumed = projectPracticeDraft(restored, now)
  assert.equal(resumed.elapsedMs, 110000)
  assert.equal(practiceRemainingMs(resumed), 190000)
})

test('an overdue draft completes at its deadline, caps elapsed time and never displays a negative countdown', () => {
  const initial = start(1, 100000), completed = projectPracticeDraft(initial, 500000)
  assert.equal(completed.status, 'completed')
  assert.equal(completed.elapsedMs, 60000)
  assert.equal(completed.completedAt, 160000)
  assert.equal(completed.completionReason, 'elapsed')
  assert.equal(practiceRemainingMs(completed), 0)
  assert.equal(formatPracticeTime(practiceRemainingMs(completed)), '00:00')
  assert.deepEqual(plain(projectPracticeDraft(completed, 600000)), plain(completed))
  assert.deepEqual(plain(finishPracticeDraft(completed, 700000)), plain(completed))
  assert.throws(() => resumePracticeDraft(completed, 700000), /已结束/)
  assert.equal(formatPracticeTime(-2000), '00:00')
})

test('exact completion includes equality and a sub-second remainder displays one second', () => {
  const initial = start(1)
  const before = projectPracticeDraft(initial, 159999), exact = projectPracticeDraft(initial, 160000)
  assert.equal(before.status, 'running'); assert.equal(formatPracticeTime(practiceRemainingMs(before)), '00:01')
  assert.equal(exact.status, 'completed'); assert.equal(formatPracticeTime(practiceRemainingMs(exact)), '00:00')
})

test('clock rollback pauses without decreasing or adding time and explicit continuation resets the anchor', () => {
  let draft = projectPracticeDraft(start(5), 120000)
  draft = projectPracticeDraft(draft, 110000)
  assert.equal(draft.status, 'paused')
  assert.equal(draft.elapsedMs, 20000)
  assert.equal(draft.anchorAt, null)
  assert.equal(draft.clockRollbackCount, 1)
  assert.equal(draft.lastClockRollbackAt, 110000)
  // Merely catching up to the old clock cannot add another 10 seconds.
  draft = projectPracticeDraft(draft, 120000)
  assert.equal(draft.elapsedMs, 20000)
  draft = resumePracticeDraft(draft, 125000)
  draft = projectPracticeDraft(draft, 130000)
  assert.equal(draft.elapsedMs, 25000)
  assert.equal(draft.clockRollbackCount, 1)
})

test('rollback on reload is retained as a paused recoverable draft', () => {
  const storage = memoryStorage(), repository = createPracticeRepository(storage)
  repository.saveDraft(projectPracticeDraft(start(), 130000))
  const loaded = createPracticeRepository(storage).load().active
  const rolledBack = projectPracticeDraft(loaded, 125000)
  repository.saveDraft(rolledBack)
  const recovered = createPracticeRepository(storage).load().active
  assert.equal(recovered.status, 'paused'); assert.equal(recovered.elapsedMs, 30000)
  assert.equal(recovered.clockRollbackCount, 1)
})

test('early finish preserves actual elapsed running time, even after a long pause', () => {
  let draft = pausePracticeDraft(start(), 107777)
  draft = finishPracticeDraft(draft, 507777)
  assert.equal(draft.status, 'completed'); assert.equal(draft.completionReason, 'early')
  assert.equal(draft.elapsedMs, 7777); assert.equal(draft.completedAt, 507777)
})

test('notes preserve whitespace, respect their limit and do not mutate the source draft', () => {
  const draft = start(), note = '  今天的一件事\n慢慢处理。  '
  const changed = updatePracticeNote(draft, note)
  assert.equal(changed.note, note); assert.equal(draft.note, '')
  assert.equal(updatePracticeNote(draft, '').note, '')
  assert.equal(updatePracticeNote(draft, '字'.repeat(2000)).note.length, 2000)
  assert.throws(() => updatePracticeNote(draft, '字'.repeat(2001)), /2000/)
  assert.throws(() => updatePracticeNote(draft, null), /2000/)
})

test('completed drafts survive reload until manually saved and duplicate completion creates one immutable record', () => {
  const storage = memoryStorage(), repository = createPracticeRepository(storage)
  const complete = updatePracticeNote(projectPracticeDraft(start(1), 160000), '保存前的笔记')
  repository.saveDraft(complete)
  const reloaded = createPracticeRepository(storage)
  assert.equal(reloaded.load().active.status, 'completed')
  assert.equal(reloaded.load().records.length, 0)
  const saved = reloaded.saveRecord(complete.id, '最终笔记', 170000)
  const repeated = reloaded.saveRecord(complete.id, '不应覆盖', 180000)
  assert.deepEqual(plain(repeated), plain(saved))
  assert.equal(reloaded.load().active, null)
  assert.equal(reloaded.load().records.length, 1)
  assert.equal(reloaded.load().records[0].snapshot.note, '最终笔记')
  assert.throws(() => reloaded.saveDraft(complete), /已保存/)
  assert.deepEqual(JSON.parse(reloaded.exportJSON()).records, [plain(saved)])
  assert.deepEqual([...storage.values.keys()], [PRACTICE_STORAGE_KEY])
})

test('historical guidance and notes round-trip verbatim with the rule version', () => {
  const storage = memoryStorage(), repository = createPracticeRepository(storage), snapshot = plain(finishPracticeDraft(start(), 105000))
  snapshot.topic.guidance[0] = '保存当时的原创导读。'
  repository.saveDraft(snapshot)
  const record = repository.saveRecord(snapshot.id, '当时的感受', 110000)
  record.snapshot.topic.guidance[0] = 'caller mutation'
  const restored = createPracticeRepository(storage).load().records[0]
  assert.equal(restored.snapshot.topic.guidance[0], '保存当时的原创导读。')
  assert.equal(restored.snapshot.note, '当时的感受')
  assert.equal(restored.snapshot.ruleVersion, 'practice-timer-v1')
})

test('final record write failure preserves the completed draft and retry is atomic', () => {
  const storage = memoryStorage(), complete = projectPracticeDraft(start(1), 160000)
  createPracticeRepository(storage).saveDraft(complete)
  const before = storage.values.get(PRACTICE_STORAGE_KEY)
  const failed = createPracticeRepository({ getItem: storage.getItem, setItem() { throw new Error('quota') } })
  assert.throws(() => failed.saveRecord(complete.id, '不应丢失', 170000), /写入失败/)
  assert.equal(storage.values.get(PRACTICE_STORAGE_KEY), before)
  assert.equal(failed.load().active.status, 'completed')
  assert.equal(failed.load().records.length, 0)
  const retry = createPracticeRepository(storage)
  retry.saveRecord(complete.id, '不应丢失', 180000)
  assert.equal(retry.load().active, null)
  assert.equal(retry.load().records.length, 1)
  assert.equal(retry.load().records[0].snapshot.note, '不应丢失')
})

test('failed draft writes leave prior data intact and the caller still has its newer recoverable draft', () => {
  const storage = memoryStorage(), initial = start()
  createPracticeRepository(storage).saveDraft(initial)
  const before = storage.values.get(PRACTICE_STORAGE_KEY)
  const repository = createPracticeRepository({ getItem: storage.getItem, setItem() { throw new Error('quota') } })
  const pending = updatePracticeNote(pausePracticeDraft(initial, 120000), '页面中的新笔记')
  assert.throws(() => repository.saveDraft(pending), /当前页面仍保留输入/)
  assert.equal(storage.values.get(PRACTICE_STORAGE_KEY), before)
  assert.equal(pending.status, 'paused'); assert.equal(pending.note, '页面中的新笔记')
  createPracticeRepository(storage).saveDraft(pending)
  assert.deepEqual(plain(createPracticeRepository(storage).load().active), plain(pending))
})

test('active drafts cannot be overwritten by a different session or restarted by stale callbacks', () => {
  const storage = memoryStorage(), repository = createPracticeRepository(storage)
  const first = start(1, 100000, 'first'), other = start(1, 100000, 'other')
  repository.saveDraft(first)
  assert.throws(() => repository.saveDraft(other), /另一份/)
  assert.throws(() => repository.saveRecord(first.id, '', 120000), /先结束/)
  repository.saveDraft(projectPracticeDraft(first, 160000))
  assert.throws(() => repository.saveDraft(first), /已经完成/)
  repository.discardDraft(first.id)
  assert.equal(repository.load().active, null)
})

test('50-record capacity preserves the pending completed draft and targeted deletion frees one slot', () => {
  const storage = memoryStorage(), repository = createPracticeRepository(storage)
  for (let i = 0; i < MAX_PRACTICE_RECORDS; i++) {
    const snapshot = finishPracticeDraft(start(1, 100000 + i, `session-${i}`), 110000 + i)
    repository.saveDraft(snapshot); repository.saveRecord(snapshot.id, `笔记 ${i}`, 120000 + i)
  }
  const pending = finishPracticeDraft(start(1, 130000, 'pending'), 140000)
  repository.saveDraft(pending)
  assert.throws(() => repository.saveRecord(pending.id, '留下', 150000), /50/)
  assert.equal(repository.load().active.id, 'pending')
  assert.equal(repository.load().records.length, 50)
  repository.removeRecord('session-17')
  assert.equal(repository.load().records.length, 49)
  assert.equal(repository.load().active.id, 'pending')
  repository.saveRecord(pending.id, '留下', 150000)
  assert.equal(repository.load().records.length, 50)
  assert.ok(!repository.load().records.some(record => record.id === 'session-17'))
})

test('corrupt or incompatible state is never overwritten by save, completion, discard or delete', () => {
  const clean = { schemaVersion: 1, active: plain(start()), records: [] }
  const bad = ['{bad', JSON.stringify({ ...clean, schemaVersion: 2 }), 'x'.repeat(400001)]
  for (const mutate of [d => { d.ruleVersion = 'future' }, d => { d.elapsedMs = -1 }, d => { d.anchorAt = null }, d => { d.lastObservedAt = d.anchorAt + 1 }, d => { d.note = [] }, d => { d.durationMinutes = 0 }, d => { d.clockRollbackCount = 1 }, d => { delete d.topic }]) {
    const state = plain(clean); mutate(state.active); bad.push(JSON.stringify(state))
  }
  for (const raw of bad) {
    const storage = memoryStorage(); storage.values.set(PRACTICE_STORAGE_KEY, raw)
    const repository = createPracticeRepository(storage)
    assert.throws(() => repository.load(), /保留/)
    assert.throws(() => repository.saveDraft(start()), /保留/)
    assert.throws(() => repository.saveRecord('practice-test', '', 170000), /保留/)
    assert.throws(() => repository.discardDraft('practice-test'), /保留/)
    assert.throws(() => repository.removeRecord('practice-test'), /保留/)
    assert.throws(() => repository.exportJSON(), /保留/)
    assert.equal(storage.values.get(PRACTICE_STORAGE_KEY), raw)
    assert.equal(storage.writes, 0)
  }
})

test('unreadable storage and invalid clocks fail explicitly', () => {
  const repository = createPracticeRepository({ getItem() { throw new Error('permission') }, setItem() { assert.fail('must not write') } })
  assert.throws(() => repository.load(), /无法读取/)
  assert.throws(() => repository.saveDraft(start()), /无法读取/)
  for (const now of [-1, NaN, Infinity, 1.5]) {
    assert.throws(() => start(1, now), /系统时间/)
    assert.throws(() => projectPracticeDraft(start(), now), /系统时间/)
  }
})
