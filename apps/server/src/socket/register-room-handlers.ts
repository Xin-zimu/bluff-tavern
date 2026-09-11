import type { Server, Socket } from 'socket.io';
import { challengeSchema, createRoomSchema, joinRoomSchema, kickPlayerSchema, leaveRoomSchema, playCardsSchema, readyRoomSchema, restartGameSchema, resumeSessionSchema, selectCharacterSchema, sendEmoteSchema, startGameSchema, updateRoomSettingsSchema, useItemSchema, type Ack, type ClientToServerEvents, type GameCue, type GameView, type InterServerEvents, type RoomView, type ServerToClientEvents, type SessionResumeResult, type SocketData } from '@bluff-tavern/shared';
import { GameScheduler } from '../game/game-scheduler.js';
import { GameService } from '../game/game-service.js';
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
const processedRoomRequests = new Map<string, Ack<RoomView>>();
const processedGameRequests = new Map<string, Ack<GameView>>();

export function registerRoomHandlers(io: GameServer, socket: GameSocket, rooms: RoomStore, games: GameService, scheduler: GameScheduler, logger: AppLogger): void {
  let windowStartedAt = Date.now();
  let commandsInWindow = 0;

  socket.use((_event, next) => {
    const now = Date.now();
    if (now - windowStartedAt > 10_000) {
      windowStartedAt = now;
      commandsInWindow = 0;
    }
    commandsInWindow += 1;
    if (commandsInWindow > 50) {
      next(new Error('RATE_LIMITED'));
      return;
    }
    next();
  });

  socket.on('room:create', (payload, ack) => {
    const parsed = createRoomSchema.safeParse(payload);
    if (!parsed.success) return ack(invalid);
    leaveCurrent(io, socket, rooms, scheduler, logger);
    try {
      const result = rooms.create(parsed.data.nickname, socket.id);
      socket.data = { playerId: result.playerId, roomCode: result.room.code };
      void socket.join(result.room.code);
      logger.info({ event: 'room_created', roomCode: result.room.code, playerId: result.playerId });
      ack({ ok: true, data: result });
    } catch (error) {
      logger.error({ event: 'server_error', error });
      ack(failure(error));
    }
  });

  socket.on('room:join', (payload, ack) => {
    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) return ack(invalid);
    leaveCurrent(io, socket, rooms, scheduler, logger);
    try {
      const result = rooms.join(parsed.data.roomCode, parsed.data.nickname, socket.id);
      socket.data = { playerId: result.playerId, roomCode: result.room.code };
      void socket.join(result.room.code);
      logger.info({ event: 'room_joined', roomCode: result.room.code, playerId: result.playerId });
      ack({ ok: true, data: result });
      io.to(result.room.code).emit('room:playerJoined', { roomCode: result.room.code, player: result.room.players.find((player) => player.id === result.playerId)! });
      io.to(result.room.code).emit('room:state', result.room);
    } catch (error) {
      ack(failure(error));
    }
  });

  socket.on('room:leave', (payload, ack) => {
    const parsed = leaveRoomSchema.safeParse(payload);
    if (!parsed.success || socket.data.roomCode !== parsed.data.roomCode) return ack(invalid);
    leaveCurrent(io, socket, rooms, scheduler, logger);
    ack({ ok: true, data: null });
  });

  socket.on('room:ready', (payload, ack) => {
    const parsed = readyRoomSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    const requestKey = roomRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId);
    const cached = processedRoomRequests.get(requestKey);
    if (cached) return ack(cached);
    try {
      const room = rooms.setReady(parsed.data.roomCode, socket.data.playerId!, parsed.data.ready);
      const result = { ok: true as const, data: room };
      processedRoomRequests.set(requestKey, result);
      io.to(room.code).emit('room:state', room);
      ack(result);
    } catch (error) {
      const result = failure(error);
      processedRoomRequests.set(requestKey, result);
      ack(result);
    }
  });

  socket.on('room:selectCharacter', (payload, ack) => {
    const parsed = selectCharacterSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    try {
      const room = rooms.selectCharacter(parsed.data.roomCode, socket.data.playerId!, parsed.data.characterId);
      io.to(room.code).emit('room:state', room);
      ack({ ok: true, data: room });
    } catch (error) {
      ack(failure(error));
    }
  });

  socket.on('game:sendEmote', (payload, ack) => {
    const parsed = sendEmoteSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    io.to(parsed.data.roomCode).emit('game:emote', { playerId: socket.data.playerId!, emoteId: parsed.data.emoteId });
    ack({ ok: true, data: null });
  });

  socket.on('game:useItem', (payload, ack) => {
    const parsed = useItemSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    const cached = processedGameRequests.get(gameRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId));
    if (cached) return ack(cached);
    try {
      games.useItem(parsed.data.roomCode, socket.data.playerId!);
      throw new RoomError('FEATURE_DISABLED', 'V6.0 暂时关闭道具');
    } catch (error) {
      const result = failure(error);
      processedGameRequests.set(gameRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId), result);
      ack(result);
    }
  });

  socket.on('room:updateSettings', (payload, ack) => {
    const parsed = updateRoomSettingsSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    const requestKey = roomRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId);
    const cached = processedRoomRequests.get(requestKey);
    if (cached) return ack(cached);
    try {
      const previous = rooms.getView(parsed.data.roomCode);
      const room = rooms.updateSettings(parsed.data.roomCode, socket.data.playerId!, {
        maxPlayers: parsed.data.maxPlayers,
        gameMode: parsed.data.gameMode,
        turnDurationSeconds: parsed.data.gameMode === 'QUICK' ? 7 : (parsed.data.turnDurationSeconds ?? previous.settings.turnDurationSeconds),
        eventEnabled: false,
        bulletCount: null,
      });
      const result = { ok: true as const, data: room };
      processedRoomRequests.set(requestKey, result);
      logger.info({ event: 'room_settings_updated', roomCode: room.code, playerId: socket.data.playerId });
      io.to(room.code).emit('room:state', room);
      ack(result);
    } catch (error) {
      const result = failure(error);
      processedRoomRequests.set(requestKey, result);
      ack(result);
    }
  });

  socket.on('room:kick', (payload, ack) => {
    const parsed = kickPlayerSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    const requestKey = roomRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId);
    const cached = processedRoomRequests.get(requestKey);
    if (cached) return ack(cached);
    try {
      const result = rooms.kick(parsed.data.roomCode, socket.data.playerId!, parsed.data.targetPlayerId);
      const ackResult = { ok: true as const, data: result.room };
      processedRoomRequests.set(requestKey, ackResult);
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
    } catch (error) {
      const result = failure(error);
      processedRoomRequests.set(requestKey, result);
      ack(result);
    }
  });

  socket.on('game:start', (payload, ack) => {
    const parsed = startGameSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    const key = gameRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId);
    const cached = processedGameRequests.get(key);
    if (cached) return ack(cached);
    try {
      const room = rooms.startGame(parsed.data.roomCode, socket.data.playerId!);
      const state = games.start(room);
      const result = { ok: true as const, data: state };
      processedGameRequests.set(key, result);
      logger.info({ event: 'game_started', roomCode: room.code, playerId: socket.data.playerId });
      io.to(room.code).emit('room:state', room);
      broadcastGameSnapshots(io, rooms, games, room.code);
      scheduleGame(io, rooms, games, scheduler, room.code, logger);
      ack(result);
    } catch (error) {
      const result = failure(error);
      processedGameRequests.set(key, result);
      ack(result);
    }
  });

  socket.on('game:playCards', (payload, ack) => {
    const parsed = playCardsSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    const key = gameRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId);
    const cached = processedGameRequests.get(key);
    if (cached) return ack(cached);
    try {
      const result = games.playCards(parsed.data.roomCode, socket.data.playerId!, parsed.data.cardIndexes);
      const ackResult = { ok: true as const, data: result.state };
      processedGameRequests.set(key, ackResult);
      logger.info({ event: 'cards_played', roomCode: parsed.data.roomCode, playerId: socket.data.playerId, count: result.cue.count });
      emitCue(io, result.cue);
      io.to(parsed.data.roomCode).emit('game:cardsPlayed', { playerId: socket.data.playerId!, count: result.cue.count ?? 0, roundNumber: result.state.roundNumber });
      broadcastGameSnapshots(io, rooms, games, parsed.data.roomCode);
      scheduleGame(io, rooms, games, scheduler, parsed.data.roomCode, logger);
      ack(ackResult);
    } catch (error) {
      const result = failure(error);
      processedGameRequests.set(key, result);
      ack(result);
    }
  });

  socket.on('game:challenge', (payload, ack) => {
    const parsed = challengeSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    const key = gameRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId);
    const cached = processedGameRequests.get(key);
    if (cached) return ack(cached);
    try {
      const result = games.challenge(parsed.data.roomCode, socket.data.playerId!);
      const ackResult = { ok: true as const, data: result.state };
      processedGameRequests.set(key, ackResult);
      logger.info({ event: 'challenge_called', roomCode: parsed.data.roomCode, challengerId: socket.data.playerId, challengedPlayerId: result.state.challenge?.challengedId });
      emitCue(io, result.cue);
      if (result.state.challenge) {
        io.to(parsed.data.roomCode).emit('game:challengeStarted', {
          challengerId: result.state.challenge.challengerId,
          challengedPlayerId: result.state.challenge.challengedId,
        });
      }
      broadcastGameSnapshots(io, rooms, games, parsed.data.roomCode);
      scheduleGame(io, rooms, games, scheduler, parsed.data.roomCode, logger);
      ack(ackResult);
    } catch (error) {
      const result = failure(error);
      processedGameRequests.set(key, result);
      ack(result);
    }
  });

  socket.on('game:restart', (payload, ack) => {
    const parsed = restartGameSchema.safeParse(payload);
    if (!parsed.success || !isCurrentMember(socket, rooms, parsed.data.roomCode)) return ack(invalid);
    const key = gameRequestKey(parsed.data.roomCode, socket.data.playerId!, parsed.data.requestId);
    const cached = processedGameRequests.get(key);
    if (cached) return ack(cached);
    try {
      const room = rooms.restartGame(parsed.data.roomCode, socket.data.playerId!);
      const state = games.restart(room);
      const result = { ok: true as const, data: state };
      processedGameRequests.set(key, result);
      io.to(room.code).emit('room:state', room);
      broadcastGameSnapshots(io, rooms, games, room.code);
      scheduleGame(io, rooms, games, scheduler, room.code, logger);
      ack(result);
    } catch (error) {
      const result = failure(error);
      processedGameRequests.set(key, result);
      ack(result);
    }
  });

  socket.on('session:resume', (payload, ack) => {
    const parsed = resumeSessionSchema.safeParse(payload);
    if (!parsed.success) return ack(invalid);
    try {
      const result = rooms.resume(parsed.data.sessionToken, socket.id);
      if (result.previousSocketId) replacePreviousSocket(io, result.previousSocketId, result.room.code);
      socket.data = { playerId: result.playerId, roomCode: result.room.code };
      void socket.join(result.room.code);
      games.updateConnections(result.room);
      io.to(result.room.code).emit('room:state', result.room);
      let game: GameView | null = null;
      try {
        game = games.getView(result.room.code, result.playerId);
        broadcastGameSnapshots(io, rooms, games, result.room.code);
      } catch {
        // Lobby has no game state.
      }
      logger.info({ event: 'player_reconnected', roomCode: result.room.code, playerId: result.playerId });
      const data: SessionResumeResult = {
        room: result.room,
        playerId: result.playerId,
        sessionToken: result.sessionToken,
        game,
      };
      ack({ ok: true, data });
    } catch (error) {
      ack(failure(error));
    }
  });

  socket.on('disconnect', () => disconnectCurrent(io, socket, rooms, games, logger));
}

