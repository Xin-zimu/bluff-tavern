import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET } from '@bluff-tavern/shared';
import { RoomStore } from '../src/rooms/room-store.js';

describe('RoomStore', () => {
  it('creates a six-character room and transfers host when creator leaves', () => {
    const store = new RoomStore(() => 0);
    const created = store.create('狼', 'socket-a');
    expect(created.room.code).toBe(ROOM_CODE_ALPHABET[0]!.repeat(6));
    const joined = store.join(created.room.code, '狐狸', 'socket-b');
    const left = store.leaveBySocket('socket-a');
    expect(left?.room?.players).toHaveLength(1);
    expect(left?.room?.hostPlayerId).toBe(joined.playerId);
  });

  it('removes an empty room so its code can be reused', () => {
    const store = new RoomStore(() => 1);
    const created = store.create('狼', 'socket-a');
    store.leaveBySocket('socket-a');
    expect(store.has(created.room.code)).toBe(false);
    expect(store.create('熊', 'socket-b').room.code).toBe(created.room.code);
  });
});
