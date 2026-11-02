# DSH Agent Hub dev.18 改名验证

验证日期：2026-11-01（America/Los_Angeles）。范围为旧版 `dsh-session-messenger@0.3.0-dev.17` 到 `@leoan698-tom/dsh-agent-hub@0.3.0-dev.18` 的分发身份变更。旧版取自 Git 提交 `4bd8f40637b8db53de9bd4f08c20e55ec2381d34` 的已提交编译产物，新版取自实际 `npm pack` 压缩包。

## 结果

- `npm run check` 通过：lint、类型检查、35 项单元/客户端测试、59 项集成测试，0 失败。
- 新包的 manifest、bundle patch、Host 导出、浏览器模块身份一致；真实 rc.5 bundle resolver 在隔离 profile 中解析完整 scoped 包名成功。
- 旧版真实写入消息、关联回复、收件选择、配对许可和普通父子关系；关闭整个 Host 后，新版完整读取这些数据，读取与恢复未调用模型。
- 新版使用恢复的准确会话 ID 和许可继续 A→B 发送，并收到绑定原请求的 B→A 回复。
- 再关闭 Host、回退旧版，仍可读取旧、新两组消息及关联回复和原父子关系；重开不自动投递。
- 新旧 `dist/schemas.js` 内容相同。旧存储域、消息来源与 wire ID 保持兼容。

压缩包：`leoan698-tom-dsh-agent-hub-0.3.0-dev.18.tgz`

SHA-256：`d9883e8d9d1f72d17b606c25c0b34d93754e43e2e6c3c5457db777f44eba547a`

本地原始结果保存在 `artifacts/agent-hub-rename-dev18/summary.json`，验证脚本为同目录下的 `verify-migration.mjs`。这些隔离工件不随发布包分发。

## 验证边界

使用真实 rc.5 组件、JSON 持久化和免费确定性模型适配器。没有操作用户日常桌面 profile，没有调用付费模型；这份结果不代表外部 CLI 已接入、人工任务面板已实现，或新版本已完成真实模型业务验收。新版本未发布 Git 标签、Release 或 npm。迁移操作见 [改名与迁移](../RENAMING.md)。
