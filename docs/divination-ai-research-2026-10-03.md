# 前台入口与自动问卦、AI 解读：先行调研与实施契约

2026-10-03。用户要求新增功能直接呈现在前台，并将“卜”做成自动生成卦象、接入 AI 解读的完整体验。本记录在实施之前整理代码审查、文献与接口调研，后续验收另记。

## 调研发现与决定

首页主按钮目前进入八字报告，新模块位于“五术探索”的折叠目录内；卜页默认六爻手录，用户须先填六个爻值，且没有 AI 解读。因此只上传已有构建不能解决用户感到“还是旧版本”的问题。

实施采用以下流程：

1. 首页直接按山、医、命、相、卜分组展示十八板块，每项直接进入对应工具；新增醒目的自动问卦与主题同读入口，复用统一导航数据。
2. 卜页默认填写问题后“一键起卦并解读”，提供“仅起卦”选项。默认模拟三枚钱、连续六次，保留真实生成的六组原始数值；时间与其他方法放入可展开设置。原有手录、纳甲、梅花两数和梅花时间法继续可用。
3. 程序固定本卦、变卦、动爻等事实，再交给 AI 解读。AI 重试复用同一份起卦输入，不重新随机；刷新、回看或轮询也不触发新的付费调用。
4. 解读同时使用有固定版本出处的《周易》卦辞与爻辞。界面将程序事实、经文原文与 AI 解释分开展示，引用由合法证据 ID 指向服务端保存的原文，不让模型自行编造出处。
5. 使用既有 DeepSeek 服务与账号体系，新增独立问卦任务和历史记录，避免污染原八字报告、每日查询与大运流程。此次不新增付费服务或变更模型供应商。

## 起卦依据与适用范围

