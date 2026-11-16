# 自动问卦的经文、复算与引用依据

2026-10-03。适用规则：`zhouyi-reading-facts-v1`；经文资料：`zhouyi-wikisource-2026-10-03-v1`。

## 数据来源与范围

主源为[维基文库《周易》逐卦原文](https://zh.wikisource.org/wiki/周易)，通过官方 [MediaWiki Revisions API](https://www.mediawiki.org/wiki/API:Revisions)保存每一页的固定修订。运行时使用仓库内资料，不访问网页，也不依赖模型背诵经文。

- `python_backend/app/data/zhouyi_wikisource_revisions.json`：64页完整原始wikitext、页面名、修订ID与时间、UTF-8原文SHA-256、抓取时间及署名许可。
- `python_backend/app/data/zhouyi_corpus.json`：64条卦辞、384条爻辞、乾用九及坤用六；每卦附固定修订链接、贡献者历史链接和原文哈希。
- `python_backend/scripts/build_zhouyi_corpus.py`：可离线重建的提取器；不取现代译文，不取彖、象、文言。

本次是对固定来源的结构化转录，保留来源用字、断句和异文选择，并非重新校订的《周易》批判版本。`sourceName`保留来源页名；界面卦名沿用原项目的简体名称。“无”“于”等不因现代字形偏好擅改。

示例固定页：[乾 oldid=2404991](https://zh.wikisource.org/w/index.php?title=周易/乾&oldid=2404991)、[坤 oldid=2404999](https://zh.wikisource.org/w/index.php?title=周易/坤&oldid=2404999)、[未济 oldid=10647450](https://zh.wikisource.org/w/index.php?title=周易/未濟&oldid=10647450)。完整64页的版本表以JSON中的`source`为准。

古代经文本身与当代转录、标点、校注应区分。本文资料按照维基文库标示的 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)保留来源、贡献者、许可和提取改动说明；受该许可约束的资料改作仍按相同方式共享。此数据许可不把整个项目代码重新许可。未复制现代翻译或网页图像。

研究时参照了 [Kanripo KR1a0001](https://github.com/kanripo/KR1a0001)的乾、未济原文。该库标记底本为TLS，并非四库本；未发现明确的仓库LICENSE，因此本次没有将它作为分发语料。未声称已将64卦逐字与多个古籍影印本完成校勘。

## 提取和全量校验

提取器只接受已识别的经文结构。以下均有自动检查：

1. 文王序1–64、卦名和阴阳结构唯一；八经卦拼接方向固定自下而上。
2. 每卦恰好六条爻辞，共384条。初、二、三、四、五、上逐位齐全，爻题九/六与卦画阳/阴全部一致。
3. 乾用九、坤用六独立存放，共两条；不作为第七爻。
4. 以“易經”到“彖曰”的边界截取，防止把经传混入引文；未识别的Wiki模板导致失败，不静默清空。
5. 坤卦辞三段合并完整。履“履虎尾”、否“否之匪人”、同人“同人于野”的卦名是句子成分，保留全文；否爻题的逗号单独处理。
6. `另`模板的首选原文保留在`text`，另一版本存入`variants`。例如未济九四引文采用“大國”，异文“邦”单列，不出现“一作邦”混入原文。
7. 每页SHA-256重新计算一致，固定链接只指向`https://zh.wikisource.org/w/index.php?title=…&oldid=…`。离线重建须与分发语料完全一致。

在`python_backend`目录运行：

```powershell
.venv/Scripts/python.exe scripts/build_zhouyi_corpus.py
.venv/Scripts/python.exe scripts/build_zhouyi_corpus.py --fetch
.venv/Scripts/python.exe -m pytest tests/test_zhouyi_corpus.py tests/test_divination_facts.py -q
```

第一条离线重建。第二条只重新获取已固定的修订并核对原始哈希，保留原抓取时间。只有显式`--refresh`才选择网页当前修订；若内容发生变化，必须同时给新的`--source-version`，不得悄然覆盖原版本。外部站点限流或不可达会显式失败，本地运行不依赖在线抓取。

## 确定性核心

`app/services/divination_facts.py`中的`build_divination_facts(input_data, rule_version)`只验证资料、复算卦象并查本地原文，不随机、不调用AI、不联网。

| 方法 | 规则版本 | 输入 |
| --- | --- | --- |
| 六爻手录 | `divination-v1` | 自下而上六个6/7/8/9 |
| 六爻纳甲 | `liuyao-najia-v1` | 同上；本核心只核卦象 |
| 数字三钱 | `liuyao-coins-v1` | 六组各三个2/3，逐组和须匹配六爻 |
| 梅花两数 | `divination-v1` | 两个1–999999整数 |
| 梅花时间 | `meihua-calendar-v1` | 日期、时刻、UTC偏移 |

公共问题字段1–200字，日期1900–2099，偏移−12至+14、15分钟一级。拒绝缺失及额外字段，拒绝布尔值和字符串冒充数值。纳甲、三钱、时间法同时要求换算后的UTC瞬间和固定UTC+8日期在1900–2099；旧手录和两数仍保留此前的边界行为。

[《增删卜易》三钱章](https://www.shidianguji.com/book/SDZJ0627/chapter/1lctz64upgl55)及[《文公易说·四象》](https://www.shidianguji.com/zh/book/SK0055/chapter/1jzn41hy7capf)支持三钱与六七八九取值。项目明确字=2、背=3，6/9动，7/8静；独立公平三钱的四值组合数为1:3:3:1。[《增删卜易·动变》](https://zh.wikisource.org/w/index.php?title=增刪卜易/7&oldid=2100290)需变讼例对应`[9,7,9,6,7,6]`，动爻1、3、4、6。

[《梅花易数》卷一](https://zh.wikisource.org/zh-hans/梅花易數/卷一)为时间取数来源。后端用已安装的`lunar-python`独立复算，前端使用`lunar-typescript`。现代约定沿用既有版本：固定UTC+8、正月初一换年、00:00换日、23:00开始子时、闰月取同月数，不校真太阳时。此处不将现代边界说成古籍唯一规则。

对照测试直接运行当前TypeScript域，核对五种方法共165组输入的本卦、之卦、动爻、互卦、体用、UTC瞬间及农历取数，包含春节、立春前、闰月、子时、跨时区和1900/2099边界。另穷举4096组六爻取值，确保只翻转6和9。

## 解读证据范围

事实包提供本卦卦辞、所有动爻爻辞及不重复的之卦卦辞。仅乾/坤六爻全动时附用九/用六。无动爻时仅本卦卦辞；多动爻采用并读，并非声称传统择辞只有一种规则。

证据ID形如`zhouyi.5.judgment`或`zhouyi.5.line.3`；用辞为`zhouyi.1.use-nine`、`zhouyi.2.use-six`。AI只可引用本次事实包内ID，前端按ID展示服务端原文。`readingScope`为字符串数组，`sourceVersion`为版本字符串；卦辞和用辞不含`linePosition`，普通爻辞才有1–6的该字段。

互卦与体用来自程序结构，纳甲高级盘仍由原功能显示。本次没有自动选用神、断旺衰、推应期或证明预测准确性。AI失败、重试、回看都沿用同一个已保存输入和事实包，不能重摇或替换历史经文版本。
