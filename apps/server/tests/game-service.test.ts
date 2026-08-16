import { describe, expect, it } from 'vitest';
import type { RoomView } from '@bluff-tavern/shared';
import { GameService } from '../src/game/game-service.js';

const room: RoomView = {
  id: 'room', code: 'ABC234', hostPlayerId: 'p1', status: 'PLAYING', maxPlayers: 4, settings: { maxPlayers: 4 }, createdAt: 1,
  players: ['p1', 'p2', 'p3', 'p4'].map((id, index) => ({ id, nickname: id, status: 'PLAYING', joinedAt: index })),
};

describe('GameService', () => {
  it('deals private hands, enforces turns, and starts a new round after all cards are played', () => {
    const game = new GameService({ nextInt: () => 0 });
    const first = game.start(room);
    expect(first.hand).toHaveLength(5);
    expect(first.players).toEqual(expect.arrayContaining([{ playerId: 'p2', cardCount: 5 }]));
    expect(() => game.playCards(room.code, 'p2', [0])).toThrow('现在不是你的回合');
    let state = first;
    let plays = 0;
    while (state.roundNumber === 1) {
      const cards = Array.from({ length: Math.min(3, state.hand.length) }, (_, index) => index);
      const result = game.playCards(room.code, state.turnPlayerId, cards);
      plays += 1;
      state = game.getView(room.code, result.state.turnPlayerId);
    }
    expect(plays).toBeGreaterThan(4);
    expect(state.roundNumber).toBe(2);
    expect(state.discardCount).toBe(0);
    expect(state.hand).toHaveLength(5);
  });

  it('rejects card indexes outside the authoritative hand', () => {
    const game = new GameService({ nextInt: () => 0 });
    const first = game.start(room);
    expect(() => game.playCards(room.code, first.turnPlayerId, [99])).toThrow('选择了不存在的手牌');
  });
});
