# OpenLive Overlay 使用

## 当前增强点
针对 OpenLive 官方事件，BilBiliChat Overlay 已补充：
- 用户等级显示
- 勋章显示
- Guard 标识显示
- SC 颜色强化
- Like 动效高亮
- Entry 事件视觉区分

## 展示来源
Overlay 元信息来自统一消息模型：
- `userLevel`
- `medalName`
- `medalLevel`
- `guardLabel`
- `likeCount`
- `provider`

## OBS 使用建议
1. 打开 `DanmuWindow`。
2. 开启 `OBS 模式`。
3. 在 OBS 中使用透明窗口捕获。
4. 根据直播场景调整字体、描边、阴影、透明度和动画速度。

## 建议搭配
- 主播互动型直播：保留 `Like`、`Entry`、`Guard` 展示
- 游戏直播：提高 `SC` 和礼物高亮强度
- 长时间挂机场景：开启自动重连与 `DebugWindow` 监控

## 故障排查
如果 Overlay 没有显示 OpenLive 强化信息：
- 检查当前 Provider 是否为 `open-live`
- 检查消息是否来自官方事件而不是 Public WS
- 检查 `DebugWindow` 中原始 JSON 是否含有勋章、等级、Guard 字段
