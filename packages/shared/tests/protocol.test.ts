import { describe, expect, it } from 'vitest';
import { joinRoomSchema, playCardsSchema, updateRoomSettingsSchema } from '../src/index.js';

describe('joinRoomSchema', () => {
  it('normalizes valid room codes and nicknames', () => {
    expect(joinRoomSchema.parse({ nickname: '  狐狸  ', roomCode: 'abc234' })).toEqual({
      nickname: '狐狸', roomCode: 'ABC234',
    });
  });

  it('rejects ambiguous room-code characters', () => {
    expect(joinRoomSchema.safeParse({ nickname: '狼', roomCode: 'AB10OL' }).success).toBe(false);
  });
});

describe('V6 protocol schemas', () => {
  it('allows only Classic and Quick game modes', () => {
    expect(updateRoomSettingsSchema.safeParse({ roomCode: 'ABC234', maxPlayers: 4, gameMode: 'CLASSIC', requestId: crypto.randomUUID() }).success).toBe(true);
    expect(updateRoomSettingsSchema.safeParse({ roomCode: 'ABC234', maxPlayers: 4, gameMode: 'QUICK', requestId: crypto.randomUUID() }).success).toBe(true);
    expect(updateRoomSettingsSchema.safeParse({ roomCode: 'ABC234', maxPlayers: 4, gameMode: 'PARTY', requestId: crypto.randomUUID() }).success).toBe(false);
    expect(updateRoomSettingsSchema.safeParse({ roomCode: 'ABC234', maxPlayers: 4, gameMode: 'CUSTOM', requestId: crypto.randomUUID() }).success).toBe(false);
  });

  it('accepts V7 extension flags without enabling new game modes', () => {
    expect(updateRoomSettingsSchema.safeParse({
      roomCode: 'ABC234',
      maxPlayers: 4,
      gameMode: 'CLASSIC',
      requestId: crypto.randomUUID(),
      v7: { itemsEnabled: true, tavernEventsEnabled: true, characterAbilitiesEnabled: true },
    }).success).toBe(true);
  });

  it('requires one to three unique card indexes', () => {
    expect(playCardsSchema.safeParse({ roomCode: 'ABC234', cardIndexes: [0, 1, 2], requestId: crypto.randomUUID() }).success).toBe(true);
    expect(playCardsSchema.safeParse({ roomCode: 'ABC234', cardIndexes: [0, 0], requestId: crypto.randomUUID() }).success).toBe(false);
    expect(playCardsSchema.safeParse({ roomCode: 'ABC234', cardIndexes: [0, 1, 2, 3], requestId: crypto.randomUUID() }).success).toBe(false);
  });
});
