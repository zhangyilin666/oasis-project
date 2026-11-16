# 五术与多体系排盘：调研及实施路线

调研日期：2026-10-03（Asia/Shanghai）。本文区分已核验的上游能力、项目设计建议与待验证事项；分期矩阵不是已交付功能清单。

后续已完成十八个板块的逐项研究，最新范围、证据和接入顺序见[总路线](metaphysics-integration-roadmap.md)及其中四份专题；本文保留最初立项时的判断。

## 1. 结论与现有基础

近期可落地的组合是：保留 Python 八字报告，在 uni-app 增加本地计算的多体系探索入口，使用 `lunar-typescript`、`iztro`、`astronomy-engine` 展示同一份出生资料的八字、紫微斗数和西方本命行星位置。三者均有 MIT 许可来源；不需要新增 Python 调 Node 的常驻服务。先把时间口径、可复现盘面与资料出处做完整，再接跨体系解释。

现有 `python_backend/app/services/calendar_service.py` 使用 `lunar-python`；`requirements.txt` 固定为 1.4.8。现有手机端为 Vue/uni-app。已有 [传统文化接入记录](wisdom-integration.md) 实现了八字报告结构化事实核对、引用快照与词典。新体系应沿用“计算事实 → 规则说明 → 资料引用 → 文化解释”的分层，而非让模型根据生日直接猜测星曜、行星或卦象。

“山、医、命、相、卜”在这里作为产品组织方式，分支归属可重叠。西方星盘属于新增的跨文化体系，不据此声称它本来属于中国五术。天文位置或程序规则可验证；象征解释及人生预测不能因为计算正确就标注“已验证有效”。

## 2. 五术能力矩阵

以下是本项目建议的能力边界与先后顺序，不是对传统学科的完整历史分类。

| 方向 | 软件中的具体能力 | 必要输入 | 建议阶段 | 验收重点 |
| --- | --- | --- | --- | --- |
| 山 | 经典阅读、静心计时、练习记录、个人反思 | 自选主题、练习时间 | P1 目录，P2 内容与记录 | 内容出处、可暂停、无神效承诺 |
| 医 | 中医文化词典、节气知识、有来源的作息与健康生活知识 | 自选主题；无需命盘 | P1 说明，P2 编辑内容 | 不由五行、疾厄宫或照片诊断疾病，不提供处方 |
| 命·八字 | 四柱、十神、藏干、节气、大运与规则对照 | 日期、时间、排盘性别参数、历法口径 | 既有后端；P1 本地探索 | 与既有引擎固定样例对照；年/月/日边界 |
| 命·紫微 | 十二宫、主辅星、四化、命身宫、五行局；再加大限流年 | 日期、时辰、排盘性别参数、闰月及换日规则 | P1 本命，P2 运限 | 十二宫完整、晚子时与闰月、流派配置记录 |
| 命·西方星盘 | 太阳/月亮/行星黄经、黄道星座、明确容许度的相位 | 出生瞬间及 UTC 偏移；宫位另需经纬度 | P1 行星，P2 宫位与行运 | 地心/日心、坐标系、UTC、容许度、未知时间降级 |
| 卜·易经基础 | 手动六爻记录、本卦/变卦、卦名、卦爻词典 | 自下而上的六爻值，起卦方式和记录时间 | P1 或 P2 独立模块 | 6/7/8/9 变爻规则、64 卦映射、记录可复现 |
| 卜·六爻纳甲 | 纳甲、世应、六亲、六神、旬空、用神选择记录 | 六爻记录、问事时间、规则版本 | P2 | 独立参考样例；不把基础变卦称为完整六爻断卦 |
| 卜·梅花 | 数字/时间起卦、互变卦、体用关系 | 用户指定数字或时刻及起卦法 | P2 | 取数来源、余数为零处理、时辰及历法口径 |
| 卜·奇门 | 九宫、三奇六仪、九星八门、值符值使 | 问事时刻、地点/时间口径、盘法 | P3 | 转/飞盘、拆补/置闰、寄宫、子时等分歧 |
| 相·空间 | 户型方位记录、采光通风收纳自查、风水文化图层 | 户型、实测朝向、方位基准；部分派别另需建造时期 | P2 实用空间记录，P3 传统盘法 | 测量误差、真北/磁北、分派规则；不承诺改运 |
| 相·面相/手相文化 | 名词、图解与典籍背景 | 自选词条 | P3 内容评估 | 不从个人照片推断品格、能力、命运、疾病或敏感属性 |
| 扩展 | 七政四余、印度占星、大六壬、太乙、择日、姓名文化 | 每种独立定义 | P3 后续候选 | 逐个核验算法、文献和许可，保持独立体系标识 |