[《增删卜易》三钱章](https://www.shidianguji.com/book/SDZJ0627/chapter/1lctz64upgl55)区分一背、两背、三背、三字；[《文公易说·四象》](https://www.shidianguji.com/zh/book/SK0055/chapter/1jzn41hy7capf)给出四象的六、七、八、九数义。本实现明确约定字面计2、背面计3，每组三个数相加，得到6老阴、7少阳、8少阴、9老阳。独立等概率模拟三枚钱得到1:3:3:1的四值分布，不能直接等概率抽取6/7/8/9。

爻序固定自下而上；6、9动，阴动变阳、阳动变阴。依据[《增删卜易·动变》固定修订](https://zh.wikisource.org/w/index.php?title=增刪卜易/7&oldid=2100290)，其需变讼例可用`[9,7,9,6,7,6]`复核。三钱模拟属于软件随机方式，不能称为实物投币或已验证的未来预测。

H5使用[Web Crypto随机接口](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)，记录本次得到的硬币面值；不以`Math.random()`静默替代。其他运行端只有在提供可靠随机接口时启用模拟，否则给出明确说明并保留已有时间法、手录入口。

梅花时间法继续沿用既有版本：转换到固定UTC+8，农历正月初一换年、00:00换日，闰月取同月数；来源和现代边界约定已记在[时间起卦文档](divination-phase3.md)。不同方法在页面明确标示，不混成同一算法。

第一版AI解读范围为本卦、变卦、动爻及相应经文；梅花另展示已有互卦和体用事实。纳甲盘继续作为程序事实显示，但此次不声称已验证自动用神、旺衰、应期或现实事件必然发生。多动爻采取明确的并读方式，不冒充唯一择辞规则。

## 经文来源与全量校验

仓库现有`hexagrams.ts`只有卦名、卦序和阴阳结构；现有后端知识库是八字资料，没有可直接用于解卦的卦辞、爻辞。

主源选[维基文库《周易》](https://zh.wikisource.org/wiki/周易)的逐卦经文，固定每页修订号，只提取“易經”，分离彖、象、文言及校异。研究阶段抽检[乾](https://zh.wikisource.org/w/index.php?title=周易/乾&oldid=2404991)、[坤](https://zh.wikisource.org/w/index.php?title=周易/坤&oldid=2404999)、[未济](https://zh.wikisource.org/w/index.php?title=周易/未濟&oldid=10647450)，发现跨段卦辞和校异混入正文等解析风险。实施须完成64卦全量校验，而不能仅依赖这三个样本。

- 文王序1–64唯一；每卦六条爻辞，总计384条；爻题的九/六与既有卦象阴阳逐位匹配。
- 初、二、三、四、五、上位置齐全；乾用九、坤用六单列，不当作第七爻。
- 坤卦辞跨段完整；未济九四校异单列，不混入引文。
- 保存修订号、抓取时间、原文哈希和提取器版本；证据链接使用可信来源白名单。
- [Kanripo《周易》原文](https://github.com/kanripo/KR1a0001)仅用于交叉核对，标记底本为TLS，不误称四库本，不在未发现许可时声称可按CC0再分发。

不复制现代译文。数据单列古代原文、维基文库贡献者、固定来源、提取改动说明与[CC BY-SA 4.0许可](https://creativecommons.org/licenses/by-sa/4.0/)，不将整个代码库误标为该许可。固定版本获取参照[MediaWiki Revisions API](https://www.mediawiki.org/wiki/API:Revisions)。

## 服务端和前端契约

以下为本轮实施约定，不能据此视为功能已完成。

### 输入与确定性事实

- 前端新增`liuyao-coins`方法，规则`liuyao-coins-v1`；输入沿用`question/date/time/utcOffset`，另存六个`lines`及六组各三个`coins`（仅2或3），逐组和必须等于相应爻值。已有四种方法及原规则版本不改变。
- AI提交体为`{request_id, input, rule_version}`。问题1–200字；日期、时刻、UTC偏移与原起卦校验一致；拒绝多余字段和客户端自带的prompt、facts、model等。
- 后端独立复算核心卦象。`build_divination_facts(input_data, rule_version)`输出`version="zhouyi-reading-facts-v1"`、`ruleVersion`、`questionInstant`、与现有Hexagram结构相同的`original/changed`、`movingLines`，梅花可另含`mutual/bodyUse`，以及`evidence/sourceVersion/readingScope`。
- `evidence`每条为`{id,title,text,sourceTitle,url,hexagramNumber,linePosition?}`；ID按`zhouyi.{卦序}.judgment`、`zhouyi.{卦序}.line.{爻位}`命名。用九/用六另设固定ID。核心服务不相信客户端提供的卦名或经文。

### AI任务

- 新增专用`DivinationReading`与加法迁移；不把卦象塞入八字`Report`。
- `POST /api/v1/app/oasis/divinations`创建任务，`GET /divinations/{id}`读取本人任务，`GET /divinations`列出本人历史，`DELETE /divinations/{id}`在确认后清除已结束记录的个人内容。不存在、其他用户或已删除内容统一404；处理中的任务不允许删除。
- 任务详情含`reading_id/status/input/rule_version/facts/analysis/error_message/created_at/updated_at`，完成时可另含`model`。状态使用`pending/processing/completed/failed`。列表含`readings/total/skip/limit/daily_limit/remaining_today`。
- `request_id`在用户内唯一。同ID同内容返回原任务，不重复调用；同ID不同内容409。网络重试使用同ID，明确点击失败重试使用新ID但沿用原输入。失败、删除任务仍计入当日接受次数。
- 使用用户行锁保护幂等、每日额度和创建任务；提交后释放锁，再进行AI调用。新增独立每日解读额度默认5，原八字额度保持原有行为。
- AI采用一次有上限的结构化调用。既有适配器120秒超时、无自动重试。新增步骤可采用独立系统指令，把用户问题作为数据。DeepSeek的[JSON输出文档](https://api-docs.deepseek.com/guides/json_mode/)只保证JSON形式，服务端仍校验字段、长度、引用和事实。
- `analysis`固定为`facts_echo: {original_number,changed_number,moving_lines}`、`overview: {text,evidence_ids}`、`question_reading: {text,evidence_ids}`、`actions: [{text,evidence_ids}]`、`reflection_questions: string[]`、`limits: string`。文本和列表长度受限，事实回显须精确匹配，证据ID须属于本次事实包；不把模拟、缺配置、空白、截断或校验失败显示成真实成功。
- AI解读与卦象分区。隐私文案明确：仅起卦在本机完成；点击AI会发送本次问题、起卦资料与卦象，用于生成并保存解读，不自动上传其他档案。

## 验收要求

先验证三钱组合分布、原始币值与爻值一致、旧档案及跨体系回看兼容；再验证Python与TypeScript的五种方法对照、64卦和384爻完整性。后端覆盖越权、幂等、额度、非法输入、AI坏输出、失败保卦、历史与删除边界，旧八字流程回归。

前端在320/390px验证首页直达入口、自动出卦、仅起卦、AI加载与失败重试、保存刷新回看及实际JSON导出。使用明确的合成问题验证真实AI，不使用真实用户私密问题。正式部署须先备份、检查迁移、保留旧镜像与回退路径，再验证公网文件、接口和页面。真机、模拟视口、本地构建与生产结果分别报告。
