import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/domain/fortune-card/map.ts', import.meta.url))],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
})
const context = vm.createContext({ module: { exports: {} } })
vm.runInContext(bundle.outputFiles[0].text, context)
const cardApi = context.module.exports

const source = () => ({
  date: '2026-11-16',
  dayGanZhi: '甲子',
  dayRelation: '食神',
  fortuneText: '今天适合把一件小事做完。走慢一点，也依然算数。下午可以和朋友喝杯热茶。',
  luckyColor: '天蓝色',
  luckyDirection: '北方',
  luckyNumber: '7',
  lunarMonth: '十',
  lunarDay: '初七',
  yearGanZhi: '丙午',
  yi: ['会友', '订约'],
  ji: ['远行'],
  redact: '林晓 1990-05-20 08:30 杭州',
})

test('maps a vertical card with date, lunar line, score, color, number, direction and one yi/ji', () => {
  const card = cardApi.buildFortuneCard(source())
  assert.equal(card.width / card.height, 1080 / 1440)
  assert.equal(card.solarDate, '2026年11月16日')
  assert.equal(card.weekday, '周一')
  assert.equal(card.lunarLine, '十月初七 · 丙午 · 甲子日')
  assert.equal(card.relation, '食神')
  assert.equal(card.score, 5)
  assert.equal(card.luckyColor, '天蓝色')
  assert.equal(card.colorSwatch, '#7eb6e6')
  assert.equal(card.luckyNumber, '7')
  assert.equal(card.luckyDirection, '北方')
  assert.equal(card.yi, '会友')
  assert.equal(card.ji, '远行')
  assert.equal(card.footer, '猫来运转')
  assert.match(card.summary, /今天适合把一件小事做完/)
})

test('omits lucky number and score when the source does not provide them', () => {
  const card = cardApi.buildFortuneCard({ ...source(), luckyNumber: '', dayRelation: '驿马', luckyDirection: '  ' })
  assert.equal(card.luckyNumber, null)
  assert.equal(card.score, null)
  assert.equal(card.luckyDirection, null)
  assert.equal(card.relation, '驿马')
})

test('keeps name, birth time and links off the card even if the essay repeats them', () => {
  const card = cardApi.buildFortuneCard({
    ...source(),
    fortuneText: '林晓生于1990-05-20 08:30，详见 https://example.com/card?user=林晓 。今天宜散步。',
    luckyNumber: 'https://evil.test',
  })
  const packed = JSON.stringify(card)
  for (const secret of ['林晓', '1990-05-20', '08:30', '杭州', 'http', 'example.com', 'qr', '出生']) {
    assert.equal(packed.includes(secret), false, secret)
  }
  assert.equal(card.luckyNumber, null)
  assert.equal(card.footer, '猫来运转')
  assert.match(card.summary, /今天宜散步/)
})

test('uses one short almanac item and a calm fallback when the essay is empty', () => {
  const card = cardApi.buildFortuneCard({
    date: '2026-01-01',
    yi: ['', '沐浴'],
    ji: [],
    fortuneText: '   ',
  })
  assert.equal(card.solarDate, '2026年1月1日')
  assert.equal(card.weekday, '周四')
  assert.equal(card.yi, '沐浴')
  assert.equal(card.ji, null)
  assert.equal(card.summary, '今天按自己的节奏来就好。')
  assert.equal(card.lunarLine, '')
})

test('wraps long CJK lines without splitting a character and keeps explicit breaks', () => {
  const measure = text => [...text].reduce((width, char) => width + (char.charCodeAt(0) > 255 ? 2 : 1), 0)
  const text = '今天适合慢慢走。\n不要一次答应太多事情。'
  const lines = cardApi.wrapText(text, 10, measure)
  assert.equal(lines.join(''), text.replace('\n', ''))
  assert.ok(lines.length > text.split('\n').length)
  for (const line of lines) assert.ok(measure(line) <= 10, line)
  assert.equal(lines[1].startsWith('慢'), true)
})

test('adds one sign line and leaves the question off the card', () => {
  const card = cardApi.buildFortuneCard({
    ...source(),
    sign: { number: 12, grade: '上', line: '天开地辟结良缘' },
    question: '这件私事不要出现',
  })
  assert.equal(card.signLine, '第12签 · 上 · 天开地辟结良缘')
  assert.equal(JSON.stringify(card).includes('这件私事不要出现'), false)
  assert.equal(JSON.stringify(card).includes('算命'), false)
})

test('omits a sign line when the slip is incomplete', () => {
  const card = cardApi.buildFortuneCard({ ...source(), sign: { number: 0, grade: '上上', line: '天开地辟结良缘' } })
  assert.equal(card.signLine, null)
})

test('clips a long essay on a sentence boundary', () => {
  const sentence = '今天把桌子收拾干净。'.repeat(8)
  const card = cardApi.buildFortuneCard({ ...source(), fortuneText: sentence })
  assert.ok(card.summary.length <= cardApi.SUMMARY_LIMIT + 1)
  assert.ok(card.summary.endsWith('。') || card.summary.endsWith('…'))
  assert.equal(card.summary.includes('1990'), false)
})
