import type { Tradition, ChartSource, SystemId } from './types'

/** Available means a shipped calculator or explicitly scoped cultural record tool. */
export const TRADITIONS: Tradition[] = [
  { id: 'practice', name: '静心与修习', category: '山', status: 'available', summary: '三种原创练习主题、可暂停计时与练习笔记。', scope: '支持后台计时与刷新恢复，完成后可保存、回看并导出记录。', phase: '第五阶段 · 修习记录已接入' },
  { id: 'seasonal-care', name: '节气与养生文化', category: '医', status: 'available', summary: '按日期和主题阅读四时文化、公共健康资料，留下习惯与作息笔记。', scope: '七张自写来源卡区分传统文化与现代科普；按 UTC+8 中午取节气区间，不由命盘生成诊疗方案。', phase: '第七阶段 · 文化与生活记录已接入' },
  { id: 'bazi', name: '四柱八字', category: '命', status: 'available', summary: '四柱、十神、藏干、大运，以及精确到观测时分的流年流月。', scope: '独立运限页列十二节月界与十神；未作真太阳时校正。', phase: '第七阶段 · 细分运限已接入' },
  { id: 'ziwei', name: '紫微斗数', category: '命', status: 'available', summary: '本命十二宫及大限、小限、流年、流月、流日、流时与各层四化。', scope: '独立运限页固定年界／日界配置，超出支持的小限不补造。', phase: '第七阶段 · 细分运限已接入' },
  { id: 'western', name: '西方占星', category: '命', status: 'available', summary: '本命、行运，整宫／上升等宫对照，以及双人跨盘主要相位。', scope: '双人各自保留资料与时间精度，统一6°容许度；未实现中点组合盘，时间不详不补四轴宫位。', phase: '第七阶段 · 宫制与双人相位已接入' },
  { id: 'qizheng', name: '七政四余', category: '命', status: 'available', summary: '七政现代黄赤道坐标对照，以及独立的清代黄道二十八宿表查算。', scope: '古表接受明确年标号与宫度，不把现代星位直接套入；四余、赤道宿度、立命与运限未核，不输出完整星命盘。', phase: '第八阶段 · 七政对照与清历宿度已接入' },
  { id: 'jyotish', name: '印度占星', category: '命', status: 'available', summary: '七曜恒星黄道 D1／D9、27 月宿与 Vimshottari 大运、分运。', scope: '采用注明误差的 Lahiri 近似岁差、整宫制与 365.25 日计年；不含未经核验的罗喉计都。', phase: '第六阶段 · 最小本命与运期已接入' },
  { id: 'almanac', name: '黄历与节气', category: '命', status: 'available', summary: '按日期浏览农历、干支、前后节气及交节时刻。', scope: '上方黄历入口采用固定 UTC+8；历法事实与传统宜忌分别展示。', phase: '第四阶段 · 日期浏览已接入' },
  { id: 'date-selection', name: '择日', category: '命', status: 'available', summary: '按四类事项、1–31 天区间、可用星期与排除日期逐条筛选。', scope: '可只用现实日程，或核对固定传统宜忌；忌优先，规则未涵盖单列，不给吉日总分。', phase: '第六阶段 · 可解释日期筛选已接入' },
  { id: 'names', name: '姓名文化', category: '命', status: 'available', summary: '116 字的 Unihan 字形、读音、字义摘要及笔画来源。', scope: '保留简繁原字、个人确认读音和笔记；未收录字符不补造资料，不做命运评分。', phase: '第六阶段 · 文化词条与笔记已接入' },
  { id: 'fengshui', name: '堪舆与空间', category: '相', status: 'available', summary: '独立空间档案，以及真北坐山起伏位的八宅游年对照。', scope: '八宅须明确坐向含义、测量依据与不确定度；未知或磁北不自动换算，未接玄空飞星。', phase: '第八阶段 · 八宅游年对照已接入' },
  { id: 'physiognomy', name: '相学文化', category: '相', status: 'available', summary: '八条可检索术语与文献词条、原创三停示意和独立阅读笔记。', scope: '保留固定资料版本与题署争议；不收个体照片作人格、身份、健康或命运推断。', phase: '第七阶段 · 文化词条已接入' },
  { id: 'liuyao', name: '六爻与纳甲', category: '卜', status: 'available', summary: '自动三钱模拟或六爻手录；本变卦、动爻与独立纳甲事实。', scope: '可明确选择发送本次卦象，获取结合《周易》经文的 AI 解读；纳甲保留世应、六亲、六神、旬空及伏神候选，未自动选用神或断应期。', phase: '自动起卦与经文解读' },
  { id: 'meihua', name: '梅花易数', category: '卜', status: 'available', summary: '两数或年月日时起卦，本互变卦、动爻与体用五行关系。', scope: '时间法按固定北京时间农历取数；可在生成卦象后请求 AI 结合经文解读，原始输入和算法事实独立保留。', phase: '时间、两数与经文解读' },
  { id: 'qimen', name: '奇门遁甲', category: '卜', status: 'available', summary: '时家转盘拆补法：完整九宫、门星神、天地盘、值符值使与推导。', scope: '固定 UTC+8、23点换日、天禽恒寄坤二，保留交节时刻与起局依据；不混用其他盘法。', phase: '第六阶段 · 单盘法已接入' },
  { id: 'liuren', name: '大六壬', category: '卜', status: 'available', summary: '天地盘、四课、三传与推导，可按公历时刻或古例条件核对。', scope: '固定月将、昼夜和贵人规则；九宗门按注明底本处理，无法判定时明确报错。', phase: '第七阶段 · 古例与课式已接入' },
  { id: 'taiyi', name: '太乙', category: '卜', status: 'available', summary: '《金镜式经》岁计积年、阳局、太乙天目、始击与主客行算。', scope: '固定724年锚与太乙专用九宫；39、50局冲突字段待校勘，不混用其他纪元或月日时计。', phase: '第八阶段 · 单一岁计已接入' },
  { id: 'tarot', name: '塔罗', category: '卜', status: 'available', summary: '78 张牌的文字手录、单张／三张／自定义牌阵、正逆位与复盘笔记。', scope: '独立牌阵记录，保存后原样回看；不随机抽牌、不自动生成牌义预测。', phase: '第五阶段 · 文字记录已接入' },
]

export const SOURCES: Record<SystemId, ChartSource> = {
  bazi: { title: 'lunar-typescript', version: '1.8.6', license: 'MIT', url: 'https://github.com/6tail/lunar-typescript' },
  ziwei: { title: 'iztro', version: '2.6.1', license: 'MIT', url: 'https://github.com/SylarLong/iztro' },
  western: { title: 'Astronomy Engine', version: '2.1.19', license: 'MIT', url: 'https://github.com/cosinekitty/astronomy' },
}
