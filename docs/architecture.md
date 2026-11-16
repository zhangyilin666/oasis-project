# 猫来运转 — 全局架构蓝图

## 1. 项目定义

猫来运转是一个**AI 驱动的传统文化生活辅助平台**，以微信小程序为前端载体，FastAPI 为后端核心，融合农历历法、八字命理、黄历宜忌等传统文化知识库，通过 AI Agent 编排引擎为用户提供个性化分析与建议。

### 核心能力

- 微信小程序一键登录（code2session）
- 农历/干支历法计算（lunar-python）
- AI Agent 工作流编排（多模型、多步骤推理）
- RAG 知识库检索增强（传统文化典籍）
- 用户个性化分析与报告生成

---

## 2. 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| Web Framework | FastAPI + Uvicorn | 异步 REST API |
| 数据库 ORM | SQLAlchemy 2.0+ | DeclarativeBase + Mapped |
| 数据库 | MySQL 8.0 | 通过 PyMySQL 驱动 |
| 鉴权 | PyJWT (HS256) | 微信登录后签发 Token |
| 配置管理 | pydantic-settings | .env 文件驱动 |
| 日志 | logging + RotatingFileHandler | 5MB × 5 滚动 |
| 历法计算 | lunar-python | 农历/干支/节气/宜忌 |
| AI 编排 | 工作流引擎（自研） | Agent 管线 + 模型适配 |
| 向量存储 | ChromaDB / FAISS（待选） | RAG 知识库 |
| 前端 | 微信小程序 | WXML + WXSS + TypeScript |

---

## 3. 目录规范

```
D:\Oasis_Project\
├── docs\
│   └── architecture.md               ← 本文件（全局蓝图）
├── python_backend\
│   ├── .env                          ← 环境变量（不入库）
│   ├── .env.example                  ← 环境变量模板
│   ├── .gitignore
│   ├── requirements.txt              ← Python 依赖
│   └── app\
│       ├── main.py                   ← FastAPI 入口 + lifespan
│       ├── api\                       ← 路由层（Router）
│       │   ├── auth_api.py           ← 鉴权路由 /api/v1/wechat/*
│       │   ├── oasis_api.py          ← 分析路由 /api/v1/wechat/oasis/*
│       │   └── __init__.py
│       ├── core\                      ← 基础设施
│       │   ├── config.py             ← Settings (pydantic-settings)
│       │   ├── exceptions.py         ← 全局异常处理
│       │   ├── kb_provider.py        ← RAG 知识库应用单例
│       │   ├── logger.py             ← 日志配置
│       │   ├── security_deps.py      ← JWT 鉴权依赖 (get_current_user)
│       │   └── __init__.py
│       ├── db\                        ← 数据库层
│       │   ├── base.py               ← DeclarativeBase
│       │   ├── database.py           ← engine + SessionLocal + get_db
│       │   └── __init__.py
│       ├── models\                    ← ORM 模型（数据表）
│       │   ├── user_model.py         ← User 表
│       │   ├── report_model.py       ← Report 表（分析报告）
│       │   ├── log_model.py          ← AnalysisLog 表（AI 调用审计）
│       │   └── __init__.py
│       ├── schemas\                   ← Pydantic 请求/响应模型
│       │   ├── auth_schema.py        ← 鉴权相关 Schema
│       │   ├── oasis_schema.py       ← 分析相关 Schema (UserInput, OasisResponse)
│       │   └── __init__.py
│       ├── services\                  ← 业务逻辑层
│       │   ├── ai_client.py          ← Claude API 客户端 + mock fallback
│       │   ├── analysis_service.py   ← 分析编排（八字→RAG→AI→入库）
│       │   ├── calendar_service.py   ← 农历历法服务 (lunar-python)
│       │   ├── rag_service.py        ← RAG 检索服务 (KeywordRetriever + KnowledgeBase)
│       │   ├── wechat_service.py     ← 微信认证服务 (code2session)
│       │   ├── workflow_service.py   ← Agent 编排引擎 (WorkflowPipeline)
│       │   └── __init__.py
│       └── utils\                     ← 工具函数
│           ├── security.py           ← JWT 签发/验证/宽限刷新
│           └── __init__.py
├── frontend\                          ← 微信小程序（6 页面 + 3 组件）
│   ├── app.js / app.json / app.wxss  ← 应用入口
│   ├── pages\                         ← 页面
│   │   ├── login\                    ← 微信一键登录
│   │   ├── home\                     ← 首页（黄历概览）
│   │   ├── analyze\                  ← 八字分析（表单+结果）
│   │   ├── reports\                  ← 报告列表（分页）
│   │   ├── report-detail\            ← 报告详情（完整分析）
│   │   ├── profile\                  ← 个人中心
│   │   └── agreement\               ← 用户协议
│   ├── components\                    ← 通用组件
│   │   ├── loading-overlay\          ← 加载遮罩
│   │   ├── empty-state\              ← 空状态占位
│   │   └── error-retry\              ← 错误重试
│   ├── services\                      ← API 调用封装
│   │   ├── auth.service.js           ← 登录/刷新
│   │   ├── oasis.service.js          ← 分析/报告
│   │   └── almanac.service.js        ← 黄历查询
│   └── utils\                         ← 工具
│       ├── request.js                ← HTTP 客户端（401 静默刷新）
│       ├── storage.js                ← 本地存储
│       └── ui.js                     ← UI 工具（loading/toast）
├── data_center\                       ← 数据存储
│   └── knowledge\                     ← 古籍知识库文档
│       ├── shishen_detail.txt        ← 十神详解
│       ├── bazi_patterns.txt         ← 八字格局基础
│       └── ditian_sui.txt            ← 滴天髓精选
└── tests\                             ← 测试（85 个，全部通过）
    ├── test_api_integration.py       ← API 集成测试
    ├── test_calendar_service.py      ← 历法模块测试
    ├── test_kb_provider.py           ← 知识库测试
    ├── test_rag_service.py           ← RAG 检索测试
    └── test_workflow_service.py      ← 工作流引擎测试
```

