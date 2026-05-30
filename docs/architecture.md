# Oasis（绿洲）— 全局架构蓝图

## 1. 项目定义

Oasis 是一个**AI 驱动的传统文化生活辅助平台**，以微信小程序为前端载体，FastAPI 为后端核心，融合农历历法、八字命理、黄历宜忌等传统文化知识库，通过 AI Agent 编排引擎为用户提供个性化分析与建议。

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
│       │   ├── logger.py             ← 日志配置
│       │   ├── security_deps.py      ← JWT 鉴权依赖（待建）
│       │   └── __init__.py
│       ├── db\                        ← 数据库层
│       │   ├── base.py               ← DeclarativeBase
│       │   ├── database.py           ← engine + SessionLocal + get_db
│       │   └── __init__.py
│       ├── models\                    ← ORM 模型（数据表）
│       │   ├── user_model.py         ← User 表
│       │   └── __init__.py
│       ├── schemas\                   ← Pydantic 请求/响应模型
│       │   ├── auth_schema.py        ← 鉴权相关 Schema
│       │   ├── oasis_schema.py       ← 分析相关 Schema
│       │   └── __init__.py
│       ├── services\                  ← 业务逻辑层
│       │   ├── wechat_service.py     ← 微信认证服务
│       │   ├── workflow_service.py   ← Agent 编排引擎（待建）
│       │   ├── calendar_service.py   ← 农历历法服务（待建）
│       │   ├── rag_service.py        ← RAG 检索服务（待建）
│       │   └── __init__.py
│       └── utils\                     ← 工具函数
│           ├── security.py           ← JWT 签发/验证
│           └── __init__.py
├── frontend\                          ← 微信小程序代码（待建）
└── data_center\                       ← 数据存储（知识库文档等）
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
| POST | `/api/v1/wechat/refresh` | JWT | 刷新 Token（待建） |

### 6.2 分析模块

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/health` | 无 | 健康检查 |
| POST | `/api/v1/wechat/oasis/analyze` | JWT | 八字分析（核心接口） |
| GET | `/api/v1/wechat/oasis/almanac` | JWT | 黄历宜忌查询（待建） |
| GET | `/api/v1/wechat/oasis/report/{id}` | JWT | 历史报告查询（待建） |

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

### 7.1 users 表（已建）

| Column | Type | Constraint | 说明 |
|---|---|---|---|
| id | INT | PK, AUTO_INCREMENT | 用户 ID |
| openid | VARCHAR(255) | UNIQUE, INDEX, NOT NULL | 微信 OpenID |
| nickname | VARCHAR(255) | NULLABLE | 昵称 |
| avatar_url | VARCHAR(500) | NULLABLE | 头像 |
| created_at | DATETIME | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT NOW(), ON UPDATE | 更新时间 |

### 7.2 待建表

- **reports** — 分析报告（user_id, type, input_data, result_json, created_at）
- **analysis_logs** — AI 调用日志（user_id, model, tokens_in, tokens_out, latency_ms, created_at）

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
| **Phase 2** | Agent 编排引擎 + 历法模块 + 鉴权中间件 | 🟡 今日进行 |
| **Phase 3** | RAG 知识库 + 真实微信对接 | ⬜ 待开始 |
| **Phase 4** | 微信小程序前端 + 报告系统 | ⬜ 待开始 |
| **Phase 5** | 多模型支持 + 缓存 + 限流 + 生产部署 | ⬜ 待开始 |

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

*文档版本: 0.2.0 | 最后更新: 2026-05-30 | 维护者: Oasis 架构组*
