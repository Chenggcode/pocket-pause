# 发布流程

Pocket Pause 使用语义化版本和 GitHub Releases。发布目标包括 Windows x64 NSIS，以及 macOS Intel x64 和 Apple Silicon arm64 DMG。

## 发布前

1. 更新 `package.json` 版本和 `CHANGELOG.md`。
2. 执行完整验证：

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm dist:win
```

国内网络若无法从 GitHub 下载 Electron 或 NSIS，可只为当前 PowerShell 会话设置镜像后重新构建：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
pnpm dist:win
```

镜像仅用于本地下载构建依赖，不应写入 GitHub Actions；发布工作流应使用 runner 的默认官方源。

3. 在干净的 Windows 和 macOS 环境安装对应安装包，验证启动、托盘、提醒、免打扰、开机启动和卸载。
4. 确认仓库中没有证书、令牌、用户设置或其他敏感文件。

## 创建发布

版本标签必须与 `package.json` 一致：

```powershell
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

标签会触发 `.github/workflows/release.yml`。工作流先执行测试和版本检查，再并行构建 Windows x64 NSIS、macOS x64 DMG 和 macOS arm64 DMG，最后统一创建或更新 GitHub Release。

## 签名

当前工作流明确构建未签名版本。Windows 可能显示 SmartScreen 提示；macOS 未签名且未公证，Gatekeeper 会阻止直接打开。未来启用签名时，证书和密码只能通过 GitHub Secrets 注入，禁止提交到仓库。

## 发布后

- 从 GitHub Release 下载并重新验证安装包。
- 检查版本号、文件名、图标和卸载入口。
- 将 Release Notes 中的用户可见变化同步回 `CHANGELOG.md`。
- 新建下一版本的 `[Unreleased]` 记录。
