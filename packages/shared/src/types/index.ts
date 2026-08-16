export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
export type RoomStatus = 'LOBBY' | 'STARTING' | 'PLAYING' | 'ROUND_RESULT' | 'GAME_OVER' | 'CLOSED';
export type PlayerStatus = 'CONNECTED' | 'DISCONNECTED' | 'READY' | 'PLAYING' | 'ELIMINATED' | 'SPECTATING';
export type GameMode = 'CLASSIC' | 'QUICK' | 'PARTY' | 'CUSTOM';
export type TavernEventType = 'BLACKOUT' | 'DRUNKEN' | 'RAPID_NIGHT' | 'DOUBLE_DANGER';

export interface RoomSettings {
  maxPlayers: number;
  gameMode: GameMode;
  turnDurationSeconds: number;
  eventEnabled: boolean;
  bulletCount: number | null;
}

export interface PlayerView {
  id: string;
  nickname: string;
  status: PlayerStatus;
  joinedAt: number;
  isConnected: boolean;
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
  sessionToken: string;
}

export interface RoomPlayerEvent {
  roomCode: string;
  player: PlayerView;
}

export type CardRank = 'A' | 'K' | 'Q' | 'JOKER';
export type GamePhase = 'TURN' | 'CHALLENGE_WINDOW' | 'REVEAL' | 'PUNISHMENT' | 'ROUND_RESULT' | 'GAME_OVER';

export interface GamePlayerView {
  playerId: string;
  cardCount: number;
}

export interface GameView {
  gameMode: GameMode;
  turnDurationSeconds: number;
  tavernEvent: { type: TavernEventType; roundNumber: number } | null;
  roundNumber: number;
  phase: GamePhase;
  targetCard: Exclude<CardRank, 'JOKER'>;
  turnPlayerId: string;
  discardCount: number;
  players: GamePlayerView[];
  hand: CardRank[];
  lastPlay: { playerId: string; count: number } | null;
  challengeResult: { challengerId: string; failedPlayerId: string; wasBluff: boolean; revealedCards: CardRank[] } | null;
  punishment: { playerId: string; chamber: number; hit: boolean } | null;
  alivePlayerIds: string[];
  winnerId: string | null;
}

export interface AckSuccess<T> { ok: true; data: T }
export interface AckFailure { ok: false; error: { code: string; message: string } }
export type Ack<T> = AckSuccess<T> | AckFailure;
