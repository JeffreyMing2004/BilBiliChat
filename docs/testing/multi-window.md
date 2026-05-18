# 多窗口测试

## 目标
验证 `Main / Settings / Login / Danmu / Overlay Studio / Crash` 多窗口在公开 Beta 阶段的稳定性。

## 用例
- 每个窗口可独立打开与关闭
- 重复打开同一窗口时正确聚焦而非重复创建
- 拖拽、最小化、最大化、恢复
- 关闭主窗口后的托盘行为
- 窗口状态恢复

## 平台重点
- macOS：Traffic Lights、原生标题栏、Command + W、双击标题栏缩放
- Windows：最小化、最大化、阴影、任务栏行为

## 通过标准
- 无窗口僵死
- 无重复实例泄漏
- 无关闭失败或焦点错乱
