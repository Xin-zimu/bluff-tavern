import { CARDS_PER_RANK_BY_PLAYER_COUNT, type CardRank, type GamePhase, type GameView, type RoomView } from '@bluff-tavern/shared';
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

  getView(roomCode: string, viewerId: string): GameView {
    const game = this.requireGame(roomCode);
    const hand = game.hands.get(viewerId);
    if (!hand) throw new RoomError('PLAYER_NOT_IN_GAME', '你不在本局游戏中');
    return {
      roundNumber: game.roundNumber,
      phase: game.phase,
      targetCard: game.targetCard,
      turnPlayerId: game.playerIds[game.turnIndex]!,
      discardCount: game.discardCount,
      players: game.playerIds.map((playerId) => ({ playerId, cardCount: game.hands.get(playerId)!.length })),
      hand: [...hand],
      lastPlay: game.lastPlay ? { playerId: game.lastPlay.playerId, count: game.lastPlay.cards.length } : null,
      challengeResult: game.challengeResult ? { ...game.challengeResult, revealedCards: [...game.challengeResult.revealedCards] } : null,
    };
  }

  getViews(roomCode: string): Map<string, GameView> {
    const game = this.requireGame(roomCode);
    return new Map(game.playerIds.map((playerId) => [playerId, this.getView(roomCode, playerId)]));
  }

  private dealRound(game: InternalGame): void {
    const configuration = CARDS_PER_RANK_BY_PLAYER_COUNT.find((entry) => game.playerIds.length <= entry.maxPlayers);
    if (!configuration) throw new Error('Missing deck configuration');
    const deck: CardRank[] = [
      ...(['A', 'K', 'Q'] as const).flatMap((rank) => Array<CardRank>(configuration.copiesPerRank).fill(rank)),
      ...Array<CardRank>(configuration.jokers).fill('JOKER'),
    ];
    this.shuffle(deck);
    game.hands = new Map(game.playerIds.map((playerId) => [playerId, []]));
    deck.forEach((card, index) => game.hands.get(game.playerIds[index % game.playerIds.length]!)!.push(card));
    game.targetCard = targets[this.random.nextInt(targets.length)]!;
    game.turnIndex = this.random.nextInt(game.playerIds.length);
    game.discardCount = 0;
    game.phase = 'TURN';
    game.lastPlay = null;
    game.challengeResult = null;
  }

  private shuffle(deck: CardRank[]): void {
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = this.random.nextInt(index + 1);
      [deck[index], deck[swapIndex]] = [deck[swapIndex]!, deck[index]!];
    }
  }

  private skipEmptyHands(game: InternalGame): void {
    while (game.hands.get(game.playerIds[game.turnIndex]!)!.length === 0) {
      game.turnIndex = (game.turnIndex + 1) % game.playerIds.length;
    }
  }

  private requireGame(roomCode: string): InternalGame {
    const game = this.games.get(roomCode);
    if (!game) throw new RoomError('GAME_NOT_FOUND', '牌局尚未开始');
    return game;
  }
}
