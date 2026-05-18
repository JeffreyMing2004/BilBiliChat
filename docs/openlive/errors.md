# 常见错误

## 环境变量缺失
现象：连接开始后立即报错，提示缺少 `AppId`、`AccessKeyId` 或 `AccessKeySecret`。

处理：检查以下变量是否存在且来自同一个 OpenLive 应用：
- `VITE_BILIBILI_OPENLIVE_APP_ID`
- `VITE_BILIBILI_OPENLIVE_ACCESS_KEY_ID`
- `VITE_BILIBILI_OPENLIVE_ACCESS_KEY_SECRET`

## 身份码无效
现象：`/v2/app/start` 返回错误，或状态面板一直停留在认证失败。

处理：
- 重新确认身份码是否复制完整。
- 确认身份码与当前主播/应用是否匹配。
- 在设置页重新粘贴并执行“应用身份码并重连”。

## 官方签名错误
现象：请求被官方接口拒绝，日志中出现签名或认证失败。

处理：
- 检查 `AccessKeyId` 与 `AccessKeySecret` 是否配对。
- 确认本地时间没有严重偏差。
- 在 `DebugWindow` 查看协议日志中的错误信息。

## WebSocket 认证失败
现象：长连接建立后很快断开，`OpenLiveStatusPanel` 显示未通过官方认证。

处理：
- 检查 `/start` 返回的 `auth_body` 与 `wss_link` 是否成功下发。
- 检查网络代理或安全软件是否拦截官方域名。
- 确认 session 未在其他客户端提前释放。

## 重连次数持续增长
现象：状态面板中的 reconnect 次数不断增加。

处理：
- 打开 `DebugWindow` 查看心跳和 reconnect 日志。
- 检查主播是否仍处于直播中。
- 检查本地网络稳定性。
- 达到上限后，BilBiliChat 会建议回退到 `Public WS`。
