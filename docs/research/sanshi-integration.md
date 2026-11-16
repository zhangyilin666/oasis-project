# 三式接入调研：奇门遁甲、大六壬、太乙

检索日期：2026-10-03（Asia/Shanghai）。本文件是接入决策与验收方案，不代表三个计算模块已经交付。阅读了本项目 `docs/metaphysics-research-2026-10-03.md`，本轮未安装候选依赖、未运行候选引擎、未复制第三方计算代码或整部典籍到产品。

## 1. 接入结论

三式应登记为三个独立体系，复用问事档案、时间归一、规则版本和结果保存。不能仅因同属“三式”就把三套结果拼成一个准确率，也不能把大六壬误接成现有六爻功能的别名。

| 体系 | 建议的第一个可用范围 | 优先候选与部署方向 | 当前实际缺口 |
| --- | --- | --- | --- |
| 奇门遁甲 | 指定一套规则的时家九宫盘；阴阳遁、局数、三奇六仪、星门神、值符值使及排盘过程 | `3meta` 可先做前端隔离验证；Python `kinqimen` 作源码研究/对照候选 | 完整独立参考盘未验收；`kinqimen` 独立 LICENSE 未取得；寄宫规则和时间语义不能默认相同 |
| 大六壬 | 月将、天地盘、四课、三传、天将、旬空，带课法与贵人规则标记 | `kinliuren` 核心可在既有 Python 后端隔离适配；前端只负责录入/呈现 | 核心不接受完整时间上下文；九宗门特殊课例与贵人两套规则尚无本项目参考盘集 |
| 太乙 | 一种底本、一个计式的研究盘，例如金镜年计；显示积年、局数与基础落宫 | `kintaiyi` 在 Python 后端隔离验证 | 版本分裂、数据资产出处、基础固定盘、古历与现代历法换算；首版不同时开放五种计式和命法 |

三式内部建议次序：完成易卦/纳甲与时间基础后，先验证奇门单一时家规则，再验证大六壬，太乙最后。整个十八板块的首批仍是梅花时间法和西方行运，见[总接入路线](../metaphysics-integration-roadmap.md)。这个次序依据当前软件技术栈、规则面和独立验收成本，是本项目建议；不是学术地位排序。

## 2. 候选引擎、实际许可与版本

### 2.1 核验结果

| 候选 | 实际读取的许可文件 | 版本/分支证据 | 可以得出的结论 |
| --- | --- | --- | --- |
| `kentang2017/kinqimen` | README 声明 MIT；仓库根目录未列 LICENSE，raw `master/LICENSE` 返回 404 | PyPI 0.0.6.6，上传 2024-05-30；主干另有后续修改 | 不能标成“已核验 MIT 并可引入”。本轮未检查发行压缩包是否包含其他授权文件；许可缺口不是“确定无授权” |
| `kentang2017/kinliuren` | LICENSE 原文为 MIT，版权 2019 Ken Tang | PyPI 0.1.2.9，上传 2025-08-20 | 仓库代码有明确 MIT 文本；仍须核对最终选中的发行物、所用文件和内容来源 |
| `kentang2017/kintaiyi` | LICENSE 原文为 MIT，版权 2023–2026 kentang2017 | PyPI 0.2.3，上传 2023-05-13；当前主干 `pyproject.toml` 为 0.2.4 | 不能用当前主干 README 作为 PyPI 0.2.3 的接口说明；正式引入必须锁定发行物或提交 |
| `3metaJun/3meta` | LICENSE 原文为 MIT，版权 2025 3metaJun | NPM registry 与主干 package.json 均为 2.6.0 | 比较贴近当前 TS 前端，但仍是待验证候选 |
| `MrJelly/QiMenDunJia` | LICENSE 原文为 MIT，版权 2026 Qi Men Dun Jia Contributors | 本轮只抽查 README 与目录，未锁定发布版本 | 候补前端引擎；日历适配层设计值得比较，不能据自述精度直接采纳 |

