# 倪海厦 Agent Skills 调研

调研日期：2026-10-12（北京时间）。范围：GitHub 项目说明、当前 main 分支的技能指令、知识文件与部分检索源码抽查。未运行第三方安装脚本，未进行模型对答效果或医学准确性实测。以下区分项目声明、源码观察与接入建议。

## 选择结论

- 个人学习和资料考证：优先关注 [JuneYaooo/nihaisha-nishi-tcm](https://github.com/JuneYaooo/nihaisha-nishi-tcm)，它有课程、截图和 PDF 证据检索设计。旧地址 nihaisha-tcm 已跳转到这个仓库。
- 技能组织方式：参考 [Tespera/nihaisha-skill](https://github.com/Tespera/nihaisha-skill) 的分层加载和独立安全策略。
- 猫来运转：目前不建议把任何一个整包直接接入生产。先确认所用资料的授权、校对天纪材料，再考虑只为现有“卜”增加易经人事解释。保持现有八字与起卦计算流程。

## 主要候选

| 项目 | 已观察到的优势 | 主要问题 | 判断 |
| --- | --- | --- | --- |
| JuneYaooo/nihaisha-nishi-tcm | 默认轻量索引；能按课程、截图、PDF 页码寻找依据；天纪模块涵盖 24 课 | 摘要仍有明显转写噪声；RAG 与知识图谱模式当前被维护者下架；项目声明仅非商业使用 | 最值得作为学习与考证候选 |
| Tespera/nihaisha-skill | 索引、人物表达、课程语料分离；POLICY 优先于角色风格 | 天纪文件抽查仅 117 行、4,698 字节，内容偏概览；安全声明不能替代语料校对 | 值得参考工程结构，天纪深度不足 |
| jangviktor-web/nihaixia | 大量模块与案例，包含六十四卦人事应用 | 指令强制处方输出、肯定式疗效话术，并限制正文出处和就医提示；入口文件较重 | 可列为待校对资料线索，不采用原始角色提示词 |
| qmzz/ni-haisha-tcm-skill | Python 工具以 JSON 提供搜索和文档读取，便于服务端封装 | 当前 search 实现是关键词匹配加权；README 所说的语义检索不能据此认定为向量检索；版本变化与搜索缓存不一致 | 借鉴接口形态，暂不优先选用其语料与人设 |

来源：[June 技能入口](https://github.com/JuneYaooo/nihaisha-nishi-tcm/blob/main/SKILL.md)、[Tespera 技能入口](https://github.com/Tespera/nihaisha-skill/blob/main/SKILL.md)、[jang 技能入口](https://github.com/jangviktor-web/nihaixia/blob/main/SKILL.md)、[qmzz 检索实现](https://github.com/qmzz/ni-haisha-tcm-skill/blob/main/internal/knowledge_query.py)。

## 影响选择的具体发现

### 1. 课程来源可追溯，不等于摘要已准确

June 的天纪文件注明前三课使用模型摘要，后续课程使用转写抽取；抽查仍见“七煞破军炭上”等疑似识别错误。截图索引提供课程与时间戳，便于回查，但不能把整理文本直接标为倪海厦逐字原话。它的源码明确区分课程观点、整理概括与原始证据。

来源：[天纪笔记](https://github.com/JuneYaooo/nihaisha-nishi-tcm/blob/main/references/tianji.md)、[天纪截图索引](https://github.com/JuneYaooo/nihaisha-nishi-tcm/blob/main/references/tianji-screenshot-evidence.md)。

### 2. 热门版本的角色规则不适合直接用于产品

jang 当前技能文件要求提供具体方剂，并设置肯定式疗效收束、隐藏检索定位信息、正文不出现就医提示等规则。这些规则使风格模仿和可靠解释发生冲突。源码还存在不同段落互相牵制的安全与角色要求。以上是静态指令风险观察，不是经过模型实测的失败率结论。

源码：[SKILL.md](https://github.com/jangviktor-web/nihaixia/blob/main/SKILL.md)。

### 3. 检索宣传需要对照实现

qmzz 当前 `KnowledgeIndex.search` 对标题、文件名和正文关键词计分，随后排序返回。所查看的这条搜索路径未调用嵌入模型或向量库。中文自然语言的同义表达能否命中，需要另做检索评测，不能仅凭“语义检索”描述认定。

源码：[knowledge_query.py](https://github.com/qmzz/ni-haisha-tcm-skill/blob/main/internal/knowledge_query.py)、[tcm_tools.py](https://github.com/qmzz/ni-haisha-tcm-skill/blob/main/tools/tcm_tools.py)。

### 4. 同名镜像不代表独立的能力提升

搜索结果中存在多个 fork 或复制版本。Bald0Wang 仓库的说明指向 June 上游；对照后上游已加入更多出处与边界说明，因此优先考察上游。搜索缓存中的 qmzz 旧技能说明与当前 main 已有明显差异，选型应固定经过审核的具体提交，而非直接跟随分支最新状态。

来源：[Bald0Wang 项目](https://github.com/Bald0Wang/nihaixia)、[June 上游](https://github.com/JuneYaooo/nihaisha-nishi-tcm)、[qmzz 当前入口](https://github.com/qmzz/ni-haisha-tcm-skill/blob/main/SKILL.md)。

### 5. 资料使用许可尚不能视为已解决

June 的使用说明明确限定非商业用途，并要求第三方课程等原始资料另行取得相应许可。Tespera 声明整理成果采用 MulanPSL-2.0，同时明确讲义本身权利不包含在该授权内，项目仅供学习研究。jang README 指向 LICENSE，但此次读取 main 根目录该文件返回 404。qmzz README 的 MIT 声明本身不能证明所有课程材料的授权来源。以上是仓库声明与文件检查结果，不是对相关权利的法律裁定。

来源：[June 使用说明](https://github.com/JuneYaooo/nihaisha-nishi-tcm/blob/main/docs/USE_AND_RISK_NOTICE.md)、[Tespera 语料与许可说明](https://github.com/Tespera/nihaisha-skill#语料来源与许可)、[jang README](https://github.com/jangviktor-web/nihaixia)、[qmzz README](https://github.com/qmzz/ni-haisha-tcm-skill)。

## 猫来运转的可行接入方向

这是产品建议，尚未实施：

1. 将范围限定为天纪中的易经、人事解释；现有“命”继续保留八字 AI 解读。
2. 在“卜”的 AI 解读中试验一种可选解释视角，由当前起卦程序提供确定的卦象，检索经过校对的对应材料后再生成解读。
3. 不增加课程大厅、诊疗入口或多套复杂操作；来源可折叠展示，正文保持简短。
4. 使用可确认授权的材料，区分原文、课程整理、模型解释，不以真人身份或背书方式呈现。
5. 上线前固定版本，并用同一批问题检查出处准确性、无依据断言、缺失资料处理、回复长度与延迟。当前没有实测证据证明某个候选能提高八字或问卦解读质量。

推荐顺序：先用 June 做学习与出处核查，参考 Tespera 的加载结构；获得适用资料与质量证据后，才决定是否接入产品。
