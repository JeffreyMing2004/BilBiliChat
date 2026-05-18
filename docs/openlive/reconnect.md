# Reconnect 机制

## 设计目标
BilBiliChat 的 OpenLive 重连机制目标是“可恢复，但不失控”。

## 当前策略
- 仅在 `autoReconnect` 启用时自动恢复
- 重连次数有上限，避免死循环
- 延迟按阶梯递增，避免短时间内疯狂重试
- 超过上限时给出 fallback 建议
- 重连前会释放旧的 WebSocket / session 资源

## 恢复过程
1. 记录断线原因
2. 标记会话为 `recovering`
3. 清理旧 socket、auth timeout、heartbeat timer
4. 重新调用 `/v2/app/start`
5. 用新的 `game_id` 和 WebSocket 参数重建连接
6. 认证通过后清零 reconnect 计数并恢复正常心跳

## 稳定性保护
- 防止 session 泄漏
- 防止重复 listener
- 防止旧 socket 未释放
- 防止 reconnect 死循环
- Provider 失败时支持 fallback 到 `PublicLiveProvider`

## 调试建议
在 `DebugWindow` 中重点观察：
- 协议日志里的 `heartbeat`
- 协议日志里的 `reconnect`
- 状态面板里的 `sessionStatus`
- `token` 剩余时间和 `WebSocket` 延迟
