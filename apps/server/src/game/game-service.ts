import { MAX_CARDS_PER_PLAY, type CardRank, type GameCue, type GameMode, type GamePhase, type GameSnapshot, type PublicChallengeState, type PublicPunishmentState, type RevolverState, type RoomView, type TargetRank, type V6GameMode } from '@bluff-tavern/shared';
import { RoomError } from '../rooms/room-store.js';
import type { RandomService } from './random.js';

interface InternalPlay {
  playerId: string;
  cards: CardRank[];
  count: number;
}

interface PendingChallenge {
  challengerId: string;
  challengedId: string;
  revealedCards: CardRank[];
  wasBluff: boolean;
  punishedPlayerId: string;
  chamber: number;
  hit: boolean;
  resultPublished: boolean;
}

interface InternalGame {
  matchId: string;
  roomCode: string;
  phase: GamePhase;
  phaseSequence: number;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  roundNumber: number;
  playerOrder: string[];
  playerNames: Map<string, string>;
  connectedPlayerIds: Set<string>;
  alivePlayerIds: Set<string>;
  hands: Map<string, CardRank[]>;
  targetRank: TargetRank;
  turnPlayerId: string | null;
  nextRoundStarterId: string | null;
  lastPlay: InternalPlay | null;
  mustChallenge: boolean;
  pendingChallenge: PendingChallenge | null;
  punishment: PublicPunishmentState | null;
  revolvers: Map<string, RevolverState>;
  winnerId: string | null;
  gameMode: V6GameMode;
  turnDurationSeconds: number;
  discardCount: number;
  startedAt: number;
  challengeCount: number;
  successfulChallenges: number;
  failedChallenges: number;
  eliminationOrder: string[];
}

export interface PlayCardsResult {
  state: GameSnapshot;
  cue: GameCue;
}

export interface ChallengeResult {
  state: GameSnapshot;
  cue: GameCue;
}

export interface PhaseAdvanceResult {
  state: GameSnapshot;
  cues: GameCue[];
  eliminatedPlayerId: string | null;
  gameOver: boolean;
}

const targets = ['A', 'K', 'Q'] as const;

const cinematicTiming = {
  ROUND_START: 2_700,
  CHALLENGE_CALLOUT: 1_800,
  VERDICT: 1_300,
  PUNISHMENT_INTRO: 1_050,
  PUNISHMENT_TRIGGER: 700,
  ROUND_END: 900,
  REVEAL_BASE: 900,
  REVEAL_PER_CARD: 650,
} as const;

export class GameService {
  private readonly games = new Map<string, InternalGame>();

  constructor(private readonly random: RandomService) {}

  start(room: RoomView): GameSnapshot {
    const gameMode = this.requireV6Mode(room.settings.gameMode);
    const playerOrder = room.players.map((player) => player.id);
    const game: InternalGame = {
      matchId: `${room.code}-${Date.now()}-${this.random.nextInt(1_000_000)}`,
      roomCode: room.code,
      phase: 'MATCH_START',
      phaseSequence: 0,
      phaseStartedAt: Date.now(),
      phaseEndsAt: null,
      roundNumber: 0,
      playerOrder,
      playerNames: new Map(room.players.map((player) => [player.id, player.nickname])),
      connectedPlayerIds: new Set(room.players.filter((player) => player.isConnected).map((player) => player.id)),
      alivePlayerIds: new Set(playerOrder),
      hands: new Map(playerOrder.map((playerId) => [playerId, []])),
      targetRank: 'A',
      turnPlayerId: null,
      nextRoundStarterId: playerOrder[0] ?? null,
      lastPlay: null,
      mustChallenge: false,
      pendingChallenge: null,
      punishment: null,
      revolvers: new Map(playerOrder.map((playerId) => [playerId, this.createRevolver()])),
      winnerId: null,
      gameMode,
      turnDurationSeconds: gameMode === 'QUICK' ? 7 : 15,
      discardCount: 0,
      startedAt: Date.now(),
      challengeCount: 0,
      successfulChallenges: 0,
      failedChallenges: 0,
      eliminationOrder: [],
    };
    this.games.set(room.code, game);
    this.startRound(game, game.nextRoundStarterId);
    return this.getView(room.code, playerOrder[0]!);
  }

