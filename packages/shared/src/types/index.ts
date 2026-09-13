export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
export type RoomStatus = 'LOBBY' | 'STARTING' | 'PLAYING' | 'ROUND_RESULT' | 'GAME_OVER' | 'CLOSED';
export type PlayerStatus = 'CONNECTED' | 'DISCONNECTED' | 'READY' | 'PLAYING' | 'ELIMINATED' | 'SPECTATING';
export type GameMode = 'CLASSIC' | 'QUICK' | 'PARTY' | 'CUSTOM';
export type V6GameMode = Extract<GameMode, 'CLASSIC' | 'QUICK'>;
export type TavernEventType = 'BLACKOUT' | 'DRUNKEN' | 'RAPID_NIGHT' | 'DOUBLE_DANGER';
export type CharacterId = 'WOLF' | 'FOX' | 'BEAR' | 'RABBIT' | 'CAT' | 'RACCOON' | 'FROG' | 'PANDA';
export type ItemId = 'SPYGLASS' | 'SWAP_GLOVE' | 'WAX_SEAL' | 'TAVERN_MUG' | 'POCKET_WATCH';
export type EmoteId = 'CHEER' | 'SUSPECT' | 'BLUFF' | 'LAUGH' | 'GASP' | 'NERVOUS' | 'TOAST' | 'GOOD_GAME';

export interface V7ExtensionSettings {
  itemsEnabled: boolean;
  tavernEventsEnabled: boolean;
  characterAbilitiesEnabled: boolean;
}

export interface RoomSettings {
  maxPlayers: number;
  gameMode: GameMode;
  turnDurationSeconds: number;
  eventEnabled: boolean;
  bulletCount: number | null;
  v7: V7ExtensionSettings;
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

export interface SessionResumeResult extends RoomMembership {
  game: GameView | null;
}

export interface RoomPlayerEvent {
  roomCode: string;
  player: PlayerView;
}

export type CardRank = 'A' | 'K' | 'Q' | 'JOKER';
export type TargetRank = Exclude<CardRank, 'JOKER'>;

export type GamePhase =
  | 'LOBBY'
  | 'MATCH_START'
  | 'ROUND_START'
  | 'TURN'
  | 'CHALLENGE_CALLOUT'
  | 'REVEAL'
  | 'VERDICT'
  | 'PUNISHMENT_INTRO'
  | 'PUNISHMENT_TRIGGER'
  | 'PUNISHMENT_RESULT'
  | 'ROUND_END'
  | 'GAME_OVER';

export interface RevolverState {
  chamberCount: 6;
  bulletPosition: number;
  currentChamber: number;
  shotsTaken: number;
}

export interface PublicPlayerState {
  playerId: string;
  name: string;
  seatIndex: number;
  connected: boolean;
  alive: boolean;
  handCount: number;
  cardCount: number;
}

export interface PublicLastPlay {
  playerId: string;
  count: number;
  claimedRank: TargetRank;
}

export interface PublicChallengeState {
  challengerId: string;
  challengedId: string;
  revealedCards: CardRank[] | null;
  wasBluff: boolean | null;
  punishedPlayerId: string | null;
}

export interface PublicPunishmentState {
  punishedPlayerId: string;
  playerId: string;
  chamber: number;
  hit: boolean;
  eliminatedPlayerId: string | null;
}

export interface PublicWinnerState {
  winnerId: string;
}

export interface GameSummary {
  winnerId: string;
  playerCount: number;
  durationSeconds: number;
  challengeCount: number;
  successfulChallenges: number;
  failedChallenges: number;
  eliminationOrder: string[];
}

export interface GameSnapshot {
  sequence: number;
  serverNow: number;
  phase: GamePhase;
  phaseStartedAt: number;
  phaseEndsAt: number | null;

  gameMode: V6GameMode;
  turnDurationSeconds: number;
  roundNumber: number;
  targetRank: TargetRank | null;
  targetCard: TargetRank;

  turnPlayerId: string | null;
  mustChallenge: boolean;

  players: PublicPlayerState[];
  hand: CardRank[];
  discardCount: number;
  lastPlay: PublicLastPlay | null;
  challenge: PublicChallengeState | null;
  punishment: PublicPunishmentState | null;
  winner: PublicWinnerState | null;

  alivePlayerIds: string[];
  winnerId: string | null;
  summary: GameSummary | null;

  tavernEvent: null;
  items: ItemId[];
  challengeResult: {
    challengerId: string;
    failedPlayerId: string;
    wasBluff: boolean;
    revealedCards: CardRank[];
  } | null;
}

export type GameView = GameSnapshot;

export type GameCueType =
  | 'ROUND_STARTED'
  | 'CARD_PLAYED'
  | 'CHALLENGE_CALLED'
  | 'PLAYER_ELIMINATED'
  | 'MATCH_FINISHED';

export interface GameCue {
  type: GameCueType;
  sequence: number;
  roomCode: string;
  playerId?: string;
  targetPlayerId?: string;
  count?: number;
  roundNumber?: number;
}

export interface AckSuccess<T> { ok: true; data: T }
export interface AckFailure { ok: false; error: { code: string; message: string } }
export type Ack<T> = AckSuccess<T> | AckFailure;
