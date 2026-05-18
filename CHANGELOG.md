# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Beta 用户测试文档、Issue / PR / Discussion 模板体系。
- Release 工件与 updater manifest 自动化脚本。

### Changed
- Release 流程收敛为 `v0.1.0-beta` 正式公开测试版发布节奏。

### Fixed
- 持续修复多窗口、macOS 原生窗口行为与更新提示细节问题。
- 修复 Tauri/WebKit 环境下房间初始化请求偶发只报 `Load failed` 的问题；房间号解析与主播资料加载现在会自动重试，并输出可定位的网络错误说明。
- 修复 GitHub Actions 仅在 `tag/workflow_dispatch` 才触发，导致普通 `push/PR` 不自动编译的问题；现在提交代码会自动执行 lint 与 build，发布链路仍仅在正式发布时运行。
- 修复开发态前端日志只停留在 WebView 控制台的问题；现在会同步桥接到 Tauri 终端，便于直接在 `tauri dev` 里观察运行日志。

### Changed
- GitHub Actions 发布矩阵扩展为 Windows、macOS、Ubuntu，并额外上传各平台未打包原始二进制归档；Ubuntu 同时产出 `deb` 与 `AppImage` 安装包。

### Performance
- 持续优化 Overlay 长时间运行与消息渲染稳定性。

### Architecture
- 将发布、崩溃报告和测试文档纳入公开 Beta 基础设施。

## [0.1.0-beta] - 2026-05-18
### Added
- 基于 `Tauri 2.x + Vue 3 + TypeScript + Rust` 的桌面端基础工程。
- 多窗口架构：`MainWindow`、`DanmuWindow`、`SettingsWindow`、`LoginWindow`、`DebugWindow`、`CrashWindow`、`OverlayStudioWindow`。
- `OBS Overlay` 渲染链路，支持透明背景、样式变量、礼物与醒目留言强化展示。
- `Overlay Studio` 独立窗口，支持实时预览、模板预设、样式调节与导入导出。
- `PluginManager` 与 `Plugin SDK` 基础，支持示例插件、动态加载与热重载基础。
- `OpenLiveProvider` 初版能力，包含官方身份码、生命周期接口、心跳与错误处理骨架。
- OAuth 登录基础与多窗口登录工作流。
- `GitHub Actions` 自动构建与 `GitHub Release` 自动发布基础。
- `CrashReporter` 与 `Crash Center`，支持运行时、窗口、WebSocket、Overlay 异常聚合。
- 专业级 `README`、品牌素材、Release 模板与路线图文档。

### Changed
- 设置系统升级为产品化配置中心，统一接入 Overlay、OpenLive、Updater 与配置导入导出。
- macOS 普通窗口恢复原生标题栏与 Traffic Lights，OBS Overlay 保持独立无边框模式。
- 主控制台与主题系统统一为 `OBS + Bilibili + Neon` 深色科技风。
- Updater 状态模型升级，支持渠道、后台下载与安装分离。

### Fixed
- 修复开发环境 `cargo` 缺失导致的 `tauri dev` 启动失败问题。
- 修复窗口关闭权限、销毁权限和多窗口关闭链路不稳定问题。
- 修复 macOS WebKit `WebsiteData` 权限警告带来的开发期噪音。
- 修复 Overlay Studio 模板与样式编辑过程中的类型和 lint 问题。
- 修复运行时异常无法聚合查看的问题。

### Performance
- Overlay 渲染循环加入队列控制、节点释放与性能监控。
- WebSocket 解包补充 `zlib/deflate` 兼容处理。
- 稳定性监控接入 `RecoveryManager` 与 `PerformanceMonitor`。

### Architecture
- 引入 `LiveProvider` 抽象，统一 `PublicLiveProvider` 与 `OpenLiveProvider`。
- 引入 `ConnectionManager`、`RoomManager`、`EventBus`、`MessageFactory` 等核心链路。
- 完成 `Design System`、`OverlayStyleEngine` 与主题引擎基础。
- 完成 `CrashReporter`、`Updater`、`Plugin SDK`、`Sync` 等产品基础模块骨架。
