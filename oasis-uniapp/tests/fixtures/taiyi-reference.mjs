// Hand-transcribed factual entries from 《太乙金镜式经》四库本卷三 9b–14a.
// Written BEFORE the implementation. Numbers are 阳局, 太乙宫, 天目位置, 主算,
// 始击位置, 客算, 计神. Symbol names mapped via vol.2 5b–7a, not via a candidate engine.
export const taiyiSource = 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_003.txt'
export const taiyiReferences = [
  [1, 1, '申', 7, '坤', 13, '寅'],
  [2, 1, '酉', 6, '戌', 1, '丑'],
  [3, 1, '戌', 1, '亥', 40, '子'],
  [4, 2, '乾', 25, '丑', 17, '亥'],
  [5, 2, '乾', 25, '寅', 14, '戌'],
  [6, 2, '亥', 25, '辰', 10, '酉'],
  [9, 3, '艮', 3, '酉', 15, '午'],
  [12, 4, '辰', 37, '寅', 1, '卯'],
  [13, 6, '巽', 18, '辰', 19, '寅'],
  [14, 6, '巳', 10, '午', 9, '丑'],
  [18, 7, '坤', 7, '子', 26, '酉'],
  [22, 9, '乾', 16, '未', 30, '巳'],
  [24, 9, '亥', 16, '戌', 17, '卯'],
  [25, 1, '子', 39, '亥', 40, '寅'],
  [36, 4, '坤', 25, '午', 27, '卯'],
  [37, 6, '申', 1, '坤', 7, '寅'],
  [44, 8, '丑', 33, '坤', 14, '未'],
  [48, 9, '辰', 1, '寅', 5, '卯'],
  [49, 1, '巽', 24, '辰', 25, '寅'],
  [60, 4, '亥', 12, '戌', 13, '卯'],
  [61, 6, '子', 33, '亥', 34, '寅'],
  [67, 8, '巽', 25, '戌', 2, '申'],
  [72, 9, '坤', 29, '午', 31, '卯'],
].map(([ju, taiyi, skyEye, hostCount, strike, guestCount, calculationSpirit]) => ({ ju, taiyi, skyEye, hostCount, strike, guestCount, calculationSpirit, source: taiyiSource }))

// Preserve conflicting book entries, never silently rewrite them to match our formula.
export const taiyiUnresolvedReferences = [
  { ju: 39, taiyi: 6, skyEye: '戌', printedHostCount: 25, stepDerivedHostCount: 35, strike: '亥', guestCount: 34, calculationSpirit: '子' },
  { ju: 50, taiyi: 1, skyEye: '巳', printedHostCount: 6, stepDerivedHostCount: 16, strike: '午', guestCount: 15, calculationSpirit: '丑' },
]

// Complete general examples, independent prose examples and the first table row.
export const taiyiGeneralReferences = [
  { ju: 1, hostGeneral: 7, hostAssistant: 1, guestGeneral: 3, guestAssistant: 9, source: taiyiSource },
  { ju: 13, hostGeneral: 8, hostAssistant: 4, guestGeneral: 9, guestAssistant: 7, source: 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_006.txt' },
  { ju: 22, hostGeneral: 6, hostAssistant: 8, guestGeneral: 3, guestAssistant: 9, source: 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_006.txt' },
  { ju: 25, guestGeneral: 4, guestAssistant: 2, source: 'https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_009.txt' },
]
