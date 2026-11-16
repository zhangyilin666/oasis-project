/** Invert the host's IANA timezone mapping without relying on device-local Date parsing. */
export function resolveZonedTime(wallMillis: number, timeZone: string, choice?: 'earlier' | 'later'): { instant: Date; utcOffset: number } {
  if (typeof timeZone !== 'string' || timeZone.length > 100 || !/^(?:UTC|GMT|[A-Za-z_+-]+\/[A-Za-z0-9_+./-]+)$/.test(timeZone)) {
    throw new Error('请填写有效的 IANA 时区，例如 Asia/Shanghai')
  }
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    throw new Error('此设备不支持历史时区查询，请切换为手动 UTC 偏移并核对当年夏令时')
  }
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
    if (typeof formatter.formatToParts !== 'function') throw new Error('unsupported')
  } catch {
    throw new Error('此设备无法查询该 IANA 时区，请核对名称或改用手动 UTC 偏移')
  }
  const wallAt = (millis: number) => {
    const values: Record<string, number> = {}
    for (const part of formatter.formatToParts(new Date(millis))) if (part.type !== 'literal') values[part.type] = Number(part.value)
    const { year, month, day, hour, minute, second } = values
    if (![year, month, day, hour, minute, second].every(Number.isFinite)) throw new Error('设备时区数据不可用，请改用手动 UTC 偏移')
    return Date.UTC(year, month - 1, day, hour === 24 ? 0 : hour, minute, second)
  }
  // Both sides of nearby timezone transitions, including date-line changes.
  // Candidate instants are accepted only after an exact wall-clock round trip.
  const offsets = new Set<number>()
  for (let hours = -48; hours <= 48; hours += 6) {
    const probe = wallMillis + hours * 3_600_000
    offsets.add(wallAt(probe) - probe)
  }
  const candidates = [...offsets].map(offset => wallMillis - offset)
    .filter(instant => wallAt(instant) === wallMillis).sort((a, b) => a - b)
  if (!candidates.length) throw new Error('该当地时刻因夏令时或时区跳转而不存在，请核对出生记录；不会自动平移时间')
  if (candidates.length > 1 && !choice) throw new Error('该当地时刻出现过两次，请在「重复时刻」选择较早或较晚的一次')
  const millis = choice === 'later' ? candidates[candidates.length - 1] : candidates[0]
  return { instant: new Date(millis), utcOffset: (wallMillis - millis) / 3_600_000 }
}
