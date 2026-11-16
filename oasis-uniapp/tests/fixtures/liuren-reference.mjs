// Expected transmissions transcribed from independent printed examples BEFORE the engine.
// The sky and lesson strings are hand-expanded from the example's explicit month-general/hour.
// 四课 strings read 一课→四课, each lower+upper; no Gregorian date is invented for ancient examples.
const source = 'https://zh.wikisource.org/zh-hans/六壬大全/7'
export const liurenReferences = [
  { id: '元首', day: '甲子', general: '子', hour: '卯', sky: '酉戌亥子丑寅卯辰巳午未申', lessons: ['甲亥','亥申','子酉','酉午'], transmissions: '午卯子', transmissionGods: ['青龙', '朱雀', '天后'], method: '贼克', source },
  { id: '重审', day: '丙戌', general: '申', hour: '巳', sky: '卯辰巳午未申酉戌亥子丑寅', lessons: ['丙申','申亥','戌丑','丑辰'], transmissions: '申亥寅', transmissionGods: ['六合', '贵人', '玄武'], method: '贼克', source },
  { id: '比用', day: '壬辰', general: '辰', hour: '巳', sky: '亥子丑寅卯辰巳午未申酉戌', lessons: ['壬戌','戌酉','辰卯','卯寅'], transmissions: '戌酉申', transmissionGods: ['白虎', '太常', '玄武'], method: '比用', source },
  { id: '涉害_俱比', day: '丁卯', general: '亥', hour: '丑', sky: '戌亥子丑寅卯辰巳午未申酉', lessons: ['丁巳','巳卯','卯丑','丑亥'], transmissions: '亥酉未', method: '涉害', source },
  { id: '涉害_俱不比', day: '庚子', general: '申', hour: '戌', sky: '戌亥子丑寅卯辰巳午未申酉', lessons: ['庚午','午辰','子戌','戌申'], transmissions: '午辰寅', method: '涉害', source },
  { id: '涉害_见机', day: '庚戌', general: '申', hour: '辰', sky: '辰巳午未申酉戌亥子丑寅卯', lessons: ['庚子','子辰','戌寅','寅午'], transmissions: '辰申子', method: '涉害', source },
  { id: '涉害_察微', day: '甲午', general: '午', hour: '辰', sky: '寅卯辰巳午未申酉戌亥子丑', lessons: ['甲辰','辰午','午申','申戌'], transmissions: '辰午申', method: '涉害', source },
  { id: '遥克_蒿矢', day: '壬辰', general: '申', hour: '巳', sky: '卯辰巳午未申酉戌亥子丑寅', lessons: ['壬寅','寅巳','辰未','未戌'], transmissions: '戌丑辰', method: '遥克', source },
  { id: '遥克_弹射', day: '壬申', general: '亥', hour: '申', sky: '卯辰巳午未申酉戌亥子丑寅', lessons: ['壬寅','寅巳','申亥','亥寅'], transmissions: '巳申亥', method: '遥克', source },
  { id: '昴星_阳', day: '戊申', general: '辰', hour: '卯', sky: '丑寅卯辰巳午未申酉戌亥子', lessons: ['戊午','午未','申酉','酉戌'], transmissions: '戌酉午', method: '昴星', source },
  { id: '昴星_阴', day: '丁丑', general: '丑', hour: '辰', sky: '酉戌亥子丑寅卯辰巳午未申', lessons: ['丁辰','辰丑','丑戌','戌未'], transmissions: '子辰戌', method: '昴星', source },
  { id: '别责_阳', day: '丙辰', general: '辰', hour: '卯', sky: '丑寅卯辰巳午未申酉戌亥子', lessons: ['丙午','午未','辰巳','巳午'], transmissions: '亥午午', method: '别责', source },
  { id: '八专_阳', day: '甲寅', general: '丑', hour: '辰', sky: '酉戌亥子丑寅卯辰巳午未申', lessons: ['甲亥','亥申','寅亥','亥申'], transmissions: '丑亥亥', method: '八专', source },
  { id: '八专_阴', day: '丁未', general: '辰', hour: '丑', sky: '卯辰巳午未申酉戌亥子丑寅', lessons: ['丁戌','戌丑','未戌','戌丑'], transmissions: '亥戌戌', method: '八专', source },
  { id: '八专_独足', day: '己未', general: '酉', hour: '未', sky: '寅卯辰巳午未申酉戌亥子丑', lessons: ['己酉','酉亥','未酉','酉亥'], transmissions: '酉酉酉', method: '八专', source },
  { id: '伏吟_有克', day: '癸丑', general: '午', hour: '午', sky: '子丑寅卯辰巳午未申酉戌亥', lessons: ['癸丑','丑丑','丑丑','丑丑'], transmissions: '丑戌未', method: '伏吟', source },
  { id: '伏吟_阳', day: '丙辰', general: '申', hour: '申', sky: '子丑寅卯辰巳午未申酉戌亥', lessons: ['丙巳','巳巳','辰辰','辰辰'], transmissions: '巳申寅', method: '伏吟', source },
  { id: '伏吟_阴', day: '丁丑', general: '未', hour: '未', sky: '子丑寅卯辰巳午未申酉戌亥', lessons: ['丁未','未未','丑丑','丑丑'], transmissions: '丑戌未', method: '伏吟', source },
  { id: '伏吟_自刑', day: '壬辰', general: '酉', hour: '酉', sky: '子丑寅卯辰巳午未申酉戌亥', lessons: ['壬亥','亥亥','辰辰','辰辰'], transmissions: '亥辰戌', method: '伏吟', source },
  { id: '返吟_有克', day: '庚戌', general: '申', hour: '寅', sky: '午未申酉戌亥子丑寅卯辰巳', lessons: ['庚寅','寅申','戌辰','辰戌'], transmissions: '寅申寅', method: '返吟', source },
  { id: '返吟_无克', day: '辛丑', general: '亥', hour: '巳', sky: '午未申酉戌亥子丑寅卯辰巳', lessons: ['辛辰','辰戌','丑未','未丑'], transmissions: '亥未辰', method: '返吟', source },
  { id: '别责_阴', day: '辛酉', general: '亥', hour: '子', sky: '亥子丑寅卯辰巳午未申酉戌', lessons: ['辛酉','酉申','酉申','申未'], transmissions: '丑酉酉', method: '别责', source: 'https://www.dao-mind.com/zh-HK/library/liuren/daliuren-tanyuan' },
]