  restart(room: RoomView): GameSnapshot {
    return this.start(room);
  }

  end(roomCode: string): void {
    this.games.delete(roomCode);
  }

  getStats(): { matches: number } {
    return { matches: this.games.size };
  }

  playCards(roomCode: string, playerId: string, cardIndexes: number[]): PlayCardsResult {
    const game = this.requireGame(roomCode);
    this.requireTurn(game, playerId);
    if (game.mustChallenge) throw new RoomError('MUST_CHALLENGE', '上一手已经出光手牌，必须质疑');
    if (cardIndexes.length < 1 || cardIndexes.length > MAX_CARDS_PER_PLAY) throw new RoomError('INVALID_CARD_SELECTION', '请选择 1 到 3 张牌');
    if (new Set(cardIndexes).size !== cardIndexes.length) throw new RoomError('INVALID_CARD_SELECTION', '不能重复选择同一张牌');
    const hand = game.hands.get(playerId);
    if (!hand) throw new RoomError('PLAYER_NOT_IN_GAME', '你不在本局游戏中');
    if (cardIndexes.some((index) => index < 0 || index >= hand.length)) throw new RoomError('INVALID_CARD_SELECTION', '选择了不存在的手牌');

    const cards = cardIndexes.map((index) => hand[index]!);
    [...cardIndexes].sort((a, b) => b - a).forEach((index) => hand.splice(index, 1));
    game.lastPlay = { playerId, cards, count: cards.length };
    game.discardCount += cards.length;
    game.mustChallenge = hand.length === 0;
    game.turnPlayerId = this.nextAlivePlayerId(game, playerId);
    this.enterPhase(game, 'TURN', this.turnDurationMs(game));

    const state = this.getView(roomCode, playerId);
    return {
      state,
      cue: {
        type: 'CARD_PLAYED',
        sequence: game.phaseSequence,
        roomCode,
        playerId,
        count: cards.length,
        roundNumber: game.roundNumber,
      },
    };
  }

  challenge(roomCode: string, challengerId: string): ChallengeResult {
    const game = this.requireGame(roomCode);
    this.requireTurn(game, challengerId);
    if (!game.lastPlay) throw new RoomError('NO_PLAY_TO_CHALLENGE', '当前没有可质疑的上一手');

    const wasBluff = game.lastPlay.cards.some((card) => card !== game.targetRank && card !== 'JOKER');
    const punishedPlayerId = wasBluff ? game.lastPlay.playerId : challengerId;
    const shot = this.resolveRevolverShot(game, punishedPlayerId);
    game.pendingChallenge = {
      challengerId,
      challengedId: game.lastPlay.playerId,
      revealedCards: [...game.lastPlay.cards],
      wasBluff,
      punishedPlayerId,
      chamber: shot.chamber,
      hit: shot.hit,
      resultPublished: false,
    };
    game.challengeCount += 1;
    if (wasBluff) game.successfulChallenges += 1;
    else game.failedChallenges += 1;
    game.mustChallenge = false;
    this.enterPhase(game, 'CHALLENGE_CALLOUT', cinematicTiming.CHALLENGE_CALLOUT);

    const state = this.getView(roomCode, challengerId);
    return {
      state,
      cue: {
        type: 'CHALLENGE_CALLED',
        sequence: game.phaseSequence,
        roomCode,
        playerId: challengerId,
        targetPlayerId: game.lastPlay.playerId,
        roundNumber: game.roundNumber,
      },
    };
  }

  autoAct(roomCode: string): PlayCardsResult | ChallengeResult {
    const game = this.requireGame(roomCode);
    if (game.phase !== 'TURN' || !game.turnPlayerId) throw new RoomError('PHASE_LOCKED', '当前阶段无法自动操作');
    if (game.mustChallenge) return this.challenge(roomCode, game.turnPlayerId);
    const hand = game.hands.get(game.turnPlayerId) ?? [];
    if (hand.length === 0) return this.challenge(roomCode, game.turnPlayerId);
    return this.playCards(roomCode, game.turnPlayerId, [this.random.nextInt(hand.length)]);
  }

  useItem(roomCode: string, playerId: string): GameSnapshot {
    this.requireGame(roomCode);
    void playerId;
    throw new RoomError('FEATURE_DISABLED', 'V6.0 暂时关闭道具');
  }

