# 安装、升级与卸载

当前分发版本 0.3.0-dev.16，宿主固定为 DSH 0.2.1-rc.5。Node.js 24+；桌面版优先使用其安装目录下的 `resources/runtime/cli/bin/dsh.cmd`。先运行 `dsh --version` 核对；全局旧版 CLI 不应代替桌面程序自带的 CLI。

## 安装

正常退出使用目标 profile 的 DSH。安装命令使用官方 bundle 机制：

```sh
dsh plugin --profile desktop add "github:leoan698-tom/dsh-session-messenger#v0.3.0-dev.16"
```

或者安装 Release 压缩包：

```sh
dsh plugin --profile desktop add "https://github.com/leoan698-tom/dsh-session-messenger/releases/download/v0.3.0-dev.16/dsh-session-messenger-0.3.0-dev.16.tgz"
```

已有本地压缩包时，把来源换成 `file:/绝对路径/dsh-session-messenger-0.3.0-dev.16.tgz`。Web profile 使用 `--profile web`。自定义 DSH_HOME 应与实际宿主一致。CLI 会交给包管理器安装依赖，并在 profile 的 bundle 清单中注册插件。包包含 `dsh.manifestVersion: 1`、`dsh.bundle.patch`、`./client` 和编译产物。

安装后启动 DSH，在插件列表确认版本及启用状态。正常入口是输入框原生 `@` 和会话列表「更多 → 会话树」，没有独立的发送管理面板。

## 使用与自查

在 A 的输入框 `@` 选择 B，并明确说明参考、派任务或发送结论。仅参考不会唤醒 B；多引用时明确收件对象。关联回复来自接收对象显式调用消息回复工具。实际发送仍复核归属、工作目录、拒收设置、时效及去重。

- 找不到插件：检查 CLI 版本、DSH_HOME、profile 名称、安装命令退出状态及插件启用状态。
- 看不到会话树：重启对应 profile 后，从会话列表的「更多」菜单打开。
- 只有上下文、没有发送：检查是否明确要求通信；一次性对象及其他主会话的子智能体只能引用。
- 引用失效：重新 `@` 对象；不从摘要里的名称猜测 ID。
- `uncertain`：先核查目标及原消息状态，不自动换 ID 重发。
- 版本不兼容：使用匹配版本，不通过版本豁免绕过本项目的宿主约束。

## 升级和回退

升级前正常退出宿主，备份目标 profile 配置及对应的 Messenger 存储，并保留旧安装包。备份含消息正文和工作目录，留在本地。安装新版本后重启，并核对插件版本。

dev.16 只改变分发、文档和可移植测试，功能及数据 schema 沿用 dev.15；可用原 dev.15 包回退。dev.14/dev.15 同样无新增持久字段。dev.13 新增 child 通信字段，回退 dev.12 或更早版本需要与旧包匹配的升级前存储备份，不能直接让旧版读取新字段。回退不撤回已经进入会话历史的消息。

## 禁用和卸载

在宿主插件列表禁用本插件可保留数据。卸载时正常退出目标宿主，再执行：

```sh
dsh plugin --profile desktop remove dsh-session-messenger
```

重启后插件工具和会话树入口移除。卸载包不会主动删除 Messenger 存储，也不会删除宿主会话历史。重新安装可能继续读到此前的消息和许可。若确需删除数据，先备份并退出宿主，再定位实际存储后端里的 `dsh_session_messenger` 单元；不得删除整个 profile 或其他会话数据。
