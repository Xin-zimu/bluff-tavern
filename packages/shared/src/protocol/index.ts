import { z } from 'zod';
import { MAX_NICKNAME_LENGTH, MIN_NICKNAME_LENGTH, ROOM_CODE_LENGTH } from '../constants/index.js';
import type { Ack, RoomMembership, RoomView } from '../types/index.js';

export const nicknameSchema = z.string().trim().min(MIN_NICKNAME_LENGTH).max(MAX_NICKNAME_LENGTH);
export const roomCodeSchema = z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH).regex(/^[2-9A-HJ-KM-NP-Z]+$/);
export const createRoomSchema = z.object({ nickname: nicknameSchema });
export const joinRoomSchema = z.object({ nickname: nicknameSchema, roomCode: roomCodeSchema });
export const leaveRoomSchema = z.object({ roomCode: roomCodeSchema });

export interface ClientToServerEvents {
  'room:create': (payload: z.input<typeof createRoomSchema>, ack: (result: Ack<RoomMembership>) => void) => void;
  'room:join': (payload: z.input<typeof joinRoomSchema>, ack: (result: Ack<RoomMembership>) => void) => void;
  'room:leave': (payload: z.input<typeof leaveRoomSchema>, ack: (result: Ack<null>) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  'room:closed': () => void;
}

export type InterServerEvents = Record<string, never>;
export interface SocketData { playerId?: string; roomCode?: string }
