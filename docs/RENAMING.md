# DSH Agent Hub 改名与迁移

本地候选为 `@leoan698-tom/dsh-agent-hub@0.3.0-dev.18`，显示名称为 **DSH Agent Hub / DSH 智能体协作中心**。它继承 dev.17 的功能，新增 CLI 接入和人工任务面板属于后续规划。此候选尚未发布 Git 标签、Release 或 npm；使用下面的本地压缩包方式试用。

| 对象 | 改名后 |
| --- | --- |
| GitHub 仓库 | `leoan698-tom/dsh-agent-hub` |
| 分发包、Host 插件和客户端模块 | `@leoan698-tom/dsh-agent-hub` |
| bundle 条目 ID | `leoan698-tom.dsh-agent-hub` |
| 消息来源和 wire ID 前缀 | 保留 `plugin:dsh-session-messenger` / `dsh-session-messenger#` |
| 持久数据 | 保留 `dsh_session_messenger`、`dsh_session_messenger_recipients`、`dsh_session_messenger_conversations` |
| 工具、旧草稿引用和历史发布包 | 保留原有名称与兼容读法 |

`dsh-agent-hub` 裸 npm 名称已属于其他项目。使用完整 scope；npm 发布之前，以本仓库生成的压缩包为准。已有本地检出目录可以继续叫 `dsh-session-messenger`，目录名不决定插件身份。

## 构建候选

在项目目录执行：

```sh
npm ci --ignore-scripts
npm run check
npm pack
```

预期产物为 `leoan698-tom-dsh-agent-hub-0.3.0-dev.18.tgz`。兼容范围仍为 DSH `0.2.1-rc.5` / Node.js 24+。

## 从旧版迁移

1. 正常退出目标 DSH，备份目标 profile 配置、以上三个存储域，并保留旧安装包。
2. 使用与目标宿主相同版本的 CLI 和同一个 DSH_HOME/profile，移除本项目旧包。旧包与新包使用同一组服务和数据，不同时启用。
3. 安装本地候选后重启，检查插件显示名称、旧会话关系、原生 `@` 引用和既有消息记录。

```sh
dsh plugin --profile desktop remove dsh-session-messenger
dsh plugin --profile desktop add "file:/绝对路径/leoan698-tom-dsh-agent-hub-0.3.0-dev.18.tgz"
```

把示例路径替换为实际绝对路径。原本未装旧包的环境只需执行安装；Web 用户将 `desktop` 换成 `web`。确认旧包来自本项目，避免误卸载同名的其他作者插件。

改名本身没有数据 schema 变更，不清空消息、许可或父子关系。保留存储名称不等于已经完成真实用户 profile 的升级验收；隔离包验证与日常桌面安装应分别记录。

## 卸载与回退

正常退出宿主后移除新包：

```sh
dsh plugin --profile desktop remove @leoan698-tom/dsh-agent-hub
```

需要回退时，再安装保存的 dev.17 旧包；它与本候选使用同一数据 schema。其他旧版本的兼容限制见 [安装、升级与卸载](OPERATIONS.md)。卸载包不删除上述存储域，也不撤回已经写入会话历史的内容。

dev.17 及更早的标签、压缩包文件名和历史报告保留原名。仓库 URL 改名后，历史链接依赖 GitHub 重定向；不重发或改写旧版本产物。
