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

function emitAck<T>(client: ClientSocket<ServerToClientEvents, ClientToServerEvents>, event: 'room:create' | 'room:join', payload: object) {
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
        return peer;
      }));
      expect(await fourPlayers).toBe(4);
      const afterLeave = new Promise<number>((resolve) => a.on('room:state', (room: RoomView) => {
        if (room.players.length === 3) resolve(3);
      }));
      peers[0]!.disconnect();
      expect(await afterLeave).toBe(3);
    } finally {
      clients.forEach((client) => client.disconnect());
      clients.length = 0;
      await app.close();
    }
  });
});
