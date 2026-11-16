# 猫来运转手机网页版：本地验证与服务器发布

> 公网 `https://162.211.181.253` 现在不用这份指南里的 Compose。现行做法见 [deploy/README.md](README.md) 和 [IP 手机网页版部署指南](MOBILE_IP_GUIDE.md)。下面保留的是旧的域名整站步骤，对应文件已放到 `deploy/archive/docker-compose.mobile.yml`，不要在当前服务器上直接执行。

本轮交付使用 `oasis-uniapp` 的 H5 网页和 `python_backend`。安卓与 iPhone 共用一个网址。暂不发布微信小程序，也不需要安装 APK 或上架 App Store。

## 当前功能与边界

- 匿名账号自动建立；在“我的”保存恢复码，换设备后可恢复同一账号。恢复码相当于密码，不要给朋友；朋友打开网址会拥有自己的账号。
- 填写姓名、公历出生日期、北京时间、性别和地点，生成四柱、五行、八步大运、AI 解读及生活建议。地点目前是记录信息，不用于真太阳时修正。
- 报告异步生成，可在列表继续查看；失败可主动重新分析。服务重启等导致的中断，超过 15 分钟后查询时标为失败，可以重试。
- 在已完成报告中点击“用于首页每日查询”，即可指定首页的查询对象。
- 报告列表和详情页支持删除已完成或失败的报告，确认后移除报告内容及对应的今日提示；生成中的报告暂不可删除，删除不返还当天分析次数。
- 每个账号每天最多接受 5 次分析，按北京时间计算，失败及重试也计入次数。首页每日内容会缓存；切换不同报告可能重新调用 AI。
- 正式环境默认禁止模拟 AI。未配置 AI 服务不会假装生成真实报告。传统文化解读仅供参考，不作为医疗、投资等决策依据。

## 晚上部署前要准备什么

需要一台能运行 Docker Engine 与 Compose 插件的 Linux 服务器、登录方式，以及 AI 服务 API Key。正式分享网址建议同时准备指向服务器的域名，用 HTTPS 保护账号恢复码和出生信息。API Key 只填写在服务器配置文件，不要发到聊天里。

## 部署步骤（服务器项目根目录）

1. 将项目上传到服务器，保留 `data_center/knowledge`、`deploy`、`python_backend`、`oasis-uniapp`。旧的整站文件在 `deploy/archive/docker-compose.mobile.yml`。
2. 复制配置模板：

```sh
cp deploy/.env.mobile.example .env.mobile
chmod 600 .env.mobile
```

3. 编辑 `.env.mobile`。分别生成三个不同的随机值填写 `MYSQL_ROOT_PASSWORD`、`MYSQL_PASSWORD`、`JWT_SECRET_KEY`；可以每次运行 `openssl rand -hex 32` 生成。数据库密码使用这种十六进制字符，避免连接字符串转义问题。填写 `DEEPSEEK_API_KEY`，保持 `ALLOW_MOCK_AI=false`。如使用 Anthropic，设置 `AI_PROVIDER=anthropic` 并添加 `ANTHROPIC_API_KEY` 和所需模型配置。
4. 将 `SITE_ADDRESS` 改为实际域名，例如 `xiaoyi.example.com`（不要照抄示例域名）。域名解析指向服务器，开放入站 TCP 80、443。数据库端口不需要开放。
5. 启动：

```sh
# 历史命令。文件已不在仓库根目录，且路径按旧位置书写，当前服务器请改用 deploy/README.md。
docker compose --env-file .env.mobile -f deploy/archive/docker-compose.mobile.yml up -d --build
docker compose --env-file .env.mobile -f deploy/archive/docker-compose.mobile.yml ps
docker compose --env-file .env.mobile -f deploy/archive/docker-compose.mobile.yml logs --tail 100 backend web
```

首次构建需要下载镜像和依赖。启动时自动执行数据库迁移；Caddy 负责网页、API 转发和域名 HTTPS 证书。确认 db、backend 健康且 web 运行后，用手机访问 `https://实际域名`。

6. 安卓浏览器、iPhone Safari 分别完成一次真实填写、生成报告、返回列表、查看每日内容、刷新和恢复账号。真实 AI 需要联网配置后才能验收。本地测试替身不能代替这一步。

## 本机演示

使用同一套 Compose，在单独的 `.env.mobile` 中设置：

