import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { GameView } from '@bluff-tavern/shared';
import { canSendAuthoritativeResync, isPhaseTimeoutResyncDue, type SnapshotTiming } from '../src/stores/game-resync';
import { shouldAcceptGameSnapshot, useSessionStore } from '../src/stores/session-store';

function game(overrides: Partial<GameView>): GameView {
  return {
    sequence: 20,
    serverNow: 2_000,
    phase: 'TURN',
    phaseStartedAt: 1_000,
    phaseEndsAt: 16_000,
    gameMode: 'CLASSIC',
    turnDurationSeconds: 15,
    roundNumber: 1,
    targetRank: 'A',
    targetCard: 'A',
    turnPlayerId: 'p1',
    mustChallenge: false,
    minimumPlayCount: 1,
    maximumPlayCount: 3,
    turnDirection: 'CLOCKWISE',
    players: [
      { playerId: 'p1', name: 'p1', seatIndex: 0, connected: true, alive: true, handCount: 5, cardCount: 5 },
      { playerId: 'p2', name: 'p2', seatIndex: 1, connected: true, alive: true, handCount: 5, cardCount: 5 },
    ],
    hand: [],
    discardCount: 0,
    lastPlay: null,
    challenge: null,
    punishment: null,
    winner: null,
    freeChallenge: null,
    sharedRevolver: null,
    alivePlayerIds: ['p1', 'p2'],
    winnerId: null,
    summary: null,
    tavernEvent: null,
    partyEventHistory: [],
    items: [],
    itemEffect: null,
    abilityEffect: null,
    challengeResult: null,
    ...overrides,
  };
}

describe('game snapshot reconciliation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    useSessionStore.setState({ game: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts higher sequence even when serverNow is lower', () => {
    expect(shouldAcceptGameSnapshot(game({ sequence: 20, serverNow: 2_000 }), game({ sequence: 21, serverNow: 1_500 }))).toBe(true);
  });

  it('rejects lower sequence', () => {
    expect(shouldAcceptGameSnapshot(game({ sequence: 20 }), game({ sequence: 19 }))).toBe(false);
  });

  it('rejects older serverNow for the same sequence', () => {
    expect(shouldAcceptGameSnapshot(game({ sequence: 20, serverNow: 2_000 }), game({ sequence: 20, serverNow: 1_900 }))).toBe(false);
  });

  it('accepts newer serverNow for the same sequence', () => {
    expect(shouldAcceptGameSnapshot(game({ sequence: 20, serverNow: 2_000 }), game({ sequence: 20, serverNow: 2_100 }))).toBe(true);
  });

  it('keeps a newer turn snapshot when an older snapshot arrives later', () => {
    useSessionStore.getState().setGame(game({ sequence: 30, turnPlayerId: 'p2', mustChallenge: false }), 'game:state');
    useSessionStore.getState().setGame(game({ sequence: 29, turnPlayerId: 'p1', mustChallenge: false }), 'game:snapshot');

    expect(useSessionStore.getState().game).toMatchObject({ sequence: 30, turnPlayerId: 'p2' });
  });

  it('keeps a newer broadcast when a stale action ack arrives later', () => {
    useSessionStore.getState().setGame(game({ sequence: 41, turnPlayerId: 'p2' }), 'game:state');
    useSessionStore.getState().setGame(game({ sequence: 40, turnPlayerId: 'p1' }), 'ack:game:playCards');
    useSessionStore.getState().setGame(game({ sequence: 40, turnPlayerId: 'p1' }), 'ack:game:challenge');
    useSessionStore.getState().setGame(game({ sequence: 40, turnPlayerId: 'p1' }), 'ack:game:useItem');
    useSessionStore.getState().setGame(game({ sequence: 40, turnPlayerId: 'p1' }), 'session:resume');

    expect(useSessionStore.getState().game).toMatchObject({ sequence: 41, turnPlayerId: 'p2' });
  });
});

describe('automatic authoritative recovery', () => {
  const throttleMs = 4_000;
  const graceMs = 2_000;

  function timing(overrides: Partial<SnapshotTiming> = {}): SnapshotTiming {
    return {
      sequence: 20,
      localReceivedAt: 1_000,
      serverNow: 10_000,
      ...overrides,
    };
  }

  function staleTurn(sequence = 20): GameView {
    return game({
      sequence,
      serverNow: 10_000,
      phaseStartedAt: 1_000,
      phaseEndsAt: 12_000,
    });
  }

  it('sends session resume on the first timeout when not throttled', () => {
    const now = 15_001;
    const snapshotTiming = timing();

    expect(isPhaseTimeoutResyncDue({ game: staleTurn(), timing: snapshotTiming, now, graceMs })).toBe(true);
    expect(canSendAuthoritativeResync({
      hasSessionToken: true,
      socketConnected: true,
      now,
      lastResyncAt: now - throttleMs,
      throttleMs,
    })).toBe(true);
  });

  it('does not permanently consume a sequence when throttle blocks the first timeout check', () => {
    const snapshotTiming = timing();
    const lastResyncAt = 12_000;

    expect(isPhaseTimeoutResyncDue({ game: staleTurn(), timing: snapshotTiming, now: 14_000, graceMs })).toBe(true);
    expect(canSendAuthoritativeResync({
      hasSessionToken: true,
      socketConnected: true,
      now: 14_000,
      lastResyncAt,
      throttleMs,
    })).toBe(false);

    expect(isPhaseTimeoutResyncDue({ game: staleTurn(), timing: snapshotTiming, now: 16_001, graceMs })).toBe(true);
    expect(canSendAuthoritativeResync({
      hasSessionToken: true,
      socketConnected: true,
      now: 16_001,
      lastResyncAt,
      throttleMs,
    })).toBe(true);
  });

  it('allows the same stale sequence to retry after cooldown', () => {
    const snapshotTiming = timing();
    const lastResyncAt = 15_001;

    expect(isPhaseTimeoutResyncDue({ game: staleTurn(), timing: snapshotTiming, now: 19_002, graceMs })).toBe(true);
    expect(canSendAuthoritativeResync({
      hasSessionToken: true,
      socketConnected: true,
      now: 19_002,
      lastResyncAt,
      throttleMs,
    })).toBe(true);
  });

  it('stops retrying the previous sequence after a newer fresh sequence arrives', () => {
    const freshSequence = game({
      sequence: 21,
      serverNow: 20_000,
      phaseStartedAt: 20_000,
      phaseEndsAt: 35_000,
    });
    const snapshotTiming = timing({ sequence: 21, localReceivedAt: 20_000, serverNow: 20_000 });

    expect(isPhaseTimeoutResyncDue({ game: freshSequence, timing: snapshotTiming, now: 20_500, graceMs })).toBe(false);
  });

  it('does not record a disconnected socket as a successful resync attempt', () => {
    const now = 15_001;
    const snapshotTiming = timing();

    expect(isPhaseTimeoutResyncDue({ game: staleTurn(), timing: snapshotTiming, now, graceMs })).toBe(true);
    expect(canSendAuthoritativeResync({
      hasSessionToken: true,
      socketConnected: false,
      now,
      lastResyncAt: 0,
      throttleMs,
    })).toBe(false);

    expect(canSendAuthoritativeResync({
      hasSessionToken: true,
      socketConnected: true,
      now: now + 500,
      lastResyncAt: 0,
      throttleMs,
    })).toBe(true);
  });
});
