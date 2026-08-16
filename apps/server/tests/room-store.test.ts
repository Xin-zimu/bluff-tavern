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

  it('enforces host-only settings and kick operations while tracking readiness', () => {
    const store = new RoomStore(() => 2);
    const host = store.create('狼', 'socket-a');
    const guest = store.join(host.room.code, '狐狸', 'socket-b');
    expect(store.setReady(host.room.code, guest.playerId, true).players[1]?.status).toBe('READY');
    expect(() => store.updateSettings(host.room.code, guest.playerId, { maxPlayers: 2 })).toThrow('你不是房主');
    expect(() => store.updateSettings(host.room.code, host.playerId, { maxPlayers: 1 })).toThrow('最大人数不能小于当前玩家数');
    const updated = store.updateSettings(host.room.code, host.playerId, { maxPlayers: 4 });
    expect(updated.settings.maxPlayers).toBe(4);
    expect(updated.players.every((player) => player.status === 'CONNECTED')).toBe(true);
    expect(() => store.kick(host.room.code, guest.playerId, host.playerId)).toThrow('你不是房主');
    expect(store.kick(host.room.code, host.playerId, guest.playerId).room.players).toHaveLength(1);
  });
});
