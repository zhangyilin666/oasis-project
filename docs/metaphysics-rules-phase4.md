# 四期：八字与紫微规则对照

实现与核对日期：2026-10-03。入口为三盘同参中的可选 `compareRules=true`。用户不勾选时，八字仍为原有 6 节、紫微本命仍为原有 13 节；既有运限、摘要与主盘口径不变。勾选后各追加 3 个对照章节，列出主方案、两个单参数变体及所展示字段的差异；这些变体不作为完整流派名称，也不评定准确性高低。

## 接口与档案

`calculateBazi(input, options={})` 和 `calculateZiwei(input, options={})` 接受 `ExplorationOptions.compareRules`。仅布尔值 `true` 启用对照。可选 `ruleProfile` 标识实际生成的对照，版本为 `rules-comparison-v1`：

| 体系 | 主方案 ID | 对照 ID |
| --- | --- | --- |
| 八字 | `bazi-day2-yun1` | `bazi-day1-yun1`、`bazi-day2-yun2` |
| 紫微 | `ziwei-normal-current` | `ziwei-exact-current`、`ziwei-normal-forward` |

主盘规则与预设的完整参数同时进入章节事实，所以保存和导出可沿用当前结果快照，无需打开档案时重新计算。`comparisonIds` 只指本次附加的两个方案，不包含主方案。未开启对照时不补写此元数据，也不回填旧档案。顶层四期版本、表单和档案入口由总入口维护。

## 八字参数

锁定 `lunar-typescript@1.8.6`，使用同一已规范化的北京时间；不加入真太阳时。三个方案只改日柱 `sect` 或起运 `getYun` 的 `sect`，各使用独立 `EightChar` 实例。

| 方案 | 日柱 sect | 起运 sect | 对照内容 |
| --- | --- | --- | --- |
| 主盘口径 | 2 | 1 | 原有规则 |
| 晚子日柱归次日 | 1 | 1 | 23:00–23:59 的日柱、日主及相对日主的十神 |
| 起运按分钟折算 | 2 | 2 | 起运间隔与日期 |

