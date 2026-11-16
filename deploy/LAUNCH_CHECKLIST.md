# 猫来运转 — 上线前检查清单

## A. 必须由你填写/操作（无法自动化）

### A1. 获取生产域名

- [ ] 购买域名（如 `oasis-app.cn`）
- [ ] 完成 ICP 备案（工信部，约 20 个工作日）
- [ ] 为该域名申请 SSL 证书（Let's Encrypt 免费，或用云服务商提供的）
- [ ] 域名 DNS 解析到服务器 IP

### A2. App 端配置

- [ ] `oasis-uniapp/.env.local` — 将 `VITE_API_BASE_URL` 指向服务器地址
  - 测试阶段可用 `http://服务器IP:8000`
  - 正式上线用 `https://你的域名`
- [ ] HBuilderX 重新打包 APK/IPA

### A3. 填写公司/运营方信息

- [x] 用户协议与隐私政策已写入当前 uni-app 的协议页。旧微信小程序 `frontend/` 已移到分支 `archive/legacy-frontend`

### A4. 生产环境 .env 配置

在服务器上创建 `python_backend/.env`：

```env
APP_NAME=猫来运转
APP_VERSION=0.1.0
DEBUG=False
DATABASE_URL=mysql+pymysql://oasis_user:强密码@db:3306/oasis_db?charset=utf8mb4
JWT_SECRET_KEY=使用 openssl rand -hex 32 生成的随机密钥

# AI Provider
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-你的真实DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_DEFAULT_MODEL=deepseek-chat

# CORS（App 无需域名限制）
CORS_ORIGINS=*

# 速率限制
RATE_LIMIT_ANALYZE_PER_DAY=5
```

---

## B. 代码中的 TODO（搜索替换）

- [ ] `oasis-uniapp/.env.local` — `VITE_API_BASE_URL` 替换为服务器地址
- [ ] 旧 Nginx 配置已放到 `deploy/archive/nginx/oasis.conf`，当前公网不用它

---

## C. 微信审核材料准备

### C1. 小程序信息

- [ ] **小程序名称**：猫来运转（确认无侵权）
- [ ] **小程序简介**：AI 驱动的八字命理分析，黄历宜忌查询，每日运势
- [ ] **服务类目**：工具 > 信息服务（或咨询微信客服确认最匹配类目）
  - ⚠️ 命理/占卜类可能被拒，建议强调「传统文化」「历法查询」「AI 辅助写作」，避免封建迷信表述
- [ ] **小程序图标**：1024×1024 px，符合微信设计规范

### C2. 审核功能性检查

- [ ] 登录页有用户协议 + 隐私政策勾选框 ✓（已完成）
- [x] 用户协议和隐私政策内容完整、包含运营方信息和联系方式（运营方：张轶林，邮箱：3438627347@qq.com）
- [ ] 所有页面功能正常，无空白页、无死链接
- [ ] 未使用测试数据/占位数据展示给用户
- [ ] 代码中不存在 `console.log` 打印敏感信息（如 token、code）
- [ ] 小程序的每个页面都已完成 UI 实现
- [ ] 底部导航栏三个 tab 均可正常切换

### C3. 提审操作

1. 微信开发者工具 → 右上角「上传」→ 填写版本号和备注
2. 登录 mp.weixin.qq.com → 版本管理 → 选择刚上传的版本 → 「提交审核」
3. 填写审核信息：功能截图（3-5 张）、测试账号（如需要登录才能使用）
4. 审核周期：1-7 个工作日

---

## D. 服务端部署

### D1. 服务器环境

```bash
# 安装依赖
cd python_backend
pip install -r requirements.txt

# 初始化数据库（首次部署）
alembic upgrade head

# 启动
uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
```

### D2. Nginx

```bash
# 旧 Nginx 配置已归档，当前公网用 Caddy，见 deploy/README.md。
# 若仍要查看旧文件：deploy/archive/nginx/oasis.conf
```

### D3. 进程守护（systemd）

创建 `/etc/systemd/system/oasis.service`：

```ini
[Unit]
Description=猫来运转 Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/oasis/python_backend
ExecStart=/opt/oasis/python_backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable oasis
systemctl start oasis
```

---

## E. 快速验证命令

```bash
# 后端健康检查
curl -s https://你的域名/health | jq

# 匿名登录测试
curl -s -X POST https://你的域名/api/v1/app/anonymous-login \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"test-device-uuid-12345678"}' | jq

# 数据库连接检查
mysql -u oasis_user -p -e "SELECT COUNT(*) FROM users" oasis_db
```

---

## F. 本次对话已完成的修复

| # | 修复内容 | 状态 |
|---|---------|------|
| 1 | `daily_fortune_service.py` Anthropic SDK 调用 bug | ✅ 已修复 |
| 2 | 用户协议 + 隐私政策重写（含 PIPL 合规） | ✅ 已写模板 |
| 3 | 登录页添加协议勾选框 | ✅ 已添加 |
| 4 | `env.js` 生产/开发环境自动切换 | ✅ 已实现 |
| 5 | `ANTHROPIC_BASE_URL` 配置项 | ✅ 已添加 |

---

## G. 本次对话新增的部署文件

| 文件 | 用途 |
|------|------|
| `python_backend/Dockerfile` | Backend 容器镜像构建 |
| `deploy/archive/docker-compose.nginx.yml` | 旧的 Nginx 一键部署，当前公网不用 |
| `deploy/systemd/oasis.service` | 非 Docker 部署的 systemd 进程守护 |
| `deploy/mysql/init.sql` | 数据库初始化脚本 |
| `deploy/.env.production.template` | 生产环境变量模板（含注释） |
| `deploy/archive/deploy-nginx.sh` | 旧的 Nginx 部署脚本，当前公网不用 |

## H. 上线前最终待办（按优先级）

### 🔴 必须完成（否则无法正常上线）
1. [ ] 生成强密码 JWT_SECRET_KEY：`openssl rand -hex 32`
2. [ ] 生成强密码 MYSQL_PASSWORD：`openssl rand -hex 16`
3. [ ] 更换 DeepSeek API Key（当前 .env 中的密钥已在本机使用过）
4. [ ] 当前公网部署见 `deploy/README.md`，不要再改已归档的 Nginx 配置
5. [ ] App 端 `oasis-uniapp/.env.local` 的 `VITE_API_BASE_URL` 指向服务器

### 🟡 强烈建议
6. [ ] 部署后立即在 DeepSeek 控制台重置当前 API Key（防止泄露）
7. [ ] 完成 ICP 备案 + SSL 证书

### 🟢 首次部署
8. [ ] 服务器安装 Docker: `curl -fsSL https://get.docker.com | bash`
9. [ ] 上传项目到服务器
10. [ ] 按 `deploy/README.md` 用 IP 版 Compose 启动，不要运行已归档的 `deploy/archive/deploy-nginx.sh`
11. [ ] App 端 HBuilderX 重新打包 APK
