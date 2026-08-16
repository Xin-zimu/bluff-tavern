import { z } from 'zod';
import { MAX_CARDS_PER_PLAY, MAX_NICKNAME_LENGTH, MAX_PLAYERS, MIN_NICKNAME_LENGTH, MIN_PLAYERS, ROOM_CODE_LENGTH } from '../constants/index.js';
import type { Ack, GameView, RoomMembership, RoomPlayerEvent, RoomView } from '../types/index.js';

export const nicknameSchema = z.string().trim().min(MIN_NICKNAME_LENGTH).max(MAX_NICKNAME_LENGTH);
export const roomCodeSchema = z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH).regex(/^[2-9A-HJ-KM-NP-Z]+$/);
export const createRoomSchema = z.object({ nickname: nicknameSchema });
export const joinRoomSchema = z.object({ nickname: nicknameSchema, roomCode: roomCodeSchema });
export const leaveRoomSchema = z.object({ roomCode: roomCodeSchema });
export const requestIdSchema = z.string().uuid();
export const readyRoomSchema = z.object({ roomCode: roomCodeSchema, ready: z.boolean(), requestId: requestIdSchema });
export const updateRoomSettingsSchema = z.object({
  roomCode: roomCodeSchema,
  maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS),
  gameMode: z.enum(['CLASSIC', 'QUICK']).default('CLASSIC'),
  requestId: requestIdSchema,
});
export const kickPlayerSchema = z.object({ roomCode: roomCodeSchema, targetPlayerId: z.string().uuid(), requestId: requestIdSchema });
export const startGameSchema = z.object({ roomCode: roomCodeSchema, requestId: requestIdSchema });
export const playCardsSchema = z.object({
  roomCode: roomCodeSchema,
  cardIndexes: z.array(z.number().int().nonnegative()).min(1).max(MAX_CARDS_PER_PLAY),
  requestId: requestIdSchema,
}).refine((value) => new Set(value.cardIndexes).size === value.cardIndexes.length, { message: 'Card indexes must be unique' });
export const challengeSchema = z.object({ roomCode: roomCodeSchema, requestId: requestIdSchema });
export const restartGameSchema = z.object({ roomCode: roomCodeSchema, requestId: requestIdSchema });
export const resumeSessionSchema = z.object({ sessionToken: z.string().min(32).max(256) });

export interface ClientToServerEvents {
  'room:create': (payload: z.input<typeof createRoomSchema>, ack: (result: Ack<RoomMembership>) => void) => void;
  'room:join': (payload: z.input<typeof joinRoomSchema>, ack: (result: Ack<RoomMembership>) => void) => void;
  'room:leave': (payload: z.input<typeof leaveRoomSchema>, ack: (result: Ack<null>) => void) => void;
  'room:ready': (payload: z.input<typeof readyRoomSchema>, ack: (result: Ack<RoomView>) => void) => void;
  'room:updateSettings': (payload: z.input<typeof updateRoomSettingsSchema>, ack: (result: Ack<RoomView>) => void) => void;
  'room:kick': (payload: z.input<typeof kickPlayerSchema>, ack: (result: Ack<RoomView>) => void) => void;
  'game:start': (payload: z.input<typeof startGameSchema>, ack: (result: Ack<GameView>) => void) => void;
  'game:playCards': (payload: z.input<typeof playCardsSchema>, ack: (result: Ack<GameView>) => void) => void;
  'game:challenge': (payload: z.input<typeof challengeSchema>, ack: (result: Ack<GameView>) => void) => void;
  'game:restart': (payload: z.input<typeof restartGameSchema>, ack: (result: Ack<GameView>) => void) => void;
  'session:resume': (payload: z.input<typeof resumeSessionSchema>, ack: (result: Ack<RoomMembership>) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  'room:closed': () => void;
  'room:playerJoined': (event: RoomPlayerEvent) => void;
  'room:playerLeft': (event: RoomPlayerEvent) => void;
  'room:kicked': (message: string) => void;
  'game:state': (state: GameView) => void;
  'game:turnStarted': (state: GameView) => void;
  'game:cardsPlayed': (event: { playerId: string; count: number; roundNumber: number }) => void;
  'game:challengeStarted': (event: { challengerId: string; challengedPlayerId: string }) => void;
  'game:challengeResult': (state: GameView) => void;
  'game:punishmentStarted': (event: { playerId: string; chamber: number }) => void;
  'game:punishmentResult': (state: GameView) => void;
  'game:playerEliminated': (event: { playerId: string }) => void;
  'game:over': (state: GameView) => void;
}

export type InterServerEvents = Record<string, never>;
export interface SocketData { playerId?: string; roomCode?: string }
