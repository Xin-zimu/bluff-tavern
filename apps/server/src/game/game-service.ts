import {
  MAX_CARDS_PER_PLAY,
  V7_ITEM_IDS,
  V7_TAVERN_EVENT_TYPES,
  type ActiveItemId,
  type CardRank,
  type GameCue,
  type GameMode,
  type GamePhase,
  type GameSnapshot,
  type PrivateItemEffect,
  type PublicChallengeState,
  type PublicPunishmentState,
  type PublicTavernEvent,
  type RevolverState,
  type RoomView,
  type TargetRank,
  type V6GameMode,
  type V7ExtensionSettings,
} from '@bluff-tavern/shared';
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
  roundTurnDurationSeconds: number;
  v7: V7ExtensionSettings;
  itemInventories: Map<string, ActiveItemId[]>;
  itemEffects: Map<string, PrivateItemEffect>;
  tavernEvent: PublicTavernEvent | null;
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
const activeItemPool = V7_ITEM_IDS;
const tavernEventPool = V7_TAVERN_EVENT_TYPES;
const TAVERN_EVENT_CHANCE_PERCENT = 25;
const POCKET_WATCH_EXTENSION_SECONDS = 7;
const ITEM_EFFECT_DURATION_MS = 18_000;

const cinematicTiming = {
  ROUND_START: 2_700,
  CHALLENGE_CALLOUT: 1_800,
  VERDICT: 1_300,
  PUNISHMENT_INTRO: 1_050,
  PUNISHMENT_TRIGGER: 700,
  ROUND_END: 900,
  REVEAL_INTRO: 500,
  REVEAL_PER_CARD: 750,
  REVEAL_FINAL_HOLD: 1_000,
} as const;

export class GameService {
  private readonly games = new Map<string, InternalGame>();

  constructor(private readonly random: RandomService) {}

