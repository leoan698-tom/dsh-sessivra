# ADR-0016 人工管理受管任务

状态：采用，目标宿主 DSH 0.2.1-rc.5。

## 决定

在原生侧栏注册独立的 `sessivra-tasks` 主面板。当前 Host/profile 的所有者可以在待处理、全部任务和历史之间切换。协调者、执行者和业务裁决继续沿用 ADR-0015 的身份和授权。工作目录只用于筛选。打开任务、搜索与查看验收记录只读取已有数据。

人工命令通过 `sessivraTaskPanel` Remote 验证 Gateway 的 owner 身份。模型工具沿用原有的调用者权限。人工操作以操作 ID、内容摘要和当前版本提交，与模型操作进入同一任务写入队列。人工答复及验收记录真实来源。通过验收需要逐项核验、说明和证据。退回保留同一任务及已完成工作。明确创建普通子会话时复用稳定请求身份。

终态任务可转存到独立的逐条历史表。先持久保存任务、问题和投递事件，再移除热记录。恢复时完成中断的清理，保留仍被其他任务使用的共同问题。历史支持回查。产物仅保存路径及提交时的证据，用户主动预览时读取工作目录下文件的当前内容。

## 与 Superagent 并用

两个插件使用不同的侧栏入口、RPC 名称和存储。Sessivra 只调度自身的受管任务。通过 Superagent 的 worker/router preset、确定性会话 ID 和原生父子关系识别其会话，跳过任务提示、派发和工具操作。Sessivra 面板不接入其 GitHub/飞书来源、Ticket 或队列。

Superagent 的安装会设置进程级 PATH 和 Git 环境，实际仓库自动化遵照上游使用专用 profile。宿主同开两个入口解决导航与任务归属问题，进程环境隔离由独立运行的宿主提供。

上游参考：[面板](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/8c32a9dc5d72c033816c6a8110b37f40cf94fba4/docs/005-panel.md)、[部署](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/8c32a9dc5d72c033816c6a8110b37f40cf94fba4/docs/006-deployment.md)。
