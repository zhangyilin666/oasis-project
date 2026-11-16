# 猫来运转

每日运势、八字报告、黄历和塔罗。公网网页在 `https://162.211.181.253`，由 Caddy 提供 HTTPS，页面和接口在同一台机器上。

## 目录

- `python_backend/`：FastAPI 接口、数据库迁移和测试。
- `oasis-uniapp/`：当前前端，主要发布为 H5，也可以打 App。
- `deploy/`：现网用的 Caddy 配置和部署说明。
- `data_center/knowledge/`：八字分析用的本地资料。
- `docs/architecture.md`：架构说明。验收记录和截图在 `docs/archive/`。

旧微信小程序已从这条分支删除。完整代码在 Git 分支 `archive/legacy-frontend`（基于 `local-snapshot-2026-11`）。

## 本地运行

后端需要 Python 3.11 和 MySQL。在 `python_backend` 里：

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

把 `.env` 里的数据库地址和 `JWT_SECRET_KEY` 改成自己的，然后：

```sh
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

前端在 `oasis-uniapp` 里：

```sh
npm install
npm run dev:h5
```

检查：

```sh
cd python_backend && python -m pytest
cd oasis-uniapp && npm test && npx vue-tsc --noEmit && npm run build:h5
```

`oasis-uniapp/.env.demo` 只用于演示构建，不要把它的内容抄进正式环境。

## 部署

现网用的是仓库根目录这两个文件一起启动：

```sh
docker compose --env-file .env.api \
  -f docker-compose.api-ip.yml \
  -f docker-compose.api-mobile.yml \
  up -d --build
```

第一个文件起数据库、接口和 Caddy。第二个文件换成能同时托管 H5 的 Caddy 配置，并挂上 `oasis-uniapp/dist/build/h5`。网页要先构建，接口地址留空，让浏览器走同一站点。步骤见 `deploy/README.md`。

`docker-compose.api.yml` 是以后有域名时的接口方案，当前这台机器没有用它。Nginx 和旧的整站 Compose 在 `deploy/archive/`。
