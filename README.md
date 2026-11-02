# DSH Sessivra

**让多个会话里的工作接得起来。**

在 DeepSeek Harness 中，用原生 `@会话` 引用已有结论，明确交办任务并接收关联回复，通过会话树找到对应工作。

[开始使用](#开始使用) · [使用示例](#使用示例) · [安装与卸载](docs/OPERATIONS.md) · [已知问题](docs/KNOWN_ISSUES.md) · [反馈问题](https://github.com/leoan698-tom/dsh-sessivra/issues)

非官方项目，由社区成员独立开发和维护。兼容 **DSH 0.2.1-rc.5 / Node.js 24+**。

## 三件事，接续你的工作

| 你想做什么 | 在 DSH 中怎样操作 |
| --- | --- |
| 参考另一个会话的结论 | 用原生 `@` 选择会话，让当前会话根据其上下文继续工作；被引用的会话不会因此被唤醒 |
| 把检查、提问或结论交给另一个会话 | `@` 选择准确对象，明确说出发送要求；符合条件的目标可以接收任务并回复原请求 |
| 找到主会话与分出去的工作 | 在原生工作区列表中展开会话树，打开普通子会话、队员或子智能体；保留宿主的搜索和工作区操作 |

适合同时使用多个 DSH 会话处理需求、实现、资料或检查的用户。原生 `@` 提供上下文引用，Sessivra 将其与明确通信和会话树衔接起来。

![检查结果通过关联回复回到原会话](docs/media/sessivra-reply.png)

上图为 DSH rc.5 / Sessivra dev.19 改名候选的实际 Web 界面，使用独立演示会话和固定响应模型；展示插件传输与界面，不代表真实模型业务验收。

<details>
<summary>查看上下文引用与会话树截图</summary>

![当前会话引用已有结论，目标没有收到新任务](docs/media/sessivra-reference.png)

![从会话树打开普通子会话，查看对应检查结果](docs/media/sessivra-tree.png)

</details>

## 开始使用

**当前公开安装版本为 `0.3.0-dev.17`（预发布）**，仍显示原名 **DSH 跨会话信使 / Session Messenger**。项目已更名为 DSH Sessivra；仓库中的新名 `0.3.0-dev.19` 是未发布候选。下列固定版本命令安装的是已发布 dev.17，不会安装未发布候选。

1. 确认 DSH 已完成首次启动，CLI 版本为 `0.2.1-rc.5`。
2. 正常退出使用目标 profile 的 DSH，然后安装：

```sh
dsh --version
dsh plugin --profile desktop add "github:leoan698-tom/dsh-sessivra#v0.3.0-dev.17"
```

3. 重启 DSH，在插件列表确认启用，然后在输入框键入 `@` 选择一个已有会话。

Windows 桌面版未配置 PATH 时，使用安装目录内的 CLI，将下面的路径换成实际位置：

```powershell
& 'D:\DeepSeekHarness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'github:leoan698-tom/dsh-sessivra#v0.3.0-dev.17'
```

Web 用户将 `desktop` 换成 `web`；自定义 profile 和 `DSH_HOME` 应与实际宿主一致。安装包包含编译产物，使用者无需构建。

也可安装 [Release 中的压缩包](https://github.com/leoan698-tom/dsh-sessivra/releases/tag/v0.3.0-dev.17)。历史包名不随仓库改名变化。新名候选的本地构建、旧包替换和回退见[改名与迁移](docs/RENAMING.md)。本项目尚未发布到 npm。

## 使用示例

先准备两个普通会话，例如“需求整理”和“验收检查”，让“验收检查”中已有一些可参考的结论。在输入框通过原生 `@` 菜单选中它，再输入要求。

**引用结论：**

```text
@验收检查 根据它已有的结论，整理 3 条后续检查项。
```

当前会话获得有界历史上下文；“验收检查”不会因此运行新任务。

**明确交办：**

```text
@验收检查 请检查这份方案中的遗漏项，完成后回复我。
```

AI 按准确引用对象发送请求。接收方生成结果并显式回复时，回复会关联原请求。

**同时参考多个会话，再指定收件人：**

```text
@需求整理 @验收检查 对比两边的结论，把待补充的检查事项发给验收检查。
```

两份上下文都可以使用，发送对象由当前要求明确指定。

**找到对应会话：** 在原生工作区列表中展开主会话。普通子会话可以独立打开和继续聊天；团队成员标为“队员”，团队外子智能体标为“子智能体”，各自保留宿主身份和生命周期。

AI 根据每条要求选择排队或直接插入。即时调整在下一执行步接收，不取消正在执行的工具；仅选择、引用或查询不会授权发送。

## 使用范围

- 同一 Host、同一 profile 内使用，不支持跨机器或跨进程通信。
- 宿主每条消息最多引用 3 个会话；历史快照可能截断。
- 一次性对象只读。其他主会话的子智能体可以在宿主允许时被引用，但只有自己直接拥有且可继续的子智能体才能接收派发任务。
- 消息送达或领取不代表业务完成；Team 任务板由团队工具维护。
- 不确定投递不会自动重发；历史引用元数据被宿主压缩移除后，需要重新 `@` 对象。
- 插件依赖 rc.5 内部父子通信接口，其他 DSH 版本需要单独验证。

当前版本为预发布，已知依赖风险见[已知问题](docs/KNOWN_ISSUES.md)。自动化、隔离运行时和安装验证分别记录在[测试报告](docs/TEST_REPORT.md)；这些结果不等于完整真实模型业务验收。

## 开发与支持

```sh
git clone https://github.com/leoan698-tom/dsh-sessivra.git
cd dsh-sessivra
npm ci --ignore-scripts
npm run check
npm pack
```

`dist/` 随 Git 提交，源码变更后应重建并同步。默认测试使用真实 rc.5 运行时和免费确定性模型适配器，不调用付费模型。

反馈时请提供 DSH 版本、插件版本、操作系统、复现步骤、预期和实际结果；截图请先隐去私密信息。

[安装、升级和卸载](docs/OPERATIONS.md) · [功能说明](docs/COLLABORATION_0_3_DEV15.md) · [架构](docs/ARCHITECTURE.md) · [变更记录](CHANGELOG.md) · [第三方声明](THIRD_PARTY_NOTICES.md) · [MIT License](LICENSE)
