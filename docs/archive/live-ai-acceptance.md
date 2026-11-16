# 真实 AI 联调记录

日期：2026-09-23。使用虚构出生信息和独立的临时 SQLite 数据库，没有改动用户数据库。原始验收结果见 [live-ai-check.json](live-ai-check.json)。

## 结果

本次成功运行包含匿名登录、报告提交和轮询、三个真实报告 AI 步骤、一次今日提示生成，以及再次查询命中缓存。

| 项目 | 结果 |
| --- | --- |
| 服务 | DeepSeek 官方 API |
| 模型 | deepseek-flash，非思考模式 |
| 报告 | completed，结构化字段核对通过 |
| 参考资料 | 5 个片段，模型返回的资料 ID 均来自本次输入 |
| 报告耗时 | 25.28 秒（包括本地流程开销） |
| 全流程耗时 | 26.64 秒 |
| 输入 tokens | 8707，其中缓存命中 2176 |
| 输出 tokens | 3995 |
| 今日提示复用 | 第二次查询命中缓存，没有新增 AI 调用 |

按本次调用时适用的 Flash 高峰价（每百万 tokens：缓存输入 0.04 元、未缓存输入 2 元、输出 8 元），成功运行的估算费用约 **0.0451 元**。仅包含这一次成功运行，不含此前调试中被校验拦截的调用；实际账单以提供商结算为准。价格与时段依据：[DeepSeek 官方价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)。这是单一样例测量，不代表并发性能或平均耗时。

## 联调发现与修正

1. 账户模型列表返回 deepseek-flash / deepseek-v4-pro。将本机非公开 .env、配置默认值、示例和手机部署 Compose 的默认模型更新为官方当前推荐的 deepseek-flash，未输出或提交密钥。
2. Flash 默认开启思考模式，报告解读显式使用非思考模式，并对需要 JSON 的报告步骤和今日提示启用 json_object 输出。自定义兼容模型不会收到 DeepSeek 专属 thinking 参数。依据：[官方思考模式说明](https://api-docs.deepseek.com/guides/thinking_mode/)。
3. 真实输出曾附加 type 顶层元数据。现在忽略未使用的顶层元数据，仍严格要求 text / facts / reference_ids 存在，facts 的内容、数字类型和资料 ID 校验没有放宽。
4. 失败的真实报告没有被发布为 completed，也没有伪造备用解读。

## 回归与边界

- 在本机完成回归后，使用部署镜像的 Python 3.11 及固定依赖运行最终代码，**205 项测试通过**。
- 已检查生成文本、八步大运标题、引用列表和每日返回字段。结构化核对只证明字段与排盘一致；文化解释、性格推论等自由文本没有因此成为可证实事实。
- 这次没有部署公网或完成实体手机验收。此前启动的隔离 UI 演示进程仍可能使用模拟配置；正式启动时应重新加载配置并保持 ALLOW_MOCK_AI=false。

## 复查命令

在 python_backend 目录运行：

```powershell
.\.venv\Scripts\python.exe scripts/check_live_ai.py --execute-live --output D:/Oasis_Project/docs/live-ai-check.json
```

每次执行会产生真实 API 用量，正常流程最多调用三个报告步骤和一个今日提示步骤。脚本只输出耗时、模型、用量及脱敏错误位置；成功结果不保存登录 token、设备恢复码或 API 密钥。输出文件中的成本估算是本次人工按价格核算的记录，重新运行脚本后需按新用量重新计算。
