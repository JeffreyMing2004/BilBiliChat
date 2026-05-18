# 项目工作总结

## 项目现状

本项目最初以 `LiveDanmu` 为核心进行开发，已经完成了：

- Tauri 2.x 桌面端基础能力
- Vue 3 + TypeScript + Vite 前端架构
- Pinia 状态管理
- Bilibili WebSocket 弹幕系统
- 普通弹幕 / 礼物 / SC 消息解析与展示
- 多直播间基础能力
- OBS 基础模式
- 多窗口基础能力

最近两轮工作的重点不是继续堆叠新功能，而是：

1. 把项目从“功能堆积型”重构为更可维护的工程架构
2. 为项目补齐 GitHub Actions 自动构建与自动发布能力

---

## 第一部分：架构稳定化重构

### 1. 建立 `core` 核心层

新增目录：

```text
src/core/
  connection/
  rooms/
  events/
  message/
  overlay/
  windows/
  logger/
```

核心目标：

- 收敛 WebSocket 生命周期
- 收敛房间管理
- 收敛多窗口通信
- 收敛消息转换与事件流
- 降低 `store`、组件、窗口之间的直接耦合

### 2. 建立唯一 WebSocket 管理中心

新增：

- `src/core/connection/ConnectionManager.ts`

已完成：

- 统一管理 WebSocket 创建
- 统一管理心跳
- 统一管理自动重连
- 统一管理断开与销毁
- 统一管理在线人数与连接状态更新
- 统一管理多房间连接会话

当前结果：

- 项目内真正创建 WebSocket 的职责被集中到 `ConnectionManager`
- 组件和 UI 层不再直接负责连接生命周期

### 3. 建立 RoomManager

新增：

- `src/core/rooms/RoomManager.ts`

已完成：

- 房间列表管理
- 当前激活房间管理
- 房间缓存与本地恢复
- 房间连接流程调度
- 最大消息缓存限制
- 房间消息派发
- 自动恢复连接处理
- 房间状态镜像同步

当前结果：

- 房间管理职责从 `store` 中剥离
- 房间相关业务逻辑统一进入 `RoomManager`

### 4. 建立统一事件中心

新增：

- `src/core/events/EventBus.ts`

已完成：

- 统一事件发布/订阅机制
- 收敛项目内核心数据流

当前事件流已经统一为：

```text
WebSocket -> EventBus -> RoomManager / Store -> UI
```

已收敛的核心事件包括：

- `MESSAGE`
- `CONNECT`
- `DISCONNECT`
- `RECONNECT`
- `ROOM_SWITCH`
- `POPULARITY_UPDATE`

### 5. 建立统一消息系统

新增：

- `src/core/message/MessageFactory.ts`

已完成：

- 原始 Bilibili WebSocket 数据统一转换
- UI 不再直接消费原始 JSON
- 系统通知统一构造

当前消息模型统一基于：

- `BaseMessage`
- `DanmuMessage`
- `GiftMessage`
- `SCMessage`
- `SystemMessage`

### 6. Overlay 职责独立

新增：

- `src/core/overlay/OverlayPresenter.ts`

已完成：

- Overlay 样式与展示状态独立封装
- Overlay 只处理展示相关职责

当前结果：

- Overlay 不再承担房间管理
- Overlay 不再承担 WebSocket 管理
- Overlay 不再承担业务逻辑

### 7. 多窗口通信收敛

新增：

- `src/core/windows/WindowBridge.ts`

已完成：

- 主窗口与弹幕窗口通信桥接
- 窗口事件广播统一入口
- 窗口打开 / 关闭能力统一封装

当前结果：

- 组件不再直接做跨窗口底层调用
- 多窗口同步能力被统一在 `WindowBridge`

### 8. 日志系统重构

新增：

- `src/core/logger/Logger.ts`

已完成：

- 统一日志输出入口
- 兼容旧日志调用方式
- 统一日志级别

当前支持的日志级别：

- `info`
- `warn`
- `error`
- `debug`

### 9. Store 瘦身

重点重构：

- `src/stores/danmu.ts`

已完成：

- `store` 从“业务中心”调整为“状态镜像层”
- 不再直接创建 WebSocket
- 不再直接发网络请求
- 不再直接承担多窗口同步

现在 `store` 主要负责：

- 响应式状态维护
- UI 自动滚动状态
- 日志列表订阅
- 音效等 UI 副作用触发

---

## 第二部分：服务层重构

新增目录：

```text
src/services/
```

新增文件：

