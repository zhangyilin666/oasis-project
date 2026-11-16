# 在已有 IP HTTPS API 上启用手机网页版

安卓和 iPhone 都通过同一个 HTTPS 地址使用 H5。此方式复用
`docker-compose.api-ip.yml` 的 `xiaoyi-api` 项目、`.env.api`、数据库卷和证书。
服务器须已经具备有效 IP 证书；证书申请和续期见 [API_GUIDE.md](API_GUIDE.md)。

## 制作与上传

在 Windows 项目根目录运行：

```powershell
python deploy/build_mobile_bundle.py
scp deploy/out/oasis-mobile.tar.gz deploy/out/oasis-mobile.tar.gz.sha256 root@162.211.181.253:/root/
```

脚本重新构建正式 H5，强制关闭模拟模式；包中只有部署源码、知识库、
示例配置和网页产物，不包含本机环境配置、账号或密钥。

## 检查、备份和更新

以下命令在服务器运行。先确认已有服务、目录、证书和数据库实际存在；
路径不同或容器项目名不同，应先调整，不能直接初始化另一套数据库。

```sh
set -eu
cd /root
sha256sum -c oasis-mobile.tar.gz.sha256
cd /opt/oasis-api
docker compose --env-file .env.api -f docker-compose.api-ip.yml ps
curl -f https://162.211.181.253/health
```

备份现有配置与数据库。备份文件只保存在服务器：

```sh
umask 077
backup_dir="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
cp .env.api docker-compose.api-ip.yml "$backup_dir/"
cp deploy/Caddyfile.api-ip "$backup_dir/"
docker compose --env-file .env.api -f docker-compose.api-ip.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --no-tablespaces oasis_db' > "$backup_dir/oasis.sql"
test -s "$backup_dir/oasis.sql"
```

确认备份成功后解包。`.env.api` 和数据库不在部署包中，不会被覆盖。
先只更新提供网页的 Caddy 容器：

```sh
tar -xzf /root/oasis-mobile.tar.gz -C /opt/oasis-api
docker compose --env-file .env.api -f docker-compose.api-ip.yml -f docker-compose.api-mobile.yml run --rm --no-deps api caddy validate --config /etc/caddy/Caddyfile
docker compose --env-file .env.api -f docker-compose.api-ip.yml -f docker-compose.api-mobile.yml up -d --no-deps api
curl -f https://162.211.181.253/health
curl -f https://162.211.181.253/ -o /dev/null
```

若后端源码也需更新，在保留旧镜像、检查已有迁移版本后，使用这两个
Compose 文件执行 `up -d --build`。以后更新必须始终同时指定两个文件，
否则网页挂载会被移除。不要运行 `down -v`。

手机打开 `https://162.211.181.253/`，检查填写、生成报告、报告列表、
每日查询和账号恢复；AI Key 保存在服务器 `.env.api`，正式环境保持
`ALLOW_MOCK_AI=false`。服务器公网健康检查和真实 AI 查询通过后才算部署完成。

## 回退网页变更

如网页发布失败，可恢复到只提供 API 的容器配置，保留数据库：

```sh
docker compose --env-file .env.api -f docker-compose.api-ip.yml up -d --no-deps api
curl -f https://162.211.181.253/health
```

此回退只撤回网页挂载；后端更新需单独使用备份镜像回退。IP 证书续期继续
沿用现有 Certbot 定时器和 Caddy 重载钩子，发布后应核对其仍正常工作。
