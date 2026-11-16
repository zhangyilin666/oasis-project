import { Body, Ecliptic, EquatorFromVector, GeoVector, MakeTime, RotateVector, Rotation_EQJ_EQD } from 'astronomy-engine'
import { resolveZonedTime } from '../metaphysics/timezone'
import type { BirthProfile } from '../metaphysics/types'

export const QIZHENG_RULE_VERSION = 'qizheng-modern-coordinate-reference-v1' as const
export const QIZHENG_NAMES = [
  { body: Body.Sun, name: '太阳', modernName: '太阳' },
  { body: Body.Moon, name: '太阴', modernName: '月亮' },
  { body: Body.Jupiter, name: '岁星', modernName: '木星' },
  { body: Body.Mars, name: '荧惑', modernName: '火星' },
  { body: Body.Saturn, name: '镇星', modernName: '土星' },
  { body: Body.Venus, name: '太白', modernName: '金星' },
  { body: Body.Mercury, name: '辰星', modernName: '水星' },
] as const
export type QizhengMoment = Pick<BirthProfile, 'date' | 'time' | 'utcOffset' | 'timeZone' | 'timeChoice'> & { timePrecision: 'minute' | 'approximate' }
export const QIZHENG_SOURCES = [
  { id: 'astronomy', title: 'Astronomy Engine · 现代天文坐标', url: 'https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md', version: '2.1.19', license: 'MIT' },
  { id: 'reference', title: 'Swiss Ephemeris · 独立坐标参考', url: 'https://www.astro.com/cgi/swetest.cgi', version: '公开服务 2.10.03 · 2026-10-03 校验', license: '仅使用公开数值校验，未集成代码或星历文件' },
  { id: 'tushubian', title: '《图书编》· 四余总叙', url: 'https://www.shidianguji.com/book/SK1996/chapter/1lbezbosvjrbd', version: '明代古籍电子文本；部分数字待影印校勘', license: '古籍原文为公版；本页为原创摘要' },
  { id: 'qizhengsuan', title: '《七政算内外篇》· 坐标与四余', url: 'https://zh.wikisource.org/wiki/朝鮮王朝實錄/世宗實錄/七政算內外篇', version: '内篇天行诸率、赤道宿度、第七四余星；外篇序', license: '古籍原文为公版；电子转录引用链接' },
  { id: 'mansions', title: '国家天文台研究 · 二十八宿的形成与演变', url: 'https://www.lamost.org/~yzhao/history/xiu28.html', version: '赵永恒、李勇 · 作者网页', license: '研究论文引用；本页为原创摘要' },
  { id: 'naoj', title: '日本国立天文台 · 二十八宿', url: 'https://eco.mtk.nao.ac.jp/koyomi/wiki/C6F3BDBDC8ACBDC9.html', version: '历计算室 · 2017-08-30 更新', license: '官方说明引用；本页为原创摘要' },
] as const
export const QIZHENG_GAPS = [
  { id: 'luohou', name: '罗睺', status: 'unavailable' as const, description: '古籍将罗、计与日月交道的首尾相联系。', reason: '所选底本的首尾方向、平均／瞬时模型与历元尚未完成独立校验，不直接套印度交点命名。' },
  { id: 'jidu', name: '计都', status: 'unavailable' as const, description: '与罗睺相对的传统余曜，相关规则需与罗睺成对核对。', reason: '古历交点命名与现代升／降交点的对应尚未定版，本期不输出数值。' },
  { id: 'yuebei', name: '月孛', status: 'unavailable' as const, description: '《图书编》把月孛与月行迟速相联系，《七政算》另列平行周期。', reason: '还须区分古历平行值、平均远地点和瞬时远地点；不会默认为西方某一种 Lilith。' },
  { id: 'ziqi', name: '紫气', status: 'unavailable' as const, description: '古籍将紫气与闰余相联系，并记载约二十八年的平行周期。', reason: '历元、起点、周天单位和古历数表尚缺完整影印复核及独立算例，不以“约28年”补造经度。' },
  { id: 'xiudu', name: '二十八宿与入宿度', status: 'unavailable' as const, description: '宿界须确定距星、历元及赤道／黄道口径；二十八宿不是均匀等分。', reason: '本现代坐标页不推算入宿度，也不套用印度27月宿。独立的清历黄道宿表页仅接受明确年标号与宫度，不自动接入这些现代位置。' },
  { id: 'minggong', name: '宫度、立命与运限', status: 'unavailable' as const, description: '传统星命还需指定底本的宫度、时间和立命规则。', reason: '尚未取得统一规则下的参考盘；不会将西方上升点、整宫制或周期直接改名接入。' },
] as const

