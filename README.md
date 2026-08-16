# 诡牌酒馆 / Bluff Tavern

手机浏览器优先的原创多人诈唬派对游戏。当前版本为 **V0.2 房间系统**：支持创建与房间码加入、实时玩家列表、房主、准备、最大人数配置和踢人。尚未进入牌局或断线重连。

## 技术栈

- Web：React 19、TypeScript、Vite、Zustand、Socket.IO Client
- Server：Node.js、Fastify、Socket.IO、Zod、Pino
- Shared：共享事件类型、公开状态类型、Zod 输入校验
- Quality：pnpm workspace、ESLint、Prettier、Vitest、TypeScript strict

## 本地运行

需要 Node.js 22+、pnpm 11+。

```bash
pnpm install
cp .env.example .env
pnpm dev
```

打开 `http://localhost:5173`。服务端默认监听 `127.0.0.1:3001`，健康检查为 `http://127.0.0.1:3001/health`。默认 Socket 地址为网页同源的 `/socket.io/`：Vite 开发服务器会反代到 3001，生产环境应由 Nginx 做同样的反代，因此无需暴露 Node 端口。临时直连时可设置 `VITE_SERVER_URL`；外部设备开发调试时设置 `WEB_HOST=0.0.0.0` 与 `HOST=0.0.0.0`。不要将开发端口长期直接暴露公网。

## 质量命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

真实多人联机测试在 `apps/server/tests/multiplayer.test.ts`，会启动临时服务并连接四个真实 Socket.IO 客户端，覆盖房主权限、准备、配置与踢人。

## 目录

```text
apps/web/                 React 网页客户端
apps/server/              权威房间与 WebSocket 服务端
packages/shared/          共享协议、校验、常量和公开类型
assets/                   按 ART_ASSETS_PLAN.md 组织的正式资源槽位
docs/                     架构、协议与验收记录
```

美术当前仅使用原创 CSS 几何占位和计划色板，没有原游戏或其他第三方版权资产。正式素材的命名、格式与替换方式见 `assets/README.md`。

## 当前边界

- 状态仅在内存中；服务重启会清空房间。
- 当前断线会立即离开房间，不是断线重连。session token 与宽限期将在后续阶段实现。
- 房主离开后会转移给最早入席的剩余玩家；修改最大人数会取消所有人的准备状态。
- 尚无牌局、观战、聊天、数据库或公网部署配置。

详见 [`docs/architecture.md`](docs/architecture.md)、[`docs/protocol.md`](docs/protocol.md) 与 [`docs/V0.2-acceptance.md`](docs/V0.2-acceptance.md)。
