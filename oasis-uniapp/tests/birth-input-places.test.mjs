import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/domain/birth-input/places.ts', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node',
})
const context = vm.createContext({ module: { exports: {} } })
vm.runInContext(bundle.outputFiles[0].text, context)
const { getBirthProvinces, getBirthCities, getBirthDistricts, resolveBirthPlace } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))

test('province, city and optional district options preserve the fixed Vant names', () => {
  assert.equal(getBirthProvinces().length, 34)
  assert.ok(getBirthProvinces().some(item => item.value === '330000' && item.label === '浙江省'))
  assert.ok(getBirthCities('330000').some(item => item.value === '330100' && item.label === '杭州市'))
  assert.ok(getBirthDistricts('330100').some(item => item.value === '330106' && item.label === '西湖区'))
  assert.ok(getBirthProvinces().some(item => item.value === '710000' && item.label === '台湾省'))
  assert.equal(getBirthCities('810000').length, 3)
  assert.equal(getBirthCities('820000').length, 2)
})

test('Hangzhou uses the independent GeoNames WGS84 city fixture even when a district is selected', () => {
  // https://www.geonames.org/1808926/hangzhou.html, read 2026-10-03.
  const city = resolveBirthPlace('330000', '330100')
  assert.deepEqual(plain(city), {
    name: '浙江省杭州市', timeZone: 'Asia/Shanghai',
    latitude: 30.29365, longitude: 120.16142, coordinateLabel: '杭州市中心（近似）',
  })
  const district = resolveBirthPlace('330000', '330100', '330106')
  assert.equal(district.name, '浙江省杭州市西湖区')
  assert.equal(district.latitude, city.latitude)
  assert.equal(district.longitude, city.longitude)
  assert.equal(district.coordinateLabel, '杭州市中心（近似）')
})

test('Beijing reference point is preserved and duplicate municipality names are omitted', () => {
  // GeoNames ID 1816670 is Beijing's populated-place reference, not its boundary centroid.
  assert.deepEqual(plain(resolveBirthPlace('110000', '110100', '110101')), {
    name: '北京市东城区', timeZone: 'Asia/Shanghai',
    latitude: 39.9075, longitude: 116.39723, coordinateLabel: '北京市中心（近似）',
  })
  assert.equal(resolveBirthPlace('110000', '110100', '').name, '北京市')
})

test('unverified cities and administrative grouping labels never fall back to another place', () => {
  assert.deepEqual(plain(resolveBirthPlace('150000', '152200')), {
    name: '内蒙古自治区兴安盟', timeZone: 'Asia/Shanghai',
  })
  const countyGrouping = resolveBirthPlace('410000', '419000', '419001')
  assert.equal(countyGrouping.name, '河南省省直辖县济源市')
  assert.equal(Object.hasOwn(countyGrouping, 'latitude'), false)
  assert.equal(Object.hasOwn(countyGrouping, 'longitude'), false)
  assert.equal(Object.hasOwn(countyGrouping, 'coordinateLabel'), false)
})

test('region defaults include Hong Kong, Macau and Taiwan and do not infer Xinjiang clock usage', () => {
  assert.equal(resolveBirthPlace('710000', '710100').timeZone, 'Asia/Taipei')
  assert.equal(resolveBirthPlace('810000', '810100').timeZone, 'Asia/Hong_Kong')
  assert.equal(resolveBirthPlace('820000', '820100').timeZone, 'Asia/Macau')
  assert.equal(resolveBirthPlace('650000', '650100').timeZone, 'Asia/Shanghai')
})

test('foreign-region or mismatched province/city/district codes cannot form a plausible address', () => {
  for (const args of [
    ['330000', '110100'], ['330000', '330100', '110101'],
    ['330000', '330100', '330299'], ['330000', '330100', '__proto__'],
    ['US', 'New York'], ['__proto__', '330100'], [330000, '330100'],
    ['330000', ''], ['330000', '330100', null],
  ]) assert.equal(resolveBirthPlace(...args), null)
  assert.deepEqual(plain(getBirthCities('invalid')), [])
  assert.deepEqual(plain(getBirthDistricts('330000')), [])
})

test('editing returned options or coordinates does not mutate later selections', () => {
  const options = getBirthCities('330000')
  options.find(item => item.value === '330100').label = 'Changed'
  options.length = 0
  const resolved = resolveBirthPlace('330000', '330100')
  resolved.latitude = 0
  assert.equal(resolveBirthPlace('330000', '330100').latitude, 30.29365)
  assert.equal(getBirthCities('330000').find(item => item.value === '330100').label, '杭州市')
})

test('frozen datasets keep source hashes and redistributable license originals', async () => {
  const provenance = JSON.parse(await readFile(new URL('../src/domain/birth-input/data/provenance.json', import.meta.url), 'utf8'))
  assert.equal(provenance.administrativeNames.license, 'MIT')
  assert.equal(provenance.cityCoordinates.license, 'CC-BY-4.0')
  assert.equal(provenance.cityCoordinates.coordinateSystem, 'WGS84')
  for (const source of [provenance.administrativeNames, provenance.cityCoordinates]) {
    const bytes = await readFile(new URL(`../src/domain/birth-input/data/${source.output.path}`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.output.sha256)
  }
  const mit = await readFile(new URL('../src/static/data-licenses/vant-area-data-MIT.txt', import.meta.url), 'utf8')
  const cc = await readFile(new URL('../src/static/data-licenses/CC-BY-4.0-legalcode.txt', import.meta.url), 'utf8')
  assert.match(mit, /Copyright \(c\) Youzan/)
  assert.match(mit, /permission notice shall be included/)
  assert.match(cc, /Creative Commons Attribution 4\.0 International Public License/)
})
