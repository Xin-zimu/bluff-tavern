import { CARDS_PER_RANK_BY_PLAYER_COUNT, REVOLVER_BULLETS_BY_PLAYER_COUNT, type CardRank, type GamePhase, type GameView, type RoomView, type TavernEventType } from '@bluff-tavern/shared';
import { RoomError } from '../rooms/room-store.js';
import type { RandomService } from './random.js';

interface InternalGame {
  roomCode: string;
  playerIds: string[];
  hands: Map<string, CardRank[]>;
  roundNumber: number;
  targetCard: 'A' | 'K' | 'Q';
  turnIndex: number;
  discardCount: number;
  phase: GamePhase;
  lastPlay: { playerId: string; cards: CardRank[] } | null;
  challengeResult: GameView['challengeResult'];
  punishment: GameView['punishment'];
  alivePlayerIds: Set<string>;
  winnerId: string | null;
  gameMode: RoomView['settings']['gameMode'];
  settings: RoomView['settings'];
  tavernEvent: GameView['tavernEvent'];
  revolver: { chamberCount: number; bulletPositions: Set<number>; currentChamber: number; shotsTaken: number };
}

const targets = ['A', 'K', 'Q'] as const;

export class GameService {
  private readonly games = new Map<string, InternalGame>();
  constructor(private readonly random: RandomService) {}

  start(room: RoomView): GameView {
    const game: InternalGame = {
      roomCode: room.code,
      playerIds: room.players.map((player) => player.id),
      hands: new Map(),
      roundNumber: 1,
      targetCard: 'A',
      turnIndex: 0,
      discardCount: 0,
      phase: 'TURN', lastPlay: null, challengeResult: null,
      punishment: null, alivePlayerIds: new Set(room.players.map((player) => player.id)), winnerId: null,
      gameMode: room.settings.gameMode,
      settings: { ...room.settings }, tavernEvent: null,
      revolver: this.createRevolver(room.players.length, room.settings.bulletCount),
    };
    this.dealRound(game);
    this.games.set(room.code, game);
    return this.getView(room.code, game.playerIds[0]!);
  }

  playCards(roomCode: string, playerId: string, cardIndexes: number[]): { state: GameView; playedCount: number; roundAdvanced: boolean } {
    const game = this.requireGame(roomCode);
    if ((game.phase !== 'TURN' && game.phase !== 'CHALLENGE_WINDOW') || game.playerIds[game.turnIndex] !== playerId) throw new RoomError('NOT_YOUR_TURN', '现在不是你的回合');
    const hand = game.hands.get(playerId);
    if (!hand) throw new RoomError('PLAYER_NOT_IN_GAME', '你不在本局游戏中');
    if (cardIndexes.some((index) => index >= hand.length)) throw new RoomError('INVALID_CARD_INDEX', '选择了不存在的手牌');
    const sorted = [...cardIndexes].sort((a, b) => b - a);
    const cards = sorted.map((index) => hand[index]!);
    sorted.forEach((index) => hand.splice(index, 1));
    game.discardCount += cardIndexes.length;
    game.lastPlay = { playerId, cards };
    game.challengeResult = null;
    game.turnIndex = (game.turnIndex + 1) % game.playerIds.length;
    if ([...game.hands.values()].some((remaining) => remaining.length > 0)) this.skipEmptyHands(game);
    game.phase = 'CHALLENGE_WINDOW';
    return { state: this.getView(roomCode, playerId), playedCount: cardIndexes.length, roundAdvanced: false };
  }

  autoPlay(roomCode: string): { state: GameView; playedCount: number; roundAdvanced: boolean } {
    const game = this.requireGame(roomCode);
    const playerId = game.playerIds[game.turnIndex]!;
    const hand = game.hands.get(playerId);
    if (!hand || hand.length === 0) throw new RoomError('NO_CARD_TO_PLAY', '当前玩家没有可自动出的手牌');
    return this.playCards(roomCode, playerId, [this.random.nextInt(hand.length)]);
  }

  challenge(roomCode: string, challengerId: string): GameView {
    const game = this.requireGame(roomCode);
    if (game.phase !== 'CHALLENGE_WINDOW' || game.playerIds[game.turnIndex] !== challengerId || !game.lastPlay) throw new RoomError('CHALLENGE_NOT_ALLOWED', '当前无法发起质疑');
    game.phase = 'REVEAL';
    const wasBluff = game.lastPlay.cards.some((card) => card !== game.targetCard && card !== 'JOKER');
    game.challengeResult = {
      challengerId,
      failedPlayerId: wasBluff ? game.lastPlay.playerId : challengerId,
      wasBluff,
      revealedCards: [...game.lastPlay.cards],
    };
    game.phase = 'ROUND_RESULT';
    return this.getView(roomCode, challengerId);
  }

  punish(roomCode: string): { state: GameView; playerId: string; hit: boolean; gameOver: boolean } {
    const game = this.requireGame(roomCode);
    if (game.phase !== 'ROUND_RESULT' || !game.challengeResult) throw new RoomError('PUNISHMENT_NOT_ALLOWED', '当前无法执行惩罚');
    const playerId = game.challengeResult.failedPlayerId;
    game.phase = 'PUNISHMENT';
    const chamber = game.revolver.currentChamber;
    const hit = game.revolver.bulletPositions.has(chamber) || (game.tavernEvent?.type === 'DOUBLE_DANGER' && game.revolver.bulletPositions.has((chamber + 1) % game.revolver.chamberCount));
    game.revolver.currentChamber = (chamber + 1) % game.revolver.chamberCount;
    game.revolver.shotsTaken += 1;
    game.punishment = { playerId, chamber, hit };
    if (hit) game.alivePlayerIds.delete(playerId);
    if (game.alivePlayerIds.size === 1) {
      game.winnerId = [...game.alivePlayerIds][0]!;
      game.phase = 'GAME_OVER';
      return { state: this.getView(roomCode, playerId), playerId, hit, gameOver: true };
    }
    game.roundNumber += 1;
    this.dealRound(game);
    game.punishment = { playerId, chamber, hit };
    return { state: this.getView(roomCode, playerId), playerId, hit, gameOver: false };
  }

