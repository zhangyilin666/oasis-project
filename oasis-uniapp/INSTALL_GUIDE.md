# 小易 — 手机安装指南

## 一、Android 手机安装（推荐，免费）

### 步骤 1：下载 HBuilderX

下载地址：https://www.dcloud.io/hbuilderx.html

选 **APP 开发版**（约 300MB），下载后解压即可使用，无需安装。

### 步骤 2：打开项目

1. 启动 HBuilderX
2. 文件 → 导入 → 从本地目录导入
3. 选择 `d:\Oasis_Project\oasis-uniapp` 文件夹

### 步骤 3：云打包生成 APK

1. 在 HBuilderX 左侧项目树中右键点击项目根目录
2. 选择 **发行 → 原生App-云打包**
3. 弹出配置窗口：
   - **Android 包名**：`com.zhangyilin.xiaoyi`（已配置）
   - **证书**：选择「使用自有证书」
     - 证书文件：`oasis-release.keystore`（项目根目录下）
     - 别名：`oasis`
     - 密码：`oasis123`
   - 勾选「打自定义基座」或「正式包」
4. 点击 **打包**，等待云端编译（约 2-5 分钟）
5. 编译完成后，扫描二维码或下载 APK 文件

### 步骤 4：安装到手机

1. 将 APK 文件传到手机（微信/QQ 发送、USB 传输均可）
2. 在手机上打开 APK 文件
3. 允许「未知来源」安装（系统会引导你）
4. 安装完成，打开「小易」

---

## 二、iOS 手机安装（需要证书）

iOS 不通过 App Store 安装有以下方案：

### 方案 A：TestFlight（推荐，需 Apple Developer）

1. 注册 Apple Developer：https://developer.apple.com（$99/年）
2. 在 HBuilderX 中配置 iOS 证书和描述文件
3. 云打包 → 上传 TestFlight
4. 通过 TestFlight App 安装

### 方案 B：爱思助手 / 3uTools（免费，7 天签名）

1. 电脑安装爱思助手：https://www.i4.cn
2. 手机连接电脑 → 爱思助手 → 工具箱 → IPA 签名
3. 使用免费 Apple ID 签名（有效期 7 天）
4. 签名后自动安装到手机
5. 每 7 天需要重新签名一次

### 方案 C：AltStore（免费，需电脑在局域网内）

1. 电脑安装 AltServer：https://altstore.io
2. 手机安装 AltStore
3. 在 AltStore 中安装 IPA（7 天自动续签）

> **推荐**：先用 Android 体验，确认功能没问题后再搞 iOS 分发。

---

## 三、后端部署

APP 安装到手机后，需要后端提供 API。两种方式：

### 本地开发测试

```bash
cd d:\Oasis_Project\python_backend
.\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

手机和电脑在同一局域网时，`manifest.json` 中的 API 地址改为电脑的局域网 IP。

### 部署到云服务器（推荐）

参考 `deploy/` 目录下的部署文档，将后端部署到有公网 IP 的服务器。

---

## 四、配置 API 地址

在 `src/config/env.ts` 中修改 `API_BASE_URL`：

```ts
// 本地开发（手机连同一 WiFi）
export const API_BASE_URL = 'http://192.168.x.x:8000'

// 生产环境（公网服务器）
export const API_BASE_URL = 'https://api.your-domain.com'
```

修改后重新执行云打包生成新的 APK。

---

## 快速测试清单

```
□ 后端运行中（161 tests ✓）
□ HBuilderX 导入项目成功
□ 云打包生成 APK 成功
□ 手机上安装 APK 成功
□ 打开 App → 输手机号 → 获取验证码（DEBUG 模式用 123456）
□ 八字分析 → 报告查看 → 报告列表 → 个人中心 → 退出登录
```
