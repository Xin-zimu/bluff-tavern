import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, RoomMembership, RoomView, ServerToClientEvents } from '@bluff-tavern/shared';
import { createApp } from '../src/app.js';

const clients: ClientSocket<ServerToClientEvents, ClientToServerEvents>[] = [];
afterEach(() => { clients.forEach((client) => client.disconnect()); clients.length = 0; });

function connect(url: string) {
  const client = createClient(url, { transports: ['websocket'], forceNew: true });
  clients.push(client);
  return new Promise<typeof client>((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function emitAck<T>(client: ClientSocket<ServerToClientEvents, ClientToServerEvents>, event: 'room:create' | 'room:join' | 'room:ready' | 'room:updateSettings' | 'room:kick', payload: object) {
  return new Promise<Ack<T>>((resolve) => client.emit(event, payload as never, resolve as never));
}

describe('real Socket.IO multiplayer', () => {
  it('synchronizes four players joining and one disconnecting', async () => {
    const { app } = await createApp({ host: '127.0.0.1', port: 0, clientOrigin: '*', logLevel: 'silent' });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Missing address');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      const a = await connect(url);
      const created = await emitAck<RoomMembership>(a, 'room:create', { nickname: 'A' });
      if (!created.ok) throw new Error(created.error.message);
      const fourPlayers = new Promise<number>((resolve) => {
        const timer = setTimeout(() => resolve(-1), 2_000);
        a.on('room:state', (room: RoomView) => {
          if (room.players.length === 4) { clearTimeout(timer); resolve(4); }
        });
      });
      const peers = await Promise.all(['B', 'C', 'D'].map(async (nickname) => {
        const peer = await connect(url);
        const joined = await emitAck<RoomMembership>(peer, 'room:join', { nickname, roomCode: created.data.room.code });
        expect(joined.ok).toBe(true);
        if (!joined.ok) throw new Error('Join failed');
        return { peer, playerId: joined.data.playerId };
      }));
      expect(await fourPlayers).toBe(4);
      const nonHostSettings = await emitAck<RoomView>(peers[0]!.peer, 'room:updateSettings', {
        roomCode: created.data.room.code, maxPlayers: 4, requestId: randomUUID(),
      });
      expect(nonHostSettings).toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
      const changedSettings = await emitAck<RoomView>(a, 'room:updateSettings', {
        roomCode: created.data.room.code, maxPlayers: 4, requestId: randomUUID(),
      });
      expect(changedSettings).toMatchObject({ ok: true, data: { settings: { maxPlayers: 4 } } });
      await Promise.all([a, ...peers.map(({ peer }) => peer)].map((client) => emitAck<RoomView>(client, 'room:ready', {
        roomCode: created.data.room.code, ready: true, requestId: randomUUID(),
      })));
      const kicked = new Promise<string>((resolve) => peers[2]!.peer.once('room:kicked', resolve));
      const afterKick = new Promise<number>((resolve) => a.on('room:state', (room: RoomView) => {
        if (room.players.length === 3 && room.players.every((player) => player.status === 'READY')) resolve(3);
      }));
      const kickResult = await emitAck<RoomView>(a, 'room:kick', {
        roomCode: created.data.room.code, targetPlayerId: peers[2]!.playerId, requestId: randomUUID(),
      });
      expect(kickResult.ok).toBe(true);
      expect(await kicked).toContain('移出房间');
      expect(await afterKick).toBe(3);
      const afterLeave = new Promise<number>((resolve) => a.on('room:state', (room: RoomView) => {
        if (room.players.length === 2) resolve(2);
      }));
      peers[0]!.peer.disconnect();
      expect(await afterLeave).toBe(2);
    } finally {
      clients.forEach((client) => client.disconnect());
      clients.length = 0;
      await app.close();
    }
  });
});
