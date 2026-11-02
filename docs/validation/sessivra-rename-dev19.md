# DSH Sessivra dev.19 改名验证

验证日期：2026-11-01（America/Los_Angeles）。候选包为 `@leoan698-tom/dsh-sessivra@0.3.0-dev.19`。此变更处理项目名称、分发身份和仓库链接，外部 CLI 接入与人工任务面板仍属规划。

## 名称检查

改名之前，于 2026-11-02 03:59 UTC 查询 GitHub、npm 和公开网页。GitHub 三组查询均返回 0 个仓库且结果未标记为不完整；npm 三个候选包名均返回 404；公开网页精确检索未返回结果。原始 API 结果见 [名称检查快照](sessivra-name-checks-2026-11-01.json)，具体范围与名称决定见 [ADR-0012](../adr/0012-sessivra-project-identity.md)。这表示本次检索未发现公开同名项目，不表示名称已经在 npm 保留。

## 构建与迁移结果

- `npm run check` 通过：lint、类型检查、35 项单元/客户端测试和 59 项集成测试，0 失败。
- 从实际 `npm pack` 压缩包读取的 manifest、bundle patch、Host 导出、协议贡献包名和浏览器模块身份一致；真实 rc.5 bundle resolver 在隔离 profile 中解析新 scoped 包名成功。
- 对以下两条升级路径分别验证：旧包写入数据 → 关闭整个 Host → 新包读取并继续通信 → 关闭 Host → 回退旧包读取。

| 旧版本 | 源码提交 | 结果 |
| --- | --- | --- |
| `dsh-session-messenger@0.3.0-dev.17` | `4bd8f40637b8db53de9bd4f08c20e55ec2381d34` | PASS |
| `@leoan698-tom/dsh-agent-hub@0.3.0-dev.18` | `97eb5931f2f4f1ad877fed0ad8ca9d7157ffe61e` | PASS |

每条路径都核对旧消息、关联回复、收件选择、配对许可和普通父子关系，重开读取不调用模型。新包使用恢复的准确会话 ID 和许可继续 A→B 请求，B→A 回复绑定原请求；回退后旧包仍能读取两组消息与原父子关系。三个持久存储域和 `dist/schemas.js` 保持一致。

压缩包：`leoan698-tom-dsh-sessivra-0.3.0-dev.19.tgz`

SHA-256：`52e0791f37b7a692162d8f707ed58c83420cb191a633933a728b4f976947cb24`

本地原始结果为 `artifacts/sessivra-rename-dev19/summary-dev17.json`、`summary-dev18.json` 和 `check.log`；验证脚本为同目录下的 `verify-migration.mjs`。隔离运行工件不随发布包分发。

## 验证边界

使用真实 rc.5 组件、JSON 持久化和免费确定性模型适配器。没有操作日常桌面 profile，没有调用付费模型；结果不代表新功能实现或真实模型业务验收。候选尚未发布 Git 标签、Release 或 npm。安装与回退见 [改名与迁移](../RENAMING.md)。
