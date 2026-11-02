# DSH 跨会话信使

通过原生 `@会话` 引入其他会话的上下文，并按用户明确要求发送任务、提问或结论。会话列表按真实归属展示普通子会话、团队队员及团队外子智能体，支持点击打开和自动刷新。

当前发布：**0.3.0-dev.16**（预发布），兼容 **DSH 0.2.1-rc.5 / Node.js 24+**。本版将 dev.15 功能整理为可从 GitHub 命令安装的分发包。依赖宿主内部父子通信接口，不能直接视为兼容其他 DSH 版本。

## 命令安装

先正常退出使用目标 profile 的 DSH，再运行与宿主相同版本的 CLI。按 DSH 的 [bundle 安装规范](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)，本仓库提供 manifest、组合 patch、服务端及客户端编译产物，无需在安装机器上构建。

```sh
dsh --version
# 应为 0.2.1-rc.5
dsh plugin --profile desktop add "github:leoan698-tom/dsh-session-messenger#v0.3.0-dev.16"
```

Windows 桌面版如未配置 PATH，使用安装目录中的 CLI（将路径换成实际安装位置）：

```powershell
& 'D:\DeepSeekHarness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'github:leoan698-tom/dsh-session-messenger#v0.3.0-dev.16'
```

Web 用户将 `desktop` 换成 `web`；其他自定义 profile 使用其名称。默认 DSH_HOME 为用户目录下的 `.dsh`；自定义 DSH_HOME 时，应指向目标宿主使用的目录。安装成功后重启 DSH。

也可直接安装 [Release](https://github.com/leoan698-tom/dsh-session-messenger/releases/tag/v0.3.0-dev.16) 中的压缩包：

```sh
dsh plugin --profile desktop add "https://github.com/leoan698-tom/dsh-session-messenger/releases/download/v0.3.0-dev.16/dsh-session-messenger-0.3.0-dev.16.tgz"
```

## 使用

- `@会话B 根据它的结论，整理下一步计划。`：引入 B 的有界历史上下文，B 不会被唤醒。
- `@会话B 把这个检查任务交给它，完成后回复我。`：AI 绑定准确对象，发送任务并接收关联回复。
- `@会话B @会话C 对比两边结论，把待修复事项发给 B。`：两份上下文都可用，发送对象明确为 B。
- 在会话列表的「更多 → 会话树」查看父子结构；团队成员标为「队员」，团队外子智能体标为「子智能体」。

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
git clone https://github.com/leoan698-tom/dsh-session-messenger.git
cd dsh-session-messenger
npm ci --ignore-scripts
npm run check
npm pack
```

`dist/` 随 Git 提交，支持直接安装 Git 标签；源码变更后必须重建并同步提交。测试使用真实 rc.5 运行时和免费确定性模型适配器，不调用付费模型。原始桌面截图、会话日志、本机 profile 及旧验收缓存不进入仓库。

[已知问题及依赖风险](docs/KNOWN_ISSUES.md) · [安装、升级和卸载](docs/OPERATIONS.md) · [功能说明](docs/COLLABORATION_0_3_DEV15.md) · [架构](docs/ARCHITECTURE.md) · [变更记录](CHANGELOG.md) · [第三方声明](THIRD_PARTY_NOTICES.md)
