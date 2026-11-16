import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const plain = value => JSON.parse(JSON.stringify(value))
const profile = { date: '2024-11-03', time: '01:30', gender: '女', utcOffset: -5, timeZone: 'America/New_York', timeChoice: 'later', timePrecision: 'approximate', place: { name: '纽约', latitude: 40.7128, longitude: -74.006 } }

async function loadPage(page) {
  const sfc = await readFile(new URL(`../src/pages/${page}/index.vue`, import.meta.url), 'utf8')
  const script = sfc.split('<script setup lang="ts">')[1].split('</script>')[0]
  const bundle = await build({
    stdin: { contents: script + '\nexport { sharedProfiles, result, error, storageError, recordName, fillShared, calculate, save, openRecord, repository };', resolveDir: root, loader: 'ts' },
    bundle: true, write: false, format: 'cjs', platform: 'node', external: ['vue'], alias: { '@': root + 'src' },
    plugins: [{ name: 'page-shell-stubs', setup(builder) {
      builder.onResolve({ filter: /^@dcloudio\/uni-app$/ }, () => ({ path: 'uni-lifecycle', namespace: 'test' }))
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const onShow = () => {}', loader: 'js' }))
      builder.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {}', loader: 'js' }))
    } }],
  })
  const values = new Map()
  const context = vm.createContext({ module: { exports: {} }, require, console, Date, Intl, setTimeout, clearTimeout, uni: { getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value) } })
  vm.runInContext(bundle.outputFiles[0].text, context)
  return { api: context.module.exports, context, values }
}

for (const [page, suffix] of [['jyotish', ' · 印占'], ['qizheng', ' · 七政']]) {
  test(`${page}: valid shared names retain the suffix and save without splitting Unicode characters`, async () => {
    const { api, context, values } = await loadPage(page)
    for (const name of ['小猫', '名'.repeat(40), '🐈'.repeat(20), '名'.repeat(34) + '🐈尾巴尾巴']) {
      assert.ok(name.length <= 40, 'fixture is a valid source archive name')
      // The import action consumes only these fields from an already validated source record.
      api.sharedProfiles.value = [{ name, result: { profile } }]
      if (page === 'jyotish') api.fillShared({ detail: { value: 1 } })
      else api.fillShared(1)
      api.calculate()
      assert.equal(api.error.value, '')
      const generated = api.recordName.value
      assert.ok(generated.endsWith(suffix))
      assert.ok(generated.length <= 40)
      assert.ok(generated.isWellFormed(), 'surrogate pairs must remain intact')
      assert.ok(name.startsWith(generated.slice(0, -suffix.length)), 'truncation must keep a prefix of the original name')
      const snapshot = plain(api.result.value)
      assert.equal(snapshot.birthUtc || snapshot.utcTime, '2024-11-03T06:30:00.000Z')
      const copied = snapshot.profile || snapshot.moment
      for (const field of ['date', 'time', 'utcOffset', 'timeZone', 'timeChoice', 'timePrecision']) assert.equal(copied[field], profile[field])
      if (page === 'jyotish') { assert.equal(snapshot.houses.status, 'unavailable'); assert.deepEqual(copied.place, profile.place) }
      api.save()
      assert.equal(api.storageError.value, '')
      const saved = api.repository.list().find(record => record.name === generated)
      assert.ok(saved, 'the generated name must pass the real repository validation')
      assert.deepEqual(plain(saved.snapshot), snapshot)
      const before = plain([...values])
      context.Intl = undefined
      try {
        api.openRecord(saved)
        assert.deepEqual(plain(api.result.value), snapshot)
        assert.deepEqual(plain(api.repository.exportJSON().records.find(record => record.id === saved.id).snapshot), snapshot)
      } finally { context.Intl = Intl }
      assert.deepEqual(plain([...values]), before, 'opening or exporting must not overwrite the saved data')
    }
  })
}
