import { describe, expect, it } from 'vitest';
import type { CardRank, CharacterId, PlayableGameMode, RoomView, V7ExtensionSettings } from '@bluff-tavern/shared';
import { GameService } from '../src/game/game-service.js';

const defaultV7: V7ExtensionSettings = { itemsEnabled: false, tavernEventsEnabled: false, characterAbilitiesEnabled: false };

function makeV7(overrides: Partial<V7ExtensionSettings>): V7ExtensionSettings {
  return { ...defaultV7, ...overrides };
}

function makeRoom(playerCount: number, code = 'ABC234', v7: V7ExtensionSettings = defaultV7, characters: Array<CharacterId | null> = [], gameMode: PlayableGameMode = 'CLASSIC'): RoomView {
  return {
    id: code,
    code,
    hostPlayerId: 'p1',
    status: 'PLAYING',
    maxPlayers: playerCount,
    settings: { maxPlayers: playerCount, gameMode, turnDurationSeconds: gameMode === 'QUICK' ? 7 : 15, eventEnabled: false, bulletCount: null, v7: { ...v7 } },
    createdAt: 1,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index + 1}`,
      nickname: `p${index + 1}`,
      status: 'PLAYING' as const,
      joinedAt: index,
      isConnected: true,
      characterId: characters[index] ?? null,
    })),
  };
}

const deterministic = () => new GameService({ nextInt: () => 0 });

const eventRandom = (eventIndex: 0 | 1 | 2) => new GameService({
  nextInt: (maxExclusive) => {
    if (maxExclusive === 100) return 0;
    if (maxExclusive === 3) return eventIndex;
    return 0;
  },
});

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

  it('enforces the escalation minimum play count from the previous hand', () => {
    const room = makeRoom(2, 'ABC234', defaultV7, [], 'ESCALATION');
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['A', 'K', 'Q', 'JOKER', 'A']);
    service.debugSetHand(room.code, 'p2', ['A', 'K', 'Q', 'JOKER', 'A']);

    const firstPlay = service.playCards(room.code, 'p1', [0, 1]).state;

    expect(firstPlay).toMatchObject({ gameMode: 'ESCALATION', lastPlay: { playerId: 'p1', count: 2 }, minimumPlayCount: 2, turnPlayerId: 'p2' });
    expect(() => service.playCards(room.code, 'p2', [0])).toThrow('至少选择 2 张牌');
    const response = service.playCards(room.code, 'p2', [0, 1]).state;
    expect(response).toMatchObject({ lastPlay: { playerId: 'p2', count: 2 }, minimumPlayCount: 2, turnPlayerId: 'p1' });
  });

  it('forces an escalation challenge when the next player cannot match the minimum', () => {
    const room = makeRoom(2, 'ABC234', defaultV7, [], 'ESCALATION');
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['A', 'K', 'Q', 'JOKER', 'A']);
    service.debugSetHand(room.code, 'p2', ['A', 'K']);

    const played = service.playCards(room.code, 'p1', [0, 1, 2]).state;

    expect(played).toMatchObject({ mustChallenge: true, minimumPlayCount: 3, turnPlayerId: 'p2' });
    expect(() => service.playCards(room.code, 'p2', [0, 1])).toThrow('必须质疑');
    expect(service.autoAct(room.code).state.phase).toBe('CHALLENGE_CALLOUT');
  });

  it('auto-plays the current escalation minimum on timeout', () => {
    const room = makeRoom(2, 'ABC234', defaultV7, [], 'ESCALATION');
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['A', 'K', 'Q', 'JOKER', 'A']);
    service.debugSetHand(room.code, 'p2', ['A', 'K', 'Q', 'JOKER', 'A']);
    service.playCards(room.code, 'p1', [0, 1]);

    const result = service.advancePhase(room.code);

    expect(result.state).toMatchObject({ lastPlay: { playerId: 'p2', count: 2 }, minimumPlayCount: 2, turnPlayerId: 'p1' });
    expect(result.cues).toMatchObject([{ type: 'CARD_PLAYED', playerId: 'p2', count: 2 }]);
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

  it('keeps V7 items disabled by default', () => {
    const room = makeRoom(2);
    const service = deterministic();
    const turn = startTurn(service, room);

    expect(turn.items).toEqual([]);
    expect(turn.itemEffect).toBeNull();
    expect(turn.abilityEffect).toBeNull();
    expect(turn.tavernEvent).toBeNull();
    expect(() => service.useItem(room.code, 'p1', 'SPYGLASS')).toThrow('道具未开启');
  });

  it('runs the wolf table-read ability as a private round hint', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ characterAbilitiesEnabled: true }), ['WOLF']);
    const service = deterministic();
    service.start(room);
    service.debugSetHand(room.code, 'p1', ['A', 'K', 'JOKER', 'Q', 'A']);

    const turn = service.advancePhase(room.code).state;

    expect(turn.abilityEffect).toMatchObject({ characterId: 'WOLF', abilityId: 'WOLF_TABLE_READ', type: 'ROUND_READ' });
    expect(turn.abilityEffect?.message).toContain('3 张目标牌或 Joker');
    expect(service.getView(room.code, 'p2').abilityEffect).toBeNull();
  });

  it('runs the fox hand-hint ability once per match', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ characterAbilitiesEnabled: true }), ['FOX']);
    const service = deterministic();
    service.start(room);
    service.debugSetHand(room.code, 'p1', ['K', 'Q', 'K', 'Q', 'K']);

    const turn = service.advancePhase(room.code).state;

    expect(turn.abilityEffect).toMatchObject({ characterId: 'FOX', abilityId: 'FOX_HAND_HINT', type: 'HAND_HINT' });
    expect(turn.abilityEffect?.message).toContain('目标牌不足');
  });

  it('extends the bear opening turn without changing rule state', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ characterAbilitiesEnabled: true }), ['BEAR']);
    const service = deterministic();

    const turn = startTurn(service, room);

    expect((turn.phaseEndsAt ?? 0) - turn.phaseStartedAt).toBe(17_000);
    expect(turn.abilityEffect).toMatchObject({ characterId: 'BEAR', abilityId: 'BEAR_OPENING_NERVE', type: 'TURN_TIME_EXTENDED', extraSeconds: 2 });
    expect(turn.discardCount).toBe(0);
  });

  it('extends the rabbit first own turn once per match', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ characterAbilitiesEnabled: true }), ['RABBIT']);
    const service = deterministic();

    const turn = startTurn(service, room);

    expect((turn.phaseEndsAt ?? 0) - turn.phaseStartedAt).toBe(18_000);
    expect(turn.abilityEffect).toMatchObject({ characterId: 'RABBIT', abilityId: 'RABBIT_QUICK_STEP', type: 'TURN_TIME_EXTENDED', extraSeconds: 3 });
  });

  it('keeps the cat risk hint private at round start', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ characterAbilitiesEnabled: true }), ['CAT']);
    const service = deterministic();

    const round = service.start(room);

    expect(round.abilityEffect).toMatchObject({ characterId: 'CAT', abilityId: 'CAT_NIGHT_EYE', type: 'RISK_HINT', riskLevel: 'HIGH' });
    expect(service.getView(room.code, 'p2').abilityEffect).toBeNull();
  });

  it('lets the raccoon find one extra low-risk item only when both switches are enabled', () => {
    const enabledRoom = makeRoom(2, 'ABC234', makeV7({ itemsEnabled: true, characterAbilitiesEnabled: true }), ['RACCOON']);
    const enabledService = deterministic();
    const enabled = enabledService.start(enabledRoom);

    expect(enabled.items).toHaveLength(2);
    expect(enabled.abilityEffect).toMatchObject({ characterId: 'RACCOON', abilityId: 'RACCOON_POCKET_FIND', type: 'ITEM_GRANTED', grantedItem: 'SPYGLASS' });

    const disabledRoom = makeRoom(2, 'DEF234', makeV7({ characterAbilitiesEnabled: true }), ['RACCOON']);
    const disabledService = deterministic();
    const disabled = disabledService.start(disabledRoom);

    expect(disabled.items).toEqual([]);
    expect(disabled.abilityEffect).toMatchObject({ characterId: 'RACCOON', abilityId: 'RACCOON_POCKET_FIND', type: 'ITEM_SKIPPED' });
  });

  it('extends the frog forced-challenge turn once per match', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ characterAbilitiesEnabled: true }), [null, 'FROG']);
    const service = deterministic();
    startTurn(service, room);
    service.debugSetHand(room.code, 'p1', ['A']);

    service.playCards(room.code, 'p1', [0]);
    const frog = service.getView(room.code, 'p2');

    expect(frog.mustChallenge).toBe(true);
    expect((frog.phaseEndsAt ?? 0) - frog.phaseStartedAt).toBe(19_000);
    expect(frog.abilityEffect).toMatchObject({ characterId: 'FROG', abilityId: 'FROG_STEADY_BREATH', type: 'FORCED_CHALLENGE_TIME', extraSeconds: 4 });
  });

  it('gives the panda a private reveal memory after verdict', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ characterAbilitiesEnabled: true }), [null, 'PANDA']);
    const service = deterministic();
    forceChallenge(service, room, ['A', 'K']);

    advanceTo(service, room.code, 'VERDICT');
    const panda = service.getView(room.code, 'p2');

    expect(panda.abilityEffect).toMatchObject({ characterId: 'PANDA', abilityId: 'PANDA_REVEAL_MEMORY', type: 'REVEAL_MEMORY' });
    expect(panda.abilityEffect?.message).toContain('目标/Joker 1 张，非目标 1 张');
  });

  it('keeps V7 item inventory and effects private', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ itemsEnabled: true }));
    const service = deterministic();
    startTurn(service, room);
    service.debugSetItems(room.code, 'p1', ['SPYGLASS']);
    service.debugSetItems(room.code, 'p2', ['POCKET_WATCH']);
    service.debugSetRevolver(room.code, 'p1', { chamberCount: 6, bulletPosition: 2, currentChamber: 2, shotsTaken: 0 });

    const used = service.useItem(room.code, 'p1', 'SPYGLASS');

    expect(used.items).toEqual([]);
    expect(used.itemEffect).toMatchObject({ itemId: 'SPYGLASS', type: 'SPYGLASS_RISK', riskLevel: 'HIGH' });
    expect(service.getView(room.code, 'p2').items).toEqual(['POCKET_WATCH']);
    expect(service.getView(room.code, 'p2').itemEffect).toBeNull();
  });

  it('lets the pocket watch extend only the current owner turn', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ itemsEnabled: true }));
    const service = deterministic();
    const turn = startTurn(service, room);
    service.debugSetItems(room.code, 'p1', ['POCKET_WATCH']);
    service.debugSetItems(room.code, 'p2', ['POCKET_WATCH']);
    const beforeEndsAt = turn.phaseEndsAt;
    if (!beforeEndsAt) throw new Error('Missing turn end time');

    const used = service.useItem(room.code, 'p1', 'POCKET_WATCH');

    expect(used.phaseEndsAt).toBe(beforeEndsAt + 7_000);
    expect(used.sequence).toBeGreaterThan(turn.sequence);
    expect(used.items).toEqual([]);
    expect(used.itemEffect).toMatchObject({ itemId: 'POCKET_WATCH', type: 'POCKET_WATCH_EXTENDED', extraSeconds: 7 });
    expect(() => service.useItem(room.code, 'p2', 'POCKET_WATCH')).toThrow('怀表只能在自己的回合使用');
  });

  it('lets the tavern mug disturb only private presentation hints', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ itemsEnabled: true }));
    const service = deterministic();
    const turn = startTurn(service, room);
    service.debugSetItems(room.code, 'p2', ['TAVERN_MUG']);

    const used = service.useItem(room.code, 'p2', 'TAVERN_MUG');

    expect(used.itemEffect).toMatchObject({ itemId: 'TAVERN_MUG', type: 'TAVERN_MUG_TIPSY' });
    expect(used.turnPlayerId).toBe(turn.turnPlayerId);
    expect(used.discardCount).toBe(turn.discardCount);
    expect(service.getView(room.code, 'p1').itemEffect).toBeNull();
  });

  it.each([
    ['RAPID_NIGHT', 0, 10],
    ['CANDLE_FLICKER', 1, 15],
    ['DOUBLE_DANGER', 2, 15],
  ] as const)('draws the enabled tavern event %s into the public round snapshot', (eventType, eventIndex, expectedTurnSeconds) => {
    const room = makeRoom(2, 'ABC234', makeV7({ tavernEventsEnabled: true }));
    const service = eventRandom(eventIndex);

    const round = service.start(room);
    const turn = service.advancePhase(room.code).state;

    expect(round.tavernEvent).toMatchObject({ type: eventType, roundNumber: 1 });
    expect(turn.tavernEvent).toMatchObject({ type: eventType, roundNumber: 1 });
    expect(turn.turnDurationSeconds).toBe(expectedTurnSeconds);
    expect((turn.phaseEndsAt ?? 0) - turn.phaseStartedAt).toBe(expectedTurnSeconds * 1_000);
  });

  it('does not draw tavern events when the chance roll misses', () => {
    const room = makeRoom(2, 'ABC234', makeV7({ tavernEventsEnabled: true }));
    const service = new GameService({ nextInt: (maxExclusive) => maxExclusive === 100 ? 99 : 0 });

    const round = service.start(room);
    const turn = service.advancePhase(room.code).state;

    expect(round.tavernEvent).toBeNull();
    expect(turn.tavernEvent).toBeNull();
    expect(turn.turnDurationSeconds).toBe(15);
  });
});
