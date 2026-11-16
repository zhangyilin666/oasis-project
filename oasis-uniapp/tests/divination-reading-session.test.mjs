import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/domain/divination/reading-session.ts', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node' })
const context = vm.createContext({ module: { exports: {} }, setTimeout, clearTimeout, console })
vm.runInContext(bundle.outputFiles[0].text, context)
const { createReadingSession } = context.module.exports
const clone = value => JSON.parse(JSON.stringify(value))
const input = () => ({ question: '合作前需要确认什么？', date: '2026-10-03', time: '12:00', utcOffset: 8, method: 'liuyao-coins', lines: [6, 7, 8, 9, 7, 8], coins: [[2, 2, 2], [2, 2, 3], [2, 3, 3], [3, 3, 3], [2, 2, 3], [2, 3, 3]] })
const reading = (id = 1, status = 'pending') => ({ reading_id: id, status, input: input(), rule_version: 'liuyao-coins-v1', facts: {}, analysis: status === 'completed' ? { overview: { text: '已有解读', evidence_ids: [] } } : null, error_message: status === 'failed' ? '模型暂未返回有效内容' : null, created_at: '2026-10-03T04:00:00Z', updated_at: '2026-10-03T04:00:00Z' })
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function harness(overrides = {}) {
  const posts = [], reads = [], updates = [], timers = new Map()
  let id = 0, timerId = 0
  const dependencies = {
    create: async payload => { posts.push(clone(payload)); return reading() },
    read: async value => { reads.push(value); return reading(value, 'completed') },
    newRequestId: () => `request-${++id}`,
    onChange: state => updates.push(clone(state)),
    schedule: callback => { const key = ++timerId; timers.set(key, callback); return key },
    unschedule: key => timers.delete(key),
    ...overrides,
  }
  const session = createReadingSession(dependencies)
  async function tick() { const [key, callback] = timers.entries().next().value; timers.delete(key); callback(); await new Promise(resolve => setImmediate(resolve)) }
  return { session, posts, reads, updates, timers, tick }
}

test('double submit creates one task and snapshots the original coin cast', async () => {
  const pending = deferred(), posts = []
  const h = harness({ create: payload => { posts.push(clone(payload)); return pending.promise } })
  const original = input()
  const first = h.session.submit(original, 'liuyao-coins-v1')
  original.question = '后来修改的内容'
  original.coins[0][0] = 3
  await h.session.submit(input(), 'liuyao-coins-v1')
  assert.equal(posts.length, 1)
  assert.deepEqual(posts[0].input, input())
  pending.resolve(reading())
  await first
  assert.equal(h.session.getState().phase, 'watching')
  assert.equal(h.timers.size, 1)
})

test('network uncertainty reuses the request ID and exact fixed input', async () => {
  const posts = []
  const h = harness({ create: async payload => { posts.push(clone(payload)); if (posts.length === 1) throw new Error('network timeout'); return reading() } })
  await h.session.submit(input(), 'liuyao-coins-v1')
  assert.equal(h.session.getState().phase, 'submit-error')
  await h.session.submit(input(), 'liuyao-coins-v1')
  assert.equal(posts.length, 2)
  assert.deepEqual(posts[0], posts[1])
})

test('explicit failed-reading retry creates a new ID but never changes the cast', async () => {
  const posts = []
  const h = harness({ create: async payload => { posts.push(clone(payload)); return reading(posts.length, posts.length === 1 ? 'failed' : 'pending') } })
  await h.session.submit(input(), 'liuyao-coins-v1')
  await h.session.submit(input(), 'liuyao-coins-v1')
  assert.equal(posts.length, 1, 'ordinary submit does not retry a terminal failure')
  await h.session.retry()
  assert.notEqual(posts[0].request_id, posts[1].request_id)
  assert.deepEqual(posts[0].input, posts[1].input)
  assert.equal(posts[0].rule_version, posts[1].rule_version)
})

test('edited input invalidates a late POST response and prevents its polling', async () => {
  const pending = deferred()
  const h = harness({ create: () => pending.promise })
  const work = h.session.submit(input(), 'liuyao-coins-v1')
  h.session.invalidate()
  pending.resolve(reading())
  assert.equal(await work, null)
  assert.equal(h.session.getState().reading, null)
  assert.equal(h.session.getState().phase, 'idle')
  assert.equal(h.timers.size, 0)
})

test('hiding cancels polling; resuming only reads the existing task', async () => {
  const h = harness()
  await h.session.submit(input(), 'liuyao-coins-v1')
  h.session.pause()
  assert.equal(h.timers.size, 0)
  h.session.resume()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.posts.length, 1)
  assert.deepEqual(h.reads, [1])
  assert.equal(h.session.getState().phase, 'completed')
})

test('poll failure retries GET without creating a paid task', async () => {
  let attempts = 0
  const h = harness({ read: async id => { attempts++; if (attempts === 1) throw new Error('offline'); return reading(id, 'completed') } })
  await h.session.submit(input(), 'liuyao-coins-v1')
  await h.tick()
  assert.equal(h.session.getState().phase, 'read-error')
  assert.equal(h.timers.size, 0)
  await h.session.retry()
  assert.equal(attempts, 2)
  assert.equal(h.posts.length, 1)
  assert.equal(h.session.getState().phase, 'completed')
})

test('opening a second history record ignores the first late response', async () => {
  const first = deferred()
  const h = harness({ read: id => id === 1 ? first.promise : Promise.resolve(reading(id, 'completed')) })
  const opening = h.session.open(1)
  await h.session.open(2)
  first.resolve(reading(1, 'completed'))
  assert.equal(await opening, null)
  assert.equal(h.session.getState().reading.reading_id, 2)
  assert.equal(h.posts.length, 0)
})

test('automatic polling is bounded and a later manual refresh stays read-only', async () => {
  const h = harness({ maxPolls: 1, read: async id => reading(id, 'processing') })
  await h.session.submit(input(), 'liuyao-coins-v1')
  await h.tick()
  assert.equal(h.session.getState().phase, 'paused')
  assert.equal(h.timers.size, 0)
  await h.session.refresh()
  assert.equal(h.posts.length, 1)
  assert.equal(h.timers.size, 1)
})

test('completed records missing analysis do not become a successful AI display', async () => {
  const h = harness({ read: async id => ({ ...reading(id, 'completed'), analysis: null }) })
  await h.session.open(12)
  assert.equal(h.session.getState().phase, 'read-error')
  assert.ok(h.session.getState().error)
  assert.equal(h.posts.length, 0)
})
