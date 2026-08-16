export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
export type RoomStatus = 'LOBBY' | 'STARTING' | 'PLAYING' | 'ROUND_RESULT' | 'GAME_OVER' | 'CLOSED';
export type PlayerStatus = 'CONNECTED' | 'DISCONNECTED' | 'READY' | 'PLAYING' | 'ELIMINATED' | 'SPECTATING';
export type GameMode = 'CLASSIC' | 'QUICK' | 'PARTY' | 'CUSTOM';
export type TavernEventType = 'BLACKOUT' | 'DRUNKEN' | 'RAPID_NIGHT' | 'DOUBLE_DANGER';
export type CharacterId = 'WOLF' | 'FOX' | 'BEAR' | 'RABBIT' | 'CAT' | 'RACCOON' | 'FROG' | 'PANDA';
export type ItemId = 'SPYGLASS' | 'SWAP_GLOVE' | 'WAX_SEAL' | 'TAVERN_MUG' | 'POCKET_WATCH';
export type EmoteId = 'CHEER' | 'SUSPECT' | 'BLUFF' | 'LAUGH' | 'GASP' | 'NERVOUS' | 'TOAST' | 'GOOD_GAME';

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
  characterId: CharacterId | null;
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
  items: ItemId[];
}

export interface AckSuccess<T> { ok: true; data: T }
export interface AckFailure { ok: false; error: { code: string; message: string } }
export type Ack<T> = AckSuccess<T> | AckFailure;
