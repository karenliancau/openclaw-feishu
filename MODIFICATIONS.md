# 本地修改说明（基于 openclaw-feishu 0.1.4）

本仓库是 [`openclaw-feishu`](https://github.com/hgkdzbf6/openclaw-feishu) 插件 **0.1.4** 版本的本地定制版。
代码为已编译的 `dist/` 产物，并在其基础上直接修改（无 TypeScript 源码）。

相对官方 0.1.4 的全部改动见 [`modifications-vs-0.1.4.patch`](./modifications-vs-0.1.4.patch)。
共改动两个文件：`dist/src/group-filter.js`、`dist/src/receive.js`。

## 1. `dist/src/group-filter.js` — 群聊回复策略

- **原版**：根据问号、英文疑问词、中文请求动词（帮/请/麻烦…）、机器人名字称呼等启发式判断是否在群里回复。
- **改后**：`shouldRespondInGroup` 简化为「仅当消息里有 @mention 时才回复」（`return mentions.length > 0`）。

## 2. `dist/src/receive.js` — 接收与消息处理

1. **解析机器人自身 open_id**
   `startFeishuProvider` 改为 `async`，启动时调用飞书
   `auth/v3/tenant_access_token/internal` + `bot/v3/info/` 接口拿到机器人自己的
   `open_id`，存入 `botOpenId`，供群聊 @ 判断使用。

2. **修复「channel exited」启动即退出**
   原函数同步返回，框架会判定 channel 已退出。改为在收到 `abortSignal`
   之前一直 `await` 挂起，保持长连接存活，abort 时再 `stop()`。

3. **群聊精确 @ 判断**
   不再依赖文本启发式，改为比对 mention 的 `open_id` 是否等于机器人自己的
   `botOpenId`，命中才回复，否则忽略。

4. **支持更多消息类型**（原版仅 `text`）
   现支持 `text` / `file` / `post`（富文本）/ `image`：
   - `file`：调用新增的 `downloadAndExtractFeishuFile()` 下载并提取文本。
   - `post`：调用新增的 `extractTextFromPost()` 提取纯文字。
   - `image`：以占位文本 `[用户发送了一张图片 (image_key=...)]` 传入。

5. **新增 `downloadAndExtractFeishuFile()`**
   通过 `im/v1/messages/{id}/resources/{file_key}` 下载文件到临时目录，按扩展名提取：
   - 文本/代码类（txt/md/csv/json/py/js/…）直接读取，超过 5万字符截断。
   - `.pdf` 用 `pdf-parse` 提取文字（扫描件无文字时给出提示）。
   - 其他类型仅保存并返回路径说明。

6. **新增 `extractTextFromPost()`**
   解析飞书富文本 post 结构（title + content 段落），提取 text/a/at 节点为纯文字。

7. **调试日志**：对每条进入的消息打印类型/id/内容片段，以及群聊 @ 判断的详细信息。

## 与官方版本同步

如需基于官方新版本重做这些改动，对照 `modifications-vs-0.1.4.patch` 重新应用即可。
