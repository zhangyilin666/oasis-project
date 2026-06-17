# 小易 — 上线前检查清单

## A. 必须由你填写/操作（无法自动化）

### A1. 获取生产域名

- [ ] 购买域名（如 `oasis-app.cn`）
- [ ] 完成 ICP 备案（工信部，约 20 个工作日）
- [ ] 为该域名申请 SSL 证书（Let's Encrypt 免费，或用云服务商提供的）
- [ ] 域名 DNS 解析到服务器 IP

### A2. 微信公众平台 → 开发管理 → 开发设置

- [ ] 填入真实 **AppSecret**（AppID `wx02953379e1c05a27` 已配置）
- [ ] **服务器域名 → request 合法域名** 添加：`https://你的生产域名`
  - 注意：必须是 HTTPS，必须是备案域名，不能带端口号
- [ ] 服务器域名每月仅可修改 5 次，确认无误后保存

### A3. 填写公司/运营方信息

- [x] `frontend/pages/agreement/agreement.js` — 用户协议 + 隐私政策已填入【张轶林】和 `3438627347@qq.com`

### A4. 生产环境 .env 配置

在服务器上创建 `python_backend/.env`：

```env
APP_NAME=小易
APP_VERSION=0.1.0
DEBUG=False
DATABASE_URL=mysql+pymysql://oasis_user:强密码@127.0.0.1:3306/oasis_db?charset=utf8mb4
JWT_SECRET_KEY=使用 openssl rand -hex 32 生成的随机密钥

# AI Provider
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-你的真实DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_DEFAULT_MODEL=deepseek-chat

# WeChat（必须填真实值！否则所有用户拿到 fake openid）
WECHAT_APPID=wx02953379e1c05a27
WECHAT_SECRET=你的微信小程序AppSecret

# CORS
CORS_ORIGINS=https://你的生产域名

# 速率限制
RATE_LIMIT_ANALYZE_PER_DAY=5
```

---

## B. 代码中的 TODO（搜索替换）

- [ ] `frontend/config/env.js:9` — `PROD_API_BASE_URL` 替换为 `https://你的生产域名`
- [ ] `deploy/nginx/oasis.conf` — 全局搜索 `your-domain.com` 替换为真实域名
- [x] `frontend/pages/agreement/agreement.js` — 已填入【张轶林】和 `3438627347@qq.com`

---

## C. 微信审核材料准备

### C1. 小程序信息

- [ ] **小程序名称**：小易（确认无侵权）
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
# 复制配置
cp deploy/nginx/oasis.conf /etc/nginx/sites-available/
# 修改域名后
ln -s /etc/nginx/sites-available/oasis.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### D3. 进程守护（systemd）

创建 `/etc/systemd/system/oasis.service`：

```ini
[Unit]
Description=小易 Backend
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
curl -s https://你的域名/ | jq

# 登录测试
curl -s -X POST https://你的域名/api/v1/wechat/login \
  -H 'Content-Type: application/json' \
  -d '{"code":"test_code"}' | jq

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
