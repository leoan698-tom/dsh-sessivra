# DSH Sessivra

**中文** · [English](README.en.md)

Sessivra 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的非官方会话协作插件。你可以把需求原文和检查结果并排看，让子会话交回文件，并在验收后放行下一项任务。

[开始使用](#开始使用) · [试跑一个小任务](#试跑一个小任务) · [60 秒实录](docs/DEMO_DEV25.md) · [发布记录](https://github.com/leoan698-tom/dsh-sessivra/releases)

## 开始使用

需要 **DSH 0.2.1-rc.5 或 0.2.2-rc.1、Node.js 24+**。跨会话协作限同一 Host/profile。

1. 打开 DSH「插件 → 添加插件」，选择 npm 官方源。
2. 在包名输入框填入 `dsh-plugin-sessivra`。若要指定当前公开版，从安装手册复制带版本的包名。
3. 按提示重载 DSH，在插件列表确认版本和启用状态。

终端、离线包、旧包迁移和回退步骤见手册。旧信使、Agent Hub 和旧 scoped 包用户请先按迁移说明处理。[安装手册](docs/OPERATIONS.md#安装) · [改名与迁移](docs/RENAMING.md)

## 试跑一个小任务

在空工作目录里创建 `需求.md`，写入一段练习需求：

> 居民登录后可以报名社区活动。每场活动有名额上限和截止时间，报名后可在活动开始前取消。重复报名、满员和取消后的名额规则待确认。

在 DSH 打开该目录，把下面的要求发给主会话：

```text
用 Sessivra 创建普通子会话检查需求.md，把原文依据、遗漏规则和可验证条件写入需求检查.md。
再给同一个子会话排队一项任务：根据检查结果生成验收清单.md。
请先读取实际的需求检查.md，由我确认后正式验收，再放行后续任务。
```

在侧栏打开「任务中心」查看交回的文件。读完检查结果并确认验收后，查看同一子会话的清单任务是否开始。可对照 dev.25 的真实模型实录，了解交办、交回文件和验收的全过程。[中文 60 秒视频](https://github.com/leoan698-tom/dsh-sessivra/releases/download/v0.3.0-dev.25/Sessivra-dev25-real-task-demo-zh-voice.mp4) · [演示记录](docs/DEMO_DEV25.md)

## 按场景使用

| 你要做什么 | 从哪里开始 |
| --- | --- |
| 同时对照两个会话 | 把侧栏会话拖到当前视图边缘。分屏各有自己的草稿，关闭主视图后可继续编辑接替视图的草稿。[分屏说明](docs/SESSION_VIEWS.md) |
| 在会话之间交接工作 | 在输入框用 `@` 选会话，再明确说要参考历史、发送消息还是派发任务。对方的关联回复会回到原请求。[通信说明](docs/OPERATIONS.md#使用与自查) |
| 从会话树找回分出去的工作 | 在工作区展开主会话，打开普通子会话或团队队员，继续查看各自的对话和产物。 |
| 集中处理子会话任务 | 在「任务中心」新建任务、答复共同问题、查看结果和验收。同一子会话的排队任务在前一项验收后放行。[任务协作说明](docs/MANAGED_TASKS.md) |
| 收藏一轮问答，后面再用 | 点回复下方的鱼形图标，或在输入框用 `@收藏` 引用。已发送的收藏标签支持预览并跳回原轮次。Windows 桌面验收环境为 DSH 0.2.2-rc.1。[发布说明](https://github.com/leoan698-tom/dsh-sessivra/releases/tag/v0.3.0-dev.28) |

## 导入 Claude Code / Codex 会话

当前工作区包含「导入会话」的开发说明，覆盖来源目录、记忆、原档与续聊范围。公开版能力以对应 Release 为准。[会话导入说明](docs/SESSION_IMPORT.md)

## 反馈与开发

反馈时请附 DSH 版本、插件版本、操作系统、复现步骤和实际结果。公开发帖前先隐去私密项目信息。[提交问题](https://github.com/leoan698-tom/dsh-sessivra/issues) · [已知问题](docs/KNOWN_ISSUES.md)

```sh
npm ci --ignore-scripts
npm run check
```

源码修改后需重建并同步 `dist/`。[架构](docs/ARCHITECTURE.md) · [测试记录](docs/TEST_REPORT.md) · [变更记录](CHANGELOG.md) · [第三方声明](THIRD_PARTY_NOTICES.md) · [MIT](LICENSE)
