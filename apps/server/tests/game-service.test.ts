import { describe, expect, it } from 'vitest';
import type { CardRank, GameView, RoomView } from '@bluff-tavern/shared';
import { GameService } from '../src/game/game-service.js';

const room: RoomView = { id: 'room', code: 'ABC234', hostPlayerId: 'p1', status: 'PLAYING', maxPlayers: 4, settings: { maxPlayers: 4 }, createdAt: 1, players: ['p1', 'p2', 'p3', 'p4'].map((id, index) => ({ id, nickname: id, status: 'PLAYING', joinedAt: index })) };
const game = () => new GameService({ nextInt: () => 0 });

function playCard(service: GameService, predicate: (card: CardRank, state: GameView) => boolean) {
  const state = service.start(room);
  const index = state.hand.findIndex((card) => predicate(card, state));
  if (index < 0) throw new Error('Expected card not dealt');
  service.playCards(room.code, state.turnPlayerId, [index]);
  return service.getView(room.code, 'p2');
}

describe('GameService challenges', () => {
  it('makes the challenger fail when the revealed card matches target', () => {
    const service = game(); const challenger = playCard(service, (card, state) => card === state.targetCard);
    const result = service.challenge(room.code, challenger.turnPlayerId);
    expect(result.challengeResult).toMatchObject({ wasBluff: false, failedPlayerId: challenger.turnPlayerId });
  });
  it('makes the previous player fail on a fake card', () => {
    const service = game(); const challenger = playCard(service, (card, state) => card !== state.targetCard && card !== 'JOKER');
    const result = service.challenge(room.code, challenger.turnPlayerId);
    expect(result.challengeResult).toMatchObject({ wasBluff: true, failedPlayerId: 'p1' });
  });
  it('treats Joker as a valid target card', () => {
    const service = game(); const twoPlayers = { ...room, players: room.players.slice(0, 2) };
    const state = service.start(twoPlayers); const index = state.hand.findIndex((card) => card === 'JOKER');
    if (index < 0) throw new Error('Expected Joker not dealt');
    service.playCards(twoPlayers.code, state.turnPlayerId, [index]);
    const challenger = service.getView(twoPlayers.code, 'p2');
    expect(service.challenge(room.code, challenger.turnPlayerId).challengeResult?.wasBluff).toBe(false);
  });
  it('finds a bluff when a multi-card play contains one invalid card', () => {
    const service = game(); const state = service.start(room);
    const valid = state.hand.findIndex((card) => card === state.targetCard || card === 'JOKER');
    const invalid = state.hand.findIndex((card) => card !== state.targetCard && card !== 'JOKER');
    service.playCards(room.code, state.turnPlayerId, [valid, invalid]);
    const result = service.challenge(room.code, 'p2').challengeResult;
    expect(result?.wasBluff).toBe(true);
    expect(result?.revealedCards).toContain(state.hand[invalid]!);
  });
  it('locks duplicate challenges after the first result', () => {
    const service = game(); const challenger = playCard(service, () => true);
    service.challenge(room.code, challenger.turnPlayerId);
    expect(() => service.challenge(room.code, challenger.turnPlayerId)).toThrow('当前无法发起质疑');
  });
  it('rejects a challenge from a non-current player', () => {
    const service = game(); playCard(service, () => true);
    expect(() => service.challenge(room.code, 'p3')).toThrow('当前无法发起质疑');
  });

  it('resolves an empty chamber and starts the next round', () => {
    const service = new GameService({ nextInt: (max) => max === 6 ? 1 : 0 });
    const twoPlayers = { ...room, players: room.players.slice(0, 2) };
    const state = service.start(twoPlayers);
    service.playCards(twoPlayers.code, state.turnPlayerId, [0]);
    service.challenge(twoPlayers.code, 'p2');
    const punishment = service.punish(twoPlayers.code);
    expect(punishment).toMatchObject({ hit: false, gameOver: false });
    expect(punishment.state.roundNumber).toBe(2);
    expect(punishment.state.alivePlayerIds).toEqual(['p1', 'p2']);
  });

  it('eliminates a player on a live bullet and declares the final survivor', () => {
    const service = new GameService({ nextInt: () => 0 });
    const twoPlayers = { ...room, players: room.players.slice(0, 2) };
    const state = service.start(twoPlayers);
    service.playCards(twoPlayers.code, state.turnPlayerId, [0]);
    service.challenge(twoPlayers.code, 'p2');
    const punishment = service.punish(twoPlayers.code);
    expect(punishment).toMatchObject({ hit: true, gameOver: true });
    expect(punishment.state.phase).toBe('GAME_OVER');
    expect(punishment.state.alivePlayerIds).toHaveLength(1);
    expect(punishment.state.winnerId).not.toBe(punishment.playerId);
  });
});
