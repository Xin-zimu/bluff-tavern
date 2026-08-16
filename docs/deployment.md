# V1.0 部署

V1.0 的部署模板将网页与 Socket.IO 保持同源：Nginx 提供 Vite 构建产物并将 `/socket.io/` 代理到本机 Node 服务。不要直接把 3001 暴露给公网。

1. 将源码部署到 `/srv/bluff-tavern`（或修改模板中的目录）。
2. 在该目录运行 `scripts/build-release.sh`，产物是 `apps/web/dist` 与 `apps/server/dist`。
3. 按实际域名替换 `deploy/systemd/bluff-tavern.service` 中的 `CLIENT_ORIGIN`，复制到 systemd 目录并启用服务。
4. 按实际域名、网站根目录和 HTTPS 证书调整 `deploy/nginx/bluff-tavern.conf`；保留 WebSocket Upgrade 相关头。
5. 从 HTTPS 域名打开页面，确认浏览器网络面板中的 `/socket.io/` 是 `101 Switching Protocols`，再执行一局两人牌局与断线恢复。

模板不包含任何服务器凭据、私钥或真实域名。证书申请、安全组和防火墙由部署者管理，不能把 `.env` 或私密值提交到仓库。
