export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
export type RoomStatus = 'LOBBY' | 'STARTING' | 'PLAYING' | 'ROUND_RESULT' | 'GAME_OVER' | 'CLOSED';
export type PlayerStatus = 'CONNECTED' | 'DISCONNECTED' | 'READY' | 'PLAYING' | 'ELIMINATED' | 'SPECTATING';

export interface RoomSettings {
  maxPlayers: number;
}

export interface PlayerView {
  id: string;
  nickname: string;
  status: PlayerStatus;
  joinedAt: number;
}

export interface RoomView {
  id: string;
  code: string;
  hostPlayerId: string;
  status: RoomStatus;
  maxPlayers: number;
  settings: RoomSettings;
  players: PlayerView[];
  createdAt: number;
}

export interface RoomMembership {
  room: RoomView;
  playerId: string;
}

export interface RoomPlayerEvent {
  roomCode: string;
  player: PlayerView;
}

export interface AckSuccess<T> { ok: true; data: T }
export interface AckFailure { ok: false; error: { code: string; message: string } }
export type Ack<T> = AckSuccess<T> | AckFailure;