```dotenv
SITE_ADDRESS=:80
HTTP_PORT=18080
HTTPS_PORT=18443
ALLOW_MOCK_AI=true
```

仍需设置上面的三个随机值；不要填真实 AI Key，以免演示产生调用费用。用电脑浏览器打开 `http://localhost:18080`。这是功能演示，AI 文本是模拟内容。局域网 HTTP 地址不作为正式手机使用方案；正式使用请配置 HTTPS。

## 更新与备份

更新代码后重复 `up -d --build`。数据库使用持久卷；普通容器重建会保留数据。不要运行 `down -v`，它会删除数据库和证书卷。数据库初始化完成后，直接修改环境变量中的密码不会修改数据库内已有密码。

更新前在 Linux 服务器上备份（输出到服务器文件，不在聊天中打印）：

```sh
mkdir -p backups
chmod 700 backups
docker compose --env-file .env.mobile -f deploy/archive/docker-compose.mobile.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --no-tablespaces oasis_db' > "backups/oasis-$(date +%Y%m%d-%H%M%S).sql"
chmod 600 backups/*.sql
```

另行妥善保存 `.env.mobile`。JWT 密钥保持稳定；重置它会使现有登录令牌失效。暂时没有短信登录，用户需自行保存恢复码。

## 开发检查

```powershell
cd python_backend
.\.venv\Scripts\python.exe -m pytest -q
cd ../oasis-uniapp
npm ci
npm run typecheck
npm test
npm run build:h5
```

后端测试强制使用临时 SQLite 数据库，不会清理开发或生产数据库。发布演练另外使用隔离的 MySQL 8 容器，验证迁移和真实数据库行为。

## 验证记录（更新于 2026-09-23）

- 本机后端完整测试与部署镜像内完整测试：各 207 项通过。新增校验拒绝未来或早于 1900 年的公历出生日期，验证无效提交不创建报告、不占用分析名额；恢复码重新登录后可打开原报告。
- 前端类型检查、5 项请求/账号回归测试、Docker 内 H5 构建通过。
- 空 MySQL 8 数据库迁移到最新版本、知识库加载、网页与 API 同域访问通过。
- MySQL 并发验证：6 次提交恰好接受 5 次、拒绝 1 次；5 份报告均完成；4 次同时每日查询仅生成一次；账号恢复及跨用户报告访问隔离通过。
- 浏览器 390px、360px 手机视口验证填写表单、报告轮询与列表、流年展开、每日查询对象和个人页；检查页面无横向溢出。此项为 Chromium 手机视口模拟，尚未在真实 Android / iPhone Safari 上验收。
- 已用虚构出生信息和隔离数据库完成一次官方 DeepSeek 真正调用：报告、引用字段和今日提示成功，第二次今日查询命中缓存。详见 [真实 AI 联调记录](../docs/archive/live-ai-acceptance.md)。这只是一份样例，不能代表模型长期稳定性或解读质量。
- 公网 HTTPS、真实 Android / iPhone Safari 访问及服务器数据恢复仍待服务器就绪后验证。构建/测试仍有上游依赖弃用提示，但不影响本轮检查通过。

## 上线前仍需测试

1. **真机完整流程（最高优先级）**：安卓 Chrome 和 iPhone Safari 分别从新账号完成填写、报告生成、返回列表、今日查询、刷新页面和用恢复码换设备登录；验证页面无横向溢出、内容可读、中文输入和日期时间选择可用。弱网或中途切后台时，也应能回到报告列表继续查看，不能重复占用次数或误创建报告。
2. **服务器与恢复能力（最高优先级）**：正式域名 HTTPS、HTTP 自动跳转、API 同域访问、重启后报告仍在；先在隔离数据库实际执行一次备份和还原，核对用户、报告与今日缓存数量，再依赖备份进行后续更新。
3. **真实 AI 稳定性与内容（上线前）**：至少用不同性别、节气前后、23:00 附近和闰日的虚构样例抽查排盘与解读；每份核对四柱、五行、引用资料是否一致，并检查医疗、投资等建议是否越界。测试超时、限流或 API 余额不足时，报告应显示失败并可按限额重试，不应展示模拟内容。
4. **持续使用（上线前）**：在北京时间跨午夜时检查 5 次额度与今日缓存换日；多人同时提交与查询时，确认计数准确、缓存不会重复调用；服务更新、容器重启和手机浏览器清理缓存后，确认恢复码与历史报告仍可用。
