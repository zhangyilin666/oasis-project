import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/domain/fortune-stick/today.ts', import.meta.url))],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
})
const context = vm.createContext({ module: { exports: {} } })
vm.runInContext(bundle.outputFiles[0].text, context)
const stickApi = context.module.exports

const sample = {
  date: '2026-11-16',
  number: 8,
  grade: '上上',
  title: '范文正公断齑画粥',
  poem: '衣食自然生处有，劝君不用苦劳心',
  line: '衣食自然生处有',
  plain: '这支签说的是开头顺利。',
  cat: '喵，可以轻轻试一下。',
  disclaimer: '仅供娱乐参考',
}

test('keeps only today and never serializes the question', () => {
  const raw = stickApi.serializeStick({ ...sample, question: '今晚的信' })
  assert.equal(raw.includes('今晚的信'), false)
  assert.equal(raw.includes('question'), false)
  assert.deepEqual(stickApi.parseStoredStick(raw, '2026-11-16').number, 8)
  assert.equal(stickApi.parseStoredStick(raw, '2026-11-17'), null)
})

test('uses the China calendar date around midnight UTC', () => {
  assert.equal(stickApi.chinaDate(new Date('2026-11-16T16:30:00Z')), '2026-11-17')
  assert.equal(stickApi.chinaDate(new Date('2026-11-16T15:30:00Z')), '2026-11-16')
})

test('share export asks for a detached 1080x1440 bitmap', async () => {
  const exportBundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/domain/fortune-card/export.ts', import.meta.url))],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
  })
  const exportContext = vm.createContext({ module: { exports: {} } })
  vm.runInContext(exportBundle.outputFiles[0].text, exportContext)
  const exportApi = exportContext.module.exports
  const canvas = { width: 0, height: 0 }
  const made = exportApi.createShareBitmap(() => canvas)
  assert.equal(made.width, 1080)
  assert.equal(made.height, 1440)
  assert.equal(exportApi.EXPORT_CANVAS_ATTACHED, false)
  assert.throws(() => exportApi.createShareBitmap(() => ({
    set width(value) { this._width = value },
    get width() { return 390 },
    set height(value) { this._height = value },
    get height() { return 844 },
  })))
  const button = readFileSync(new URL('../src/components/FortuneShareButton.vue', import.meta.url), 'utf8')
  assert.equal(button.includes('width: 1080px'), false)
  assert.equal(button.includes('left: -2400px'), false)
  assert.equal(button.includes('createShareBitmap'), true)
})
