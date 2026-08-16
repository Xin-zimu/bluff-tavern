import { describe, expect, it } from 'vitest';
import { joinRoomSchema } from '../src/index.js';

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