function leaveCurrent(io: GameServer, socket: GameSocket, rooms: RoomStore, scheduler: GameScheduler, logger: AppLogger): void {
  const result = rooms.leaveBySocket(socket.id);
  if (!result) return;
  void socket.leave(result.code);
  socket.data = {};
  logger.info({ event: 'room_left', roomCode: result.code });
  if (result.room) {
    io.to(result.code).emit('room:playerLeft', { roomCode: result.code, player: result.player });
    io.to(result.code).emit('room:state', result.room);
  } else {
    scheduler.cancel(result.code);
    io.to(result.code).emit('room:closed');
  }
}

function isCurrentMember(socket: GameSocket, rooms: RoomStore, roomCode: string): boolean {
  return socket.data.roomCode === roomCode
    && socket.data.playerId !== undefined
    && rooms.isCurrentSocket(roomCode, socket.data.playerId, socket.id);
}

function replacePreviousSocket(io: GameServer, socketId: string, roomCode: string): void {
  const previousSocket = io.sockets.sockets.get(socketId);
  if (!previousSocket) return;
  void previousSocket.leave(roomCode);
  previousSocket.data = {};
  previousSocket.emit('session:replaced', '你的会话已在新连接中恢复');
}

function disconnectCurrent(io: GameServer, socket: GameSocket, rooms: RoomStore, games: GameService, logger: AppLogger): void {
  const result = rooms.disconnect(socket.id);
  if (!result) return;
  socket.data = {};
  logger.info({ event: 'player_disconnected', roomCode: result.code, playerId: result.player.id });
  if (result.room) {
    games.updateConnections(result.room);
    io.to(result.code).emit('room:state', result.room);
    try {
      broadcastGameSnapshots(io, rooms, games, result.code);
    } catch {
      // Lobby has no game state.
    }
  }
}

