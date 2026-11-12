# 安装、升级与卸载

项目已采用 **DSH Sessivra / DSH Sessivra 协作空间** 名称。当前版本使用 `dsh-plugin-sessivra`，其安装和跨包名迁移见 [改名与迁移](RENAMING.md)。本文命令用于已发布的新包；已安装dev.19 scoped 包、原信使包或 Agent Hub 包时，先按迁移说明移除对应旧包。

当前分发版本 0.3.0-dev.31，支持 DSH 0.2.1-rc.5 或 0.2.2-rc.1。Node.js 24+；桌面版优先使用其安装目录下的 `resources/runtime/cli/bin/dsh.cmd`。先运行 `dsh --version` 核对；全局旧版 CLI 不应代替桌面程序自带的 CLI。

## 安装

### DSH 界面安装

在「插件 → 添加插件」输入框中，选择 npm 官方源，只填写包名，不加引号：

```text
dsh-plugin-sessivra@0.3.0-dev.31
```

DSH rc.5 自带 pnpm 的默认发布时间保护为 24 小时。新版本发布首日，仅填裸包名可能仍安装较旧版本；使用上面的固定版本可明确选择 dev.31，安装后核对版本。无需关闭全局保护。

点击「安装」，完成后按界面提示重启或重新加载。若出现 `not a package name the registry accepts`，先检查是否误把整条 `dsh plugin ...` 终端命令粘贴到了输入框。

### 终端安装

以下命令在 PowerShell、CMD 或其他终端中执行，不能整行填入「添加插件」窗口。

正常退出使用目标 profile 的 DSH。安装命令使用官方 bundle 机制：

```sh
dsh plugin --profile desktop add "dsh-plugin-sessivra@0.3.0-dev.31"
```

或者安装 Release 压缩包：

```sh
dsh plugin --profile desktop add "https://github.com/leoan698-tom/dsh-sessivra/releases/download/v0.3.0-dev.31/dsh-plugin-sessivra-0.3.0-dev.31.tgz"
```

已有本地压缩包时，把来源换成 `file:/绝对路径/dsh-plugin-sessivra-0.3.0-dev.31.tgz`。Web profile 使用 `--profile web`。自定义 DSH_HOME 应与实际宿主一致。CLI 会交给包管理器安装依赖，并在 profile 的 bundle 清单中注册插件。包包含 `dsh.manifestVersion: 1`、`dsh.bundle.patch`、`./client` 和编译产物。

安装后启动 DSH，在插件列表确认版本及启用状态。正常入口是输入框原生 `@` 和原生工作区列表。工作区标题、搜索、视图选项和添加工作区由宿主管理，主会话有子节点时直接显示展开箭头。

## 向本机 CLI 派发任务

打开「任务中心 → 本机 CLI」可以查看 Claude Code、Codex 和 Grok Build 的安装版本、登录状态和派发配置。首次打开会检测本机 CLI，之后打开页面会读取上次结果。点击「重新检测」可刷新所有状态。对于确认未登录的 CLI，点击「授权登录」会启动官方登录流程，窗口退出后自动复查该 CLI。

在会话输入框键入 `@`，从「聊天对象」选择 Codex 或 Grok Build 并发送文本。回复和该轮公开执行记录写入当前 DSH 会话，直接回复可继续对应 CLI 的会话。选 `@DeepSeek` 可切回原来的 DSH 模型。CLI 工具权限由原生审批卡处理，Codex 的用户选择题通过 DSH 问答卡提交。

选「自动选择」可让 DSH 根据本条任务推荐一个聊天对象。若推荐外部 CLI，审批卡会列出推荐理由、工作目录和即将发送的文本。允许后才切换并派发，拒绝后回到原聊天对象。

在运行 DeepSeek Harness 的机器上安装并登录对应 CLI。外部 CLI 使用自己的账号、模型和权限设置。Windows 需要配置实际的 `.exe` 路径。npm 安装的 Claude Code 和 Codex 可在对应包目录找到原生程序。macOS 和 Linux 使用实际可执行文件的绝对路径。

在目标 DSH profile 的 `cordis.patch.yml` 给 Sessivra 增加 `externalCli` 配置，替换为本机路径并重启。已有同 ID 的配置时，把 `externalCli` 放到现有 `config` 下。只配置要使用的 CLI。

