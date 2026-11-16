# 手机网页版服务器验收：2026-09-30

访问地址：**https://162.211.181.253/**。安卓浏览器和 iPhone Safari 共用 H5 页面。

服务器目录为 `/opt/oasis-api`，Compose 项目仍为 `xiaoyi-api`。当前运行命令：

```sh
docker compose --env-file .env.api -f docker-compose.api-ip.yml -f docker-compose.api-mobile.yml up -d --build
```

数据库沿用 `xiaoyi-api_api_mysql`，JWT 和数据库密码保持原值。发布前已有数据库
及源码备份位于服务器 `/root/oasis-backups/mobile-20260930/`，其中备份包含私密配置，
不可作为公开下载文件。后端旧镜像保留为 `oasis-backend:before-mobile-20260930`。

## 本次实际通过的检查

- 从本机通过 WLAN 直连服务器，使用受信任证书验证的公网 HTTPS 获取首页、4 个首页资源和 `/health`；未跳过证书检查。
- MySQL 与后端容器健康，HTTPS 443 对外提供网页和 API；数据库没有公网端口。
- 使用一组明确标为虚构的出生资料创建测试报告（报告 ID 1），真实 DeepSeek 的 3 个 AI 步骤成功，合计 11565 tokens；报告状态完成，排盘字段结构化校验通过，历史列表可查。
- 每日查询成功，再次查询命中缓存；恢复码恢复账号后可读取原报告。
- 未登录访问报告列表返回 401。
- Certbot 5.8.0 签发公网 IP 证书，当前证书到期日为 2026-10-06；`snap.certbot.renew.timer` 已运行。
- `certbot renew --dry-run --run-deploy-hooks` 成功，续期后 Caddy 重载钩子已安装。Caddy 配置包含 `default_sni`，可处理浏览器通过 IP 访问时不发送 SNI 的 TLS 握手。

AI Key 已通过 SSH 从本项目本机私密配置传入服务器 `.env.api`，配置权限为 600，
`ALLOW_MOCK_AI=false`；密钥未放进网页或部署包。完整部署包位于本机
`deploy/out/oasis-mobile.tar.gz`，同目录有 SHA256 校验文件。

本机 Mihomo TUN 路径曾导致到该 IP 的 SSH/HTTPS 连接中断。本次验收针对该服务器
使用指定 WLAN 接口的临时连接，未修改全局代理设置。若手机使用代理后无法访问，
可先关闭手机代理后用普通 Wi-Fi 或移动网络打开上述 HTTPS 地址。

## 尚需用户真机验证

本次公网验收通过 HTTP 客户端完成，之前的页面交互验证使用 Chromium 手机视口。
真实安卓浏览器及 iPhone Safari 的中文输入、日期选择、报告显示、切后台后恢复，
仍需在用户手机实际试用。此记录不代表全部模型输出质量已验收。

IP 模式目前仅提供公网 HTTPS 443。证书验证时 Certbot 临时监听 80；不常驻 HTTP
网页或 HTTP 跳转，以免与 standalone 自动续期占用同一端口。请使用完整 HTTPS 链接。

## 同日更新：删除报告

- 报告列表与已完成/失败的详情页支持确认后删除；生成中的报告不可删除。删除清空个人内容与每日缓存，并保留不含报告内容的用量记录及提交次数。
- 本机后端完整测试 214 项通过，最终每日缓存锁调整后的相关测试 23 项通过；前端类型检查、9 项账号/请求/删除测试和正式 H5 构建通过。上游依赖弃用提示仍存在。
- 发布前数据库与源码备份：服务器 `/root/oasis-backups/delete-20260930-081143/`。生产 MySQL 迁移到 `c8d4e2f091ab`，容器健康，公网 HTTPS 验证未跳过证书检查。
- 使用新建的专用虚构账号验证：未登录删除返回 401，删除其他账号报告返回 404；自己的报告删除成功，详情返回 404，列表从 5 条变为 4 条；MySQL 中内容清空、每日缓存清除、用量日志解除报告关联，删除后仍受当天 5 次额度限制。报告 ID 1 保持未删除。
- 浏览器 390px 报告列表、360px 报告详情验证删除确认及取消操作；页面没有横向溢出。仅测试专用虚构数据，未删除用户报告；该验收没有调用 AI。真实 Android / iPhone Safari 仍需用户实际试用。
