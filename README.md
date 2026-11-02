# DSH Agent Hub · 智能体协作中心

在 DSH 中组织 AI 会话、引用上下文并开展协作。项目原名 **DSH 跨会话信使 / dsh-session-messenger**，新包名为 **`@leoan698-tom/dsh-agent-hub`**。

当前功能：通过原生 `@会话` 引入其他会话的上下文，并按用户明确要求发送任务、提问或结论。会话列表按真实归属展示普通子会话、团队队员及团队外子智能体，支持点击打开和自动刷新。

后续方向：通过插件调用本机 CLI，将其会话展示在 DSH 中，并支持会话通信、上下文引用和供人使用的任务管理面板。计划覆盖用户提出的 Grok CLI、Antigravity CLI、Claude Code CLI 等工具；每个 CLI 的具体实现、版本和可接入能力需分别核对。这些能力尚未在当前版本实现，产品范围见 [ADR-0011](docs/adr/0011-agent-hub-product-scope-and-identity.md)。

本地改名候选：**0.3.0-dev.18**（未发布）。最近已发布版本仍为旧名 **0.3.0-dev.17**，兼容 **DSH 0.2.1-rc.5 / Node.js 24+**。主子会话树直接附加在原生列表中；依赖宿主内部父子通信接口，不能直接视为兼容其他 DSH 版本。

新名称已有其他作者使用，本项目始终以仓库所有者 `leoan698-tom` 和完整 scoped 包名区分。尚未发布 npm；裸包名 `dsh-agent-hub` 和 `dsh-session-messenger` 均不是本项目的安装入口。新包的构建、安装及旧版迁移见 [改名与迁移](docs/RENAMING.md)。

## 已发布旧版的命令安装

先正常退出使用目标 profile 的 DSH，再运行与宿主相同版本的 CLI。按 DSH 的 [bundle 安装规范](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)，本仓库提供 manifest、组合 patch、服务端及客户端编译产物，无需在安装机器上构建。

```sh
dsh --version
# 应为 0.2.1-rc.5
dsh plugin --profile desktop add "github:leoan698-tom/dsh-agent-hub#v0.3.0-dev.17"
```

Windows 桌面版如未配置 PATH，使用安装目录中的 CLI（将路径换成实际安装位置）：

```powershell
& 'D:\DeepSeekHarness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'github:leoan698-tom/dsh-agent-hub#v0.3.0-dev.17'
```

以下标签和压缩包仍安装旧包名的 dev.17；仓库改名不改变历史产物。Web 用户将 `desktop` 换成 `web`；其他自定义 profile 使用其名称。默认 DSH_HOME 为用户目录下的 `.dsh`；自定义 DSH_HOME 时，应指向目标宿主使用的目录。安装成功后重启 DSH。

也可直接安装 [Release](https://github.com/leoan698-tom/dsh-agent-hub/releases/tag/v0.3.0-dev.17) 中的压缩包：

```sh
dsh plugin --profile desktop add "https://github.com/leoan698-tom/dsh-agent-hub/releases/download/v0.3.0-dev.17/dsh-session-messenger-0.3.0-dev.17.tgz"
```

## 使用

- `@会话B 根据它的结论，整理下一步计划。`：引入 B 的有界历史上下文，B 不会被唤醒。
- `@会话B 把这个检查任务交给它，完成后回复我。`：AI 绑定准确对象，发送任务并接收关联回复。
- `@会话B @会话C 对比两边结论，把待修复事项发给 B。`：两份上下文都可用，发送对象明确为 B。
- 在原生工作区列表中直接展开主会话查看父子结构；团队成员标为「队员」，团队外子智能体标为「子智能体」。

AI 根据要求选择排队或直接插入；直接插入在下一执行步接收，不取消当前工具。仅引用或查询不授权发送。普通子会话是可独立打开、继续聊天的普通会话；团队和子智能体保留宿主的身份及生命周期。

## 范围与限制

- 仅同一 Host、同一 profile；不支持跨机器、跨进程通信。
- 宿主每条消息最多引用 3 个会话，上下文可能截断，不是完整共享历史。
- 一次性对象只读；可引用其他主会话的子智能体，但只能向自己直接拥有且可继续的子智能体派任务。
- 消息送达或领取不代表业务完成；Team 任务板不随消息自动完成。
- 不确定投递不会自动重发。历史中的引用元数据被宿主压缩移除后，需要重新 `@` 对象。
- 本版为预发布。隔离运行时、客户端和安装验证与真实模型业务验收分别记录，见 [测试报告](docs/TEST_REPORT.md)。

## 开发与文档

```sh
git clone https://github.com/leoan698-tom/dsh-agent-hub.git
cd dsh-agent-hub
npm ci --ignore-scripts
npm run check
npm pack
```

`dist/` 随 Git 提交，支持直接安装 Git 标签；源码变更后必须重建并同步提交。测试使用真实 rc.5 运行时和免费确定性模型适配器，不调用付费模型。原始桌面截图、会话日志、本机 profile 及旧验收缓存不进入仓库。

[已知问题及依赖风险](docs/KNOWN_ISSUES.md) · [安装、升级和卸载](docs/OPERATIONS.md) · [功能说明](docs/COLLABORATION_0_3_DEV15.md) · [架构](docs/ARCHITECTURE.md) · [变更记录](CHANGELOG.md) · [第三方声明](THIRD_PARTY_NOTICES.md)
