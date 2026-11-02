# dev.20 npm 包名安装验证

结果：**PASS**。验证日期：2026-11-01（America/Los_Angeles）。

## 公开分发

- npm 包：`dsh-plugin-sessivra@0.3.0-dev.20`。
- [npm 包页面](https://www.npmjs.com/package/dsh-plugin-sessivra)。公开 registry 回读确认裸包名及 `latest` 均指向 `0.3.0-dev.20`。
- `npm pack dsh-plugin-sessivra` 从公开 npm 下载的压缩包，与经过验证并提交发布的文件逐字节一致。
- SHA-256：`6c4b5d8c51b066d88ace806196ac81816c3560d2c3951858a49b2da19d6d685c`。
- npm 发布经过账号持有人完成的登录、2FA 设置及本次发布认证；异步处理完成后才执行安装验证。曾短暂出现 `0.0.0-stage` 占位版本，最终验证以实际 dev.20 与默认标签回读为准。

## 构建与包检查

- `npm run check` 退出码 0：lint、TypeScript、构建、35 项单元/客户端测试和 59 项集成测试通过，0 失败。
- 实际压缩包含 60 个文件，没有 artifacts、node_modules、环境配置或 npm 凭据。
- manifest、bundle patch、Host 导出、协议贡献和浏览器加载器身份均为 `dsh-plugin-sessivra`；bundle ID 仍为 `leoan698-tom.dsh-sessivra`。
- 提交编译产物与最终安装包运行时一致。部分文档在 Git 提交时按仓库规则规范化为 LF；发布包保留打包时的行尾，不改写 npm 已发布产物。

## 从 npm 安装及运行

使用 DSH 桌面程序自带的 rc.5 CLI，在专用 DSH_HOME 和全新 `sessivra-npm-registry` profile 执行：

```sh
dsh plugin --profile sessivra-npm-registry add dsh-plugin-sessivra --registry=https://registry.npmjs.org/
```

命令退出码 0，实际解析并下载 `0.3.0-dev.20`。profile 依赖和 bundle 清单均注册新包；安装后的全部 60 个文件与公开 npm 压缩包一致，安装来源不含 file/link/GitHub 替代。

随后直接加载此次 npm 安装后的包，使用真实 rc.5 组件验证 dev.19 → dev.20 → dev.19：旧消息、关联回复、选择、许可和父子关系逐项保留；恢复原准确会话后继续 A→B 请求和关联回复成功；回退 dev.19 能读取旧、新两组消息和原关系。重开读取无自动模型调用。官方 bundle resolver 也成功解析新包。

## 边界

此前对未初始化的隔离 desktop profile 的检查被宿主按预期拒绝，随后使用其支持的独立自定义 profile。最小测试 profile 不是完整桌面依赖集合，因此 pnpm 提示 peer dependency 警告；实际运行验证使用固定的真实 rc.5 依赖。

未更改日常桌面 profile。运行时迁移检查使用确定性免费模型适配器，不代替 dev.20 的真实模型业务验收。兼容范围仍为 DSH `0.2.1-rc.5` / Node.js 24+，版本仍标注预发布。

## 本地证据

`artifacts/npm-dev20/` 中的 `check.log`、`summary-final.json`、`registry-readback.json`、`registry-download/pack.json`、`cli-npm-install.log`、`npm-installed-readback.json` 和 `summary-registry.json` 分别保存构建、最终包迁移、registry、下载、安装和安装版运行时结果。
