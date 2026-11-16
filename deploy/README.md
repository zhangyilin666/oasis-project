# 部署

## 现网（这台机器）

公网 `https://162.211.181.253` 使用 Caddy，证书是 Let’s Encrypt 的 IP 证书。容器项目名是 `xiaoyi-api`。续期钩子 `oasis-api-cert-renew-hook.sh` 会重载这个项目里的 Caddy。

正式组合是仓库根目录的两个 Compose 文件：

| 文件 | 作用 |
| --- | --- |
| `docker-compose.api-ip.yml` | MySQL、FastAPI、Caddy。Caddy 先读 `deploy/Caddyfile.api-ip`，只公开接口。 |
| `docker-compose.api-mobile.yml` | 盖在上面：改用 `deploy/Caddyfile.api-mobile`，并把构建好的 H5 挂到 `/srv`。同一域名上，`/api` 和 `/health` 进后端，其余是网页。 |

发布前在 `oasis-uniapp` 构建网页，`VITE_API_BASE_URL` 留空：

```sh
cd oasis-uniapp
VITE_DEMO_MODE=false VITE_API_BASE_URL= npm run build:h5
cd ..
docker compose --env-file .env.api \
  -f docker-compose.api-ip.yml \
  -f docker-compose.api-mobile.yml \
  up -d --build
```

密钥放在服务器上的 `.env.api`，模板是 `deploy/.env.api.example`。不要执行 `docker compose down -v`，那会删掉数据库卷。打包上传的细节在 `deploy/MOBILE_IP_GUIDE.md` 和 `deploy/build_mobile_bundle.py`。

## 还留在根目录、但不是这台机器现网的

- `docker-compose.api.yml` 和 `deploy/Caddyfile.api`：以后改用域名时的纯接口方案。`deploy/API_GUIDE.md` 和 `deploy/build_api_bundle.py` 仍会带上它们。当前公网 IP 没有用这一套。
- `deploy/systemd/oasis.service`：不用 Docker、本机直接跑 uvicorn 的示例。现网没有用这个单元。

## 已归档

`deploy/archive/` 里是旧的 Nginx 一键部署，以及另一份独立的 Caddy 整站文件。现网没有引用它们。
