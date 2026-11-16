# Android App 的 API 部署

服务器运行 FastAPI、MySQL 和 Caddy；Android APK 在本地电脑的 HBuilderX 中打包。Compose 文件 `docker-compose.api.yml` **不构建网页版**。

若要同时在安卓和 iPhone 浏览器中使用，请看 [IP 手机网页版部署指南](MOBILE_IP_GUIDE.md)，在已有 API 上增加 H5 页面。

## 服务器准备

在 Ubuntu 24.04 上按 [Docker 官方文档](https://docs.docker.com/engine/install/ubuntu/)安装 Docker Engine 与 Compose 插件。确认 `docker --version`、`docker compose version` 都能显示版本。

在 Windows 项目根目录运行 `python deploy/build_api_bundle.py`，生成 `deploy/out/oasis-api.tar.gz`。它只收录 API 部署需要的源码、迁移脚本、知识库和示例配置，不包含本机 `.env`、`.venv`、`node_modules` 或签名证书。然后在 Windows PowerShell 上传：

```powershell
scp deploy/out/oasis-api.tar.gz root@<服务器IP>:/root/
```

在服务器 SSH 终端解压：

```sh
mkdir -p /opt/oasis-api
tar -xzf /root/oasis-api.tar.gz -C /opt/oasis-api
cd /opt/oasis-api
```

## 先做服务器本地健康检查

在服务器项目根目录：

```sh
python3 deploy/init_api_env.py
```

脚本会在服务器上生成权限为 `600` 的 `.env.api`，为 `MYSQL_ROOT_PASSWORD`、`MYSQL_PASSWORD` 和 `JWT_SECRET_KEY` 写入三个不同的随机值，不会将它们打印出来，也不会覆盖已存在的配置。真实 AI 还需在服务器的 `.env.api` 中填写 `DEEPSEEK_API_KEY`，**不要发到聊天或打进 APK**。保持 `ALLOW_MOCK_AI=false`。

模板默认仅把 HTTP 的 18080 端口绑定到服务器本机，供上线前检查：

```sh
docker compose --env-file .env.api -f docker-compose.api.yml up -d --build
docker compose --env-file .env.api -f docker-compose.api.yml ps
curl -f http://127.0.0.1:18080/health
```

健康检查应返回 `status: ok`。数据库只在容器网络内使用，不向公网开放。

## 无域名：用公网 IP 的 HTTPS

这台服务器的 IP 是 `162.211.181.253`。Let’s Encrypt 已支持 IP 证书，但有效期只有 6 天，必须配置自动续期。证书申请需要服务商防火墙放行入站 TCP 80；App 访问需要放行入站 TCP 443。保持 SSH 的 TCP 22 可用。不要把明文 HTTP 写入正式 APK。

先在 **Windows PowerShell** 的项目根目录重新制作并上传部署包：

```powershell
python deploy/build_api_bundle.py
scp deploy/out/oasis-api.tar.gz root@162.211.181.253:/root/
```

然后在 **服务器 SSH 终端** 运行以下命令。现有 `.env.api` 和数据库卷不会被覆盖：

```sh
cd /opt/oasis-api
tar -xzf /root/oasis-api.tar.gz -C /opt/oasis-api
grep -q '^SERVER_IP=' .env.api || printf '\nSERVER_IP=162.211.181.253\n' >> .env.api
apt-get update
apt-get install -y snapd
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/local/bin/certbot
certbot --version
```

确认 Certbot 至少为 **5.4**。若已安装 Certbot，先核对 `certbot --version` 指向的是 Snap 新版本。申请证书时按提示输入你自己的邮箱并同意协议；邮箱和密码都不用发到聊天：

```sh
certbot certonly --standalone --preferred-profile shortlived --ip-address 162.211.181.253
```

证书成功后启动公网 HTTPS 配置。两个 Compose 文件使用同一个项目名，MySQL 数据卷保持不变：

```sh
cd /opt/oasis-api
docker compose --env-file .env.api -f docker-compose.api-ip.yml up -d --build
docker compose --env-file .env.api -f docker-compose.api-ip.yml ps
curl -f https://162.211.181.253/health
```

`curl` 应返回 `status: ok`。手机浏览器也要能直接打开 `https://162.211.181.253/health`，而且不能出现证书警告。**不要加 `-k` 跳过证书校验。**

安装续期钩子，并验证 Certbot 的自动续期定时器：

```sh
install -m 755 deploy/oasis-api-cert-renew-hook.sh /etc/letsencrypt/renewal-hooks/deploy/oasis-api-reload.sh
systemctl list-timers --all | grep -i certbot
certbot renew --dry-run --run-deploy-hooks
```

续期成功后钩子会让 Caddy 重新读取证书。若看不到 Certbot 定时器或演练失败，先排查再分享 APK。之后按 [Android 安装指南](../oasis-uniapp/INSTALL_GUIDE.md)把 `https://162.211.181.253` 写入 `.env.production` 并打包。以后若服务器 IP 变化，须重新申请证书、更新 App 接口地址并重打 APK。

如果日后改用域名，可回到 `docker-compose.api.yml` 配合 Caddy 自动 HTTPS；当前无域名路线只需 IP。

## 更新与数据

使用 IP 证书时，更新代码后运行 `docker compose --env-file .env.api -f docker-compose.api-ip.yml up -d --build`。数据库使用持久卷，证书位于服务器 `/etc/letsencrypt`。不要执行 `down -v`，它会删除数据库卷。更新前备份数据库和 `.env.api`；JWT 密钥保持稳定，否则现有令牌会失效。
