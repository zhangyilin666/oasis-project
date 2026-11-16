import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { build } from 'esbuild'

const bundle = await build({
  stdin: { contents: "export * from './src/api/request'; export * from './src/api/session'; export * from './src/api/auth'; export * from './src/utils/storage'; export * from './src/utils/reports'; export * from './src/utils/recovery-code'", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node',
  plugins: [{ name: 'test-config', setup(b) {
    b.onLoad({ filter: /config[\\/]env\.ts$/ }, () => ({ contents: "export const API_BASE_URL=''; export const API_PREFIX='/api/v1/app'; export const REQUEST_TIMEOUT=20000; export const DEMO_MODE=false", loader: 'ts' }))
  } }],
})
function harness(handle, initial = {}, confirm = true) {
  const storage = new Map(Object.entries(initial)), calls = [], loading = []
  const context = vm.createContext({ module: { exports: {} }, crypto: webcrypto, console, Uint8Array,
    uni: {
      getStorageSync: key => storage.get(key), setStorageSync: (k, v) => storage.set(k, v), removeStorageSync: k => storage.delete(k),
      showLoading: () => loading.push('show'), hideLoading: () => loading.push('hide'),
      showModal: opts => opts.success({ confirm, cancel: !confirm }), showToast: () => {},
      request: opts => { calls.push(opts); queueMicrotask(() => handle(opts)) },
    },
  })
  vm.runInContext(bundle.outputFiles[0].text, context)
  return { api: context.module.exports, storage, calls, loading }
}
const ok = (opts, data = {}) => opts.success({ statusCode: 200, data: { code: 200, data } })
const denied = opts => opts.success({ statusCode: 401, data: { detail: { code: 401, message: 'expired' } } })

test('first concurrent page requests share one login and preserve the device', async () => {
  const h = harness(o => o.url.endsWith('/anonymous-login') ? ok(o, { token: 'token', user_id: 1 }) : ok(o))
  await Promise.all([h.api.get('/api/v1/app/oasis/almanac'), h.api.get('/api/v1/app/oasis/reports')])
  assert.equal(h.calls.filter(o => o.url.endsWith('/anonymous-login')).length, 1)
  assert.match(h.storage.get('__xiaoyi_device_id'), /^[a-f0-9]{32}$/)
  assert.equal(h.calls[1].header.Authorization, 'Bearer token')
})
test('concurrent 401 refresh once, then retry using the new token', async () => {
  const h = harness(o => o.url.endsWith('/refresh') ? ok(o, { token: 'new', user_id: 1 }) : o.header.Authorization === 'Bearer old' ? denied(o) : ok(o), { __xiaoyi_token: 'old' })
  await Promise.all([h.api.get('/api/v1/app/oasis/almanac'), h.api.get('/api/v1/app/oasis/reports')])
  assert.equal(h.calls.filter(o => o.url.endsWith('/refresh')).length, 1)
})
test('expired refresh logs in with the same device; retries are bounded', async () => {
  const h = harness(o => o.url.endsWith('/anonymous-login') ? ok(o, { token: 'new', user_id: 7 }) : denied(o), { __xiaoyi_token: 'old', __xiaoyi_device_id: 'saved-device' })
  await assert.rejects(h.api.get('/api/v1/app/oasis/reports'), e => e.code === 401)
  assert.equal(h.calls.length, 4)
  assert.equal(h.calls[2].data.device_id, 'saved-device')
})
test('business errors preserve code and network errors always clear loading', async () => {
  const h = harness(o => o.success({ statusCode: 200, data: { code: 400, message: '先完成分析' } }), { __xiaoyi_token: 'token' })
  await assert.rejects(h.api.get('/api/v1/app/oasis/daily-fortune'), e => e.code === 400)
  const n = harness(o => o.fail({}), { __xiaoyi_token: 'token' })
  await assert.rejects(n.api.post('/api/v1/app/oasis/analyze', {}, { showLoading: true }), e => e.code === 0)
  assert.deepEqual(n.loading, ['show', 'hide'])
})
test('failed restore preserves current account credentials', async () => {
  const h = harness(o => o.success({ statusCode: 404, data: { detail: { message: 'not found' } } }), { __xiaoyi_token: 'current', __xiaoyi_device_id: 'current-device' })
  await assert.rejects(h.api.restoreAccount('mlyz0-' + 'a'.repeat(32)), e => e.code === 404)
  assert.equal(h.storage.get('__xiaoyi_device_id'), 'current-device')
  assert.equal(h.storage.get('__xiaoyi_token'), 'current')
})

test('current-account lookup is authenticated and accepts account zero after token recovery', async () => {
  const h = harness(o => o.url.endsWith('/refresh')
    ? ok(o, { token: 'renewed', user_id: 0 })
    : o.header.Authorization === 'Bearer old' ? denied(o) : ok(o, { user_id: 0, is_admin: true }),
  { __xiaoyi_token: 'old', __xiaoyi_user_id: '1' })
  const response = await h.api.getMyAccountApi()
  assert.equal(h.calls[0].url, '/api/v1/app/me')
  assert.equal(h.calls[0].header.Authorization, 'Bearer old')
  assert.equal(h.calls[2].header.Authorization, 'Bearer renewed')
  assert.equal(response.data.user_id, 0)
  assert.equal(response.data.is_admin, true)
  assert.equal(h.api.getUserId(), 0)
  assert.equal(h.calls.length, 3)
})

test('restoring account zero preserves its valid identity and uses the restored session', async () => {
  const h = harness(o => o.url.endsWith('/restore')
    ? ok(o, { token: 'restored', user_id: 0 }) : ok(o, { user_id: 0, is_admin: false }),
  { __xiaoyi_token: 'previous', __xiaoyi_user_id: '12', __xiaoyi_device_id: 'previous-device' })
  await h.api.restoreAccount('mlyz0-' + 'a'.repeat(32))
  const response = await h.api.getMyAccountApi()
  assert.equal(h.api.getUserId(), 0)
  assert.equal(h.calls[1].header.Authorization, 'Bearer restored')
  assert.equal(response.data.is_admin, false)
  assert.equal(h.storage.get('__xiaoyi_device_id'), 'a'.repeat(32))
})

test('numeric and string account zero remain distinct from absent storage', () => {
  for (const value of [0, '0']) {
    const h = harness(ok, { __xiaoyi_user_id: value, __xiaoyi_report_0: 17 })
    assert.equal(h.api.getUserId(), 0)
    assert.equal(h.api.getSelectedReport(), 17)
  }
  for (const value of [undefined, null, '', ' ', 'invalid', -1]) {
    assert.equal(harness(ok, { __xiaoyi_user_id: value }).api.getUserId(), null)
  }
})

test('explicit refresh sends the current token and does not recursively recover its own 401', async () => {
  const h = harness(denied, { __xiaoyi_token: 'expired' })
  await assert.rejects(h.api.refreshApi(), e => e.code === 401)
  assert.equal(h.calls[0].header.Authorization, 'Bearer expired')
  assert.equal(h.calls.length, 1)
})

const report = { id: 17, birth_info: '测试 1990-01-01 08:00 北京', status: 'completed' }
const selected = { __xiaoyi_token: 'token', __xiaoyi_user_id: '1', __xiaoyi_report_1: 17 }

test('cancelling deletion sends no request and keeps the daily selection', async () => {
  const h = harness(ok, selected, false)
  assert.equal(await h.api.confirmDeleteReport(report), false)
  assert.equal(h.calls.length, 0)
  assert.equal(h.storage.get('__xiaoyi_report_1'), 17)
})

test('confirmed deletion sends authenticated DELETE and clears only the deleted selection', async () => {
  const h = harness(ok, selected)
  assert.equal(await h.api.confirmDeleteReport(report), true)
  assert.equal(h.calls[0].method, 'DELETE')
  assert.equal(h.calls[0].url, '/api/v1/app/oasis/report/17')
  assert.equal(h.calls[0].header.Authorization, 'Bearer token')
  assert.equal(h.storage.has('__xiaoyi_report_1'), false)
  const other = harness(ok, { ...selected, __xiaoyi_report_1: 9 })
  await other.api.confirmDeleteReport(report)
  assert.equal(other.storage.get('__xiaoyi_report_1'), 9)
})

test('failed deletion keeps the selection so the user can retry', async () => {
  const h = harness(o => o.success({ statusCode: 500, data: { detail: { message: '服务暂不可用' } } }), selected)
  await assert.rejects(h.api.confirmDeleteReport(report), e => e.code === 500)
  assert.equal(h.storage.get('__xiaoyi_report_1'), 17)
})

test('already deleted report is removed locally and a processing report is never submitted for deletion', async () => {
  const h = harness(o => o.success({ statusCode: 404, data: { detail: { message: '报告已删除' } } }), selected)
  assert.equal(await h.api.confirmDeleteReport(report), true)
  assert.equal(h.storage.has('__xiaoyi_report_1'), false)
  const pending = harness(ok, selected)
  assert.equal(await pending.api.confirmDeleteReport({ ...report, status: 'processing' }), false)
  assert.equal(pending.calls.length, 0)
})


test('branded recovery codes round-trip accounts zero, one and two without changing the secret', async () => {
  const device = 'a'.repeat(32)
  for (const userId of [0, 1, 2, 123]) {
    const h = harness(o => ok(o, { token: 'restored', user_id: userId }))
    const code = h.api.formatRecoveryCode(userId, device)
    assert.equal(code, `mlyz${userId}-${device}`)
    await h.api.restoreAccount('  ' + code + '  ')
    assert.equal(h.calls[0].data.device_id, device)
    assert.equal(h.api.getUserId(), userId)
  }
})

test('new-code ID mismatch and malformed codes keep the current session', async () => {
  const initial = { __xiaoyi_token: 'current', __xiaoyi_device_id: 'current-device', __xiaoyi_user_id: '9' }
  const h = harness(o => ok(o, { token: 'wrong-account', user_id: 2 }), initial)
  await assert.rejects(h.api.restoreAccount('mlyz1-' + 'a'.repeat(32)), e => e.code === 400)
  assert.equal(h.api.getUserId(), 9)
  assert.equal(h.api.getToken(), 'current')
  assert.equal(h.api.getDeviceId(), 'current-device')
  const invalid = harness(ok, initial)
  for (const code of ['mlyz-1-' + 'a'.repeat(32), 'mlyz1-short', 'mlyz01-' + 'a'.repeat(32)]) {
    await assert.rejects(invalid.api.restoreAccount(code), e => e.code === 400)
  }
  assert.equal(invalid.calls.length, 0)
  assert.equal(invalid.api.getToken(), 'current')
})

test('new recovery format supports existing UUID suffixes', async () => {
  const id = '12345678-1234-1234-1234-123456789abc'
  const h = harness(o => ok(o, { token: 'restored', user_id: 2 }))
  await h.api.restoreAccount('mlyz2-' + id)
  assert.equal(h.api.getDeviceId(), id)
})

test('retired xy1 and unprefixed recovery codes are rejected without requesting or switching accounts', async () => {
  const initial = { __xiaoyi_token: 'current', __xiaoyi_device_id: 'current-device', __xiaoyi_user_id: '9' }
  const h = harness(ok, initial)
  for (const id of ['a'.repeat(32), '12345678-1234-1234-1234-123456789abc']) {
    for (const code of [id, 'xy1-' + id, 'XY1-' + id, '  xy1-' + id + '  ']) {
      assert.throws(() => h.api.parseRecoveryCode(code))
      await assert.rejects(h.api.restoreAccount(code), e => e.code === 400 && e.message.includes('旧版恢复码已停用'))
    }
  }
  assert.equal(h.calls.length, 0)
  assert.equal(h.api.getToken(), 'current')
  assert.equal(h.api.getDeviceId(), 'current-device')
  assert.equal(h.api.getUserId(), 9)
})
