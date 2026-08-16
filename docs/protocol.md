# V0.1 Socket 协议

类型真源位于 `packages/shared/src/protocol/index.ts`。

## Client → Server

- `room:create`：`{ nickname }`，返回 `{ room, playerId }`。
- `room:join`：`{ nickname, roomCode }`，返回 `{ room, playerId }`。
- `room:leave`：`{ roomCode }`，返回 `null`。

所有 ack 均为 `{ ok: true, data }` 或 `{ ok: false, error: { code, message } }`。

## Server → Client

- `room:state`：完整公开 `RoomView`，在加入、离开或断线后广播。
- `room:closed`：房间已关闭（当前最后一人离开即在内存回收）。

房间码统一大写、六位，字符集为 `23456789ABCDEFGHJKMNPQRSTUVWXYZ`。V0.1 不提供 `session:resume`、ready 或 game 事件。