export function normalizeQizhengMoment(input: QizhengMoment) {
  if (!input || typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('请填写公历日期，格式为 YYYY-MM-DD')
  if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('请填写实际采样时刻 HH:mm；不以默认中午代替未知出生时间')
  if (!['minute', 'approximate'].includes(input.timePrecision)) throw new Error('请明确选择时刻精度')
  if (input.timeChoice !== undefined && !['earlier', 'later'].includes(input.timeChoice)) throw new Error('重复时刻选项无效')
  if (!input.timeZone && (!Number.isFinite(input.utcOffset) || input.utcOffset < -12 || input.utcOffset > 14 || !Number.isInteger(input.utcOffset * 4))) throw new Error('手动 UTC 偏移须为 −12 至 +14 小时，以 0.25 小时为步长')
  const [year, month, day] = input.date.split('-').map(Number)
  const [hour, minute] = input.time.split(':').map(Number)
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (year < 1900 || year > 2099 || wall.getUTCFullYear() !== year || wall.getUTCMonth() + 1 !== month || wall.getUTCDate() !== day) throw new Error('请输入 1900–2099 年之间的有效公历日期')
  const resolved = input.timeZone ? resolveZonedTime(wall.getTime(), input.timeZone, input.timeChoice) : { instant: new Date(wall.getTime() - input.utcOffset * 3600000), utcOffset: input.utcOffset }
  const moment: QizhengMoment = { date: input.date, time: input.time, timePrecision: input.timePrecision, utcOffset: resolved.utcOffset, ...(input.timeZone ? { timeZone: input.timeZone, ...(input.timeChoice ? { timeChoice: input.timeChoice } : {}) } : {}) }
  return { moment, instant: resolved.instant }
}

export function calculateQizhengPositions(instant: Date) {
  if (!instant || !Number.isFinite(instant.getTime())) throw new Error('七政位置需要有效的 UTC 时刻')
  const time = MakeTime(instant)
  const rotation = Rotation_EQJ_EQD(time)
  return QIZHENG_NAMES.map(item => {
    const vector = GeoVector(item.body, time, true)
    const ecliptic = Ecliptic(vector)
    const equatorial = EquatorFromVector(RotateVector(rotation, vector))
    return { ...item, longitude: ecliptic.elon, latitude: ecliptic.elat, rightAscensionHours: equatorial.ra, rightAscensionDegrees: equatorial.ra * 15, declination: equatorial.dec, northPolarDistance: 90 - equatorial.dec }
  })
}

export function formatRightAscension(hours: number): string {
  if (!Number.isFinite(hours)) throw new Error('赤经必须为有限数值')
  const seconds = Math.round((((hours % 24) + 24) % 24) * 3600) % 86400
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}时${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}分${String(seconds % 60).padStart(2, '0')}秒`
}

export function calculateQizheng(input: QizhengMoment) {
  const { moment, instant } = normalizeQizhengMoment(input)
  return {
    schemaVersion: 1 as const, ruleVersion: QIZHENG_RULE_VERSION, scope: 'seven-governors-astronomical-reference' as const,
    moment, utcTime: instant.toISOString(),
    timeResolution: { mode: moment.timeZone ? 'iana' as const : 'manual' as const, utcOffset: moment.utcOffset, ...(moment.timeZone ? { timeZone: moment.timeZone, ...(moment.timeChoice ? { choice: moment.timeChoice } : {}) } : {}) },
    engine: { name: 'astronomy-engine' as const, version: '2.1.19' as const, license: 'MIT' as const },
    coordinates: { center: 'geocentric' as const, ecliptic: 'true-ecliptic-of-date' as const, equatorial: 'true-equator-of-date' as const, equinox: 'true-equinox-of-date' as const, angleUnit: 'modern-degree' as const, circleDegrees: 360 as const, rightAscensionHoursPerCircle: 24 as const },
    positions: calculateQizhengPositions(instant),
    unavailable: QIZHENG_GAPS.map(item => ({ ...item })),
    conventions: ['七政按日、月、木、火、土、金、水次序列出；本页为天文坐标对照。', '采用近似地心视位置；不按地面观测地点做视差或大气折射改正。', '黄经／黄纬使用日期真黄道，赤经／赤纬使用日期真赤道；两者均以日期真春分点为零点。', '本页一周为现代360°；赤经一周24小时，与出生钟表时刻含义不同。', '现代角度下的去极度为90°减赤纬；它不是入宿度，也不是宿内黄经。'],
    limitations: ['这是七政天文对照子体系，本结果不含四余、二十八宿、宫度、立命与运限，不能视为完整七政四余命盘。', '古历周天单位、距星与历元并不统一；本页不把现代角度直接当作古籍宿度，也不推导吉凶。', '六个时刻的独立坐标样例已校验；样例误差不能当作整个1900–2099区间的精度保证。', ...(moment.timePrecision === 'approximate' ? ['所填时刻为大约时间：所有坐标仅代表这个输入时刻，不能表达真实出生时刻的确定位置。'] : [])],
    sources: QIZHENG_SOURCES.map(source => ({ ...source })),
  }
}
export type QizhengSnapshot = ReturnType<typeof calculateQizheng>
