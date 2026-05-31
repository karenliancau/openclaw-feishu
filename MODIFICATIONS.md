# 定制改动说明（基于 openclaw-feishu 0.1.4）

本仓库基于官方 [`openclaw-feishu`](https://github.com/hgkdzbf6/openclaw-feishu) **0.1.4** 定制。
与早期「直接改编译产物」的做法不同，本仓库是**完整 TypeScript 源码**，可 `npm run build` 重新构建，
方便维护与跟上游合并。

## 基线说明

- 官方源码仓库 main 分支当前为 **0.1.3**，但 npm 发布的是 **0.1.4**。
- 0.1.3 → 0.1.4 的唯一改动是一次重构：新增 `FEISHU_CHANNEL_ID = "openclaw-feishu"` 常量，
  把各处硬编码的通道 id `"feishu"` 全部替换为它（**通道 id 从 `feishu` 改为 `openclaw-feishu`**）。
- 本仓库以 0.1.3 源码为底，**先复刻了 0.1.4 的 id 重构**，再叠加下述定制功能。
- 构建产物已与「线上运行的 0.1.4 + 定制」逐文件比对验证：13 个文件中 11 个字节级一致，
  其余 2 个（`group-filter`、`receive`）仅格式/注释不同，逻辑等价。

## 定制改动（相对官方 0.1.4）

涉及两个源文件：`src/group-filter.ts`、`src/receive.ts`。

### 1. `src/group-filter.ts` — 群聊回复策略

- **官方**：根据问号、英文疑问词、中文求助动词、机器人名字称呼等启发式判断是否回复。
- **定制**：`shouldRespondInGroup` 简化为「**仅当存在 @mention 时**」。
  真正「是否 @ 到机器人本人」的判断移到 `receive.ts` 里用 bot 自己的 `open_id` 精确比对。

### 2. `src/receive.ts` — 接收与消息处理

1. **解析机器人自身 open_id**：`startFeishuProvider` 改为 `async`，启动时调用飞书
   `auth/v3/tenant_access_token/internal` + `bot/v3/info/`，拿到机器人自己的 `open_id`（`botOpenId`）。

2. **修复「channel exited」**：在收到 `abortSignal` 之前一直 `await` 挂起，保持长连接存活，
   网关停止时再 `stop()`。

3. **群聊精确 @ 判断**：比对 mention 的 `open_id` 是否等于 `botOpenId`，命中才回复，否则忽略。
   并打印 `Group filter: ...` 调试日志。

4. **支持更多消息类型**（官方仅 `text`）：现支持 `text` / `file` / `post`（富文本）/ `image`。

5. **新增 `downloadAndExtractFeishuFile()`**：通过
   `im/v1/messages/{id}/resources/{file_key}` 下载文件并按扩展名提取——
   文本/代码类直接读（超 5 万字符截断），`.pdf` 用 `pdf-parse` 转文字，其它类型仅保存并返回路径。

6. **新增 `extractTextFromPost()`**：从飞书富文本 post 结构（title + content 段落）提取纯文字。

7. **调试日志**：打印每条进入消息的类型/id/内容片段。

## 重新生成方式

如需基于上游新版本重做：拉取上游源码，复刻 `FEISHU_CHANNEL_ID` 重构（若上游已自带则跳过），
再把上面第 1、2 节的改动应用到 `group-filter.ts` 与 `receive.ts`，最后 `npm run build`。