  advancePhase(roomCode: string): PhaseAdvanceResult {
    const game = this.requireGame(roomCode);
    const cues: GameCue[] = [];
    let eliminatedPlayerId: string | null = null;
    let gameOver = false;

    switch (game.phase) {
      case 'TURN': {
        const result = this.autoAct(roomCode);
        return { state: result.state, cues: [result.cue], eliminatedPlayerId, gameOver };
      }
      case 'ROUND_START':
        this.enterPhase(game, 'TURN', this.turnDurationMs(game));
        break;
      case 'CHALLENGE_CALLOUT':
        this.enterPhase(game, 'REVEAL', this.revealDurationMs(game));
        break;
      case 'REVEAL':
        this.enterPhase(game, 'VERDICT', cinematicTiming.VERDICT);
        break;
      case 'VERDICT':
        this.enterPhase(game, 'PUNISHMENT_INTRO', cinematicTiming.PUNISHMENT_INTRO);
        break;
      case 'PUNISHMENT_INTRO':
        this.enterPhase(game, 'PUNISHMENT_TRIGGER', cinematicTiming.PUNISHMENT_TRIGGER);
        break;
      case 'PUNISHMENT_TRIGGER':
        ({ eliminatedPlayerId } = this.publishPunishmentResult(game));
        if (eliminatedPlayerId) {
          cues.push({
            type: 'PLAYER_ELIMINATED',
            sequence: game.phaseSequence + 1,
            roomCode,
            playerId: eliminatedPlayerId,
            roundNumber: game.roundNumber,
          });
        }
        this.enterPhase(game, 'PUNISHMENT_RESULT', game.pendingChallenge?.hit ? 1_650 : 1_250);
        break;
      case 'PUNISHMENT_RESULT':
        this.enterPhase(game, 'ROUND_END', cinematicTiming.ROUND_END);
        break;
      case 'ROUND_END':
        if (game.alivePlayerIds.size <= 1) {
          game.winnerId = [...game.alivePlayerIds][0] ?? null;
          this.enterPhase(game, 'GAME_OVER', null);
          gameOver = true;
          cues.push(game.winnerId
            ? { type: 'MATCH_FINISHED', sequence: game.phaseSequence, roomCode, playerId: game.winnerId }
            : { type: 'MATCH_FINISHED', sequence: game.phaseSequence, roomCode });
        } else {
          this.startRound(game, game.nextRoundStarterId);
          cues.push({ type: 'ROUND_STARTED', sequence: game.phaseSequence, roomCode, roundNumber: game.roundNumber });
        }
        break;
      default:
        throw new RoomError('PHASE_LOCKED', '当前阶段不能自动推进');
    }

    return { state: this.getView(roomCode, game.playerOrder[0]!), cues, eliminatedPlayerId, gameOver };
  }

  getView(roomCode: string, viewerId: string): GameSnapshot {
    const game = this.requireGame(roomCode);
    const hand = game.hands.get(viewerId) ?? [];
    const challenge = this.getPublicChallenge(game);
    const challengeResult = challenge && challenge.wasBluff !== null && challenge.punishedPlayerId !== null && challenge.revealedCards !== null
      ? {
        challengerId: challenge.challengerId,
        failedPlayerId: challenge.punishedPlayerId,
        wasBluff: challenge.wasBluff,
        revealedCards: [...challenge.revealedCards],
      }
      : null;
    const summary = game.winnerId
      ? {
          winnerId: game.winnerId,
          playerCount: game.playerOrder.length,
          durationSeconds: Math.max(0, Math.floor((Date.now() - game.startedAt) / 1_000)),
          challengeCount: game.challengeCount,
          successfulChallenges: game.successfulChallenges,
          failedChallenges: game.failedChallenges,
          eliminationOrder: [...game.eliminationOrder],
        }
      : null;

    return {
      sequence: game.phaseSequence,
      serverNow: Date.now(),
      phase: game.phase,
      phaseStartedAt: game.phaseStartedAt,
      phaseEndsAt: game.phaseEndsAt,
      gameMode: game.gameMode,
      turnDurationSeconds: game.turnDurationSeconds,
      roundNumber: game.roundNumber,
      targetRank: game.targetRank,
      targetCard: game.targetRank,
      turnPlayerId: game.turnPlayerId,
      mustChallenge: game.mustChallenge,
      players: game.playerOrder.map((playerId, seatIndex) => {
        const handCount = game.hands.get(playerId)?.length ?? 0;
        return {
          playerId,
          name: game.playerNames.get(playerId) ?? playerId,
          seatIndex,
          connected: game.connectedPlayerIds.has(playerId),
          alive: game.alivePlayerIds.has(playerId),
          handCount,
          cardCount: handCount,
        };
      }),
      hand: [...hand],
      discardCount: game.discardCount,
      lastPlay: game.lastPlay ? { playerId: game.lastPlay.playerId, count: game.lastPlay.count, claimedRank: game.targetRank } : null,
      challenge,
      punishment: game.punishment ? { ...game.punishment } : null,
      winner: game.winnerId ? { winnerId: game.winnerId } : null,
      alivePlayerIds: [...game.alivePlayerIds],
      winnerId: game.winnerId,
      summary,
      tavernEvent: null,
      items: [],
      challengeResult,
    };
  }