function broadcastGameSnapshots(io: GameServer, rooms: RoomStore, games: GameService, roomCode: string): void {
  games.updateConnections(rooms.getView(roomCode));
  for (const [playerId, state] of games.getViews(roomCode)) {
    const socketId = rooms.getSocketId(roomCode, playerId);
    if (!socketId) continue;
    io.to(socketId).emit('game:snapshot', state);
    io.to(socketId).emit('game:state', state);
    if (state.phase === 'TURN') io.to(socketId).emit('game:turnStarted', state);
  }
}

function scheduleGame(io: GameServer, rooms: RoomStore, games: GameService, scheduler: GameScheduler, roomCode: string, logger: AppLogger): void {
  let phaseEndsAt: number | null;
  try {
    phaseEndsAt = games.getPhaseEndsAt(roomCode);
  } catch {
    return;
  }

  scheduler.schedule(roomCode, phaseEndsAt, () => {
    try {
      const result = games.advancePhase(roomCode);
      if (result.eliminatedPlayerId) {
        io.to(roomCode).emit('game:playerEliminated', { playerId: result.eliminatedPlayerId });
      }
      if (result.gameOver) {
        const room = rooms.finishGame(roomCode);
        io.to(room.code).emit('room:state', room);
        io.to(room.code).emit('game:over', result.state);
      }
      for (const cue of result.cues) emitCue(io, cue);
      if (result.state.phase === 'VERDICT') io.to(roomCode).emit('game:challengeResult', result.state);
      if (result.state.phase === 'PUNISHMENT_INTRO' && result.state.challenge?.punishedPlayerId) {
        io.to(roomCode).emit('game:punishmentStarted', { playerId: result.state.challenge.punishedPlayerId, chamber: 0 });
      }
      if (result.state.phase === 'PUNISHMENT_RESULT') io.to(roomCode).emit('game:punishmentResult', result.state);
      broadcastGameSnapshots(io, rooms, games, roomCode);
      scheduleGame(io, rooms, games, scheduler, roomCode, logger);
    } catch (error) {
      logger.error({ event: 'phase_advance_failed', roomCode, error });
    }
  });
}

function emitCue(io: GameServer, cue: GameCue): void {
  io.to(cue.roomCode).emit('game:cue', cue);
}

function gameRequestKey(roomCode: string, playerId: string, requestId: string): string {
  return `${roomCode}:${playerId}:${requestId}`;
}

function roomRequestKey(roomCode: string, playerId: string, requestId: string): string {
  return `${roomCode}:${playerId}:${requestId}`;
}
