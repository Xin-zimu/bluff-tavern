import { describe, expect, it } from 'vitest';
import type { CardRank, RoomView } from '@bluff-tavern/shared';
import { GameService } from '../src/game/game-service.js';

function makeRoom(playerCount: number, code = 'ABC234'): RoomView {
  return {
    id: code,
    code,
    hostPlayerId: 'p1',
    status: 'PLAYING',
    maxPlayers: playerCount,
    settings: { maxPlayers: playerCount, gameMode: 'CLASSIC', turnDurationSeconds: 15, eventEnabled: false, bulletCount: null, v7: { itemsEnabled: false, tavernEventsEnabled: false, characterAbilitiesEnabled: false } },
    createdAt: 1,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index + 1}`,
      nickname: `p${index + 1}`,
      status: 'PLAYING' as const,
      joinedAt: index,
      isConnected: true,
      characterId: null,
    })),
  };
}

const deterministic = () => new GameService({ nextInt: () => 0 });

function startTurn(service: GameService, room: RoomView) {
  service.start(room);
  return service.advancePhase(room.code).state;
}

function advanceTo(service: GameService, roomCode: string, phase: string) {
  let state = service.getView(roomCode, 'p1');
  for (let index = 0; index < 10 && state.phase !== phase; index += 1) {
    state = service.advancePhase(roomCode).state;
  }
  expect(state.phase).toBe(phase);
  return state;
}

function forceChallenge(service: GameService, room: RoomView, hand: CardRank[], challengerId = 'p2') {
  startTurn(service, room);
  service.debugSetHand(room.code, 'p1', hand);
  service.playCards(room.code, 'p1', hand.map((_, index) => index));
  return service.challenge(room.code, challengerId).state;
}

describe('V6 GameService rules', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('deals exactly five cards to each alive player for %i players', (playerCount) => {
    const room = makeRoom(playerCount);
    const service = deterministic();
    const state = service.start(room);
    expect(state.phase).toBe('ROUND_START');
    expect(state.players).toHaveLength(playerCount);
    expect(state.players.every((player) => player.handCount === 5)).toBe(true);
    expect(state.players.reduce((sum, player) => sum + player.handCount, 0)).toBe(playerCount * 5);
  });

  it('accepts 1 to 3 cards and rejects too many cards or bad indexes', () => {
    const room = makeRoom(2);
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['A', 'K', 'Q', 'JOKER', 'A']);
    expect(service.playCards(room.code, 'p1', [0]).state.lastPlay).toMatchObject({ playerId: 'p1', count: 1 });

    const service2 = deterministic();
    startTurn(service2, room);
    service2.debugSetHand(room.code, 'p1', ['A', 'K', 'Q', 'JOKER', 'A']);
    expect(() => service2.playCards(room.code, 'p1', [0, 1, 2, 3])).toThrow('请选择 1 到 3 张牌');
    expect(() => service2.playCards(room.code, 'p1', [9])).toThrow('选择了不存在的手牌');
  });

  it('reveals a failed challenge only after REVEAL and publishes verdict only in VERDICT', () => {
    const room = makeRoom(2);
    const service = deterministic();
    const callout = forceChallenge(service, room, ['A']);
    expect(callout.phase).toBe('CHALLENGE_CALLOUT');
    expect(callout.challenge).toMatchObject({ challengerId: 'p2', challengedId: 'p1', revealedCards: null, wasBluff: null, punishedPlayerId: null });
    expect(callout.punishment).toBeNull();

    const reveal = service.advancePhase(room.code).state;
    expect(reveal.phase).toBe('REVEAL');
    expect(reveal.challenge?.revealedCards).toEqual(['A']);
    expect(reveal.challenge?.wasBluff).toBeNull();

    const verdict = service.advancePhase(room.code).state;
    expect(verdict.phase).toBe('VERDICT');
    expect(verdict.challenge).toMatchObject({ wasBluff: false, punishedPlayerId: 'p2' });
    expect(verdict.challengeResult).toMatchObject({ wasBluff: false, failedPlayerId: 'p2', revealedCards: ['A'] });
    expect(verdict.punishment).toBeNull();
  });

  it('holds reveal long enough for every card to flip before verdict', () => {
    const room = makeRoom(2);
    const service = deterministic();
    forceChallenge(service, room, ['A', 'K', 'Q']);

    const reveal = service.advancePhase(room.code).state;

    expect(reveal.phase).toBe('REVEAL');
    expect((reveal.phaseEndsAt ?? 0) - reveal.phaseStartedAt).toBe(3_750);
  });

  it('treats Joker as true and mixed truth/bluff as bluff', () => {
    const room = makeRoom(2);
    const jokerService = deterministic();
    forceChallenge(jokerService, room, ['JOKER']);
    expect(advanceTo(jokerService, room.code, 'VERDICT').challenge).toMatchObject({ wasBluff: false, punishedPlayerId: 'p2' });

    const mixedService = deterministic();
    forceChallenge(mixedService, room, ['A', 'K']);
    expect(advanceTo(mixedService, room.code, 'VERDICT').challenge).toMatchObject({ wasBluff: true, punishedPlayerId: 'p1' });
  });

  it('forces a challenge when the previous player goes out of cards', () => {
    const room = makeRoom(2);
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['A']);
    const played = service.playCards(room.code, 'p1', [0]).state;
    expect(played.mustChallenge).toBe(true);
    expect(played.turnPlayerId).toBe('p2');
    expect(() => service.playCards(room.code, 'p2', [0])).toThrow('必须质疑');
    expect(service.autoAct(room.code).state.phase).toBe('CHALLENGE_CALLOUT');
  });

  it('auto-plays one legal card on a normal turn timeout', () => {
    const room = makeRoom(2);
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['A', 'K']);
    const result = service.advancePhase(room.code);
    expect(result.state.phase).toBe('TURN');
    expect(result.state.lastPlay).toMatchObject({ playerId: 'p1', count: 1 });
    expect(result.state.turnPlayerId).toBe('p2');
    expect(result.cues).toMatchObject([{ type: 'CARD_PLAYED', playerId: 'p1', count: 1 }]);
  });

  it('locks gameplay actions during cinematic phases', () => {
    const room = makeRoom(2);
    const service = deterministic();
    forceChallenge(service, room, ['A']);
    service.advancePhase(room.code);
    expect(service.getView(room.code, 'p1').phase).toBe('REVEAL');
    expect(() => service.playCards(room.code, 'p1', [0])).toThrow('当前阶段无法操作');
  });

  it('keeps revolvers independent and hides hit until PUNISHMENT_RESULT', () => {
    const room = makeRoom(3);
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['K']);
    service.debugSetRevolver(room.code, 'p1', { chamberCount: 6, bulletPosition: 1, currentChamber: 0, shotsTaken: 0 });
    service.debugSetRevolver(room.code, 'p2', { chamberCount: 6, bulletPosition: 0, currentChamber: 0, shotsTaken: 0 });
    service.playCards(room.code, 'p1', [0]);
    service.challenge(room.code, 'p2');
    expect(advanceTo(service, room.code, 'PUNISHMENT_TRIGGER').punishment).toBeNull();
    const dry = service.advancePhase(room.code).state;
    expect(dry.phase).toBe('PUNISHMENT_RESULT');
    expect(dry.punishment).toMatchObject({ punishedPlayerId: 'p1', chamber: 0, hit: false });

    service.advancePhase(room.code);
    advanceTo(service, room.code, 'TURN');
    service.debugSetHand(room.code, 'p1', ['A']);
    service.playCards(room.code, 'p1', [0]);
    const p2HitCallout = service.challenge(room.code, 'p2').state;
    expect(p2HitCallout.punishment).toBeNull();
    const hit = advanceTo(service, room.code, 'PUNISHMENT_RESULT');
    expect(hit.punishment).toMatchObject({ punishedPlayerId: 'p2', chamber: 0, hit: true, eliminatedPlayerId: 'p2' });
  });

  it('guarantees a hit by the sixth shot for one player revolver', () => {
    const room = makeRoom(3);
    const service = deterministic();
    startTurn(service, room);
    service.debugSetRevolver(room.code, 'p1', { chamberCount: 6, bulletPosition: 5, currentChamber: 0, shotsTaken: 0 });

    for (let shot = 1; shot <= 6; shot += 1) {
      advanceTo(service, room.code, 'TURN');
      service.debugSetHand(room.code, 'p1', ['K']);
      service.playCards(room.code, 'p1', [0]);
      service.challenge(room.code, 'p2');
      const result = advanceTo(service, room.code, 'PUNISHMENT_RESULT');
      expect(result.punishment).toMatchObject({ punishedPlayerId: 'p1', chamber: shot - 1, hit: shot === 6 });
      if (shot < 6) {
        service.advancePhase(room.code);
        service.advancePhase(room.code);
      }
    }
  });

  it('deals only alive players after an elimination and starts with the next alive player', () => {
    const room = makeRoom(3);
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['K']);
    service.debugSetRevolver(room.code, 'p1', { chamberCount: 6, bulletPosition: 0, currentChamber: 0, shotsTaken: 0 });
    service.playCards(room.code, 'p1', [0]);
    service.challenge(room.code, 'p2');

    const result = advanceTo(service, room.code, 'PUNISHMENT_RESULT');
    expect(result.players.find((player) => player.playerId === 'p1')).toMatchObject({ alive: false, handCount: 0 });
    service.advancePhase(room.code);
    const nextRound = service.advancePhase(room.code).state;
    expect(nextRound.phase).toBe('ROUND_START');
    expect(nextRound.turnPlayerId).toBe('p2');
    expect(nextRound.players.map((player) => [player.playerId, player.handCount, player.alive])).toEqual([
      ['p1', 0, false],
      ['p2', 5, true],
      ['p3', 5, true],
    ]);
  });
});
