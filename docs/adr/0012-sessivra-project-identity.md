---
status: accepted
---

# DSH Sessivra 的项目名称与兼容身份

2026-11-01（America/Los_Angeles），用户在查看同名竞品分析后要求再次改名，并明确不要有重名项目。原名称 DSH Agent Hub 已有多个同类项目，仅加 npm scope 不能解决产品名称混淆。本条替代 ADR-0011 的名称与分发身份决定；当前产品范围以 [CONTEXT.md](../../CONTEXT.md) 为准。

采用专有名称 **DSH Sessivra**，中文显示为 **DSH Sessivra 协作空间**；GitHub 仓库为 `leoan698-tom/dsh-sessivra`，分发包为 `@leoan698-tom/dsh-sessivra`，bundle 条目为 `leoan698-tom.dsh-sessivra`。scope 用于标明发布者，名称本身也经过重名检查。

## 改名前的名称检查

- GitHub REST 仓库查询 `sessivra in:name`、`dsh-sessivra in:name`、`sessivra in:name,description,readme` 返回 `total_count: 0` 且 `incomplete_results: false`。
- npm registry 对 [sessivra](https://registry.npmjs.org/sessivra)、[dsh-sessivra](https://registry.npmjs.org/dsh-sessivra) 和 [@leoan698-tom/dsh-sessivra](https://registry.npmjs.org/@leoan698-tom%2Fdsh-sessivra) 均返回 HTTP 404 `Not found`。
- 公开网页精确检索 `"Sessivra"`、`"DSH Sessivra"`、`"dsh-sessivra"` 未返回结果。

这些结果表示查询时未发现公开同名项目，不保证未被索引或私有项目不存在，也不代表 npm 名称已保留。原始查询结果与时间保存在本地 `artifacts/sessivra-rename-dev19/name-checks.json`。本次不发布 npm。

## 兼容选择

dev.19 同步变更包名、Host 注册、浏览器加载器、协议贡献包身份、bundle 条目和当前仓库链接。继续保留既有 `dsh-session-messenger#` wire ID、消息来源、工具名及三个 `dsh_session_messenger*` 存储域，不引入数据 schema 迁移。

原信使包、Agent Hub dev.18 与 Sessivra dev.19 是同一个插件的不同分发身份；迁移时替换安装，不能同时启用。已发布标签、旧安装包和历史验证报告保留当时的名称与版本。当前候选版本为 `0.3.0-dev.19`，安装与回退见 [改名与迁移](../RENAMING.md)。
