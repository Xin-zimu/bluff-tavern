# 诡牌酒馆 / Bluff Tavern

手机浏览器优先的原创多人诈唬派对游戏。当前版本为 **V6.6**：2–8 人服务器权威诈唬核心循环，按 Match、Round、Turn 状态机推进，含完整房间返回流程、目标牌 HUD、当前玩家聚焦、分阶段质疑、真实翻牌、判定、独立左轮、淘汰、胜利、重连恢复、规则面板、异常兜底、原创演出资产、PWA 与部署资产。

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

真实多人联机测试在 `apps/server/tests/multiplayer.test.ts`，会启动临时服务并连接真实 Socket.IO 客户端，覆盖 8 人开局、断线恢复、三客户端 phaseSequence 同步和惩罚结果延迟公开。运行中的开发服务还可执行 `pnpm --filter @bluff-tavern/server exec tsx scripts/live-reconnect-v1.0.ts`，通过 Vite 的 Socket.IO 反代验证游戏内断线后恢复同一座位。

## 目录

```text
apps/web/                 React 网页客户端
apps/server/              权威房间与 WebSocket 服务端
packages/shared/          共享协议、校验、常量和公开类型
assets/                   按 ART_ASSETS_PLAN.md 组织的正式资源槽位
docs/                     架构、协议与验收记录
```

美术当前使用原创酒馆、角色、卡牌和 UI 资源，没有原游戏或其他第三方版权资产。正式素材的命名、格式与替换方式见 `assets/README.md`。

## 当前边界

- 状态仅在内存中；服务重启会清空房间。
- 牌局或结算阶段的意外断线会保留座位；浏览器用本地 `sessionToken` 在重新打开、网络恢复或从后台回到前台后恢复同一玩家身份。Token 只存浏览器本机、不写日志、不会出现在公开房间状态中。
- V6 只开放 Classic 和 Quick；Party、Custom、随机事件、道具、角色技能和经济系统保留到 V7。
- 房主离开后会转移给最早入席的剩余玩家；修改最大人数会取消所有人的准备状态。
- 内存状态在服务器重启后仍会清空；聊天、数据库和多实例扩展尚未实现。

## 部署

V1.0 提供最小 Nginx 与 systemd 模板：[`deploy/nginx/bluff-tavern.conf`](deploy/nginx/bluff-tavern.conf)、[`deploy/systemd/bluff-tavern.service`](deploy/systemd/bluff-tavern.service) 和 [`scripts/build-release.sh`](scripts/build-release.sh)。部署前必须替换示例域名并配置 HTTPS；具体步骤见 [`docs/deployment.md`](docs/deployment.md)。

详见 [`docs/GAME_RULES_V6.md`](docs/GAME_RULES_V6.md)、[`docs/GAME_STATE_MACHINE_V6.md`](docs/GAME_STATE_MACHINE_V6.md)、[`docs/GAME_PROTOCOL_V6.md`](docs/GAME_PROTOCOL_V6.md)、[`docs/GAME_ANIMATION_V6.md`](docs/GAME_ANIMATION_V6.md) 与 [`docs/V6.6-acceptance.md`](docs/V6.6-acceptance.md)。
