import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { transform } from 'esbuild'
import { JSDOM } from 'jsdom'

const source = await readFile(new URL('../src/utils/export-json.ts', import.meta.url), 'utf8')
async function compile(h5) {
  let include = true
  const code = source.split('\n').filter(line => {
    if (line.includes('// #ifdef H5')) { include = h5; return false }
    if (line.includes('// #ifndef H5')) { include = !h5; return false }
    if (line.includes('// #endif')) { include = true; return false }
    return include
  }).join('\n')
  return (await transform(code, { loader: 'ts', format: 'cjs', target: 'es2021' })).code
}
const h5Code = await compile(true), nativeCode = await compile(false)
const settle = () => new Promise(resolve => setImmediate(resolve))

function browser(t, writeText = async () => {}) {
  const dom = new JSDOM('<!doctype html><html><body><button id="trigger">导出</button></body></html>', { url: 'https://local.test/' })
  const { window } = dom, { document } = window
  const clicks = [], urls = [], revoked = []
  // Use real Blob URLs. jsdom can dispatch clicks, but cannot download files.
  // Prevent navigation and count initiation only; no download-completion event is invented.
  document.addEventListener('click', event => { if (event.target.tagName === 'A') { clicks.push(event.target.href); event.preventDefault() } })
  const blobUrls = { createObjectURL(blob) { const url = URL.createObjectURL(blob); urls.push(url); return url }, revokeObjectURL(url) { revoked.push(url); URL.revokeObjectURL(url) } }
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } })
  const context = vm.createContext({ module: { exports: {} }, window, document, navigator: window.navigator, HTMLElement: window.HTMLElement, URL: blobUrls, Blob, setTimeout, clearTimeout })
  vm.runInContext(h5Code, context)
  t.after(() => { urls.forEach(url => URL.revokeObjectURL(url)); window.close() })
  const trigger = document.querySelector('#trigger'); trigger.focus()
  return { ...context.module.exports, window, document, clicks, urls, revoked, trigger, panel: () => document.querySelector('[role="region"][aria-labelledby="json-export-title"]') }
}

test('H5 initiates a download and retains a visible retry link without claiming completion', async t => {
  let copies = 0
  const b = browser(t, async () => { copies++ })
  const value = { note: '仅本次输入 <script>不会作为标记执行</script>' }
  assert.equal(await b.exportJson(value, 'chart.json'), 'download')
  const panel = b.panel(), link = panel.querySelector('a[download]')
  assert.equal(link.download, 'chart.json')
  assert.deepEqual(b.clicks, [link.href])
  assert.deepEqual(await (await fetch(link.href)).json(), value)
  assert.match(panel.textContent, /已发起.*检查/)
  assert.doesNotMatch(panel.textContent, /下载完成|已下载成功/)
  assert.equal(b.document.activeElement, link)
  assert.equal(copies, 0, 'exporting must never write the clipboard automatically')
  link.click()
  assert.deepEqual(b.clicks, [link.href, link.href])
})

test('a second export replaces the panel and releases only the old Blob URL', async t => {
  const b = browser(t)
  await b.exportJson({ version: 1 }, 'first.json')
  const firstPanel = b.panel(), firstUrl = firstPanel.querySelector('a').href
  await b.exportJson({ version: 2 }, 'second.json')
  assert.equal(firstPanel.isConnected, false)
  assert.equal(b.document.querySelectorAll('[aria-labelledby="json-export-title"]').length, 1)
  assert.deepEqual(b.revoked, [firstUrl])
  await assert.rejects(fetch(firstUrl))
  assert.deepEqual(await (await fetch(b.panel().querySelector('a').href)).json(), { version: 2 })
  b.panel().querySelector('button[aria-label="关闭导出面板"]').click()
  assert.equal(b.panel(), null)
  assert.equal(b.document.activeElement, b.trigger, 'replacement must not retain an element from the removed panel')
  assert.equal(b.revoked.length, 2)
})

test('undefined and circular values reject before replacing an existing usable export', async t => {
  const b = browser(t)
  await b.exportJson({ keep: true }, 'keep.json')
  const panel = b.panel(), url = panel.querySelector('a').href
  const circular = {}; circular.self = circular
  for (const value of [undefined, circular]) await assert.rejects(b.exportJson(value, 'invalid.json'))
  assert.equal(b.panel(), panel)
  assert.equal(b.urls.length, 1)
  assert.deepEqual(b.revoked, [])
  assert.deepEqual(await (await fetch(url)).json(), { keep: true })
})

test('clipboard rejection reports failure, exposes manual text and permits a successful retry', async t => {
  const attempts = []
  const b = browser(t, async text => { attempts.push(text); if (attempts.length === 1) throw new Error('permission denied') })
  const value = { text: '可复制的 JSON' }, expected = JSON.stringify(value, null, 2)
  await b.exportJson(value, 'copy.json')
  const panel = b.panel(), copy = [...panel.querySelectorAll('button')].find(button => button.textContent.includes('复制 JSON'))
  copy.click(); await settle()
  assert.match(panel.querySelector('[role="status"]').textContent, /复制未成功|复制失败/)
  assert.equal(copy.disabled, false)
  const textarea = panel.querySelector('textarea')
  assert.equal(textarea.hidden, false)
  assert.equal(textarea.readOnly, true)
  assert.equal(textarea.value, expected)
  copy.click(); await settle()
  assert.match(panel.querySelector('[role="status"]').textContent, /JSON 已复制/)
  assert.equal(copy.disabled, false)
  assert.deepEqual(attempts, [expected, expected])
})

test('Escape closes the panel, revokes its URL and restores the connected trigger', async t => {
  const b = browser(t)
  await b.exportJson({ close: true }, 'close.json')
  const url = b.panel().querySelector('a').href
  b.document.activeElement.dispatchEvent(new b.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(b.panel(), null)
  assert.deepEqual(b.revoked, [url])
  await assert.rejects(fetch(url))
  assert.equal(b.document.activeElement, b.trigger)
})

test('a late clipboard result cannot change the replacement panel or move its focus', async t => {
  let resolveCopy
  const b = browser(t, () => new Promise(resolve => { resolveCopy = resolve }))
  await b.exportJson({ old: true }, 'old.json')
  const old = b.panel(), copy = [...old.querySelectorAll('button')].find(button => button.textContent.includes('复制 JSON'))
  copy.click()
  await b.exportJson({ current: true }, 'current.json')
  const current = b.panel(), status = current.querySelector('[role="status"]').textContent, focused = b.document.activeElement
  resolveCopy(); await settle()
  assert.equal(b.panel(), current)
  assert.equal(current.querySelector('[role="status"]').textContent, status)
  assert.equal(b.document.activeElement, focused)
})

test('non-H5 keeps the clipboard contract and reports rejected or non-serializable values', async () => {
  const calls = []
  let fail = false
  const context = vm.createContext({ module: { exports: {} }, uni: { setClipboardData(options) { calls.push(options.data); if (fail) options.fail(); else options.success() } } })
  vm.runInContext(nativeCode, context)
  const { exportJson } = context.module.exports
  assert.equal(await exportJson({ native: true }, 'ignored.json'), 'clipboard')
  fail = true
  await assert.rejects(exportJson({ native: false }, 'ignored.json'), /复制失败/)
  const circular = {}; circular.self = circular
  await assert.rejects(exportJson(undefined, 'ignored.json'))
  await assert.rejects(exportJson(circular, 'ignored.json'))
  assert.equal(calls.length, 2)
})
