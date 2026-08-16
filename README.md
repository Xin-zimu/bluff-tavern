# 诡牌酒馆 / Bluff Tavern

手机浏览器优先的原创多人诈唬派对游戏。当前版本为 **V1.5 手机体验版**：支持 2–4 人服务器权威牌局、基础断线恢复、PWA 安装与移动端全屏游玩。

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

生产构建会注册 PWA Service Worker。Android Chrome 可通过浏览器的“安装应用”入口安装；iPhone Safari 可用分享菜单的“添加到主屏幕”。游戏牌桌提供全屏按钮，竖屏手机会提示横屏；低性能设备会自动关闭非必要动画。

## 质量命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

真实多人联机测试在 `apps/server/tests/multiplayer.test.ts`，会启动临时服务并连接四个真实 Socket.IO 客户端及真实断线恢复客户端。运行中的开发服务还可执行 `pnpm --filter @bluff-tavern/server exec tsx scripts/live-reconnect-v1.0.ts`，通过 Vite 的 Socket.IO 反代验证游戏内断线后恢复同一座位。

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
- 牌局或结算阶段的意外断线会保留座位；浏览器用本地 `sessionToken` 在重新打开、网络恢复或从后台回到前台后恢复同一玩家身份。Token 只存浏览器本机、不写日志、不会出现在公开房间状态中。
- 房主离开后会转移给最早入席的剩余玩家；修改最大人数会取消所有人的准备状态。
- 内存状态在服务器重启后仍会清空；观战、聊天、数据库和多实例扩展尚未实现。

## 部署

V1.0 提供最小 Nginx 与 systemd 模板：[`deploy/nginx/bluff-tavern.conf`](deploy/nginx/bluff-tavern.conf)、[`deploy/systemd/bluff-tavern.service`](deploy/systemd/bluff-tavern.service) 和 [`scripts/build-release.sh`](scripts/build-release.sh)。部署前必须替换示例域名并配置 HTTPS；具体步骤见 [`docs/deployment.md`](docs/deployment.md)。

详见 [`docs/architecture.md`](docs/architecture.md)、[`docs/protocol.md`](docs/protocol.md) 与 [`docs/V1.5-acceptance.md`](docs/V1.5-acceptance.md)。
