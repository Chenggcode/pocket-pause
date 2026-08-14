# Pocket Pause

Pocket Pause 是一款安静常驻系统托盘的 Electron 桌面宠物。它按用户设定的节奏提醒喝水和起身活动，在锁屏、休眠、长时间离开及免打扰时段自动暂停，尽量减少对工作的打断。

> 当前阶段：核心功能已经闭环并发布首个开源版本；Windows 安装包已完成基础验证，macOS 安装包由 CI 构建但仍待真机验证，所有安装包暂不签名。

## 下载

当前版本为 `v0.1.0`，可在 [GitHub Releases](https://github.com/Chenggcode/pocket-pause/releases) 下载 Windows x64、macOS Intel x64 或 macOS Apple Silicon arm64 安装包。未签名安装包可能触发 Windows SmartScreen 或 macOS Gatekeeper，安装前请核对版本和发布来源。

## 当前进度

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 喝水与起身提醒 | 已实现 | 两类提醒独立计时，也可同时到期 |
| 桌面宠物提醒窗 | 已实现 | 透明、置顶、可拖动，内置 3 个宠物形象 |
| 设置与持久化 | 已实现 | 提醒间隔、多个免打扰时段、外观、开机启动、宠物位置 |
| 系统托盘 | 已实现 | 3 套图标，支持显示/隐藏宠物、暂停提醒、打开设置、退出 |
| 状态感知 | 已实现 | 锁屏、休眠或离开 5 分钟后暂停计时 |
| 自动化测试 | 部分完成 | 已覆盖调度器、存储和设置校验，缺少主进程与 UI 测试 |
| 安装包与发布 | 基础完成 | 自动构建 Windows x64 NSIS 与 macOS x64/arm64 DMG；macOS 待真机验证，尚无签名和自动更新 |

详细的产品规则、技术架构和路线图见[项目设计文档](docs/PROJECT_DESIGN.md)。

## 功能与默认行为

- 喝水提醒默认每 45 分钟一次。
- 起身活动提醒默认每 60 分钟一次。
- “10 分钟后”会只延后当前类型的提醒。
- 内置薄荷猫、蜂蜜熊和云朵兔，以及柔和、描边和像素 3 套界面/托盘图标。
- 支持设置最多 8 个免打扰时段，任一时段命中即暂停提醒；默认时段为 22:00 至次日 08:00。
- 系统锁定、休眠或连续空闲 5 分钟时暂停提醒。
- 退出免打扰、恢复活动或取消手动暂停后，从完整间隔重新计时。
- 保存设置时，只有启用状态或间隔发生变化的提醒会重新计时；未变化的提醒和延后状态保持不变。
- 两类提醒同时到期时，会合并在同一个宠物气泡中展示。
- 关闭设置窗口只会将它隐藏；应用仍在系统托盘中运行。

## 快速开始

### 环境要求

- Windows 或 macOS
- Node.js 22 或更高版本
- pnpm 11 或更高版本

### 安装与运行

```powershell
pnpm install
pnpm test
pnpm start
```

如果项目目录被移动或复制后，`node_modules` 中残留了旧路径，可重新生成依赖链接：

```powershell
pnpm install --force
```

如果在国内网络下构建安装包时无法从 GitHub 下载 Electron 或 NSIS，可只为当前 PowerShell 会话设置镜像：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
pnpm dist:win
```

### 使用方式

1. 在设置页选择宠物与图标样式，并配置喝水、起身活动和一个或多个免打扰时段。
2. 点击“保存设置”；只有配置发生变化的提醒会从完整间隔重新计时。
3. 提醒出现后选择“完成”或“10 分钟后”。
4. 通过托盘菜单显示宠物、暂停提醒或重新打开设置。
5. 需要完全结束应用时，从托盘菜单选择“退出 Pocket Pause”。

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `pnpm start` | 启动 Electron 应用 |
| `pnpm check` | 检查主进程、共享模块和渲染脚本语法 |
| `pnpm test` | 运行 Node.js 内置测试 |
| `pnpm verify` | 依次执行语法检查和测试 |
| `pnpm pack` | 生成未安装的应用目录 |
| `pnpm dist` | 构建当前平台的安装包 |
| `pnpm dist:win` | 构建 Windows x64 NSIS 安装包 |
| `pnpm dist:mac:x64` | 在 macOS 上构建 Intel x64 DMG |
| `pnpm dist:mac:arm64` | 在 macOS 上构建 Apple Silicon arm64 DMG |

## 项目结构

```text
src/
  main/
    main.js           Electron 生命周期、窗口、托盘和 IPC
    scheduler.js      提醒调度状态机
    store.js          JSON 设置持久化
    window-position.js 多显示器窗口边界计算
  preload/
    pet.js            宠物窗口的受限 IPC API
    settings.js       设置窗口的受限 IPC API
  renderer/
    pet/              桌面宠物界面
    settings/         设置界面
  shared/
    defaults.js       默认值和公共常量
    validation.js     设置归一化与输入校验
test/
  scheduler.test.js   调度器和设置校验测试
docs/
  PROJECT_DESIGN.md   产品与技术设计文档
  RELEASING.md        版本与 GitHub Release 流程
.github/
  workflows/          CI 与跨平台 Release 自动化
```

主进程是提醒状态的唯一可信来源。渲染进程不能直接访问 Node.js，只能通过 preload 暴露的白名单接口读取设置、保存设置或提交提醒动作。

## 数据与隐私

- 应用不需要账户，也不依赖网络服务。
- 设置保存在 Electron `userData` 目录下的 `settings.json`。
- 当前只持久化设置和宠物位置，不记录喝水、活动历史或行为统计。
- 提醒倒计时不跨进程重启保留；应用重启后会从完整间隔重新开始。

## 测试

```powershell
pnpm test
```

现有测试覆盖以下规则：

- 两类提醒独立计时及同时到期合并。
- 完成与延后提醒后的重新调度。
- 多个同日或跨午夜免打扰时段，以及旧版单时段配置迁移。
- 合法与非法外观配置的归一化。
- 设置文件缺失、损坏、原子保存和替换失败恢复。
- 离开免打扰或恢复活动后重新计时。
- 非法持久化设置回退到默认值。

目前尚未覆盖窗口生命周期、托盘、IPC 和渲染层交互。

## 打包

```powershell
pnpm pack
pnpm dist
```

构建产物输出到 `release/`。Windows 安装包应在 Windows 上构建，macOS DMG 应在 macOS 上构建。当前 Windows x64 NSIS 已完成本地构建验证，macOS x64/arm64 DMG 由 GitHub Actions 构建。正式发布前还需要补充：

- 代码签名、macOS 公证和安装/卸载验证。
- 干净环境、开机启动和多显示器场景验证。
- 版本发布说明与升级策略。

推送与 `package.json` 版本一致的 `v*` 标签会触发跨平台 Release 工作流。完整步骤见[发布流程](docs/RELEASING.md)。

## 已知限制

- 开机启动已支持静默驻留托盘，但仍需要在 Windows 和 macOS 真机验证。
- macOS DMG 未签名且未公证，Gatekeeper 会阻止直接打开，需要用户手动允许。
- 当前没有代码签名、自动更新或端到端测试。

## 贡献与安全

- 提交代码前请阅读[贡献指南](CONTRIBUTING.md)。
- 安全问题请按照[安全策略](SECURITY.md)私密报告，不要创建公开 Issue。
- 版本变化记录在[CHANGELOG](CHANGELOG.md)。

## 设计原则

1. 提醒应该容易感知，但不能持续抢占注意力。
2. 宠物承担情绪表达，设置页保持克制和高效。
3. 所有关键状态由主进程管理，页面刷新不能改变计时语义。
4. 默认本地运行、最少数据、无需登录。
5. 优先保证可靠提醒和系统行为，再扩展装扮、统计等附加能力。

## License

Pocket Pause 使用 [MIT License](LICENSE)。