  getViews(roomCode: string): Map<string, GameSnapshot> {
    const game = this.requireGame(roomCode);
    return new Map(game.playerOrder.map((playerId) => [playerId, this.getView(roomCode, playerId)]));
  }

  getPhaseEndsAt(roomCode: string): number | null {
    return this.requireGame(roomCode).phaseEndsAt;
  }

  updateConnections(room: RoomView): void {
    const game = this.games.get(room.code);
    if (!game) return;
    game.connectedPlayerIds = new Set(room.players.filter((player) => player.isConnected).map((player) => player.id));
  }

  debugSetHand(roomCode: string, playerId: string, hand: CardRank[]): void {
    const game = this.requireGame(roomCode);
    game.hands.set(playerId, [...hand]);
  }

  debugSetRevolver(roomCode: string, playerId: string, revolver: RevolverState): void {
    const game = this.requireGame(roomCode);
    game.revolvers.set(playerId, { ...revolver });
  }

  private startRound(game: InternalGame, starterId: string | null): void {
    game.roundNumber += 1;
    game.hands = new Map(game.playerOrder.map((playerId) => [playerId, []]));
    const alivePlayers = game.playerOrder.filter((playerId) => game.alivePlayerIds.has(playerId));
    const deck = this.createDeck(alivePlayers.length * 5);
    this.shuffle(deck);
    for (const [seatIndex, playerId] of alivePlayers.entries()) {
      game.hands.set(playerId, deck.slice(seatIndex * 5, seatIndex * 5 + 5));
    }
    game.targetRank = targets[this.random.nextInt(targets.length)]!;
    game.turnPlayerId = starterId && game.alivePlayerIds.has(starterId) ? starterId : alivePlayers[0] ?? null;
    game.nextRoundStarterId = game.turnPlayerId;
    game.lastPlay = null;
    game.mustChallenge = false;
    game.pendingChallenge = null;
    game.punishment = null;
    game.discardCount = 0;
    this.enterPhase(game, 'ROUND_START', cinematicTiming.ROUND_START);
  }

  private publishPunishmentResult(game: InternalGame): { eliminatedPlayerId: string | null } {
    const pending = game.pendingChallenge;
    if (!pending) throw new RoomError('PUNISHMENT_NOT_ALLOWED', '当前没有惩罚结果');
    if (pending.resultPublished) return { eliminatedPlayerId: game.punishment?.eliminatedPlayerId ?? null };

    const eliminatedPlayerId = pending.hit ? pending.punishedPlayerId : null;
    if (eliminatedPlayerId) {
      game.alivePlayerIds.delete(eliminatedPlayerId);
      game.hands.set(eliminatedPlayerId, []);
      game.eliminationOrder.push(eliminatedPlayerId);
      if (game.alivePlayerIds.size === 1) game.winnerId = [...game.alivePlayerIds][0]!;
    }
    game.nextRoundStarterId = pending.hit
      ? this.nextAlivePlayerId(game, pending.punishedPlayerId)
      : pending.punishedPlayerId;
    game.turnPlayerId = null;
    game.punishment = {
      punishedPlayerId: pending.punishedPlayerId,
      playerId: pending.punishedPlayerId,
      chamber: pending.chamber,
      hit: pending.hit,
      eliminatedPlayerId,
    };
    pending.resultPublished = true;
    return { eliminatedPlayerId };
  }