一手来源：[kinqimen 仓库](https://github.com/kentang2017/kinqimen)、[kinqimen LICENSE 请求地址](https://raw.githubusercontent.com/kentang2017/kinqimen/master/LICENSE)、[kinliuren LICENSE](https://raw.githubusercontent.com/kentang2017/kinliuren/master/LICENSE)、[kintaiyi LICENSE](https://raw.githubusercontent.com/kentang2017/kintaiyi/master/LICENSE)、[3meta LICENSE](https://raw.githubusercontent.com/3metaJun/3meta/main/LICENSE)、[MrJelly LICENSE](https://raw.githubusercontent.com/MrJelly/QiMenDunJia/main/LICENSE)。发行元数据：[kinqimen PyPI JSON](https://pypi.org/pypi/kinqimen/json)、[kinliuren PyPI JSON](https://pypi.org/pypi/kinliuren/json)、[kintaiyi PyPI JSON](https://pypi.org/pypi/kintaiyi/json)、[3meta NPM JSON](https://registry.npmjs.org/3meta/latest)。

本次 `git ls-remote` 记录的 HEAD 为：

| 仓库 | HEAD |
| --- | --- |
| kinqimen/master | `127ead87aa24a74d40c893a5351e22a1a89d0945` |
| kinliuren/master | `557a9ad3ced7b0551b4e623a63dc74536a190a7e` |
| kintaiyi/master | `11f78555d5e77c81ac8af69d243a981c22934733` |
| 3meta/main | `9be1238cbb7b0118826a689f9d3f8100284f6df3` |

源码抽查使用当日分支 URL；上述提交记录用于后续复查定位，不表示已下载、运行或对分支与发行包做文件级一致性验证。GitHub API 本次触发未认证请求限流，随后只用公开网页、raw 文件与 `git ls-remote`。

MIT 通常要求在软件副本或实质部分中保留版权与许可声明。这不自动解决嵌入书籍、现代译注、图像、数据表的来源问题；应分别登记代码许可和内容权利，不能用仓库的 MIT 标签给来历不明的资料盖章。这里记录实际文件和接入门槛，不替代具体发行方式的许可审查。

### 2.2 依赖区别：核心算法与演示 App

| 候选 | 本次查到的依赖 | 接入判断 |
| --- | --- | --- |
| kinqimen | 仓库 requirements：pendulum 3.0.0、streamlit 1.58.0、sxtwl 2.0.6、ephem 4.1.6、streamlit-aggrid 1.0.5、kinliuren 0.1.2.9、eacal 0.0.3、bidict 0.23.1、未固定版 cerebras-cloud-sdk；PyPI 元数据仅列 sxtwl 2.0.6、ephem 4.1.3 | 演示站依赖和发行包依赖不同；不能复制整个 requirements 到本项目。主干计算文件还导入本地 config/angan、bidict |
| kinliuren | 主干 requirements 包含 Streamlit、sxtwl、kinqimen、ephem、bidict、Cerebras 与 OpenAI 等；抽查 `src/kinliuren/kinliuren.py` 顶部仅导入 Python 标准库 | 核心课式计算与在线演示/AI 必须分开评估；不因演示站支持 AI 就新增外部数据发送 |
| kintaiyi | 主干 pyproject 核心依赖为 pendulum、sxtwl、ephem、cn2an、pytz、bidict、drawsvg、astropy；CLI、Streamlit、Flask、开发测试分 extras | 更适合后端；先测纯计算启动、输出序列化、Windows/Linux 环境。不得把“纯 Python 接口”理解为所有底层依赖都无本地扩展 |
| 3meta | dayjs `^1.11.10`、lunar-lite `^0.2.7`、lunar-typescript `^1.8.6` | 与现有前端历法栈重叠；需要锁文件、包体积和 uni-app/微信运行时验证 |

来源：[kinqimen requirements](https://raw.githubusercontent.com/kentang2017/kinqimen/master/requirements.txt)、[kinliuren requirements](https://raw.githubusercontent.com/kentang2017/kinliuren/master/requirements.txt)、[kinliuren 核心](https://github.com/kentang2017/kinliuren/blob/master/src/kinliuren/kinliuren.py)、[kintaiyi pyproject](https://raw.githubusercontent.com/kentang2017/kintaiyi/master/pyproject.toml)、[3meta package.json](https://raw.githubusercontent.com/3metaJun/3meta/main/package.json)。本轮未对全部递归依赖逐一核验 LICENSE，也未执行依赖安装。

补充候选 `Taogram/taobi` 的作者 README 明确把飞盘、置闰等部分标成未完成，仓库显示 MPL-2.0；本轮请求的 main/LICENSE 返回 404，未继续核定其默认分支许可文本，因此不纳入已核验许可名单，也不以其功能名作为“完整支持”的证据。[作者仓库](https://github.com/Taogram/taobi)

## 3. 共同时间与结果契约

三个系统的问事入口都需要 `EventContext`。最低字段：原始民用日期时间、时间精度、IANA 时区或明确偏移、发生地点（可选，依规则）、归一后的 UTC 瞬间、用于历法的参考日期时间、问题与创建时刻。保存首次输入，重开历史记录不能重新取“现在”。

`RuleProfile` 至少保存体系、计式、盘法、底本/门派名、规则版本、节气算法和精度、日界、历法参考时区、太阳时模式、寄宫/贵人/积年法等体系参数。`ChartResult` 保存归一输入、引擎版本或 SHA、规则、结构化盘面、计算步骤、资料引用及不支持范围。

问事时辰不是出生时辰。非命法的三式基本排盘不应强制收集出生性别；涉及年命/行年或太乙命法时再单独请求相应资料。出生地时区、问事地点时区与当前设备时区也不得互相代替。

算法内部的“地盘/天盘”“月将”“九宫”是术数规则对象，不能因为存在天文依赖就视为实测天体位置。真实太阳时、日出日落划分如果没有实现，应使用明确的民用时/固定时辰规则，不显示已经自动校正。

## 4. 奇门遁甲

### 4.1 用户场景与最小输入输出

首个场景是研习某一时刻的时家盘、查看九宫布局和保存问事记录。必需输入是问事年月日时分、明确时间口径，以及盘法配置。地点只在所选太阳时或方位扩展需要时必填；基础九宫可使用明确的历法参考时刻。

确定性输出：干支、当前节气及交节时刻、阴阳遁、上中下元、局数、旬首/旬空、地盘三奇六仪、天盘干、九星、八门、八神、值符值使、寄宫关系。吉凶格局和象征释义另列为版本化规则，不能混入基础落宫事实或直接输出未来事件。

### 4.2 必须先确定的分歧

| 决策 | 为什么影响盘面 | 首版建议 |
| --- | --- | --- |
| 时家、日家、刻家 | 定局周期和符使算法不同，不能作为同一盘的显示切换 | 只开时家；金函玉镜日家和刻家另注册 |
| 转盘、飞盘 | 星门神迁移方法不同 | 明确一个版本；不因为界面有九宫就标“转飞兼容” |
| 拆补、置闰、茅山等定局法 | 节气与符头三元的组合不同，二至附近可能差异更大 | 首版固定拆补口径，先作参考盘复核；置闰另行测试 |
| 中五寄宫、天禽与天芮关系 | 地盘寄干、值符中宫处理、星的附随可各有规则 | 分字段记录，不能用单一“寄坤/寄艮”替代全部细则 |
| 23:00 日界、交节精度 | 换日改变符头、干支和时旬；交节改变用局 | 将所用方法写进结果；交节前后与 23:00/00:00 均验收 |
| 地方太阳时 | 会改变所用时辰，可能跨节气/日界 | 暂用统一声明的民用时；太阳时独立版本再做 |

《遁甲演义》卷一的时家说明含阴阳遁、符使及中五寄坤例，卷内也有用奇置闰材料，可作为规则定位入口。该网上排印页存在现代前言和文字整理，不能直接整体导入，须再锁定影印底本与页码。[《遁甲演义》](https://zh.wikisource.org/wiki/遁甲演義)

### 4.3 候选源码的真实观察

- `kinqimen` 的 `pan(option)` 使用 1/2 区分拆补/置闰；`pan_minute`、`gpan` 为另一路径。抽查 `config.py` 可见置闰的芒种/大雪等分支、中宫落坤处理及八宫旋转序列。它没有因此证明所有传统飞盘/寄宫法均可选，必须按函数逐项映射。[config.py](https://github.com/kentang2017/kinqimen/blob/master/config.py)、[kinqimen.py](https://github.com/kentang2017/kinqimen/blob/master/kinqimen.py)
- `kinqimen/jieqi.py` 用无时区的 `datetime` 比较输入和节气，把节气分钟舍入，并在 23 时路径使用下一日字段。调用方不能把任意海外墙钟直接传入并宣称时区正确；月底、闰日、跨年和分钟舍入是待运行的边界用例，而不是本次已经确认的 bug。[jieqi.py](https://github.com/kentang2017/kinqimen/blob/master/jieqi.py)
- `3meta` 的 `byDatetime` 先用 dayjs 解析，再提取本地年月日时分秒传给 `Solar.fromYmdHms`；这不是接受 UTC 后自动转成指定出生地/问事地时区的接口。适配器应从项目时间层传入选定的墙钟字段，禁止依赖设备时区。[QimenChart.ts](https://github.com/3metaJun/3meta/blob/main/src/qimen/QimenChart.ts)
- `3meta` 用日干支取元、节气查局表。其 `yearDivide='exact'` 代码优先调用 `getYearInGanZhiByLiChun`，仅在缺少该方法时退到 `getYearInGanZhiExact`；不能仅凭参数名声称年界精确到交节秒。调用结果要按实际依赖版本复核。[同一源码](https://github.com/3metaJun/3meta/blob/main/src/qimen/QimenChart.ts)
- `3meta/calculator.ts` 对中宫处理包含多条规则：地盘寄干采用阳寄艮八、阴寄坤二，星盘中天禽随天芮，值符/神盘遇中五又有转到二宫的处理。产品必须保留这些具体差异，不能统一改名成“永寄坤二”。[calculator.ts](https://github.com/3metaJun/3meta/blob/main/src/qimen/calculator.ts)

### 4.4 参考盘与验收边界

`3meta` 的 `qimen.test.ts` 固定了 2008-11-04 12:30，并**手动传入**霜降、阴遁二局；断言旬首甲寅、值符天心落二、值使开门落二以及部分星干。它是可复查的局部排布回归，测试名指向 Python verifier，但本轮没有取得可独立追溯的纸本课例，因此不能用它证明自动定局或全部九宫正确。[作者测试](https://github.com/3metaJun/3meta/blob/main/src/__tests__/qimen.test.ts)

必须建立本项目参考集：阴阳遁各九局基础排布、值符/值使入中宫、天禽寄宫、六甲时、伏吟/反吟候选、23:00/00:00、二至和其他交节前后；置闰开放前增加芒种/大雪、超神接气与置闰年的完整盘。每例记录原始年月日、时区、法门、底本页码或独立算法、逐宫期望值和复核人。选少数普通日得到同盘不足以通过。

首版只输出确定盘面与解释其排法。达到许可完整、固定参考盘通过、前端运行时通过、错误输入与旧盘复现通过，才把状态从“调研中”改为“可排盘”。本轮仍处于调研中。

## 5. 大六壬

### 5.1 场景、输入、输出

场景：保存一次具体问事的课式，展示月将加时、四课产生顺序和三传取法，便于学习与复盘。输入包括问事时刻及时间口径、取时方式、日干支、占时支、月将及来源、贵人法。界面可由时间层自动换算，但结果必须保留全部中间值；手动课例输入另标为“按指定干支/月将复盘”。

输出至少为十二支天地盘、四课、三传及其取法、十二天将、旬空。六亲、遁干、日马等可逐项加；问事对象、年命/行年属于后续选配。三传确定性计算与解释问题类型分开，不能让大模型选择一个它认为“更合理”的课法而覆盖原盘。

### 5.2 上游核验与关键分歧

`kinliuren.Liuren(jieqi, cmonth, daygangzhi, hourgangzhi).result(num)` 直接接收节气名、农历月文本、日时干支。核心未替调用方解决民用时间、夏令时、秒级节气、日界和真太阳时。源码中月将用成对节气映射，例如雨水/惊蛰对应亥；农历月 `cmonth` 则是另一个输入，不能把农历月、月建、月将当成同一字段。[核心源文件](https://github.com/kentang2017/kinliuren/blob/master/src/kinliuren/kinliuren.py)

该文件还可见两套贵人起例表，由 `num=0/1` 选择，昼夜以卯至申、酉至寅两组时支划分。它不是按用户经纬度的当地日出日落计算。没有在界面展示这一规则时，不能称为“自动昼夜贵人校正”。同一文件的三传路径包括贼克、比用、涉害、遥克、昴星、别责、八专、伏吟等函数；函数存在不等于各特殊课已复核。

首版需要明定：

1. 月将按中气切换还是另一明确法；交接时刻如何确定。
2. 民用时/地方太阳时，以及是否采用报时取支；不能自行随机更换占时。
3. 贵人起例采用哪套表、固定时辰昼夜还是日出日落。
4. 涉害深浅/孟仲季取用、反吟无克、伏吟自刑、八专与别责的优先关系。
5. 日界、旬空与遁干取法，年命/行年和神煞是否纳入本期。

《六壬大全》卷一“起例”列十干寄宫、九种取传法，可逐条定位到可编程规则。但网上排印应与影印底本核对，特别是巳/己、未/末等易错字。[《六壬大全》卷一](https://zh.wikisource.org/zh-hant/六壬大全/1)

### 5.3 固定课例的实际验证范围

作者 README 提供 `惊蛰、二月、己未日、甲午时、result(0)` 的结构化输出，三传为巳、戌、卯；它是上游自述样例，不能作为独立证明。[作者 README](https://github.com/kentang2017/kinliuren)

本轮可做的纸面局部复核是：亥将加午时，己寄未，因此一至四课的上下支/干应为“子己、巳子、子未、巳子”；巳的上神为戌，戌的上神为卯，与上述三传的后两步一致。取初传的课法标签仍应独立审校：作者示例称“贼克/重审”，多课下克上与阴阳比用的说明需要逐条对照原典，不能直接拿示例的标签作为金标准。本轮未运行 `kinliuren`，也未把此纸面推演标成完整审核通过。

接入前建立覆盖九宗门的课例集：每一种至少有可追溯代表例，涉害平手、四课不备、伏吟自刑、反吟无克等必须单列；对完整十二宫映射、四课、三传、天将和旬空逐字段比较。固定月将下可测 60 日干支 × 12 时支共 720 组；跨月将与其他规则的组合另测。不崩溃或自洽只能验证软件覆盖，不能代替有独立来源的正确性断言。

### 5.4 部署与最小交付

建议首期在既有 Python 服务中加纯计算适配器，只调用审查过的核心，不启动上游 Streamlit、不带上游 AI 客户端、不把用户档案传给演示站。接口返回结构化 JSON，前端本地保存原始输入和引擎版本。若以后移植到 TypeScript，则把迁移作为独立实现，用相同参考集对照；不能仅靠 Python 输出生成全部期望值后称为“独立交叉验证”。

最低可用版为一种月将法、一种贵人法、天地盘/四课/三传/天将/旬空、课法解释与记录导出。神煞大全、自动断事、行年本命与其他传法留作单独能力，未实现字段明确为空。

## 6. 太乙

### 6.1 场景和最小范围

最适合先做“古法计算研究盘”：用户选择某年或某时刻与一种底本，查看积数如何变成局数和落宫。太乙年计、月计、日计、時計、分计、命法有不同计数基准；不应把它们一次性作为同一个开关上线。

建议先选《太乙金镜式经》年计，输入所求年、纪年/历法语义、积年基准、年界规则及方法版本；如果接口仍需月日时分，应解释这些字段是否参与本计式。后续月/日/時計必须增加精确日期、时区、节气、日界；命法再增加出生资料和所用性别参数。

基础确定输出可限定为积年/积日/积时（只显示该模式所需项）、阴阳遁/局数、太乙、文昌/天目、始击、计神、主客算及相应将位；每个中间余数和零余数解释可以展开查看。古书“主客胜负”属于象征解释，不转换为现实胜率。

### 6.2 必须拆开的规则

- 积年纪元：统宗、金镜、淘金歌、太乙局不是只换书名，必须记录其起算常数与公式。
- 计式：年/月/日/时/分改变除数、累计单位、换局周期；分计和命法不得默认与古籍年计同等来源。
- 年界/月界、古历与现代公历：含朔闰、冬夏至和太乙入纪的选择；古代示例不能不经校对直接映射公历日期。
- 太乙行宫与九宫编号：不能复用奇门的洛书显示映射而不确认此法的行宫顺序；十六神与九宫应分层展示。
- 余数为零、跨纪与公元前年：程序零索引与传统“算外”的解释需要单独断言。

《太乙金镜式经》卷一可定位“推上元积年”“推入六纪三元法”“积太乙所在法”等；公开 Kanripo 文本带文渊阁《四库全书》页标，也明确能看到版本残缺/不同计数材料，适合作规则与底本定位入口。本轮未对照影印图完成校勘。[目录与底本标识](https://github.com/kanripo/KR3g0047)、[卷一带页标文本](https://raw.githubusercontent.com/kanripo/KR3g0047/master/KR3g0047_001.txt)

### 6.3 引擎真实观察

`kintaiyi` 主干 `Taiyi.pan(ji_style, taiyi_acumyear, enable_game_theory=False)` 的两个位置参数分别表示计式与积年法。当前 README 示例使用 `method=`，而本轮所读实现签名使用 `taiyi_acumyear`；不能直接复制 README 关键字调用进服务。主干实现中可见四套积年常数，以及特定计式/底本的分支。[核心实现](https://github.com/kentang2017/kintaiyi/blob/master/src/kintaiyi/kintaiyi.py)

同一主干 import 时会读取两份预计算天文 JSON；`config.py` 还载入本地 `data.pkl`。这些文件的具体数据出处、生成工具、范围、精度和许可应单独核验，软件根 LICENSE 并不证明每个表的来源已核清。上线应固定随包数据校验值，并审查是否能用可检查格式替代 pickle；本轮没有读取或反序列化该 pickle。[config.py](https://github.com/kentang2017/kintaiyi/blob/master/src/kintaiyi/config.py)

节气/干支工具抽查仍见无时区 datetime、节气分钟舍入和 23 时 day+1 路径；主干配置另有公元前年转换。函数注释提到支持负年，不代表 Python datetime 的每个调用分支都支持相同范围，首版应限制到参考盘验证过的年份区间。[jieqi.py](https://github.com/kentang2017/kintaiyi/blob/master/src/kintaiyi/jieqi.py)

上游可选现代博弈模块从术数结果生成支付矩阵与策略，默认未启用。本项目不接入该层，也不将其概率和均衡输出当作术数预测已得到统计验证。

### 6.4 现有测试不等于古籍金标准

本轮读取上游四个测试文件：CLI 测试主要断言命令退出/输出字段；命身宫测试有少量局部期望值；歌诀测试检查覆盖和去重；博弈测试检查矩阵、策略和输出结构。未在这些文件找到完整、逐宫且有底本页码的三式独立固定盘集。[tests 目录](https://github.com/kentang2017/kintaiyi/tree/master/tests)、[CLI 测试](https://github.com/kentang2017/kintaiyi/blob/master/tests/test_cli.py)、[命身宫测试](https://github.com/kentang2017/kintaiyi/blob/master/tests/test_life_body_palaces.py)、[博弈测试](https://github.com/kentang2017/kintaiyi/blob/master/tests/test_game_theory.py)

可用作首批“参考盘材料”的是卷一按纪元累计与除数求太乙所在的公式：先人工核对同一底本的纪元，再挑每宫停留周期前后、元/纪边界、余数零值建立手算表。书中有开元纪年材料，但不同段落的纪年、文字和后人补入问题必须先校勘，不能为了凑固定盘自行选一个数。实际完整参考盘尚待建立。

完成单一金镜年计全部中间值和基础落宫验收后，再加日计/時計；每增加一种底本或计式重新建立相应参考集。后端只返回允许清单里的盘面字段，避免主干庞大的文本/军事/命法输出被自动全量暴露到用户报告。

## 7. 内容来源与授权登记

| 资料 | 本次实际可见内容 | 接入用途和未完成项 |
| --- | --- | --- |
| 维基文库《遁甲演义》 | 成功读取页面，含卷内规则与现代前言 | 规则定位；需找到影印底本、具体卷页和整理说明，现代前言不当古籍原文导入 |
| 维基文库《六壬大全》卷一 | 成功读取起例与取传法文本 | 九宗门规则定位；逐字校勘、版本与条目级来源待补 |
| Kanripo《太乙金镜式经》 | 成功读取目录和卷一带页标文本，标为文渊阁四库本 | 可定位卷一 3a/3b、4a 等；仍需复核影印与仓库数据使用条件 |
| ctext《太乙金镜式经》/《奇门遁甲统宗》 | 搜索结果可定位，直接打开本轮遇 403 | 只作检索入口，不称已读原文，不声称已取得内容授权 |

入口：[遁甲演义](https://zh.wikisource.org/wiki/遁甲演義)、[六壬大全卷一](https://zh.wikisource.org/zh-hant/六壬大全/1)、[金镜 Kanripo](https://github.com/kanripo/KR3g0047)、[金镜 ctext](https://ctext.org/wiki.pl?if=gb&res=58486)、[奇门统宗卷十二 ctext](https://ctext.org/wiki.pl?chapter=730643&if=gb)。

内容条目至少登记书名、作者/编者、成书/版本信息、底本机构或库、卷页、访问地址、数字化/整理者、适用许可、校勘状态。古书年代久远不等于任何现代译注和图片都能随产品复制；本轮只引用定位链接、没有导入正文资产。

## 8. 分步实施与完成标准

1. **研究登记**：把三个体系列入目录，展示用途、输入、研究状态、规则差异；没有完成算法验证的模块不放“立即排盘”按钮。
2. **参考样例工程**：固定候选 SHA/版本、完整许可和最小依赖；建立有来源的 JSON 期望盘。人工算式/原典、独立实现和候选输出分别记录，禁止候选自算自验。
3. **奇门最小适配**：先一种时家规则，验证全部九宫、寄宫和时间边界；若用 TS，本地离线、320/390px、微信/H5 运行时全部通过后开放。
4. **六壬最小适配**：一种贵人/月将法，补足九宗门异常课；Python 端保证错误输入不会回退为假盘，前端保存问题和快照。
5. **太乙研究适配**：固定单底本/单计式，先验中间积数和基础落宫；确认数据资产再扩展计式，不同时引入全部文本库。
6. **文化解释层**：以上结果通过验收后，才用引用过的盘面字段组织解说。LLM 不负责确定局数、月将、三传或积年；解释缺少资料时返回缺口。

共同验收：相同输入和规则版本结果稳定；设备时区变化不改盘；时间不详不能默认给确定盘；保存/恢复/导出含完整规则与版本；未知配置拒绝而非悄悄选默认；引擎升级前后差异可查看；网络断开或后端失败不展示伪造结果。独立样例只验证传统规则实现，不证明现实预测效果。

## 9. 检索记录与证据等级

主要检索词：`github kinqimen`、`github kinliuren`、`github kintaiyi`、`site.ctext.org 奇門遁甲 統宗`、`site.ctext.org 六壬大全`、`site.ctext.org 太乙金鏡式經`、`site.zh.wikisource.org 御定奇門寶鑑 六壬大全 太乙金鏡式經`、`github 奇门遁甲 TypeScript 拆补 LICENSE MIT`、`github 大六壬 排盘 tests license`、`github 太乙 排盘 LICENSE test`。

已核验：公开 LICENSE 原文（标明失败者除外）、发行元数据、依赖声明、指定源码片段、上游测试的断言类型、公开古籍条目与部分规则文本。源码观察与产品建议在上文分开标明。

尚未核验：候选包安装/运行、所有源码与递归依赖、正式发布包所含文件、完整盘正确性、秒级天文精度、手机运行性能、全部流派、现代资料的再分发权。没有验证预测效力。网上作者的“最准确”“完整古法”“一键全支持”以及第三方差分通过数量都不作为本项目已经完成的验收。
