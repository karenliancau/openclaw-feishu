# openclaw-feishu（定制版）

让 OpenClaw AI 助手接入**飞书 / Lark**，无需公网服务器（基于飞书 WebSocket 长连接，本地运行即可）。

> 本仓库是 [`openclaw-feishu`](https://github.com/hgkdzbf6/openclaw-feishu) 官方 0.1.4 的**定制版**，
> 在官方基础上改了**群聊回复策略**并增加了**文件 / 图片 / 富文本消息支持**。
> 完整改动见 [MODIFICATIONS.md](./MODIFICATIONS.md)。

---

## ✨ 这个定制版相比官方多了什么

| 能力 | 官方 0.1.4 | 本定制版 |
|------|-----------|---------|
| 群聊回复 | 被 @ / 问号 / 求助词等智能判断 | **只在「真正 @ 到机器人本人」时回复**（更安静，不误触发） |
| 文本消息 | ✅ | ✅ |
| 文件消息 | ❌ | ✅ 自动下载并提取内容（txt/md/代码/csv/json… 直接读，**PDF 自动转文字**） |
| 图片消息 | ❌ | ✅ 以占位文本传入（让 AI 知道用户发了图） |
| 富文本(post) | ❌ | ✅ 提取其中的纯文字 |
| 启动稳定性 | 偶发「channel exited」 | ✅ 修复：连接保活直到网关停止 |

---

## 🧩 准备工作

1. 已经安装并能正常使用 **OpenClaw**（`openclaw` 命令可用）。
2. **Node.js ≥ 20**。
3. 一个**飞书企业自建应用**（下面第 1 步教你建）。

---

## 🚀 快速开始

### 第 1 步：创建飞书应用与机器人

1. 打开 [飞书开放平台](https://open.feishu.cn/app) → 创建**企业自建应用**
2. 在应用里添加「**机器人**」能力
3. 在**权限管理**中开启：
   - `im:message`（收发消息）
   - `im:message.group_at_msg`（群聊 @ 消息）
   - `im:message.p2p_msg`（私聊消息）
   - `im:resource`（**读取文件/图片资源**，定制版的文件功能需要它）
4. **事件订阅** → 添加事件 `im.message.receive_v1` → 接收方式选择「**使用长连接接收事件**」
5. **版本管理与发布** → 创建版本 → 申请上线（应用必须是「已发布」状态，草稿态收不到消息）
6. 记下 **App ID**（形如 `cli_xxxxxxxx`）和 **App Secret**

### 第 2 步：安装本插件

因为这是定制版（没有发布到 npm），从本仓库安装：

```bash
git clone https://github.com/karenliancau/openclaw-feishu.git
cd openclaw-feishu
npm install -g .
```

> 仓库里已经带了编译好的 `dist/`，所以**不需要自己 build**，`npm install -g .` 会把插件连同运行依赖装到全局。
> 如果你改了 TypeScript 源码，再执行 `npm install && npm run build` 重新编译即可（见下方「从源码构建」）。

### 第 3 步：配置 OpenClaw

编辑 `~/.openclaw/openclaw.json`（Windows 是 `C:\Users\你的用户名\.openclaw\openclaw.json`），
加入下面两段（注意通道名是 **`openclaw-feishu`**）：

```json
{
  "channels": {
    "openclaw-feishu": {
      "enabled": true,
      "appId": "cli_你的AppID",
      "appSecret": "你的AppSecret"
    }
  },
  "plugins": {
    "entries": {
      "openclaw-feishu": { "enabled": true }
    }
  }
}
```

⚠️ **`appId` / `appSecret` 一定要写在 `channels.openclaw-feishu` 下面**，
不要写进 `plugins.entries`，否则会触发配置校验报错。

### 第 4 步：启动

```bash
openclaw gateway restart
```

然后在飞书里找到你的机器人：
- **私聊**：直接发消息即可。
- **群聊**：把机器人拉进群，然后 **@机器人** 提问（定制版群里只认 @）。

---

## 📁 文件 / 图片 / 富文本（定制版功能）

- 在私聊里**直接把文件拖给机器人**，它会自动下载并把内容读给 AI：
  - 文本/代码/CSV/JSON/Markdown 等：直接读取（超长会截断到 5 万字符）。
  - **PDF**：自动提取文字（扫描件无文字时会提示）。
  - 其他类型：保存到临时目录并告知路径。
- **图片**：会以 `[用户发送了一张图片 …]` 的占位文本传给 AI。
- **富文本消息**：自动提取其中的纯文字。

> 临时文件存放在系统临时目录下的 `openclaw-feishu-files/`。

---

## 🛠 从源码构建（改代码时才需要）

```bash
npm install        # 安装依赖（含 TypeScript）
npm run build      # tsc 编译，输出到 dist/
npm install -g .   # 重新全局安装
openclaw gateway restart
```

源码结构（`src/`）：

| 文件 | 作用 |
|------|------|
| `channel.ts` | 通道 + Dock 注册（核心） |
| `receive.ts` | **接收消息、文件/图片/富文本处理、分发给 AI**（定制重点） |
| `group-filter.ts` | 群聊是否回复的判断（定制：只认 @） |
| `send.ts` / `media.ts` | 发送文本与媒体 |
| `accounts.ts` | 多账号解析 |
| `onboarding.ts` | 配置向导 |
| `probe.ts` / `status-issues.ts` | 健康检查与诊断 |
| `types.ts` | 类型定义 + `FEISHU_CHANNEL_ID` 常量 |

---

## ❓ 常见问题

**机器人收不到消息？**
检查：① 应用已**发布上线**（不是草稿）；② 事件订阅选的是「**长连接**」而不是 webhook；③ 上面列的权限都开了。

**群聊里机器人不理我？**
本定制版群聊**只在 @ 到机器人本人时**才回复，请直接 @机器人。
（启动日志里会打印 `Bot open_id resolved: ...`，群消息进来时也会打印 `Group filter: ...` 方便排查。）

**文件发了没反应？**
确认开通了 `im:resource` 权限；日志里搜 `Received file` / `Downloaded file` 看下载是否成功。

**怎么看通道状态？**
```bash
openclaw channels status openclaw-feishu
```

**插件没被加载？**
确认 `plugins.entries.openclaw-feishu.enabled` 为 `true`，且 `npm install -g .` 成功（`npm ls -g openclaw-feishu` 能看到）。重启网关后看启动日志里是否有 `Starting Feishu provider`。

---

## 链接

- [飞书开放平台文档](https://open.feishu.cn/document/home/index)
- 官方上游：[hgkdzbf6/openclaw-feishu](https://github.com/hgkdzbf6/openclaw-feishu)

## 协议

MIT（沿用上游）
