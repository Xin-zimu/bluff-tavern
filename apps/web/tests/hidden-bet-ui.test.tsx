import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, beforeAll } from 'vitest';
import type { GameView, RoomView } from '@bluff-tavern/shared';
import { GameScreen } from '../src/screens/GameScreen';

const room: RoomView = {
  id: 'room-1',
  code: 'ABC123',
  hostPlayerId: 'p1',
  status: 'PLAYING',
  maxPlayers: 2,
  settings: {
    maxPlayers: 2,
    gameMode: 'PARTY',
    turnDurationSeconds: 15,
    eventEnabled: false,
    bulletCount: null,
    v7: { itemsEnabled: false, tavernEventsEnabled: false, characterAbilitiesEnabled: false },
  },
  players: [
    { id: 'p1', nickname: 'Alpha', status: 'PLAYING', joinedAt: 0, isConnected: true, characterId: null },
    { id: 'p2', nickname: 'Beta', status: 'PLAYING', joinedAt: 0, isConnected: true, characterId: null },
  ],
  createdAt: 0,
};

function hiddenBetView(): GameView {
  return {
    sequence: 10,
    serverNow: 1_000,
    phase: 'TURN',
    phaseStartedAt: 1_000,
    phaseEndsAt: 16_000,
    gameMode: 'PARTY',
    turnDurationSeconds: 15,
    roundNumber: 1,
    targetRank: 'A',
    targetCard: 'A',
    turnPlayerId: 'p2',
    mustChallenge: false,
    minimumPlayCount: 1,
    maximumPlayCount: 3,
    turnDirection: 'CLOCKWISE',
    players: [
      { playerId: 'p1', name: 'Alpha', seatIndex: 0, connected: true, alive: true, handCount: null, cardCount: null },
      { playerId: 'p2', name: 'Beta', seatIndex: 1, connected: true, alive: true, handCount: 5, cardCount: 5 },
    ],
    hand: ['A', 'K', 'Q', 'JOKER', 'A'],
    discardCount: null,
    lastPlay: { playerId: 'p1', count: null, claimedRank: 'A' },
    challenge: null,
    punishment: null,
    winner: null,
    freeChallenge: null,
    sharedRevolver: null,
    alivePlayerIds: ['p1', 'p2'],
    winnerId: null,
    summary: null,
    tavernEvent: {
      type: 'HIDDEN_BET',
      title: '暗注夜',
      description: '本轮其他玩家的剩余手牌数量与每次出牌数量都会隐藏，只有质疑翻牌时才公开被质疑那一手的真实数量。',
      category: 'INFORMATION',
      roundNumber: 1,
      turnDurationSeconds: null,
      intensity: 'HIGH',
    },
    partyEventHistory: [{ roundNumber: 1, type: 'HIDDEN_BET', title: '暗注夜' }],
    items: [],
    itemEffect: null,
    abilityEffect: null,
    challengeResult: null,
  };
}

describe('HIDDEN_BET UI projection', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
      configurable: true,
    });
  });

  it('does not leak hidden count through text or pile backs before reveal', () => {
    const html = renderToStaticMarkup(createElement(GameScreen, {
      room,
      game: hiddenBetView(),
      playerId: 'p2',
      audioMuted: true,
      lowPowerActive: true,
      reduceMotion: true,
      onToggleAudio: () => undefined,
      onToggleLowPower: () => undefined,
      onToggleReduceMotion: () => undefined,
      onPlay: () => undefined,
      onChallenge: () => undefined,
      onReturnToRoom: () => undefined,
      onLeaveRoom: () => undefined,
      onFullscreen: () => undefined,
      onUseItem: () => undefined,
      onShare: () => undefined,
    }));

    expect(html).toContain('数量暂时隐藏');
    expect(html).toContain('已出数量暂时隐藏');
    expect(html).toContain('手牌数量隐藏');
    expect(html).toContain('Alpha 已下注');
    expect(html).toContain('上一手已下注，数量暂时隐藏');
    expect(html).not.toContain('已出 2 张');
    expect(html).not.toContain('2 张手牌');
    expect(html).not.toContain('3 张手牌');
    expect(html).not.toContain('2 张 A');
    expect(html).not.toContain('A × 2');
    expect(html).not.toContain('声明：2 张');
    expect(html).not.toContain('title="2');
    expect(html).not.toContain('aria-label="2');
    expect(html.match(/table-pile__card-back/g)).toHaveLength(1);
  });
});
