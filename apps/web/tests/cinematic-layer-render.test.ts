import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CardRank, GamePhase, GameView, PublicPunishmentState, RoomView } from '@bluff-tavern/shared';
import { CinematicLayer } from '../src/components/CinematicLayer';
import { REVEAL_TIMING } from '../src/components/cinematic-reveal-state';

const removedSealClass = ['verdict', 'seal'].join('__');

const room: RoomView = {
  id: 'room-1',
  code: 'ABC123',
  hostPlayerId: 'p1',
  status: 'PLAYING',
  maxPlayers: 2,
  settings: {
    maxPlayers: 2,
    gameMode: 'CLASSIC',
    turnDurationSeconds: 15,
    eventEnabled: false,
    bulletCount: null,
    v7: {
      itemsEnabled: false,
      tavernEventsEnabled: false,
      characterAbilitiesEnabled: false,
    },
  },
  players: [
    { id: 'p1', nickname: 'Alpha', status: 'PLAYING', joinedAt: 0, isConnected: true, characterId: null },
    { id: 'p2', nickname: 'Beta', status: 'PLAYING', joinedAt: 0, isConnected: true, characterId: null },
  ],
  createdAt: 0,
};

function punishment(): PublicPunishmentState {
  return {
    punishedPlayerId: 'p1',
    playerId: 'p1',
    chamber: 2,
    hit: false,
    eliminatedPlayerId: null,
    shotNumber: 1,
    totalShots: 1,
  };
}

function game(phase: GamePhase, cards: CardRank[] | null = ['A', 'Q', 'JOKER']): GameView {
  return {
    sequence: 1,
    serverNow: 1_000,
    phase,
    phaseStartedAt: 1_000,
    phaseEndsAt: 4_000,
    gameMode: 'CLASSIC',
    turnDurationSeconds: 15,
    roundNumber: 1,
    targetRank: 'A',
    targetCard: 'A',
    turnPlayerId: 'p1',
    mustChallenge: false,
    minimumPlayCount: 1,
    turnDirection: 'CLOCKWISE',
    players: [
      { playerId: 'p1', name: 'Alpha', seatIndex: 0, connected: true, alive: true, handCount: 2, cardCount: 2 },
      { playerId: 'p2', name: 'Beta', seatIndex: 1, connected: true, alive: true, handCount: 3, cardCount: 3 },
    ],
    hand: [],
    discardCount: 3,
    lastPlay: { playerId: 'p1', count: 3, claimedRank: 'A' },
    challenge: cards
      ? {
          challengerId: 'p2',
          challengedId: 'p1',
          revealedCards: cards,
          wasBluff: phase === 'REVEAL' ? null : true,
          punishedPlayerId: phase === 'REVEAL' ? null : 'p1',
        }
      : null,
    punishment: phase.startsWith('PUNISHMENT') ? punishment() : null,
    winner: null,
    freeChallenge: null,
    sharedRevolver: null,
    alivePlayerIds: ['p1', 'p2'],
    winnerId: null,
    summary: null,
    tavernEvent: null,
    items: [],
    itemEffect: null,
    abilityEffect: null,
    challengeResult: null,
  };
}

function renderPhase(phase: GamePhase) {
  return renderToStaticMarkup(createElement(CinematicLayer, {
    game: game(phase),
    room,
    now: 1_000 + REVEAL_TIMING.intro + REVEAL_TIMING.perCard * 3 + 200,
  }));
}

describe('cinematic layer reveal DOM', () => {
  it('uses the 3D reveal card DOM only during REVEAL', () => {
    const html = renderPhase('REVEAL');

    expect(html).toContain('class="reveal-cards');
    expect(html).toContain('class="reveal-card ');
    expect(html).toContain('reveal-card__back');
    expect(html).not.toContain('static-reveal-card');
  });

  it.each(['VERDICT', 'PUNISHMENT_INTRO', 'PUNISHMENT_TRIGGER', 'PUNISHMENT_RESULT', 'ROUND_END'] as const)('uses only static face-up challenged cards during %s', (phase) => {
    const html = renderPhase(phase);

    expect(html).toContain('class="static-reveal-cards"');
    expect(html).toContain('class="static-reveal-card');
    expect(html).not.toContain('class="reveal-card');
    expect(html).not.toContain('reveal-card__back');
    expect(html).not.toContain(removedSealClass);
  });
});