两种日柱方案都沿用库对晚子时干的处理；时柱不是简单由当前显示日干重新推一次。起运 `sect=1` 使用天数和时辰差，`sect=2` 使用分钟差折算。年、月仍以节气的交接时刻划分，起运顺逆规则不改。界面展示四柱、日主、天干／藏干十神、起运完整日期、年月日时间隔及大运方向。[作者八字 API](https://6tail.cn/calendar/lunar.bazi.html)、[EightChar 源码](https://raw.githubusercontent.com/6tail/lunar-typescript/master/src/lib/EightChar.ts)、[Yun 源码](https://raw.githubusercontent.com/6tail/lunar-typescript/master/src/lib/Yun.ts)

本地代码定位：安装包 `dist/lib/EightChar.mjs` 的 `setSect/getDay/getDayGan/getYun`，以及 `dist/lib/Yun.mjs` 的构造函数。在线链接的默认分支可能更新；本次行为以锁文件和已装 1.8.6 源码为准。

### 八字参考样例

在本机另行运行 `lunar-python@1.4.8`，将输出固定在测试中，测试执行时不调用 Python。两者同属 lunar 作者的实现，因此这是跨语言核对，不能称为算法谱系独立的证明。

女，2000-08-16 23:30 UTC+08:00：

| 参数 | 四柱 | 天干十神（年／月／时） | 起运日期 |
| --- | --- | --- | --- |
| 日2、运1 | 庚辰 甲申 丙午 庚子 | 偏财／偏印／偏财 | 2003-09-26 23:30:00 |
| 日1、运1 | 庚辰 甲申 丁未 庚子 | 正财／正印／正财 | 2003-09-26 23:30:00 |
| 日2、运2 | 庚辰 甲申 丙午 庚子 | 偏财／偏印／偏财 | 2003-10-09 07:30:00 |

另测女，1990-01-01 12:00：顺行起运在两算法中分别为 1991-06-21 12:00 与 1991-06-24 06:00。22:59／23:00／次日 00:00 检查日柱不重复推进。2024-02-04 16:26／16:28 检查三个方案的年、月柱都在交节两侧切换。香港天文台的 2024 年历给出立春为 2 月 4 日 16:27；这里只用它核对分钟两侧，不据此宣称秒级校验。[香港天文台年历](https://www.hko.gov.hk/tc/gts/astron2024/files/HKO_almanac_2024.pdf)

复现 Python 参考的核心调用：`Solar.fromYmdHms(...).getLunar().getEightChar()`、`setSect(daySect)`、`getYun(0, yunSect)`；`0` 为该库的女性参数。测试固定值包括起运年月日时差与十神，没有通过待测 TypeScript 适配器生成预期。

## 紫微参数及边界

锁定 `iztro@2.6.1`、其所用 `lunar-lite@0.2.8`。三个方案都使用 `horoscopeDivide=normal`、`ageDivide=normal`、`algorithm=default`、`fixLeap=true` 和 2.6.1 的内置四化／亮度表，只分别改变以下参数：

| 方案 | yearDivide | dayDivide |
| --- | --- | --- |
| 主盘口径 | normal | current |
| 立春日年界 | exact | current |
| 晚子归次日（库规则） | normal | forward |

`exact` 在此不是精确交节时刻：已装 `lunar-lite/lib/ganzhi.js` 调用 `getYearGanByLiChun/getYearZhiByLiChun`，按立春所在日期换年。2024-02-04 00:30 与 20:30 都用甲辰，主方案仍用癸卯直到春节。页面明确写“立春日年界”。[iztro 配置文档](https://docs.iztro.com/posts/config-n-plugin)、[lunar-lite 干支实现](https://raw.githubusercontent.com/SylarLong/lunar-lite/master/src/ganzhi.ts)

`forward` 也不等于把公历输入整体加一天：`lib/star/location.js:getStartIndex` 对晚子的有效农历日数加一，月末日数回到一；`chart.lunarDate` 仍显示输入日，年、月信息未整体推进。此外 `lib/utils/index.js:fixLunarMonthIndex` 在 `timeIndex===12` 时不执行闰月后半月进月。页面分别写清“引擎原值”、日数处理和闰月例外。这里呈现的是锁定版本的参数差异，尚未完整校勘这种月末／闰月组合是否对应某一传统流派。

展示农历与干支原值、命身宫、五行局、命主／身主、紫微星落宫、生年四化及所列字段差异。没有展示的星曜与全盘差异不计入“无差异”；文字明确限定为“本次所列字段”。没有把这些本命变体的参数用于上方原有运限。

### 紫微参考样例与验收范围

采用香港天文台公农历对照表作为日历锚点，再按公开安星规则手算关键字段；不把本库再跑一次当作独立参考。[2024 对照表](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2024e.pdf)、[2000 对照表](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2000e.pdf)、[2023 对照表](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2023e.pdf)、[安星规则](https://docs.iztro.com/learn/setup)

- 2024-02-05 子时是农历腊月廿六。按月份与时支手算命身宫均在丑；癸年宫干为乙丑，对应金四局，甲年为丁丑，对应水二局。这个样例在两个年界方案间产生真实差异，另核对两年四化的星名。
- 2000-08-16 晚子，农历七月十七、命宫申、水二局。起紫微手算：17 加 1 后除 2 得 9，补数奇数退 1，落酉；有效日 18 整除 2 得 9，落戌。用于核对 `current/forward`，并验证页面仍如实显示原农历日期。
- 2023-04-05／06 是闰二月十五／十六，子时主方案命宫分别在卯／辰；晚子 `forward` 保持闰月月份，后者仍在卯。2024 除夕晚子的年干支仍为癸卯，用回归锁定并公开说明这个引擎边界，不称其已经完成全盘外部验收。

这些资料能核对日历、边界和上述关键字段；不能覆盖三个方案的全部十二宫星曜。界面与本记录均明确“未完成各方案全盘独立验收”。不据软件可配置能力推定任何预设为更正确的流派。

## 全局配置隔离

iztro 的 `config` 会合并四化／亮度覆盖表，传 `{}` 不能清空。已装 2.6.1 的 `getConfig` 返回这两张活动表的引用。本实现通过该引用删除所有覆盖项，再显式恢复五个标量参数；每次主盘开始、各对照开始／结束和异常路径均恢复。所有操作同步完成，主盘和运限的事实先提取完毕，之后才创建对照盘，不在配置切换期间 `await`。

外部未声明的覆盖表仍使当次紫微调用报错，以保留原有防伪装约束；同时清空污染，使下一次调用可恢复。未自动安装插件，也没有声称能卸载第三方插件。测试用独立实例注入比较途中的异常，验证 `finally` 能清除表与恢复标量。若将来升级 iztro 并改变 `getConfig` 引用语义，相关测试必须先通过再升级。

## 验证记录

新增 `oasis-uniapp/tests/metaphysics-rules.test.mjs`。覆盖默认不变、按参数出现差异的固定参考、晚子／午夜、立春两种精度、春节、闰月月末、对照与运限交替执行、表污染拒绝后恢复、对照中途抛错的全局清理。

本轮运行原基础测试、原紫微运限测试和前 12 项对照测试，共 68 项通过；`npx vue-tsc --noEmit` 通过。补充第 13 项闰月／年末规则边界后，重新运行完整对照测试，13／13 通过。这里的通过表示软件契约和列明参考相符，不表示全流派、全星曜或现实预测有效性验收。
