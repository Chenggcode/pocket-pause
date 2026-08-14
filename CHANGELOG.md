# Changelog

本项目的显著变化记录在此文件中，版本号遵循语义化版本。

## [Unreleased]

### Added

- GitHub Actions 自动构建 macOS Intel x64 和 Apple Silicon arm64 DMG，并上传到对应 Release。

## [0.1.0] - 2026-08-14

### Added

- 喝水和起身活动独立提醒，支持完成和延后。
- 多个免打扰时段，以及锁屏、休眠和空闲暂停。
- 系统托盘、开机静默启动和单实例运行。
- 薄荷猫、蜂蜜熊、云朵兔及三套图标样式。
- 本地设置持久化、多显示器窗口边界和保存失败恢复。
- Windows NSIS x64 自动构建与 GitHub Release 工作流。

### Security

- 启用渲染进程沙箱、上下文隔离、CSP、导航限制和 IPC 来源校验。
