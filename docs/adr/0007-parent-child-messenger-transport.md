---
status: accepted
---

# 主会话通过 Messenger 调度其直接子智能体

dev.15 的 [ADR-0009](0009-unified-session-references-and-messaging.md) 将可见 @ 候选统一到原生上下文引用入口；引用本身不创建通信许可，明确发送时才绑定通信对象。本篇的传输与归属边界继续有效，发送专属候选表述保留为历史。

2026-11-01，用户要求「把团队队员和团队外子智能体也加入 @ 会话候选，让主会话能直接给它们发任务并接收回复」。此决策取代 ADR-0006 中两类对象只导航、不进入 @ 和 Messenger 的限制；ADR-0004 的普通子会话创建语义保持。

候选由现有树的真实归属生成，只向普通主会话展示自己的 continuable 子智能体，区分 teammate 和 standalone。选择、发送、队列释放和回复分别核对父子精确 ID、会话 origin、描述符、Team 成员 active 状态、归档状态、工作目录和持久配对许可。创建失败或未完成的队员不得回退为 standalone。

发送调用 rc.5 官方包导出的 `queueHostSubagentPrompt` / `steerHostSubagentPrompt`，由宿主负责原子智能体的恢复、生命期和接收队列。插件不把 child 转为 root，不调用普通会话恢复路径，也不创建替代执行者。此导出属于 internal 子路径，必须固定宿主版本并验证升级。

回信使用 `session_message_reply` 及原任务 ID，验证精确活动 child、原主会话与一次关联回复；底层走 `subagents.sendMessage` 的相邻父子验证。子智能体不能通过此接口主动向其他会话派活或更改许可。消息复用既有持久状态、配额、时效、去重与不确定投递不自动重试规则；原生回复的 inbox ID 写回插件记录后用于领取状态跟踪。

Team 任务板不由通信状态推断完成。关联结果终止该消息链，主会话可以继续发送下一项任务。查看候选不启动模型。`session_progress` 范围保持普通会话。