  restart(room: RoomView): GameView {
    return this.start(room);
  }

  getView(roomCode: string, viewerId: string): GameView {
    const game = this.requireGame(roomCode);
    const hand = game.hands.get(viewerId) ?? [];
    return {
      gameMode: game.gameMode,
      turnDurationSeconds: game.tavernEvent?.type === 'RAPID_NIGHT' ? Math.max(5, Math.floor(this.baseTurnDuration(game) / 2)) : this.baseTurnDuration(game),
      tavernEvent: game.tavernEvent ? { ...game.tavernEvent } : null,
      roundNumber: game.roundNumber,
      phase: game.phase,
      targetCard: game.targetCard,
      turnPlayerId: game.playerIds[game.turnIndex]!,
      discardCount: game.discardCount,
      players: game.playerIds.map((playerId) => ({ playerId, cardCount: game.hands.get(playerId)?.length ?? 0 })),
      hand: [...hand],
      lastPlay: game.lastPlay ? { playerId: game.lastPlay.playerId, count: game.lastPlay.cards.length } : null,
      challengeResult: game.challengeResult ? { ...game.challengeResult, revealedCards: [...game.challengeResult.revealedCards] } : null,
      punishment: game.punishment ? { ...game.punishment } : null,
      alivePlayerIds: [...game.alivePlayerIds],
      winnerId: game.winnerId,
    };
  }

  getViews(roomCode: string): Map<string, GameView> {
    const game = this.requireGame(roomCode);
    return new Map(game.playerIds.map((playerId) => [playerId, this.getView(roomCode, playerId)]));
  }

  private dealRound(game: InternalGame): void {
    const activePlayers = game.playerIds.filter((playerId) => game.alivePlayerIds.has(playerId));
    const configuration = CARDS_PER_RANK_BY_PLAYER_COUNT.find((entry) => activePlayers.length <= entry.maxPlayers);
    if (!configuration) throw new Error('Missing deck configuration');
    const deck: CardRank[] = [
      ...(['A', 'K', 'Q'] as const).flatMap((rank) => Array<CardRank>(configuration.copiesPerRank).fill(rank)),
      ...Array<CardRank>(configuration.jokers).fill('JOKER'),
    ];
    this.shuffle(deck);
    game.hands = new Map(game.playerIds.map((playerId) => [playerId, []]));
    deck.forEach((card, index) => game.hands.get(activePlayers[index % activePlayers.length]!)!.push(card));
    game.targetCard = targets[this.random.nextInt(targets.length)]!;
    game.tavernEvent = this.selectEvent(game);
    if (game.tavernEvent?.type === 'DRUNKEN') for (const hand of game.hands.values()) this.shuffle(hand);
    game.turnIndex = game.playerIds.indexOf(activePlayers[this.random.nextInt(activePlayers.length)]!);
    game.discardCount = 0;
    game.phase = 'TURN';
    game.lastPlay = null;
    game.challengeResult = null;
    game.punishment = null;
  }

  private shuffle(deck: CardRank[]): void {
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = this.random.nextInt(index + 1);
      [deck[index], deck[swapIndex]] = [deck[swapIndex]!, deck[index]!];
    }
  }

  private skipEmptyHands(game: InternalGame): void {
    while (!game.alivePlayerIds.has(game.playerIds[game.turnIndex]!) || game.hands.get(game.playerIds[game.turnIndex]!)!.length === 0) {
      game.turnIndex = (game.turnIndex + 1) % game.playerIds.length;
    }
  }

  private requireGame(roomCode: string): InternalGame {
    const game = this.games.get(roomCode);
    if (!game) throw new RoomError('GAME_NOT_FOUND', '牌局尚未开始');
    return game;
  }

  private selectEvent(game: InternalGame): GameView['tavernEvent'] {
    if (!game.settings.eventEnabled && game.gameMode !== 'PARTY') return null;
    const types: TavernEventType[] = ['DRUNKEN', 'RAPID_NIGHT', 'DOUBLE_DANGER'];
    return { type: types[this.random.nextInt(types.length)]!, roundNumber: game.roundNumber };
  }

  private baseTurnDuration(game: InternalGame): number { return game.gameMode === 'QUICK' ? 7 : game.settings.turnDurationSeconds; }

  private createRevolver(playerCount: number, configuredBullets: number | null) {
    const chamberCount = 6;
    const bullets = configuredBullets ?? REVOLVER_BULLETS_BY_PLAYER_COUNT.find((entry) => playerCount <= entry.maxPlayers)?.bullets;
    if (!bullets) throw new Error('Missing revolver configuration');
    const positions = new Set<number>();
    while (positions.size < bullets) {
      let position = this.random.nextInt(chamberCount);
      while (positions.has(position)) position = (position + 1) % chamberCount;
      positions.add(position);
    }
    return { chamberCount, bulletPositions: positions, currentChamber: 0, shotsTaken: 0 };
  }
}
