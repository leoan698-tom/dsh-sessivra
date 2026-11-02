---
status: accepted
---

# DSH Agent Hub 的产品范围与分发身份

2026-11-01（America/Los_Angeles），用户结合竞品对比要求项目改名，并明确后续通过插件调用本机 Grok CLI、Antigravity CLI、Claude Code CLI 等主流 CLI，将会话展示在 DSH 中，支持通信、上下文引用和供人使用的任务管理面板。用户选择名称 **DSH Agent Hub（DSH 智能体协作中心）**。

这扩展 ADR-0002、ADR-0003 的产品范围：同一 Host/profile 内的通信仍是当前实现边界，后续增加插件与本机外部 CLI 进程的适配；人工任务管理纳入未来范围。跨机器协作、任务自动验收和失败自动恢复并未由此次需求自动纳入。纯插件集成原则、ADR-0004 的真实会话身份、ADR-0009 的引用与明确通信意图区分、ADR-0010 的原生工作区栏约束继续适用。

CLI 适配需要按实际产品和版本分别确认可执行入口、会话标识、历史读取、继续执行、消息输入及运行状态。用户列举的 CLI 名称记录为接入目标，不构成官方实现存在性、能力或兼容性声明。外部会话保持原执行来源和身份，不能仅因在 DSH 中展示就视为原生子智能体。人工任务具有独立身份，关联会话与执行结果；消息状态、CLI 退出和业务完成分别表达。

名称与分发采用 `leoan698-tom/dsh-agent-hub` 仓库和 `@leoan698-tom/dsh-agent-hub` 包名。核查时 [dsh-agent-hub](https://registry.npmjs.org/dsh-agent-hub) 已有 npm 包，GitHub 也有[同名 DSH 插件](https://github.com/jax629321/dsh-agent-hub)；以所有者和 scope 区分来源，不以裸名称安装。本次未发布 npm，也未验证该 npm scope 的发布权限。

改名同步 Host、客户端加载器、bundle 入口和协议贡献的包身份；保留既有 wire ID、消息来源标记、工具名与三个 `dsh_session_messenger*` 存储域，避免将改名变成历史消息、许可和会话关系的数据迁移。旧、新包是同一插件的不同分发身份，迁移时替换安装，不同时启用。具体步骤见 [改名与迁移](../RENAMING.md)。
