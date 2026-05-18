# OpenLive 文档

BilBiliChat 已支持 Bilibili OpenLive 官方接入链路，覆盖身份码、官方认证、长连接、心跳、重连、状态监控与 Overlay 展示。

## 文档目录
- [OpenLive 配置教程](./configuration.md)
- [身份码教程](./identity-code.md)
- [常见错误](./errors.md)
- [Reconnect 机制](./reconnect.md)
- [Overlay 使用](./overlay.md)

## 适用范围
- `src/providers/openlive/` 官方 Provider 实现
- `src/providers/openlive/parser/` 官方事件解析
- `src/modules/openlive/` 设置页与状态面板
- `DebugWindow` OpenLive 调试面板
- `DanmuWindow` / `OverlayRenderer` OpenLive 显示增强

## 当前支持
- 身份码接入与本地保存
- `/v2/app/start`、`/v2/app/heartbeat`、`/v2/app/end`
- 官方 WebSocket 认证、心跳、断线重连
- `LIVE_OPEN_PLATFORM_DM`
- `SEND_GIFT`
- `SUPER_CHAT_MESSAGE`
- `INTERACT_WORD`
- `LIKE_INFO_V3_CLICK`
- `ENTRY_EFFECT`
- `GUARD_BUY`

## 联调建议
1. 先完成 [configuration.md](./configuration.md) 的环境变量配置。
2. 再在设置页切换到 `OpenLive` 并填入身份码。
3. 打开 `DebugWindow` 观察认证、心跳、重连和原始 JSON。
4. 使用 [errors.md](./errors.md) 排查环境变量、签名或身份码问题。
