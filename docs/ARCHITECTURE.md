# 架构与边界

宿主版本固定为 DSH 0.2.1-rc.5。插件通过 bundle patch 加载服务端，通过 `./client` 和宿主 ModuleLoader 加载客户端。React、原生 UI primitives 及 DSH 运行时由宿主提供；Zod runtime 随客户端构建，许可见第三方声明。

## 引用和准确寻址

原生 SessionReferenceResolver 按准确 ID 生成有界历史快照。`ReferenceTargets` 从已接受消息的结构化引用元数据恢复目标，不从标题、快照正文或工具输出推断授权。多引用不默认选最后一项。查询保持只读；用户明确要求通信后，发送工具复核 `selectionRevision` 并进入既有 Messenger 许可和传输路径。旧草稿的投递芯片保留转换能力，新菜单只显示原生引用入口。见 [ADR-0009](adr/0009-unified-session-references-and-messaging.md)。

## 会话树和子智能体

普通子会话关系保存在插件的独立域；普通子会话仍是可独立打开和聊天的 root 会话。子智能体归属来自宿主 Session 头、subagentCatalog 和 Team 名册，按层级自动发现，不写成普通会话关系。创建中、失败、外部执行及历史不可用的对象保留状态节点。可读节点通过宿主父子地址打开，查看不唤醒模型。见 [ADR-0004](adr/0004-conversation-tree-is-not-subagent-ownership.md) 和 [ADR-0008](adr/0008-automatic-subagent-tree-discovery.md)。

主会话只能向自己直接拥有、可继续的子智能体派任务。传输调用 rc.5 的 `queueHostSubagentPrompt` / `steerHostSubagentPrompt`；回复通过原任务 ID 和宿主相邻父子通道返回。该接口属于 internal 子路径，因此固定宿主版本，升级须复验。一次性、多级下属或他人子智能体可以引用，但不扩大通信权限。Team 任务板由团队工具维护。见 [ADR-0007](adr/0007-parent-child-messenger-transport.md)。

## 许可、投递和状态

发送主体来自真实 `exec.agent`；模型不能指定发送者。独立会话消息通过宿主 followup/steer 传输，保留插件来源，接收正文为低信任资料。目标精确 ID、工作目录、既有拒收设置、配对许可、TTL 和去重在实际发送时复核。排队等待当前执行结束，直接插入在安全步骤接收，不取消现有工具。

持久 ledger 记录消息、关联回复、许可和预算。先保存 dispatching，再调用宿主投递；宿主 inbox 和插件存储不共享事务。重开时中断的 dispatching 成为 uncertain，不自动重发。同 ID 重试不得重复投递，内容或目标不一致时拒绝。delivered 表示投递调用返回，claimed 表示 inbox 已领取，都不等于业务完成。短暂 Windows 文件锁只对存储操作进行有限重试，不重试消息投递。

## 数据和运行范围

仅同一 Host/profile；无跨进程或跨机连接。模型工具、队列、消息时效、回复次数及唤醒预算均有上限。无自动业务验收或自动任务板完成。普通会话进展查询只返回有界观察，不代表完整共享历史。存储包含主动发送的内容、ID、工作目录及状态；原始本机日志、profile、凭据和验收截图不发布。

运行时测试采用真实 Cordis、AgentLoop、SessionQuery、SessionReferenceResolver、Team、Subagent 和磁盘存储，模型输出由免费确定性适配器提供；其通过不替代真实模型决策验收。详见 [测试报告](TEST_REPORT.md) 和 [验收范围](ACCEPTANCE_CRITERIA.md)。
