import type { Server, Socket } from 'socket.io';
import { createRoomSchema, joinRoomSchema, leaveRoomSchema, type ClientToServerEvents, type InterServerEvents, type ServerToClientEvents, type SocketData } from '@bluff-tavern/shared';
import { RoomError, RoomStore } from '../rooms/room-store.js';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
interface AppLogger {
  info: (data: object) => void;
  error: (data: object) => void;
}

const invalid = { ok: false as const, error: { code: 'INVALID_REQUEST', message: '输入内容无效' } };
const failure = (error: unknown) => error instanceof RoomError
  ? { ok: false as const, error: { code: error.code, message: error.message } }
  : { ok: false as const, error: { code: 'SERVER_ERROR', message: '服务器暂时不可用' } };

export function registerRoomHandlers(io: GameServer, socket: GameSocket, rooms: RoomStore, logger: AppLogger): void {
  socket.on('room:create', (payload, ack) => {
    const parsed = createRoomSchema.safeParse(payload);
    if (!parsed.success) return ack(invalid);
    leaveCurrent(io, socket, rooms, logger);
    try {
      const result = rooms.create(parsed.data.nickname, socket.id);
      socket.data = { playerId: result.playerId, roomCode: result.room.code };
      void socket.join(result.room.code);
      logger.info({ event: 'room_created', roomCode: result.room.code, playerId: result.playerId });
      ack({ ok: true, data: result });
    } catch (error) { logger.error({ event: 'server_error', error }); ack(failure(error)); }
  });

  socket.on('room:join', (payload, ack) => {
    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) return ack(invalid);
    leaveCurrent(io, socket, rooms, logger);
    try {
      const result = rooms.join(parsed.data.roomCode, parsed.data.nickname, socket.id);
      socket.data = { playerId: result.playerId, roomCode: result.room.code };
      void socket.join(result.room.code);
      logger.info({ event: 'room_joined', roomCode: result.room.code, playerId: result.playerId });
      ack({ ok: true, data: result });
      io.to(result.room.code).emit('room:state', result.room);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('room:leave', (payload, ack) => {
    const parsed = leaveRoomSchema.safeParse(payload);
    if (!parsed.success || socket.data.roomCode !== parsed.data.roomCode) return ack(invalid);
    leaveCurrent(io, socket, rooms, logger);
    ack({ ok: true, data: null });
  });

  socket.on('disconnect', () => leaveCurrent(io, socket, rooms, logger));
}

function leaveCurrent(io: GameServer, socket: GameSocket, rooms: RoomStore, logger: AppLogger): void {
  const result = rooms.leaveBySocket(socket.id);
  if (!result) return;
  void socket.leave(result.code);
  socket.data = {};
  logger.info({ event: 'room_left', roomCode: result.code });
  if (result.room) io.to(result.code).emit('room:state', result.room);
  else io.to(result.code).emit('room:closed');
}
