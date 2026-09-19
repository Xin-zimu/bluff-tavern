# V6.6 Socket 协议

类型真源位于 `packages/shared/src/protocol/index.ts`。

## Client → Server

- `room:create`：`{ nickname }`，返回 `{ room, playerId, sessionToken }`。
- `room:join`：`{ nickname, roomCode }`，返回 `{ room, playerId, sessionToken }`。
- `room:leave`：`{ roomCode }`，返回 `null`。
- `room:ready`：`{ roomCode, ready, requestId }`，切换自己的准备状态。
- `room:updateSettings`：`{ roomCode, maxPlayers, requestId }`，仅房主，人数范围 2–8。
- `room:kick`：`{ roomCode, targetPlayerId, requestId }`，仅房主，不能踢出自己。
- `game:start`：`{ roomCode, requestId }`，仅房主；至少两人且全员准备。
- `game:playCards`：`{ roomCode, cardIndexes, requestId }`，仅当前回合玩家；1–3 个不重复手牌索引。
- `game:challenge`：`{ roomCode, requestId }`，仅质疑窗口中的当前玩家。
- `game:restart`：`{ roomCode, requestId }`，兼容旧客户端，仅 GAME_OVER 后的房主直接开新局。
- `game:returnToRoom`：`{ roomCode, requestId }`，GAME_OVER 后返回房间等待区，清理上一局快照并重置准备状态。
- `session:resume`：`{ sessionToken }`，恢复牌局或结算中断线玩家的原座位，返回新的公开房间快照及原身份。

所有 ack 均为 `{ ok: true, data }` 或 `{ ok: false, error: { code, message } }`。

## Server → Client

- `room:state`：完整公开 `RoomView`，在加入、离开、断线和恢复后广播；每名玩家含公开的 `isConnected` 状态。
- `room:closed`：房间已关闭（当前最后一人离开即在内存回收）。
- `room:playerJoined` / `room:playerLeft`：增量入席与离开事件。
- `room:kicked`：仅发给被房主移出的客户端。
- `game:state` / `game:turnStarted`：按接收玩家过滤的状态，包含其自己的手牌与所有玩家手牌数。
- `game:cardsPlayed`：仅包含出牌者与公开数量，不含真实牌面；暗注夜翻牌前数量为 `null`。
- `game:challengeStarted` / `game:challengeResult`：服务器统一广播质疑者、失败者和翻开的上一手牌。
- `game:punishmentStarted` / `game:punishmentResult` / `game:playerEliminated` / `game:over`：轮盘、淘汰和胜负事件。

房间码统一大写、六位，字符集为 `23456789ABCDEFGHJKMNPQRSTUVWXYZ`。会改变房间状态的命令要求 UUID `requestId`，同一 socket 重复提交会返回首次结果。`sessionToken` 为服务端用密码学随机源生成的私有凭据，只在创建/加入/恢复的 ack 内返回，客户端保存于本机 localStorage，严禁记录、展示或放入公开状态。
