# 猫来运转：Android APK 安装指南

这份工程是 uni-app Vue 3 CLI 工程。有效的 App 配置位于 `src/manifest.json`；当前体验版 Android 包名为 `com.zhangyilin.oasis.demo`，正式版计划使用 `com.zhangyilin.oasis`。`npm run build:app` 只编译 App 资源，不直接生成 APK。APK 由 Windows 上的 HBuilderX 打包，云服务器只运行 API 和数据库。

## 离线界面体验版

当前 `.env.production` 已在本机设为 `VITE_DEMO_MODE=true`。体验版不连接服务器：首页、黄历、示例报告、表单和“我的”页面都可浏览。示例报告与输入的信息无关，也不会上传或保存输入。若以后要生成真实报告，须把 `.env.production` 改回真实 HTTPS API 地址并关闭体验模式，重新打包。

本机先运行 `npm run build:app`，然后使用 HBuilderX 登录自己的 DCloud 账号，选择项目 `D:\Oasis_Project\oasis-uniapp`，执行 **发行 → 原生 App → 云打包**。本次体验包使用 DCloud 云端证书；该新 AppID 无法使用公共测试证书。包名为 `com.zhangyilin.oasis.demo`，与未来正式版区分。打包完成后把新 APK 文件通过文件传输发到 Android 手机，在手机上打开安装。**不要误用 `dist/release/apk/` 中 2026 年 6 月的旧包。**

## 先准备可用的 API

先按 [API 部署指南](../deploy/API_GUIDE.md)部署后端，确认手机可以通过可信的 HTTPS 地址访问 `/health`。正式 APK 中的接口地址不能是 `localhost`、局域网 IP、示例域名或无效的自签名 HTTPS 地址。

## 配置 App 接口地址

在 `oasis-uniapp` 目录复制 `.env.production.example` 为 `.env.production`，将 `VITE_API_BASE_URL` 改成实际 API 的 HTTPS **源地址**。这台服务器当前用 `https://162.211.181.253`，前提是先按 API 部署指南取得该 IP 的可信证书并完成公网 HTTPS 检查。不要在末尾添加 `/api`，也不要将 API Key 写进 App 环境变量。`.env.production` 已被 Git 忽略。

```powershell
Copy-Item .env.production.example .env.production
```

每次更改接口地址后都要重新打包并安装 APK，因为它会编入安装包。

## 检查并打包

1. 在 Windows 上安装 HBuilderX App 开发版并登录自己的 DCloud 账号；从本地目录导入 `D:\Oasis_Project\oasis-uniapp`。
2. 打开 `src/manifest.json`，确认应用名称、DCloud AppID、Android 包名和版本号。以后发布更新时递增 `versionCode`。
3. 在项目目录运行 `npm ci`、`npm run typecheck`、`npm test` 和 `npm run build:app`。最后一条只验证 App 资源能够编译。
4. 在 HBuilderX 中选择 **发行 → 原生 App → 云打包**，选择 Android 正式包，按界面提示完成打包。打包产物通常位于 `unpackage/release/apk/`。参见 [uni-app 官方云打包说明](https://uniapp.dcloud.net.cn/dev/app/cloud-build.html)。
5. 首次给朋友分发前使用自己新建的发布签名证书，并离线备份证书和口令。旧指南曾公开写出本地旧证书的口令，**不要把该旧证书用于正式分发**。后续更新必须使用与首次分发相同的包名和签名。

## 真机验收

将 APK 传到 Android 手机并允许安装来源。打开 App 后检查：匿名账号能建立、姓名和出生信息能提交、真实报告能生成并再次打开、首页每日内容能显示、恢复码能在另一台设备恢复账号。恢复码相当于密码，不要发给朋友；朋友安装后会建立自己的账号。

如果手机提示网络连接失败，先在手机浏览器访问 `https://实际API地址/health`，再核对 `.env.production` 中的地址并重新打包。不要用关闭证书校验或明文 HTTP 作为正式分享方案。
