# V0.1 架构

## 技术选择

V0.1 采用轻量 TypeScript monorepo。React 负责菜单和大厅，Zustand 只保存客户端可见会话；Fastify 提供健康检查并承载 Socket.IO；Zod 与 TypeScript 事件接口位于共享包，防止前后端协议漂移。PixiJS、音频、数据库和 Redis 此阶段没有真实用途，因此按计划不提前引入。

## 边界与数据流

```text
React screen
  → Socket.IO intent (room:create / join / leave)
  → Zod validation
  → RoomStore (authoritative in-memory state)
  → sanitized RoomView
  → room:state broadcast
  → Zustand → React render
```

服务端的 `InternalPlayer` 含 `socketId`，但序列化时显式构造 `PlayerView`，不会把连接标识或未来私有数据发送给浏览器。`RoomStore` 与 Socket 传输层分开，后续可在不改客户端协议的前提下增加房主命令、准备状态、牌局状态机或持久化实现。

## 服务端模块

- `config/`：环境配置与启动边界。
- `rooms/room-code.ts`：可注入随机源的房间码生成器；方便固定随机单测。
- `rooms/room-store.ts`：房间聚合根，负责容量、昵称冲突、创建者与生命周期。
- `socket/`：解析客户端意图、更新 socket membership、广播公开快照。
- 未来的 `game/`、`auth/`、`persistence/` 目录在需要时添加，避免空抽象。

## 后续扩展点

- 房主/准备：在共享协议新增命令，`RoomStore` 校验 `hostPlayerId` 和大厅状态。
- 牌局：独立 `GameStateMachine`，房间只持有状态机引用，所有判定留在服务端。
- 断线重连：引入密码学随机 `sessionToken`、连接与玩家身份分离、宽限计时器；当前明确采用立即离开语义。
- 多实例：把房间仓储迁移到 Redis，并启用 Socket.IO adapter。
- 幂等性：关键牌局命令加入 `requestId` 去重缓存；V0.1 房间创建/加入尚不持久化请求。

## 响应式与美术

布局以 320px 起步，桌面使用双列，窄屏改为单列，并处理 `env(safe-area-inset-*)`、横屏低高度和 reduced-motion。色彩取自 `ART_ASSETS_PLAN.md`；当前所有视觉均为原创 CSS 占位，正式资源统一进入根 `assets/`，优化后复制/构建到 Web public 资源。

## 安全与运维边界

输入由 Zod 校验；错误向用户返回中文稳定消息；日志不记录 token 或隐私数据。`.env` 被忽略，仅提交无秘密的示例。生产 HTTPS、限流、Redis、Nginx 和 systemd 属后续版本，本阶段不伪装实现。