  start(room: RoomView): GameSnapshot {
    const gameMode = this.requireV6Mode(room.settings.gameMode);
    const playerOrder = room.players.map((player) => player.id);
    const turnDurationSeconds = gameMode === 'QUICK' ? 7 : 15;
    const v7 = { ...room.settings.v7 };
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
      turnDurationSeconds,
      roundTurnDurationSeconds: turnDurationSeconds,
      v7,
      itemInventories: new Map(playerOrder.map((playerId) => [playerId, v7.itemsEnabled ? [this.dealItem()] : []])),
      itemEffects: new Map(),
      tavernEvent: null,
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

  useItem(roomCode: string, playerId: string, itemId: ActiveItemId): GameSnapshot {
    const game = this.requireGame(roomCode);
    if (!game.v7.itemsEnabled) throw new RoomError('FEATURE_DISABLED', 'V7 道具未开启');
    this.requireAlivePlayer(game, playerId);
    const inventory = game.itemInventories.get(playerId) ?? [];
    if (!inventory.includes(itemId)) throw new RoomError('ITEM_NOT_AVAILABLE', '你没有这个道具');

    const effect = this.resolveItemEffect(game, playerId, itemId);
    this.consumeItem(inventory, itemId);
    game.itemEffects.set(playerId, effect);
    this.touch(game);
    return this.getView(roomCode, playerId);
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
        this.enterPhase(game, 'PUNISHMENT_TRIGGER', this.punishmentTriggerDurationMs(game));
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
    const now = Date.now();
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
          durationSeconds: Math.max(0, Math.floor((now - game.startedAt) / 1_000)),
          challengeCount: game.challengeCount,
          successfulChallenges: game.successfulChallenges,
          failedChallenges: game.failedChallenges,
          eliminationOrder: [...game.eliminationOrder],
        }
      : null;

    return {
      sequence: game.phaseSequence,
      serverNow: now,
      phase: game.phase,
      phaseStartedAt: game.phaseStartedAt,
      phaseEndsAt: game.phaseEndsAt,
      gameMode: game.gameMode,
      turnDurationSeconds: game.roundTurnDurationSeconds,
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
      tavernEvent: game.v7.tavernEventsEnabled && game.tavernEvent ? { ...game.tavernEvent } : null,
      items: game.v7.itemsEnabled ? [...(game.itemInventories.get(viewerId) ?? [])] : [],
      itemEffect: game.v7.itemsEnabled ? this.getItemEffect(game, viewerId, now) : null,
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

  debugSetItems(roomCode: string, playerId: string, items: ActiveItemId[]): void {
    const game = this.requireGame(roomCode);
    game.itemInventories.set(playerId, [...items]);
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
    game.tavernEvent = this.drawTavernEvent(game.roundNumber, game.turnDurationSeconds, game.v7.tavernEventsEnabled);
    game.roundTurnDurationSeconds = game.tavernEvent?.turnDurationSeconds ?? game.turnDurationSeconds;
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
      game.itemInventories.set(eliminatedPlayerId, []);
      game.itemEffects.delete(eliminatedPlayerId);
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

  private resolveItemEffect(game: InternalGame, playerId: string, itemId: ActiveItemId): PrivateItemEffect {
    if (game.phase !== 'TURN') throw new RoomError('PHASE_LOCKED', '当前阶段无法使用道具');
    const now = Date.now();
    switch (itemId) {
      case 'SPYGLASS': {
        const revolver = game.revolvers.get(playerId);
        if (!revolver) throw new RoomError('PLAYER_NOT_IN_GAME', '你不在本局游戏中');
        const riskLevel = revolver.currentChamber === revolver.bulletPosition ? 'HIGH' : 'LOW';
        return {
          itemId,
          type: 'SPYGLASS_RISK',
          riskLevel,
          expiresAt: now + ITEM_EFFECT_DURATION_MS,
          message: riskLevel === 'HIGH'
            ? '望远镜：下一次轮到你受罚时风险偏高。'
            : '望远镜：下一次轮到你受罚时风险偏低。',
        };
      }
      case 'POCKET_WATCH': {
        if (game.turnPlayerId !== playerId) throw new RoomError('NOT_YOUR_TURN', '怀表只能在自己的回合使用');
        if (game.phaseEndsAt === null) throw new RoomError('PHASE_LOCKED', '当前阶段没有可延长的倒计时');
        game.phaseEndsAt = Math.max(game.phaseEndsAt, now) + POCKET_WATCH_EXTENSION_SECONDS * 1_000;
        return {
          itemId,
          type: 'POCKET_WATCH_EXTENDED',
          expiresAt: now + ITEM_EFFECT_DURATION_MS,
          extraSeconds: POCKET_WATCH_EXTENSION_SECONDS,
          message: `旧怀表：本回合时间延长 ${POCKET_WATCH_EXTENSION_SECONDS} 秒。`,
        };
      }
      case 'TAVERN_MUG':
        return {
          itemId,
          type: 'TAVERN_MUG_TIPSY',
          expiresAt: now + ITEM_EFFECT_DURATION_MS,
          message: '酒杯：提示短暂晃动，但牌局判定不变。',
        };
      default: {
        const neverItem: never = itemId;
        return neverItem;
      }
    }
  }

  private consumeItem(inventory: ActiveItemId[], itemId: ActiveItemId): void {
    const index = inventory.indexOf(itemId);
    if (index >= 0) inventory.splice(index, 1);
  }

  private getItemEffect(game: InternalGame, playerId: string, now: number): PrivateItemEffect | null {
    const effect = game.itemEffects.get(playerId);
    if (!effect) return null;
    if (effect.expiresAt !== null && effect.expiresAt <= now) {
      game.itemEffects.delete(playerId);
      return null;
    }
    return { ...effect };
  }

  private drawTavernEvent(roundNumber: number, baseTurnDurationSeconds: number, enabled: boolean): PublicTavernEvent | null {
    if (!enabled) return null;
    if (this.random.nextInt(100) >= TAVERN_EVENT_CHANCE_PERCENT) return null;
    return this.createTavernEvent(tavernEventPool[this.random.nextInt(tavernEventPool.length)]!, roundNumber, baseTurnDurationSeconds);
  }

  private createTavernEvent(type: (typeof tavernEventPool)[number], roundNumber: number, baseTurnDurationSeconds: number): PublicTavernEvent {
    switch (type) {
      case 'RAPID_NIGHT': {
        const turnDurationSeconds = this.rapidNightTurnDurationSeconds(baseTurnDurationSeconds);
        return {
          type,
          title: '快速夜',
          description: `本轮回合时间缩短至 ${turnDurationSeconds} 秒。`,
          roundNumber,
          turnDurationSeconds,
          intensity: 'HIGH',
        };
      }
      case 'CANDLE_FLICKER':
        return {
          type,
          title: '烛火摇曳',
          description: '本轮质疑演出更紧张，规则判定不变。',
          roundNumber,
          turnDurationSeconds: null,
          intensity: 'MEDIUM',
        };
      case 'DOUBLE_DANGER':
        return {
          type,
          title: '双倍危机',
          description: '本轮惩罚阶段压力提升，但实弹数量不变。',
          roundNumber,
          turnDurationSeconds: null,
          intensity: 'HIGH',
        };
      default: {
        const neverEvent: never = type;
        return neverEvent;
      }
    }
  }

  private requireTurn(game: InternalGame, playerId: string): void {
    if (game.phase !== 'TURN') throw new RoomError('PHASE_LOCKED', '当前阶段无法操作');
    if (!game.alivePlayerIds.has(playerId)) throw new RoomError('PLAYER_ELIMINATED', '已淘汰玩家不能操作');
    if (game.turnPlayerId !== playerId) throw new RoomError('NOT_YOUR_TURN', '现在不是你的回合');
  }

  private requireAlivePlayer(game: InternalGame, playerId: string): void {
    if (!game.playerOrder.includes(playerId)) throw new RoomError('PLAYER_NOT_IN_GAME', '你不在本局游戏中');
    if (!game.alivePlayerIds.has(playerId)) throw new RoomError('PLAYER_ELIMINATED', '已淘汰玩家不能使用道具');
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
    return cinematicTiming.REVEAL_INTRO
      + (game.pendingChallenge?.revealedCards.length ?? 0) * cinematicTiming.REVEAL_PER_CARD
      + cinematicTiming.REVEAL_FINAL_HOLD
      + (game.tavernEvent?.type === 'CANDLE_FLICKER' ? 500 : 0);
  }

  private punishmentTriggerDurationMs(game: InternalGame): number {
    return cinematicTiming.PUNISHMENT_TRIGGER + (game.tavernEvent?.type === 'DOUBLE_DANGER' ? 450 : 0);
  }

  private turnDurationMs(game: InternalGame): number {
    return game.roundTurnDurationSeconds * 1_000;
  }

  private rapidNightTurnDurationSeconds(baseTurnDurationSeconds: number): number {
    return Math.max(5, baseTurnDurationSeconds - 5);
  }

  private dealItem(): ActiveItemId {
    return activeItemPool[this.random.nextInt(activeItemPool.length)]!;
  }

  private touch(game: InternalGame): void {
    game.phaseSequence += 1;
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
