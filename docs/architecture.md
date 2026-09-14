# V1.0 架构

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
- `rooms/room-store.ts`：房间聚合根，负责容量、昵称冲突、创建者、准备状态、房主授权、踢人与生命周期。
- `socket/`：解析客户端意图、更新 socket membership、广播公开快照。
- `game/GameService`：独立服务端牌局状态机；游戏真实手牌从不进入 `RoomView`，按 viewer 生成 `GameView`。
- `GameService` 在 V0.4 保存上一手真实出牌，仅在质疑结果时公开；`CHALLENGE_WINDOW` 和 `ROUND_RESULT` 阻止重复或并发判定。
- V0.5 将轮盘弹位与存活集合纳入同一服务端游戏聚合；客户端仅获得惩罚结果，不能指定命中与否或胜负。
- 未来的 `game/`、`auth/`、`persistence/` 目录在需要时添加，避免空抽象。

## 后续扩展点

- 房主/准备：已在 V0.2 实现；`RoomStore` 校验 `hostPlayerId` 与大厅状态，配置变更会统一重置准备状态。
- 牌局：独立 `GameStateMachine`，房间只持有状态机引用，所有判定留在服务端。
- 断线重连：`sessionToken` 由 `randomBytes(32)` 生成，连接标识与玩家身份分离。大厅断线立即释放座位；`PLAYING` 与 `GAME_OVER` 状态保留座位并标记 `isConnected: false`，新的 socket 用 token 恢复原玩家。token 不会进入 `RoomView`、日志或仓库。宽限计时器、后台恢复和网络体验将在 V1.5 完成。
- 多实例：把房间仓储迁移到 Redis，并启用 Socket.IO adapter。
- 幂等性：关键牌局命令加入 `requestId` 去重缓存；V0.1 房间创建/加入尚不持久化请求。

## 响应式与美术

布局以 320px 起步，桌面使用双列，窄屏改为单列，并处理 `env(safe-area-inset-*)`、横屏低高度和 reduced-motion。V1.5 在竖屏显示横屏提示，牌桌提供标准 Fullscreen API 入口；触摸卡牌使用 `touch-action: manipulation`、禁用文字选择和 tap highlight 以降低误触。色彩取自 `ART_ASSETS_PLAN.md`；当前所有视觉均为原创 CSS/SVG 占位，正式资源统一进入根 `assets/`，优化后复制/构建到 Web public 资源。

## PWA 与恢复

`manifest.webmanifest` 声明 standalone 应用，原创 SVG 酒馆卡牌图标位于 `apps/web/public/icons/`。生产构建注册最小同源 Service Worker：安装时缓存应用壳，访问过的同源 GET 资源会写入同一缓存；Socket.IO 不会被缓存。Socket.IO 使用有限退避的自动重连，`connect`、浏览器 online 和页面恢复可调用 `session:resume`，因此新 socket 会重新绑定服务端原玩家座位。`navigator.onLine` 与 Socket 状态分别呈现，避免把“有网络但服务端重连中”误显示为正常。

无法可靠读取跨平台的电池省电模式，因此 V1.5 使用 `hardwareConcurrency` / `deviceMemory` 的保守阈值禁用可选动画，并尊重 `prefers-reduced-motion`；不影响玩法与服务端状态。

## V2.0 大酒桌

`CARDS_PER_RANK_BY_PLAYER_COUNT` 和 `REVOLVER_BULLETS_BY_PLAYER_COUNT` 是唯一的人数规则来源：2–4 人使用 20 张/一发，5–6 人使用 30 张/两发。房间的 `gameMode` 是服务端公开设置，开局后复制到私有游戏状态；Socket 层按 `turnDurationSeconds` 安排权威计时器，超时调用 `GameService.autoPlay`，客户端不能指定自动出牌牌面。计时器会在任何正常操作后重置且 `unref`，不会阻止服务关闭。

## V2.5 八人同步

7–8 人沿用同一权威状态机，但选取 40 张牌和两发实弹配置。客户端根据 viewer 的 playerId 对公开座位做相对排序，并将自己作为最后一个座位；八人网格将其跨两列放在底部中央，窄屏退化为一列。服务端仍按每位 viewer 单独发放 `GameView`，所以八人同步不会泄漏任何其他玩家的真实手牌。

## V7.0 扩展开关

`RoomSettings.v7` 在大厅由房主权限保护，开局时复制到 `InternalGame` 并在本局冻结。三个扩展开关分别控制道具、酒馆事件和角色能力，默认全部关闭；Classic 和 Quick 仍是唯一可开局模式。旧客户端不传 `settings.v7` 时，Socket 层按现有值合并，避免意外开启新玩法。

## V7.0 内容系统

角色选择在大厅由 `RoomStore` 校验唯一性，公开房间快照仅含 `characterId`。每局游戏为每名玩家建立独立道具库存，`GameView.items` 只发送 viewer 自己的库存；`game:useItem` 必须带 requestId 并由 `GameService` 消耗。V7.0 首批道具只开放望远镜、旧怀表和酒杯，不开放换别人牌、偷看别人牌或改写惩罚结果。

酒馆事件只在 `tavernEventsEnabled` 开启时由服务器每轮小概率抽取，事件写入公开 `GameView.tavernEvent`。快速夜缩短本轮权威回合时间；烛火摇曳和双倍危机只改变演出时长和视觉压力，不改变诈唬判定或实弹数量。

角色能力只在 `characterAbilitiesEnabled` 开启时触发，效果写入对应 viewer 的 `GameView.abilityEffect` 私有快照。V7.0 第一版只做私有提示、轻量回合延时和道具协同，不提供主动技能按钮、技能响应窗口、他人手牌窥视或惩罚抵消。

## V4.0 表现层

原创 `bg_01_tavern_v1.png` 同时保存于 `assets/backgrounds/` 和 Web public 资源目录，生产构建引用 `/assets/backgrounds/`，不会依赖生成工具临时路径。CSS 动画只作用于公开表现状态，不能改变游戏规则；低性能标记、`prefers-reduced-motion` 和窄屏背景固定关闭保证中端手机可降级。

## V4.5 结算与社交

`GameService` 从服务端状态生成 `GameSummary`，客户端仅在 `GAME_OVER` 读取该快照。匿名 localStorage 以当前 playerId 聚合局数、胜场和质疑表现，并用组件内去重防止同一快照重复计数。分享只使用浏览器原生 Web Share/Clipboard 文本，社交输入保持固定表情枚举，避免自由文本审核与存储风险。

## 安全与运维边界

输入由 Zod 校验；错误向用户返回中文稳定消息；日志不记录 token 或隐私数据。`.env` 被忽略，仅提交无秘密的示例。V1.0 提供 Nginx 反代与 systemd 服务模板，Node 默认绑定回环地址并由 Nginx 暴露同源网页与 `/socket.io/`。HTTPS、限流、Redis、多实例与持久化仍属后续版本；部署前必须自行配置证书及域名。