```yaml
- id: leoan698-tom.dsh-sessivra
  config:
    externalCli:
      claude:
        executable: 'C:/path/to/claude.exe'
      codex:
        executable: 'C:/path/to/codex.exe'
      grok:
        executable: 'C:/path/to/grok.exe'
        timeoutSeconds: 600
```

在打开目标工作目录的 DSH 会话里说「把这项任务派给 Codex CLI，梳理本目录的测试入口并回报」。DSH 会显示 CLI、工作目录、外部会话 ID（续派时）和完整提示词，默认由你批准后启动。等待期间可用 DSH 的停止操作中断本机进程。回执包含外部 CLI 会话 ID、退出状态和有限长度的结果。继续时说「让 Codex CLI 在外部会话 `<UUID>` 里继续，补上运行集成测试的命令」。保持同一工作目录和 CLI 账号。

如希望某个已配置的 CLI 直接派发，在该 CLI 的 `executable` 同级设置 `dispatchApproval: direct`，再重启 profile。默认值为 `ask`。这项设置作用于 Sessivra 的派发审批，CLI 的账号授权和执行权限由各 CLI 自己管理。

CLI 回合返回后由用户或协调会话检查产出。出现取消、超时或结果不确定时，先核对文件和外部会话再决定是否续派。外部 CLI 会话由对应 CLI 保存，使用各自的会话 ID；DSH 的停止操作作用于通过本工具启动的当前回合。默认超时 600 秒，可按 CLI 调整。

## 使用与自查

在 A 的输入框 `@` 选择 B，并明确说明参考、派任务或发送结论。仅参考不会唤醒 B；多引用时明确收件对象。关联回复来自接收对象显式调用消息回复工具。实际发送仍复核归属、工作目录、拒收设置、时效及去重。

- 找不到插件：检查 CLI 版本、DSH_HOME、profile 名称、安装命令退出状态及插件启用状态。
- 看不到子节点：展开对应工作区，确认插件启用并等待一次刷新。宿主须为 rc.5；其原生行结构不匹配时保留原生列表，不覆盖工作区栏。
- 只有上下文、没有发送：检查是否明确要求通信；一次性对象及其他主会话的子智能体只能引用。
- 引用失效：重新 `@` 对象；不从摘要里的名称猜测 ID。
- `uncertain`：先核查目标及原消息状态，不自动换 ID 重发。
- 版本不兼容：使用匹配版本，不通过版本豁免绕过本项目的宿主约束。

## 升级和回退

dev.25 包含受管任务协议，沿用 dev.24 的独立 `dsh_sessivra_tasks` 域。更新保留任务、共同决定和会话关系；启动不自动唤醒模型。回退到 dev.20 前须结束或暂停受管任务并备份新域，旧版不能继续新任务协议。详见[任务协作恢复说明](MANAGED_TASKS.md)。

升级前正常退出宿主，备份目标 profile 配置及对应的 Messenger 存储，并保留旧安装包。备份含消息正文和工作目录，留在本地。安装新版本后重启，并核对插件版本。

dev.20 npm 安装名及 dev.19 改名均不改变持久 schema，可回退至保存的 dev.19、dev.18 或 dev.17 包。dev.17 调整原生侧栏集成，通信功能及数据 schema 沿用 dev.15；可用原 dev.15 包回退。dev.14/dev.15 同样无新增持久字段。dev.13 新增 child 通信字段，回退 dev.12 或更早版本需要与旧包匹配的升级前存储备份，不能直接让旧版读取新字段。回退不撤回已经进入会话历史的消息。

## 禁用和卸载

在宿主插件列表禁用本插件可保留数据。卸载时正常退出目标宿主，再执行：

```sh
dsh plugin --profile desktop remove dsh-plugin-sessivra
```

重启后插件工具和会话树入口移除。卸载包不会主动删除 Messenger 存储，也不会删除宿主会话历史。重新安装可能继续读到此前的消息和许可。若确需删除数据，先备份并退出宿主，再定位实际存储后端里的 `dsh_session_messenger` 单元；不得删除整个 profile 或其他会话数据。