- `src/services/roomService.ts`
- `src/services/streamerService.ts`
- `src/services/rankingService.ts`

已完成：

- 将房间号解析请求下沉到 `roomService`
- 将主播资料请求下沉到 `streamerService`
- 将贡献榜计算逻辑统一到 `rankingService`

当前结果：

- API 请求不再散落在多个业务文件中
- 服务层与核心层职责边界更清晰

---

## 第三部分：类型系统整理

新增：

- `src/types/websocket.ts`
- `src/types/events.ts`

并整理了已有：

- `src/types/room.ts`
- `src/types/message.ts`
- `src/types/danmu.ts`

已完成：

- WebSocket 类型定义统一
- 事件类型定义统一
- 房间类型定义统一
- 消息类型定义统一

当前结果：

- 项目类型层次更清晰
- 后续维护和扩展更稳定

---

## 第四部分：兼容层与迁移策略

为了避免一次性重构导致大面积回归，还做了兼容处理：

- `src/api/bilibili.ts` 兼容转发到 `services`
- `src/websocket/events.ts` 兼容转发到新的消息工厂
- `src/overlay/index.ts` 兼容转发到新的 overlay 核心实现
- `src/windows/shared/*` 保留现有调用方式，同时内部转向 `WindowBridge`
- `src/utils/logger.ts` 保留旧接口，同时内部转向新的 `Logger`

当前结果：

- 保持现有 UI 和窗口逻辑可继续运行
- 重构过程更平滑
- 降低一次性重构的风险

---

## 第五部分：运行稳定性处理

本轮还重点处理了若干稳定性问题：

- 修复自动恢复连接时的未处理 Promise 拒绝
- 将启动期房间自动恢复失败降级为可恢复告警
- 保持 `tauri dev` 可启动
- 保持 `lint` / `build` 可通过

当前已验证：

- `npm run lint`
- `npm run build`
- `npm run tauri dev`
- `cargo metadata --manifest-path src-tauri/Cargo.toml`

---

## 第六部分：GitHub Actions 自动构建与发布

新增文件：

- `.github/workflows/build.yml`

已完成：

- `push` 到 `main` 自动构建
- `workflow_dispatch` 手动触发构建
- 使用官方 `tauri-apps/tauri-action`
- 使用 `actions/setup-node`
- 使用 `dtolnay/rust-toolchain`
- 自动创建 GitHub Release
- 自动上传 Windows / macOS 安装包

工作流当前支持：

- `windows-latest`
- `macos-latest`
- Node.js `20`
- Rust `stable`

### Release 规则

已配置：

- Release 名称格式：`BilBiliChat v__VERSION__`
- 自动生成 Release Notes
- 自动上传构建产物

### Tauri 配置修正

已修正：

- `src-tauri/tauri.conf.json`

当前配置：

- `productName`: `BilBiliChat`
- `identifier`: `com.ming.bilbilichat`
- `bundle.targets`:
  - `dmg`
  - `app`
  - `nsis`
  - `msi`

### 包信息修正

已修正：

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`

当前结果：

- npm 包名统一为 `bilbilichat`
- Rust 包名统一为 `bilbilichat`
- Tauri 打包产品名统一为 `BilBiliChat`

---

## 第七部分：当前项目成果

到目前为止，项目已经从一个“逐步堆功能的桌面工具”重构为一个更清晰的工程化项目。

当前已经具备：

- 更稳定的连接管理
- 更清晰的房间管理中心
- 更统一的消息模型
- 更统一的事件流
- 更清晰的多窗口通信边界
- 更干净的 `store` 职责
- 更规范的服务层
- 更规范的日志系统
- 可直接运行的 GitHub Actions 自动构建与自动发布流程

---

## 第八部分：当前仍可继续优化的方向

虽然本轮目标已经完成，但从长期维护角度看，后续仍然可以继续做这些纯工程化优化：

- 继续移除旧兼容层
- 收敛 import 路径和命名风格
- 优化前端大 chunk 体积
- 继续拆分窗口 UI 与核心逻辑
- 补充更系统的单元测试 / 集成测试
- 增加签名与正式发布流程

---

## 总结

这次工作的重点不是新增业务功能，而是：

**把项目从“功能堆积型项目”重构为“更稳定、更清晰、更适合长期维护的桌面客户端工程”。**

同时还补齐了：

**GitHub Actions + Tauri 自动构建与自动发布系统。**

现在项目已经具备：

- 更清晰的工程结构
- 更稳定的运行基础
- 更规范的发布流程
- 更适合后续继续演进的架构基础
