import type { Server, Socket } from 'socket.io';
import { createRoomSchema, joinRoomSchema, leaveRoomSchema, readyRoomSchema, updateRoomSettingsSchema, kickPlayerSchema, startGameSchema, playCardsSchema, challengeSchema, restartGameSchema, resumeSessionSchema, selectCharacterSchema, sendEmoteSchema, useItemSchema, type Ack, type ClientToServerEvents, type GameView, type InterServerEvents, type RoomView, type ServerToClientEvents, type SocketData } from '@bluff-tavern/shared';
import { GameService } from '../game/game-service.js';
import { RoomError, RoomStore } from '../rooms/room-store.js';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
interface AppLogger {
  info: (data: object) => void;
  error: (data: object) => void;
}

const invalid = { ok: false as const, error: { code: 'INVALID_REQUEST', message: '输入内容无效' } };
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
const failure = (error: unknown) => error instanceof RoomError
  ? { ok: false as const, error: { code: error.code, message: error.message } }
  : { ok: false as const, error: { code: 'SERVER_ERROR', message: '服务器暂时不可用' } };

export function registerRoomHandlers(io: GameServer, socket: GameSocket, rooms: RoomStore, games: GameService, logger: AppLogger): void {
  const processedRequests = new Map<string, Ack<RoomView>>();
  const processedGameRequests = new Map<string, Ack<GameView>>();
  let windowStartedAt = Date.now();
  let commandsInWindow = 0;
  socket.use((_event, next) => {
    const now = Date.now();
    if (now - windowStartedAt > 10_000) { windowStartedAt = now; commandsInWindow = 0; }
    commandsInWindow += 1;
    if (commandsInWindow > 50) { next(new Error('RATE_LIMITED')); return; }
    next();
  });
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

  socket.on('room:selectCharacter', (payload, ack) => {
    const parsed = selectCharacterSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    try { const room = rooms.selectCharacter(parsed.data.roomCode, socket.data.playerId!, parsed.data.characterId); io.to(room.code).emit('room:state', room); ack({ ok: true, data: room }); } catch (error) { ack(failure(error)); }
  });

  socket.on('game:sendEmote', (payload, ack) => {
    const parsed = sendEmoteSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    io.to(parsed.data.roomCode).emit('game:emote', { playerId: socket.data.playerId!, emoteId: parsed.data.emoteId });
    ack({ ok: true, data: null });
  });

  socket.on('game:useItem', (payload, ack) => {
    const parsed = useItemSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedGameRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try { const state = games.useItem(parsed.data.roomCode, socket.data.playerId!, parsed.data.itemId); const result = { ok: true as const, data: state }; processedGameRequests.set(parsed.data.requestId, result); broadcastGameState(io, rooms, games, parsed.data.roomCode); ack(result); } catch (error) { ack(failure(error)); }
  });

  socket.on('room:updateSettings', (payload, ack) => {
    const parsed = updateRoomSettingsSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try {
      const previous = rooms.getView(parsed.data.roomCode);
      const room = rooms.updateSettings(parsed.data.roomCode, socket.data.playerId!, {
        maxPlayers: parsed.data.maxPlayers, gameMode: parsed.data.gameMode,
        turnDurationSeconds: parsed.data.turnDurationSeconds ?? previous.settings.turnDurationSeconds,
        eventEnabled: parsed.data.eventEnabled ?? previous.settings.eventEnabled,
        bulletCount: parsed.data.bulletCount ?? previous.settings.bulletCount,
      });
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

  socket.on('game:start', (payload, ack) => {
    const parsed = startGameSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedGameRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try {
      const room = rooms.startGame(parsed.data.roomCode, socket.data.playerId!);
      const state = games.start(room);
      const result = { ok: true as const, data: state };
      processedGameRequests.set(parsed.data.requestId, result);
      logger.info({ event: 'game_started', roomCode: room.code, playerId: socket.data.playerId });
      io.to(room.code).emit('room:state', room);
      broadcastGameState(io, rooms, games, room.code);
      scheduleTurn(io, rooms, games, room.code, logger);
      ack(result);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('game:playCards', (payload, ack) => {
    const parsed = playCardsSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedGameRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try {
      const result = games.playCards(parsed.data.roomCode, socket.data.playerId!, parsed.data.cardIndexes);
      const ackResult = { ok: true as const, data: result.state };
      processedGameRequests.set(parsed.data.requestId, ackResult);
      logger.info({ event: 'cards_played', roomCode: parsed.data.roomCode, playerId: socket.data.playerId, count: result.playedCount });
      io.to(parsed.data.roomCode).emit('game:cardsPlayed', { playerId: socket.data.playerId!, count: result.playedCount, roundNumber: result.state.roundNumber });
      broadcastGameState(io, rooms, games, parsed.data.roomCode);
      scheduleTurn(io, rooms, games, parsed.data.roomCode, logger);
      ack(ackResult);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('game:challenge', (payload, ack) => {
    const parsed = challengeSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedGameRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try {
      const state = games.challenge(parsed.data.roomCode, socket.data.playerId!);
      const punishment = games.punish(parsed.data.roomCode);
      const result = { ok: true as const, data: punishment.state };
      processedGameRequests.set(parsed.data.requestId, result);
      if (!state.lastPlay || !state.challengeResult) throw new Error('Missing challenge result');
      logger.info({ event: 'challenge', roomCode: parsed.data.roomCode, challengerId: socket.data.playerId, failedPlayerId: state.challengeResult.failedPlayerId });
      io.to(parsed.data.roomCode).emit('game:challengeStarted', { challengerId: socket.data.playerId!, challengedPlayerId: state.lastPlay.playerId });
      io.to(parsed.data.roomCode).emit('game:challengeResult', state);
      io.to(parsed.data.roomCode).emit('game:punishmentStarted', { playerId: punishment.playerId, chamber: punishment.state.punishment?.chamber ?? 0 });
      if (punishment.hit) {
        const room = rooms.eliminatePlayer(parsed.data.roomCode, punishment.playerId);
        io.to(room.code).emit('room:state', room);
        io.to(room.code).emit('game:playerEliminated', { playerId: punishment.playerId });
      }
      if (punishment.gameOver) {
        const room = rooms.finishGame(parsed.data.roomCode);
        io.to(room.code).emit('room:state', room);
        io.to(room.code).emit('game:over', punishment.state);
      }
      broadcastGameState(io, rooms, games, parsed.data.roomCode);
      scheduleTurn(io, rooms, games, parsed.data.roomCode, logger);
      io.to(parsed.data.roomCode).emit('game:punishmentResult', punishment.state);
      ack(result);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('game:restart', (payload, ack) => {
    const parsed = restartGameSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, parsed.data.roomCode)) return ack(invalid);
    const cached = processedGameRequests.get(parsed.data.requestId);
    if (cached) return ack(cached);
    try {
      const room = rooms.restartGame(parsed.data.roomCode, socket.data.playerId!);
      const state = games.restart(room);
      const result = { ok: true as const, data: state };
      processedGameRequests.set(parsed.data.requestId, result);
      io.to(room.code).emit('room:state', room);
      broadcastGameState(io, rooms, games, room.code);
      scheduleTurn(io, rooms, games, room.code, logger);
      ack(result);
    } catch (error) { ack(failure(error)); }
  });

  socket.on('session:resume', (payload, ack) => {
    const parsed = resumeSessionSchema.safeParse(payload);
    if (!parsed.success) return ack(invalid);
    try {
      const result = rooms.resume(parsed.data.sessionToken, socket.id);
      socket.data = { playerId: result.playerId, roomCode: result.room.code };
      void socket.join(result.room.code);
      io.to(result.room.code).emit('room:state', result.room);
      try { broadcastGameState(io, rooms, games, result.room.code); } catch { /* Lobby has no game state. */ }
      logger.info({ event: 'player_reconnected', roomCode: result.room.code, playerId: result.playerId });
      ack({ ok: true, data: result });
    } catch (error) { ack(failure(error)); }
  });

  socket.on('disconnect', () => disconnectCurrent(io, socket, rooms, logger));
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

function disconnectCurrent(io: GameServer, socket: GameSocket, rooms: RoomStore, logger: AppLogger): void {
  const result = rooms.disconnect(socket.id);
  if (!result) return;
  socket.data = {};
  logger.info({ event: 'player_disconnected', roomCode: result.code, playerId: result.player.id });
  if (result.room) io.to(result.code).emit('room:state', result.room);
}

function broadcastGameState(io: GameServer, rooms: RoomStore, games: GameService, roomCode: string): void {
  for (const [playerId, state] of games.getViews(roomCode)) {
    const socketId = rooms.getSocketId(roomCode, playerId);
    if (!socketId) continue;
    io.to(socketId).emit('game:state', state);
    io.to(socketId).emit('game:turnStarted', state);
  }
}

function scheduleTurn(io: GameServer, rooms: RoomStore, games: GameService, roomCode: string, logger: AppLogger): void {
  const previous = turnTimers.get(roomCode);
  if (previous) clearTimeout(previous);
  let view: GameView;
  try { view = games.getView(roomCode, games.getViews(roomCode).keys().next().value!); } catch { return; }
  if (view.phase === 'GAME_OVER') return;
  const timer = setTimeout(() => {
    try {
      const result = games.autoPlay(roomCode);
      logger.info({ event: 'turn_timeout_auto_played', roomCode, playerId: result.state.lastPlay?.playerId });
      io.to(roomCode).emit('game:cardsPlayed', { playerId: result.state.lastPlay!.playerId, count: result.playedCount, roundNumber: result.state.roundNumber });
      broadcastGameState(io, rooms, games, roomCode);
      scheduleTurn(io, rooms, games, roomCode, logger);
    } catch { /* A manual action won the race or the room has ended. */ }
  }, view.turnDurationSeconds * 1_000);
  timer.unref();
  turnTimers.set(roomCode, timer);
}
