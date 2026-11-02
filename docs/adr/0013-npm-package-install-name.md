---
status: accepted
---

# 使用 dsh-plugin-sessivra 作为 npm 安装名称

2026-11-01（America/Los_Angeles），用户要求参照 `dsh-plugin-whale-pet`，在 DSH「添加插件」输入一个 `dsh-` 开头的包名即可安装。本条替代 ADR-0012 中 scoped 分发包名的决定；产品名 **DSH Sessivra**、GitHub 仓库和产品范围继续沿用。

从 `0.3.0-dev.20` 起，分发包、Host 插件名、客户端加载器 ID 及协议贡献包名统一为 `dsh-plugin-sessivra`。bundle 条目仍为 `leoan698-tom.dsh-sessivra`。旧 wire ID、工具名、消息来源和三个持久存储域保持不变。

npm registry 在 2026-11-02 06:04 UTC 对 `dsh-plugin-sessivra` 返回 404；名称是否成功取得以实际发布结果为准。单独输入包名的安装方式必须在 npm 发布及回读验证之后才可宣称可用。

发布时显式指定 `--tag latest`，使裸包名解析到当前公开候选；版本号和文档继续明确标注预发布。`latest` 是默认安装入口，不表示已经完成稳定版或真实模型业务验收。发布包仍固定兼容 DSH `0.2.1-rc.5` / Node.js 24+。

跨包名升级先移除旧的 `@leoan698-tom/dsh-sessivra`（或更早的信使/Agent Hub 包），再安装新包；它们使用同一组服务和持久数据，不同时启用。旧 Git 标签、Release 和已发布文件保留原名，不改写历史产物。

发布流程和当前状态见 [npm 发布与验证](../NPM_PUBLISH.md)。
