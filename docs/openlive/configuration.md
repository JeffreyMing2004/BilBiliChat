# OpenLive 配置教程

## 1. 申请 OpenLive 能力
1. 登录 [Bilibili 开放平台](https://open.bilibili.com/)。
2. 创建或进入你的 OpenLive 应用。
3. 获取以下官方参数：
   - `AppId`
   - `AccessKeyId`
   - `AccessKeySecret`
4. 在平台后台生成房间对应的身份码。

## 2. 配置本地环境变量
在本地开发环境中配置：

```bash
VITE_BILIBILI_OPENLIVE_APP_ID=
VITE_BILIBILI_OPENLIVE_ACCESS_KEY_ID=
VITE_BILIBILI_OPENLIVE_ACCESS_KEY_SECRET=
VITE_BILIBILI_OPENLIVE_API_BASE=https://live-open.biliapi.com
```

## 3. 启动项目

```bash
npm install
npm run tauri dev
```

## 4. 打开 OpenLive 设置
1. 进入设置页。
2. 将“直播连接源”切换到 `OpenLive`。
3. 输入身份码。
4. 点击“应用身份码并重连”。

## 5. 验证状态
以下区域应能看到官方状态：
- 设置页 `OpenLiveStatusPanel`
- `DebugWindow` 协议日志
- `DebugWindow` 原始事件 JSON
- 当前 Provider 状态与 session 信息

## 6. 正常连接链路
BilBiliChat 的 OpenLive 标准流程为：
1. 调用 `/v2/app/start`
2. 提取 `game_id`、主播信息、`websocket_info`
3. 建立官方 WebSocket
4. 发送认证包
5. 启动 WebSocket 心跳与 HTTP `/v2/app/heartbeat`
6. 退出或重启时调用 `/v2/app/end`