---

## 4. 模块边界与职责

```
┌─────────────────────────────────────────────────────────┐
│                     API Layer (api/)                      │
│  auth_api.py          oasis_api.py                       │
│  微信登录/Token刷新    八字分析/黄历查询/报告                │
└──────────┬──────────────────────┬────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐  ┌───────────────────────────────────┐
│   Core (core/)    │  │        Services (services/)        │
│  config.py        │  │  workflow_service  → AI 编排引擎    │
│  security_deps.py │  │  calendar_service  → 历法计算      │
│  exceptions.py    │  │  wechat_service    → 微信对接      │
│  logger.py        │  │  rag_service       → 知识库检索    │
└──────────────────┘  └──────┬────────────┬───────────────┘
                             │            │
                             ▼            ▼
                    ┌────────────┐ ┌──────────────┐
                    │  models/   │ │  utils/       │
                    │  ORM 模型   │ │  security.py  │
                    └─────┬──────┘ └──────────────┘
                          │
                          ▼
                    ┌────────────┐
                    │  db/       │
                    │  MySQL 引擎 │
                    └────────────┘
```

### 各层职责

| 层 | 职责 | 禁止 |
|---|---|---|
| **api/** | 路由注册、参数校验、调用 service、格式化响应 | 不含业务逻辑 |
| **services/** | 业务逻辑编排、外部 API 调用、算法计算 | 不直接操作 HTTP 请求/响应 |
| **models/** | ORM 表定义 | 不含业务方法（保持纯数据层） |
| **schemas/** | Pydantic 请求/响应校验模型 | 不含数据库操作 |
| **core/** | 全局配置、基础设施、中间件依赖 | 不含业务规则 |
| **utils/** | 纯函数工具（JWT、加密等） | 不含状态或数据库依赖 |
| **db/** | 引擎创建、会话管理、Base 基类 | 不含表定义 |

---

## 5. 数据流

### 5.1 微信登录流程

```
小程序 code
    │
    ▼
POST /api/v1/wechat/login
    │
    ▼
auth_api.wechat_login()
    ├── wechat_service.authenticate_wechat_user()
    │   ├── code → mock_openid（开发阶段）
    │   ├── SELECT * FROM users WHERE openid = ?
    │   └── 不存在 → INSERT INTO users → 返回 User
    │
    └── security.create_access_token({sub, openid})
        └── JWT HS256 签名 → 返回 {token, user_id}
```

### 5.2 八字分析流程（目标态）

```
小程序端提交 {birth_date, birth_time, gender, location, is_solar_time}
    │
    ▼
POST /api/v1/wechat/oasis/analyze
    │
    ▼
oasis_api.analyze()
    ├── calendar_service.calculate_bazi()
    │   ├── 公历→农历转换
    │   ├── 八字四柱计算（年柱/月柱/日柱/时柱）
    │   └── 返回十二宫信息
    │
    ├── workflow_service.execute(pipeline)
    │   ├── Step 1: 命理分析 Agent
    │   ├── Step 2: 流年运势 Agent
    │   └── Step 3: 综合建议 Agent
    │
    └── 返回 {calendar_data, ai_analysis_text}
```

---

## 6. API 契约

### 6.1 鉴权模块

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/api/v1/wechat/login` | 无 | 微信 code 登录，返回 JWT |
| POST | `/api/v1/wechat/refresh` | JWT | 刷新 Token（30 天宽限期） |

### 6.2 分析模块

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/health` | 无 | 健康检查 |
| POST | `/api/v1/wechat/oasis/analyze` | JWT | 八字分析（核心接口，含 RAG 古籍引用） |
| GET | `/api/v1/wechat/oasis/reports` | JWT | 用户报告列表（分页，skip/limit） |
| GET | `/api/v1/wechat/oasis/report/{report_id}` | JWT | 报告详情（八字 + AI 分析全文 + 审计日志） |
| GET | `/api/v1/wechat/oasis/almanac` | JWT | 黄历宜忌查询（支持 ?solar_date=YYYY-MM-DD） |

### 6.3 通用响应格式

```json
{
  "code": 200,
  "message": "ok",
  "data": { ... }
}
```

### 6.4 错误码约定

| Code | 含义 |
|---|---|
| 200 | 成功 |
| 401 | 未登录 / Token 过期 |
| 422 | 请求参数校验失败 |
| 500 | 服务器内部错误 |

---

## 7. 数据库设计

### 7.1 users 表

| Column | Type | Constraint | 说明 |
|---|---|---|---|
| id | INT | PK, AUTO_INCREMENT | 用户 ID |
| openid | VARCHAR(255) | UNIQUE, INDEX, NOT NULL | 微信 OpenID |
| nickname | VARCHAR(255) | NULLABLE | 昵称 |
| avatar_url | VARCHAR(500) | NULLABLE | 头像 |
| created_at | DATETIME | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT NOW(), ON UPDATE | 更新时间 |

### 7.2 reports 表

| Column | Type | Constraint | 说明 |
|---|---|---|---|
| id | INT | PK, AUTO_INCREMENT | 报告 ID |
| user_id | INT | FK → users.id, INDEX, NOT NULL | 所属用户 |
| birth_info | VARCHAR(100) | NOT NULL | 出生信息摘要 |
| calendar_data | JSON | NOT NULL | 八字排盘完整数据 |
| ai_analysis | TEXT | NULLABLE | AI 分析全文 |
| created_at | DATETIME | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT NOW(), ON UPDATE | 更新时间 |

### 7.3 analysis_logs 表

| Column | Type | Constraint | 说明 |
|---|---|---|---|
| id | INT | PK, AUTO_INCREMENT | 日志 ID |
| user_id | INT | FK → users.id, INDEX, NOT NULL | 所属用户 |
| report_id | INT | FK → reports.id, INDEX, NOT NULL | 关联报告 |
| model_name | VARCHAR(50) | NOT NULL, DEFAULT 'unknown' | AI 模型名 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'success' | 步骤状态 |
| prompt_tokens | INT | NULLABLE | 输入 Token 数 |
| completion_tokens | INT | NULLABLE | 输出 Token 数 |
| total_tokens | INT | NULLABLE | 总 Token 数 |
| latency_ms | INT | NULLABLE | 步骤耗时（毫秒） |
| trace_id | VARCHAR(20) | INDEX, NULLABLE | 链路追踪 ID |
| created_at | DATETIME | NOT NULL, DEFAULT NOW() | 创建时间 |

---

## 8. 安全架构

```
微信小程序
    │
    ▼ wx.login() → code
POST /api/v1/wechat/login (公开)
    │
    ▼ 返回 JWT Token
    │
后续请求携带: Authorization: Bearer <token>
    │
    ▼ Depends(get_current_user)
    │ verify_token() 解码
    │ 注入 current_user → 受保护端点
```

### JWT Payload 结构

```json
{
  "sub": "<user_id>",
  "openid": "<wechat_openid>",
  "iat": <issued_at_timestamp>,
  "exp": <expiration_timestamp>
}
```

---

## 9. 演进路线图

| Phase | 内容 | 状态 |
|---|---|---|
| **Phase 1** | FastAPI 骨架 + DB + JWT + 微信登录 | ✅ 完成 |
| **Phase 2** | Agent 编排引擎 + 历法模块 + 鉴权中间件 | ✅ 完成 |
| **Phase 3** | RAG 知识库 + AI 分析管线 + 报告系统 | ✅ 完成 |
| **Phase 4** | 微信小程序前端（6 页面 + 3 组件） | ✅ 完成 |
| **Phase 4B** | Alembic 数据库迁移 + reports/analysis_logs 表 | ✅ 完成 |
| **Phase 5** | 前端后端联调 + 集成测试（85 个测试通过） | ✅ 完成 |
| **Phase 6** | 真实 API Key 配置 + 微信 APPID/SECRET 对接 | 🟡 待配置 |
| **Phase 7** | Docker 容器化 + 生产部署 | ⬜ 待开始 |
| **Phase 8** | CI/CD + 监控 + 限流 + 缓存 | ⬜ 待开始 |

---

## 10. 开发约定

1. **所有 .py 文件首行**：`# -*- coding: utf-8 -*-`
2. **所有文件编码**：UTF-8 without BOM
3. **ORM 语法**：仅使用 SQLAlchemy 2.0+ `Mapped` + `mapped_column`
4. **Pydantic**：v2 语法（`field_validator`，非 v1 的 `validator`）
5. **类型提示**：所有函数签名包含完整类型注解
6. **配置读取**：通过 `app.core.config.settings`，禁止 `os.getenv` 直接读取业务配置
7. **日志**：统一使用 `app.core.logger.logger`
8. **禁止**：在 api/ 层写业务逻辑，在 services/ 层操作 HTTP 对象

---

## 11. 三盘同参增量（2026-10-03）

uni-app 新增 `pages/explore/index`，以本地确定性适配器连接八字、紫微斗数与西方基础星盘，统一输入和时间归一，分别保存各体系规则与来源。首页增加入口，原有服务端 AI 八字报告保持独立。新能力不需要数据库迁移或额外服务。

实现边界、依赖许可和验证记录见[第一阶段交付记录](metaphysics-phase1.md)；完整五术能力及分期研究见[调研与路线](metaphysics-research-2026-10-03.md)。

第二阶段扩展同一出生契约，加入 IANA 历史时区、时间精度与地点；紫微按可选观察日期生成运限，西方星盘增加四轴与整宫制。出生结果在用户保存后形成最多 30 份本机快照；独立的 `pages/divination/index` 提供六爻基础记录和梅花两数法，最多保存 50 条问事输入。两类存储均独立于认证、服务端账号报告和数据库，不进行云同步。界面、算法、记录版本及本轮验证状态见[第二阶段交付记录](metaphysics-phase2.md)。

第三批先完成[十八项调研与接入路线](metaphysics-integration-roadmap.md)，随后在原有边界内扩展梅花年月日时法与西方行运快照。问事仍使用独立方法与规则版本；出生结果仅对实际生成行运的星盘增加可选观察元数据，旧存档原样可读。具体实现和验收见[第三批交付](metaphysics-phase3.md)。

第四批将六爻纳甲作为独立 `liuyao-najia-v1` 方法接入，保留原有三种起卦方法语义；出生计算的 `compareRules` 仅追加显式的八字／紫微参数对照，并在紫微调用前后清理全局设置。独立黄历页面固定 UTC+8，区分瞬时节气事实与整日传统宜忌；使用独立键存放最多 20 条原样快照。具体范围及验证限制见[第四批交付](metaphysics-phase4.md)。持续开发的完整状态和下一验收点见[十八板块清单](metaphysics-delivery-ledger.md)。

第五至八批继续以独立领域及本机档案接入修习、塔罗、空间事实、姓名、印度占星、择日、奇门、七政天文、节气生活、相学文化、细分运限、西方宫制/双人相位、六壬、太乙和八宅。共享导航与资料只读复用，不扩展服务端鉴权对象或把不同记录合成一种生日模型。范围、独立参考、设备与下载限制见[第五批](metaphysics-phase5.md)、[第六批](metaphysics-phase6.md)、[第七批](metaphysics-phase7.md)和[第八批集成](metaphysics-phase8.md)。开发中主题同读与清历宿度状态以[持续交付清单](metaphysics-delivery-ledger.md)为准。

主题同读已接入19类原档案的只读副本，用户自选2–8份形成独立主题报告；完整输入、事实、时间口径、来源与差异一并保存，不推定身份、不生成综合分数。清历宿度以独立年标号与古表宫度查算，不自动接受现代七政位置。最终范围及验证状态见[集成验收](metaphysics-phase9.md)，模块清单继续作为当前状态入口。

*文档版本: 0.11.0 | 本次增量更新: 2026-10-03 | 维护者: 猫来运转 架构组*
