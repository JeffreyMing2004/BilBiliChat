# BilBiliChat Beta Testing

公开 Beta 阶段的测试重点不是继续扩展功能，而是验证：

- 正式 Release 是否可安装、可更新、可回滚预留
- 多窗口在 macOS / Windows 上是否稳定
- OBS Overlay 是否可长时间运行
- OpenLive 基础链路是否可实际联调
- Crash Report 是否能在出现异常时快速导出

## 测试文档
- [Overlay 长时间测试](./overlay-long-run.md)
- [OBS 测试](./obs.md)
- [多窗口测试](./multi-window.md)
- [OpenLive 测试](./openlive.md)
- [macOS 测试](./macos.md)
- [Windows 测试](./windows.md)

## Beta 通过标准
- `npm run lint` 通过
- `npm run build` 通过
- `npm run tauri dev` 可正常运行
- 主窗口、设置窗口、登录窗口、Overlay Studio、DanmuWindow、Crash Center 可正常打开关闭
- Updater UI 可完成检查更新、后台下载、安装提示与日志显示
