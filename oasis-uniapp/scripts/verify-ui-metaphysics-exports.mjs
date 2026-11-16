// Verify synthetic records exported through the actual H5 page controls.
// Capture is performed separately through UI actions, never by reading browser storage.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const directory = new URL('../../docs/verification/browser-exports/', import.meta.url)
const actions = JSON.parse(await readFile(new URL('ui-actions.json', directory), 'utf8'))
const bundle = await build({
  stdin: { contents: `
    export * from './src/domain/cross-reading/index';
    export { calculateDivination } from './src/domain/divination/index';
  `, loader: 'ts', resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} }, Date, Intl, console, setTimeout, clearTimeout })
vm.runInContext(bundle.outputFiles[0].text, context)
const api = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))
const sources = {
  'birth-charts-ui.json': 'birth-charts', 'flow-study-ui.json': 'flow-study',
  'jyotish-ui.json': 'jyotish', 'western-study-ui.json': 'western-study',
  'qizheng-ui.json': 'qizheng', 'qizheng-lodges-ui.json': 'qizheng-lodges',
  'qimen-ui.json': 'qimen', 'liuren-ui.json': 'liuren', 'taiyi-ui.json': 'taiyi',
  'divination-ui.json': 'divination', 'date-selection-ui.json': 'date-selection',
  'tarot-ui.json': 'tarot', 'almanac-ui.json': 'almanac', 'space-ui.json': 'space',
  'bazhai-ui.json': 'bazhai', 'seasonal-care-ui.json': 'seasonal-care',
  'practice-ui.json': 'practice', 'names-ui.json': 'name-culture',
  'physiognomy-ui.json': 'physiognomy-culture',
}
assert.equal(Object.keys(sources).length, api.CROSS_SOURCE_KINDS.length)
assert.equal(actions.files.length, 20)
const files = []
for (const action of actions.files) {
  assert.ok(action.file === 'cross-reading-ui.json' || Object.hasOwn(sources, action.file))
  const bytes = await readFile(new URL(action.file, directory))
  const text = bytes.toString('utf8'), data = JSON.parse(text)
  assert.equal(text.length, action.characters, `${action.file}: captured text length`)
  const kind = sources[action.file]
  if (action.file === 'cross-reading-ui.json') {
    assert.equal(data.kind, 'cross-reading')
    assert.equal(data.records.length, 2)
    for (const record of data.records) assert.ok(api.isCrossReadingSnapshot(record.snapshot))
    assert.deepEqual(data.records.map(record => record.snapshot.entries.length).sort(), [2, 8])
    const eight = data.records.find(record => record.snapshot.entries.length === 8).snapshot
    assert.equal(eight.entries.find(entry => entry.selection.kind === 'taiyi').selection.record.snapshot.board.host.count, null)
    assert.equal(eight.entries.find(entry => entry.selection.kind === 'space').selection.record.snapshot.facts.bearingDegrees, null)
    assert.equal(eight.entries.find(entry => entry.selection.kind === 'divination').representation, 'reconstructed-from-input')
    assert.ok(data.records.some(record => record.snapshot.differences.some(item => item.id === 'historical-modern-coordinates')))
  } else {
    const records = kind === 'birth-charts'
      ? [{ id: 'validation-only-export-id', name: data.name, savedAt: data.savedAt, result: data.result }]
      : data.records
    assert.equal(records.length, action.records)
    for (const record of records) {
      const selection = { kind, key: api.sourceKey(kind, record.id), record }
      assert.deepEqual(plain(api.validateSourceSelection(selection)), selection)
      if (kind === 'divination') assert.deepEqual(plain(api.calculateDivination(record.input, record.ruleVersion)), record.result)
    }
  }
  files.push({ name: action.file, kind: kind || 'cross-reading', records: action.records, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
assert.equal(new Set(files.map(file => file.name)).size, 20)
const manifest = {
  verifiedAt: new Date().toISOString(), capturedAt: actions.capturedAt,
  method: 'Actual H5 export controls → explicit Copy JSON → clipboard → UTF-8 file → exact text readback → production source/snapshot validation',
  input: 'Only synthetic acceptance records created during page testing. No direct browser storage inspection or user account export.',
  boundary: 'Clipboard fallback verified. IAB native download completion timed out and is not certified. This is not Android, iPhone Safari, or WeChat device verification.',
  files,
}
await writeFile(new URL('manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ files: files.length, sourceFamilies: Object.keys(sources).length, records: files.reduce((total, file) => total + file.records, 0), manifest: fileURLToPath(new URL('manifest.json', directory)) }, null, 2))
