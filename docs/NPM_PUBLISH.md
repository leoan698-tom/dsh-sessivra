# npm 包名安装与发布

包名：`dsh-plugin-sessivra`。版本：`0.3.0-dev.25`，兼容 DSH `0.2.1-rc.5` / Node.js 24+。

npm 公开版本以 [registry 元数据](https://registry.npmjs.org/dsh-plugin-sessivra/latest) 和 [npm 包页面](https://www.npmjs.com/package/dsh-plugin-sessivra) 为准。[验证记录](https://github.com/leoan698-tom/dsh-sessivra/blob/main/docs/validation/dev25-release.md)区分本地包检查与实际公开安装结果。

## 用户安装

在 DSH「插件 → 添加插件」中输入：

```text
dsh-plugin-sessivra@0.3.0-dev.25
```

DSH rc.5 自带 pnpm 的默认发布时间保护为 24 小时。新版本发布首日，仅填裸包名可能仍安装 dev.20；使用上面的固定版本可明确选择 dev.25，安装后核对版本。无需关闭全局保护。

选择 npm 官方源，点击「安装」，按界面提示重新加载或重启。包名输入框不填写终端命令。预发布版本号应在安装确认与插件列表中可见。

已安装 dev.19 的用户应先停用并移除 `@leoan698-tom/dsh-sessivra`，再装新包；原信使包或 Agent Hub 包同样需替换。移除插件不清空消息或会话关系，不能同时启用多个旧包。

## 维护者发布

1. 执行 `npm run check`，检查实际打包内容和旧包迁移结果。若只修改发布状态与安装说明，无需重复全部功能测试，但需要重新打包并校验最终包。
2. 执行 `npm pack`，用隔离 profile 检查真实压缩包的 bundle 解析、Host/浏览器身份及持久数据。
3. 在 npm 官方网页完成 `npm login --auth-type=web --registry=https://registry.npmjs.org/` 的认证。
4. 同步最终发布版 README、安装与迁移文档，重新打包并校验，再对经过验证的同一个压缩包发布：

```sh
npm publish ./dsh-plugin-sessivra-0.3.0-dev.25.tgz --access public --tag latest --registry=https://registry.npmjs.org/
```

显式使用 `latest` 是为了让用户只填包名即可解析；版本仍是预发布。若 npm 要求登录或发布认证，由账号持有人在 npm 官方页面完成。

5. 回读 `npm view dsh-plugin-sessivra name version dist-tags dist --json --registry=https://registry.npmjs.org/`，确认裸包名及 `latest` 解析为候选版本，下载公开包并比对内容与校验值。
6. 在隔离 DSH profile 中从 npm 安装裸包名，核对注册、运行及关联回复。通过后更新 README、安装文档和发布说明，记录 GitHub 与 npm 分发状态。

完整真实模型业务验收继续按既有报告单独表述。
