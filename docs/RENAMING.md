# DSH Sessivra 改名与迁移

## dev.20 的 npm 安装名

当前包名为 `dsh-plugin-sessivra@0.3.0-dev.20`，产品名和仓库仍为 DSH Sessivra / `leoan698-tom/dsh-sessivra`。在 DSH「添加插件」中选择 npm 官方源，只输入 `dsh-plugin-sessivra` 即为本版的安装入口。

已有 dev.19 时，在目标 DSH 正常退出并备份后，先移除 `@leoan698-tom/dsh-sessivra`，再安装 dev.20。原信使包和 Agent Hub 包按下文对应命令移除。新包继续使用原 bundle 条目 ID、三个持久存储域、工具和 wire ID，不同时启用旧包与新包。

```sh
dsh plugin --profile desktop remove @leoan698-tom/dsh-sessivra
dsh plugin --profile desktop add dsh-plugin-sessivra
```

没有安装旧包的用户只需添加新包。上面完整命令用于终端；界面输入框只填写新包名。

本地构建执行 `npm ci --ignore-scripts`、`npm run check`、`npm pack`，生成 `dsh-plugin-sessivra-0.3.0-dev.20.tgz`。离线安装可通过 CLI 使用其绝对 `file:` 地址。卸载 dev.20 使用 `dsh plugin --profile desktop remove dsh-plugin-sessivra`。回退时移除新包，再安装保存的 dev.19；卸载不删除消息与会话关系。[dev.20 检查记录](validation/npm-dev20.md)分别记录本地包迁移与公开安装结果。

## dev.19 的已发布改名记录

dev.19 的历史预发布包为 `@leoan698-tom/dsh-sessivra@0.3.0-dev.19`，显示名称为 **DSH Sessivra / DSH Sessivra 协作空间**，继承既有会话引用、通信和会话树功能。GitHub 标签与 Release 为 [v0.3.0-dev.19](https://github.com/leoan698-tom/dsh-sessivra/releases/tag/v0.3.0-dev.19)，该 scoped 包未发布 npm；dev.20 通过上文的新包名分发。历史 dev.19 可安装 Release 压缩包。

| 对象 | 改名后 |
| --- | --- |
| GitHub 仓库 | `leoan698-tom/dsh-sessivra` |
| 分发包、Host 插件和客户端模块 | `@leoan698-tom/dsh-sessivra` |
| bundle 条目 ID | `leoan698-tom.dsh-sessivra` |
| 消息来源和 wire ID 前缀 | 保留 `plugin:dsh-session-messenger` / `dsh-session-messenger#` |
| 持久数据 | 保留 `dsh_session_messenger`、`dsh_session_messenger_recipients`、`dsh_session_messenger_conversations` |
| 工具、旧草稿引用和历史发布包 | 保留原有名称与兼容读法 |

改名前未发现 Sessivra 同名公开项目，检查范围见 [命名记录](adr/0012-sessivra-project-identity.md)。历史 dev.19 使用完整 scoped 包名，以本仓库的 GitHub Release 或固定版本 Git 标签为准。已有本地检出目录可以继续叫 `dsh-session-messenger`，目录名不决定插件身份。

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