“医”建议从国家卫健委的健康素养知识组织日常内容，传统理论另标“文化知识”。不能用生日推导体质、药物或疾病风险。所查官方资料是内容来源候选，尚未导入或进行医学内容审核。[国家卫健委：2024 年版健康素养通知](https://www.nhc.gov.cn/xcs/c100123/202405/73a4927142f34152abed875634a3c13b.shtml)

## 3. 算法库与许可核验

版本来自本次直接读取 NPM registry 的 `latest` 元数据，实施时应固定版本和 lockfile；不是将来持续有效的“最新版”声明。上游 README 的营销性预测主张不作为软件能力证据。

| 库 | 本次查证结果 | 适用范围 | 本项目建议 |
| --- | --- | --- | --- |
| `iztro` 2.6.1 | registry 声明 MIT；作者 LICENSE 为 MIT。依赖 dayjs、i18next、lunar-lite、lunar-typescript | TypeScript/JS 紫微盘面、宫位星曜、运限 | 首选紫微本命引擎；不用其托管 AI 代替本地计算 |
| `astronomy-engine` 2.1.19 | registry 与作者 LICENSE 为 MIT；registry 无运行依赖；作者提供 JS/TS 与 Python 等实现 | 天体位置和坐标转换 | 首选本地行星坐标引擎；自行清晰定义占星相位规则 |
| `lunar-typescript` 1.8.6 | registry 与作者 LICENSE 为 MIT；registry 无运行依赖；iztro 本身依赖其兼容版本范围 | 农历、节气、干支、八字 | 手机端基础历法；避免再重复加入 lunar-javascript |
| `lunar-python` 1.4.8（项目当前固定） | 作者 LICENSE 为 MIT；本项目已有集成 | 后端既有八字与报告 | 保留；前后端版本不同，必须对比样例，不假设所有边界一致 |
| `sxtwl` / `sxtwl_cpp` | 作者仓库 LICENSE 为 BSD 3-Clause | C++/Python 中国历法和节气 | 作为将来第二历法实现和后端候选；本次未安装、未对精度独立验收 |
| Swiss Ephemeris | 作者明确提供 AGPL 与 Professional 双许可 | 行星、宫位及更广占星因子 | 专业宫制阶段再选；不能按 MIT 库的方式直接加入闭源产品 |
| `kinqimen` | README 声称 MIT，列出 sxtwl/kinliuren/Streamlit/pendulum；本次 LICENSE 链接未能取回 | Python 奇门候选，README 提及拆补/置闰 | 仅候选；独立许可文件、依赖与盘法样例待核验，不引入本期 |

对应一手来源：[iztro 仓库](https://github.com/SylarLong/iztro)、[iztro LICENSE](https://raw.githubusercontent.com/SylarLong/iztro/main/LICENSE)、[Astronomy Engine 仓库](https://github.com/cosinekitty/astronomy)、[Astronomy Engine LICENSE](https://raw.githubusercontent.com/cosinekitty/astronomy/master/LICENSE)、[lunar-typescript 仓库](https://github.com/6tail/lunar-typescript)、[lunar-typescript LICENSE](https://raw.githubusercontent.com/6tail/lunar-typescript/master/LICENSE)、[lunar-python LICENSE](https://raw.githubusercontent.com/6tail/lunar-python/master/LICENSE)、[sxtwl LICENSE](https://raw.githubusercontent.com/yuangu/sxtwl_cpp/master/LICENSE)、[Swiss Ephemeris 作者许可说明](https://www.astro.com/swisseph/swephinfo_e.htm)、[kinqimen 作者仓库](https://github.com/kentang2017/kinqimen)。MIT/BSD 代码交付时保留对应版权和许可声明；第三方文献、图片及翻译需另行核验，不能由算法库许可推导其授权。

### 紫微 API 与流派配置

`astro.bySolar(date, timeIndex, gender, fixLeap, language)` 的时辰索引是 0 到 12，区分早子时和晚子时；`fixLeap` 默认启用，按闰月前后半月调整排盘月。用本地日期字符串，不让设备时区偷偷改写生日。[iztro 快速开始](https://docs.iztro.com/quick-start)

规则需写入结果：`yearDivide`（正月初一/立春）、`dayDivide`（晚子归次日/当日）、`algorithm`（default/zhongzhou），以及四化、亮度、闰月设置。`config()` 和 `withOptions({config})` 都会改变全局配置，适配器应每次显式设置完整受支持选项，防止先前排盘影响下一次结果。[iztro 配置文档](https://docs.iztro.com/posts/config-n-plugin)

作者 README 现同时介绍紫微与奇门托管 AI；其中明确说明 NPM `iztro` 包仍是紫微库，奇门不是其本地排盘模块。不能把安装 iztro 写成“已支持奇门”。[作者 README](https://github.com/SylarLong/iztro)

### 西方本命行星的计算口径

使用 `Ecliptic(GeoVector(body, utcDate, true)).elon` 获取地心、当日真黄道的黄经。`EclipticLongitude` 是日心函数，不能直接拿来算本命行星落座。黄经来自天文引擎；星座划分、相位名称和容许度属于应用声明的规则。[Astronomy Engine JS API](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md)

第一版建议固定回归黄道，展示太阳、月亮、水金火木土天海冥的黄经与所在 30° 区间；相位只做合、六合、刑、拱、冲，并公开各自容许度。同一 UTC 瞬间的地心行星位置不依赖出生地点，因此这版可以不收经纬度。ASC、MC、宫头需要地点和另外的计算/验收，不应以行星列表冒充完整宫位星盘。恒星黄道及其岁差量选项留在后续独立配置。

### 八字的前后端一致性

`Solar.fromYmdHms(...).getLunar().getEightChar()` 适合显式墙钟字段。作者源码中 `Solar.fromDate` 读取 JavaScript 设备本地日期与时间，不适合直接消费一个已转 UTC 的 Date。[Solar 源码](https://raw.githubusercontent.com/6tail/lunar-typescript/master/src/lib/Solar.ts)

`EightChar` 默认 `sect=2`，`setSect(1)`/`setSect(2)` 控制晚子时日柱口径；年/月使用精确干支方法。`Lunar` 的日柱 Exact 在 23 点前进，Exact2 不前进，时柱另按库规则计算。因此“统一换日”要先明确定义，不能只改一个布尔值就宣称所有派别等价。[EightChar 源码](https://raw.githubusercontent.com/6tail/lunar-typescript/master/src/lib/EightChar.ts)、[Lunar 源码](https://raw.githubusercontent.com/6tail/lunar-typescript/master/src/lib/Lunar.ts)

## 4. 共享出生档案，但保留不同时间语义

建议把下列信息作为一次计算的可追溯输入，而不只保存“1990-01-01 12:00”文本：

| 字段 | 用途 |
| --- | --- |
| 用户原始日期、历法、闰月标记 | 防止农历转换后丢失输入含义 |
| 出生地民用日期和时间、精度 | 精确分钟、只知时辰、不详需要不同处理 |
| 时区 ID、当日 UTC 偏移、夏令时选择 | 得到确定的 UTC 瞬间；不能使用设备所在时区 |
| 出生地点名称、经纬度（按需） | 将来宫位、地方太阳时；行星基础盘无需强制收集 |
| 排盘性别参数（仅需要的体系） | 记录传统顺逆排运输入，不扩展推断其他个人属性 |
| 历法计算时标、日界、年界、真太阳时选项 | 明确中文体系采用的规则；保留未经校正的原始时间 |
| 引擎名、版本、规则版本、计算时间 | 复现旧盘，并区分升级前后差异 |

IANA 时区库保存各地历史 UTC 偏移与夏令时规则。中国出生记录也不能全部视为固定 +08：tzdb 的 PRC 规则记录了 1986—1991 年夏令时。若第一版仅接受显式 UTC 偏移，界面必须说明偏移包含出生当天夏令时、尚未自动查询历史时区；不能显示“已自动校正”。[IANA 时区说明](https://www.iana.org/time-zones)、[tzdb Asia 数据](https://raw.githubusercontent.com/eggert/tz/main/asia)

Python 后续可用标准库 `zoneinfo`，Windows 或精简镜像需明确提供 tzdata；DST 重复时刻/不存在时刻必须显式处理，而不是任意选一个结果。[Python zoneinfo 文档](https://docs.python.org/3/library/zoneinfo.html)

中文历法库通常围绕中国历法的日期和节气口径工作，不应把全球任意墙钟时间直接等同于同一节气时标。实现有两个可审查选择：P1 明确限定中国标准时间输入；或在统一时间层分别转换出生地民用时、UTC、中文历法参考时刻，并逐项测试。不能先把全球生日全部转成北京时间，又把结果称为出生地本地时辰。

真太阳时需要经度与均时差；“每度四分钟”的经度改正本身不是完整真太阳时算法。暂未实现时明确标记民用时，不显示假校正结果。未知出生时间不应悄悄填 12:00 后给出确定的时柱、命身宫、月亮度数或宫位；可提示补资料，或提供标明计算时刻的日范围示意。

## 5. 如何做到融通且可核对

建议使用共享的档案和主题导航，以及独立的结果对象：

```text
BirthProfile / EventContext
  → TimeNormalization + RuleProfile
  → BaziAdapter / ZiweiAdapter / NatalAdapter / DivinationAdapter
  → ChartResult { system, engine, version, input, rules, facts, limits }
  → ThemeComparison { theme, observations[], differences[], references[] }
  → 可选文化解释、反思问题、用户自己的行动记录
```

这是项目架构建议，不是传统理论之间存在严格数学同构的声明。

1. 主题可以统一为“自我认识、关系、工作学习、生活节律、居住环境、当下问题”；每条观察仍写明来源体系与具体盘面字段。
2. 八字的五行、紫微的五行局、西方的四元素分别显示原名和定义；不把同一个“火”字自动合并计分。
3. 紫微太阳/太阴属于该体系的星曜名称，西方太阳/月亮属于天文对象；界面通过体系标签避免误认成同一颗星的同一种计算。
4. 对照结果允许“主题相近”“侧重点不同”“缺少足够资料”，禁止用体系数量投票生成准确率或预测置信分。
5. 卜问需要独立 `EventContext`，包含问题和起卦记录；不能用出生档案替代所有问事时刻。保存首次输入，不在刷新页面时重新起卦。
6. AI 接入时，每个体系单独声明事实字段与引用 ID；缺失字段、不支持的术法或不确定时间应返回限制。现有八字核对器只覆盖八字，不能把紫微/星盘附文自动盖上同一“已核对”标记。

## 6. 卜、相与内容资料的下一步

易经基础模块可以先自行实现小型确定性规则：六个自下而上的爻值、阴阳与动爻、本卦/变卦，再保存其计算过程。三枚钱币、蓍草和手工输入的来源需分别记录；不同起卦方式不能共用一个未经说明的随机分布。完整六爻还需要纳甲、世应等规则，不与基础卦象展示混称。

典籍资料应逐条登记书名、版本、卷章、整理/翻译作者和授权。中国哲学书电子化计划所列《周易·系辞上》可作为古籍定位入口；《梅花易数》有不同数字化底本，搜索发现并不等于文本已校勘或取得再分发权。本次没有抓取整本古籍、导入现代解释或复制第三方断语。[《周易·系辞上》](https://ctext.org/book-of-changes/xi-ci-shang)、[《梅花易数》底本入口](https://ctext.org/wiki.pl?if=en&res=724043)

奇门先定规则配置和参考盘集，再选库。即使一个项目自称拥有“权威金标准”，本项目也需要独立核对来源、日期、盘法和逐宫结果。风水先做户型标注与方位事实记录；传统罗盘盘层和玄空等流派另行立项，不从手机一次磁罗盘读数直接推导确定结论。

## 7. 分期交付与验收门槛

### P1：可用的探索入口

- 五术导航说明每个分支用途、所需资料和实际开放状态。
- 同份明确时间口径的出生输入，生成真实的八字、紫微本命、地心行星基础结果；未实现的宫位/奇门保持待开发说明。
- 每个盘面展示算法来源与规则；本地计算失败时不退回模拟盘。
- 本地入口不自动把用户出生信息发给新的第三方服务。已有 AI 报告是否上传与其现有流程一致，界面分清入口。
- 新依赖固定版本，附带实际安装版本的第三方许可；旧八字报告继续可打开。

### P2：工具补全与可追溯比较

- 统一档案的历史时区、资料精度与导出；紫微运限；经独立对照的宫位/ASC/MC。
- 六爻基础到纳甲、梅花起卦与记录；五术知识卡、静心记录和有来源的健康生活内容。
- 主题对照先采用结构化、可检查的字段；需要 AI 时扩展每种体系的事实契约与资料快照。

### P3：专业扩展

- 奇门、风水盘法、七政四余及其他体系逐个注册；每个适配器有独立规则版本、许可和参考样例。
- 流派差异可以生成并排盘面，解释差异来源；不能静默替用户挑一张“最吉”的结果。
- 内容审核后扩展典籍与现代解释，支持回溯到具体版本和段落。

### 必须覆盖的验证样例

| 类别 | 需要核对的边界 |
| --- | --- |
| 输入 | 真实闰年、无效日期、闰月、时区偏移范围、时间不详 |
| 中文历法 | 立春前后、节气换月、23:00/00:00、闰月前后半月 |
| 紫微 | 作者示例盘、十二宫数据、主星/四化、两种晚子归属、配置连续调用 |
| 星盘 | 同一瞬间不同 UTC 偏移表达结果相同；黄经 0/360 环绕；相位在容许度内外 |
| 时区 | 1986—1991 中国夏令时、海外重复与缺失时刻、设备时区不同 |
| 融合 | 不同体系年份/时间口径差异可见；不支持字段无虚构值；旧报告兼容 |
| UI | 320/390px 手机布局、长星名、多宫位展示、输入错误、加载失败、离线后计算 |

历法对照可使用香港天文台的公农历对照与节气资料；必须记录参考表的时区和日期精度，不能用仅到“日”的表验证秒级交节。天文台指出节气按太阳黄经定义，其数据属于历法事实验证，不证明术数解释有效。[公农历对照](https://www.hko.gov.hk/sc/gts/time/conversion.htm)、[二十四节气](https://www.hko.gov.hk/sc/gts/time/24solarterms.htm)

## 8. 本次实际查证范围

- 已读取本项目传统文化接入文档、当前后端历法服务/依赖与手机端 package.json。
- 已在线核验上述作者仓库、MIT/BSD 原始许可文件、Swiss Ephemeris 作者许可说明；kinqimen 许可文件取回失败已单独标注。
- 已直接读取 NPM registry `iztro`、`astronomy-engine`、`lunar-typescript` 的版本、license 和 dependencies 元数据。
- 已读取 iztro API/配置说明、Astronomy Engine 坐标 API，以及 lunar-typescript 的 Solar/EightChar/Lunar 源码时间语义。
- 已查 IANA/tzdb、Python zoneinfo、香港天文台和国家卫健委一手资料。
- 本调研没有安装或运行候选库、没有跨引擎数值精度验收、没有验证奇门/六爻/风水所有流派，也没有验证现实预测效果。实际实现与测试结果应另记在交付记录，不能由本文推导“全部已支持”。
