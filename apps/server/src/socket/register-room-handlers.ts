import type { Server, Socket } from 'socket.io';
import { createRoomSchema, joinRoomSchema, leaveRoomSchema, readyRoomSchema, updateRoomSettingsSchema, kickPlayerSchema, type Ack, type ClientToServerEvents, type InterServerEvents, type RoomView, type ServerToClientEvents, type SocketData } from '@bluff-tavern/shared';
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
  const processedRequests = new Map<string, Ack<RoomView>>();
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
      io.to(result.room.code).emit('room:playerJoined', { roomCode: result.room.code, player: result.room.players.find((player) => player.id === result.playerId)! });
      io.to(result.room.code).emit('room:state', result.room);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('room:leave', (payload, ack) => {
    const parsed = leaveRoomSchema.safeParse(payload);
    if (!parsed.success || socket.data.roomCode !== parsed.data.roomCode) return ack(invalid);
    leaveCurrent(io, socket, rooms, logger);
    ack({ ok: true, data: null });
  });

  socket.on('room:ready', (payload, ack) => {
    const parsed = readyRoomSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try {
      const room = rooms.setReady(parsed.data.roomCode, socket.data.playerId!, parsed.data.ready);
      const result = { ok: true as const, data: room };
      processedRequests.set(parsed.data.requestId, result);
      io.to(room.code).emit('room:state', room);
      ack(result);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('room:updateSettings', (payload, ack) => {
    const parsed = updateRoomSettingsSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try {
      const room = rooms.updateSettings(parsed.data.roomCode, socket.data.playerId!, { maxPlayers: parsed.data.maxPlayers });
      const result = { ok: true as const, data: room };
      processedRequests.set(parsed.data.requestId, result);
      logger.info({ event: 'room_settings_updated', roomCode: room.code, playerId: socket.data.playerId });
      io.to(room.code).emit('room:state', room);
      ack(result);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('room:kick', (payload, ack) => {
    const parsed = kickPlayerSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try {
      const result = rooms.kick(parsed.data.roomCode, socket.data.playerId!, parsed.data.targetPlayerId);
      const ackResult = { ok: true as const, data: result.room };
      processedRequests.set(parsed.data.requestId, ackResult);
      const kickedSocket = io.sockets.sockets.get(result.kickedSocketId);
      if (kickedSocket) {
        void kickedSocket.leave(result.room.code);
        kickedSocket.data = {};
        kickedSocket.emit('room:kicked', '你已被房主移出房间');
      }
      logger.info({ event: 'room_player_kicked', roomCode: result.room.code, playerId: result.kickedPlayer.id });
      io.to(result.room.code).emit('room:playerLeft', { roomCode: result.room.code, player: result.kickedPlayer });
      io.to(result.room.code).emit('room:state', result.room);
      ack(ackResult);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('disconnect', () => leaveCurrent(io, socket, rooms, logger));
}

function leaveCurrent(io: GameServer, socket: GameSocket, rooms: RoomStore, logger: AppLogger): void {
  const result = rooms.leaveBySocket(socket.id);
  if (!result) return;
  void socket.leave(result.code);
  socket.data = {};
  logger.info({ event: 'room_left', roomCode: result.code });
  if (result.room) {
    io.to(result.code).emit('room:playerLeft', { roomCode: result.code, player: result.player });
    io.to(result.code).emit('room:state', result.room);
  }
  else io.to(result.code).emit('room:closed');
}

function isCurrentMember(socket: GameSocket, roomCode: string): boolean {
  return socket.data.roomCode === roomCode && socket.data.playerId !== undefined;
}