  private enterPhase(game: InternalGame, phase: GamePhase, durationMs: number | null): void {
    const now = Date.now();
    game.phase = phase;
    game.phaseSequence += 1;
    game.phaseStartedAt = now;
    game.phaseEndsAt = durationMs === null ? null : now + durationMs;
  }

  private getPublicChallenge(game: InternalGame): PublicChallengeState | null {
    const pending = game.pendingChallenge;
    if (!pending) return null;
    if (game.phase === 'CHALLENGE_CALLOUT') {
      return {
        challengerId: pending.challengerId,
        challengedId: pending.challengedId,
        revealedCards: null,
        wasBluff: null,
        punishedPlayerId: null,
      };
    }
    if (game.phase === 'REVEAL') {
      return {
        challengerId: pending.challengerId,
        challengedId: pending.challengedId,
        revealedCards: [...pending.revealedCards],
        wasBluff: null,
        punishedPlayerId: null,
      };
    }
    return {
      challengerId: pending.challengerId,
      challengedId: pending.challengedId,
      revealedCards: [...pending.revealedCards],
      wasBluff: pending.wasBluff,
      punishedPlayerId: pending.punishedPlayerId,
    };
  }

  private requireTurn(game: InternalGame, playerId: string): void {
    if (game.phase !== 'TURN') throw new RoomError('PHASE_LOCKED', '当前阶段无法操作');
    if (!game.alivePlayerIds.has(playerId)) throw new RoomError('PLAYER_ELIMINATED', '已淘汰玩家不能操作');
    if (game.turnPlayerId !== playerId) throw new RoomError('NOT_YOUR_TURN', '现在不是你的回合');
  }

  private nextAlivePlayerId(game: InternalGame, playerId: string): string | null {
    if (game.alivePlayerIds.size === 0) return null;
    const start = game.playerOrder.indexOf(playerId);
    for (let offset = 1; offset <= game.playerOrder.length; offset += 1) {
      const candidate = game.playerOrder[(start + offset + game.playerOrder.length) % game.playerOrder.length]!;
      if (game.alivePlayerIds.has(candidate)) return candidate;
    }
    return null;
  }

  private createDeck(cardCount: number): CardRank[] {
    const cycle: CardRank[] = ['A', 'K', 'Q', 'JOKER'];
    return Array.from({ length: cardCount }, (_, index) => cycle[index % cycle.length]!);
  }

  private shuffle(deck: CardRank[]): void {
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = this.random.nextInt(index + 1);
      [deck[index], deck[swapIndex]] = [deck[swapIndex]!, deck[index]!];
    }
  }

  private revealDurationMs(game: InternalGame): number {
    return cinematicTiming.REVEAL_BASE + (game.pendingChallenge?.revealedCards.length ?? 0) * cinematicTiming.REVEAL_PER_CARD;
  }

  private turnDurationMs(game: InternalGame): number {
    return game.turnDurationSeconds * 1_000;
  }

  private resolveRevolverShot(game: InternalGame, playerId: string): { chamber: number; hit: boolean } {
    const revolver = game.revolvers.get(playerId);
    if (!revolver) throw new RoomError('PLAYER_NOT_IN_GAME', '你不在本局游戏中');
    const chamber = revolver.currentChamber;
    const hit = chamber === revolver.bulletPosition;
    revolver.currentChamber = (revolver.currentChamber + 1) % revolver.chamberCount;
    revolver.shotsTaken += 1;
    return { chamber, hit };
  }

  private createRevolver(): RevolverState {
    return {
      chamberCount: 6,
      bulletPosition: this.random.nextInt(6),
      currentChamber: 0,
      shotsTaken: 0,
    };
  }

  private requireV6Mode(gameMode: GameMode): V6GameMode {
    if (gameMode !== 'CLASSIC' && gameMode !== 'QUICK') throw new RoomError('FEATURE_DISABLED', 'V6.0 只开放 Classic 和 Quick');
    return gameMode;
  }

  private requireGame(roomCode: string): InternalGame {
    const game = this.games.get(roomCode);
    if (!game) throw new RoomError('GAME_NOT_FOUND', '牌局尚未开始');
    return game;
  }
}
