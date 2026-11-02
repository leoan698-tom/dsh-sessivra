# DSH Sessivra 改名与迁移

当前预发布版本为 `@leoan698-tom/dsh-sessivra@0.3.0-dev.19`，显示名称为 **DSH Sessivra / DSH Sessivra 协作空间**，继承既有会话引用、通信和会话树功能。GitHub 标签与 Release 为 [v0.3.0-dev.19](https://github.com/leoan698-tom/dsh-sessivra/releases/tag/v0.3.0-dev.19)，尚未发布 npm。可安装 Release 压缩包或本地构建产物。

| 对象 | 改名后 |
| --- | --- |
| GitHub 仓库 | `leoan698-tom/dsh-sessivra` |
| 分发包、Host 插件和客户端模块 | `@leoan698-tom/dsh-sessivra` |
| bundle 条目 ID | `leoan698-tom.dsh-sessivra` |
| 消息来源和 wire ID 前缀 | 保留 `plugin:dsh-session-messenger` / `dsh-session-messenger#` |
| 持久数据 | 保留 `dsh_session_messenger`、`dsh_session_messenger_recipients`、`dsh_session_messenger_conversations` |
| 工具、旧草稿引用和历史发布包 | 保留原有名称与兼容读法 |

改名前未发现 Sessivra 同名公开项目，检查范围见 [命名记录](adr/0012-sessivra-project-identity.md)。使用完整 scoped 包名；npm 发布之前，以本仓库的 GitHub Release 或固定版本 Git 标签为准。已有本地检出目录可以继续叫 `dsh-session-messenger`，目录名不决定插件身份。

## 本地构建

在项目目录执行：

```sh
npm ci --ignore-scripts
npm run check
npm pack
```

预期产物为 `leoan698-tom-dsh-sessivra-0.3.0-dev.19.tgz`。兼容范围仍为 DSH `0.2.1-rc.5` / Node.js 24+。

## 从旧版迁移

1. 正常退出目标 DSH，备份目标 profile 配置、以上三个存储域，并保留旧安装包。
2. 使用与目标宿主相同版本的 CLI 和同一个 DSH_HOME/profile，按实际安装的包名移除本项目旧包。以下两个移除命令选择对应的一条执行；旧包与新包使用同一组服务和数据，不同时启用。
3. 安装新包后重启，检查插件显示名称、旧会话关系、原生 `@` 引用和既有消息记录。

原信使包（dev.17 及以前）：

```sh
dsh plugin --profile desktop remove dsh-session-messenger
```

Agent Hub 候选（dev.18）：

```sh
dsh plugin --profile desktop remove @leoan698-tom/dsh-agent-hub
```

然后安装 Sessivra：

```sh
dsh plugin --profile desktop add "https://github.com/leoan698-tom/dsh-sessivra/releases/download/v0.3.0-dev.19/leoan698-tom-dsh-sessivra-0.3.0-dev.19.tgz"
```

已有本地压缩包时，来源可替换为 `file:/绝对路径/leoan698-tom-dsh-sessivra-0.3.0-dev.19.tgz`。

把示例路径替换为实际绝对路径。原本未装旧包的环境只需执行安装；Web 用户将 `desktop` 换成 `web`。确认旧包来自本项目，避免误卸载同名的其他作者插件。

改名本身没有数据 schema 变更，不清空消息、许可或父子关系。隔离包验证见 [dev.19 验证报告](validation/sessivra-rename-dev19.md)，日常桌面 profile 的升级验收需分别记录。

## 卸载与回退

正常退出宿主后移除新包：

```sh
dsh plugin --profile desktop remove @leoan698-tom/dsh-sessivra
```

需要回退时，再安装保存的 dev.17 或 dev.18 旧包；它们与本版本使用同一数据 schema。其他旧版本的兼容限制见 [安装、升级与卸载](OPERATIONS.md)。卸载包不删除上述存储域，也不撤回已经写入会话历史的内容。

历史标签、压缩包文件名和验证报告保留当时的名称。仓库 URL 改名后，历史链接依赖 GitHub 重定向；不重发或改写旧版本产物。
