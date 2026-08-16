# V0.2 Socket 协议

类型真源位于 `packages/shared/src/protocol/index.ts`。

## Client → Server

- `room:create`：`{ nickname }`，返回 `{ room, playerId }`。
- `room:join`：`{ nickname, roomCode }`，返回 `{ room, playerId }`。
- `room:leave`：`{ roomCode }`，返回 `null`。
- `room:ready`：`{ roomCode, ready, requestId }`，切换自己的准备状态。
- `room:updateSettings`：`{ roomCode, maxPlayers, requestId }`，仅房主，人数范围 2–8。
- `room:kick`：`{ roomCode, targetPlayerId, requestId }`，仅房主，不能踢出自己。

所有 ack 均为 `{ ok: true, data }` 或 `{ ok: false, error: { code, message } }`。

## Server → Client

- `room:state`：完整公开 `RoomView`，在加入、离开或断线后广播。
- `room:closed`：房间已关闭（当前最后一人离开即在内存回收）。
- `room:playerJoined` / `room:playerLeft`：增量入席与离开事件。
- `room:kicked`：仅发给被房主移出的客户端。

房间码统一大写、六位，字符集为 `23456789ABCDEFGHJKMNPQRSTUVWXYZ`。会改变房间状态的 V0.2 命令要求 UUID `requestId`，同一 socket 重复提交会返回首次结果。V0.2 不提供 `session:resume` 或 game 事件。
