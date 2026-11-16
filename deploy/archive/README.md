# 已不用的部署文件

这些文件从仓库根目录移来，避免和现网配置混在一起。现网说明见 `deploy/README.md`。

- `docker-compose.nginx.yml`、`deploy-nginx.sh`、`nginx/`：早期域名加 Nginx 加 Certbot 的方案。
- `docker-compose.mobile.yml`、`Caddyfile.site`：另一套自己起数据库和 Caddy 的整站方案。当时文件放在仓库根目录，相对路径也按那个位置写。不要在 `https://162.211.181.253` 这台机器上改用它们。
