import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, GameView, RoomMembership, RoomView, ServerToClientEvents } from '@bluff-tavern/shared';
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

function emitAck<T>(client: ClientSocket<ServerToClientEvents, ClientToServerEvents>, event: 'room:create' | 'room:join' | 'room:ready' | 'room:updateSettings' | 'room:kick' | 'game:start' | 'game:playCards' | 'session:resume', payload: object) {
  return new Promise<Ack<T>>((resolve) => client.emit(event, payload as never, resolve as never));
}

describe('real Socket.IO multiplayer', () => {
  it('starts a real six-player Grand Table with the 30-card deck', async () => {
    const { app } = await createApp({ host: '127.0.0.1', port: 0, clientOrigin: '*', logLevel: 'silent' });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Missing address');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      const host = await connect(url);
      const created = await emitAck<RoomMembership>(host, 'room:create', { nickname: 'Host6' });
      if (!created.ok) throw new Error(created.error.message);
      const peers = await Promise.all(Array.from({ length: 5 }, async (_, index) => {
        const peer = await connect(url);
        const joined = await emitAck<RoomMembership>(peer, 'room:join', { nickname: `P${index + 2}`, roomCode: created.data.room.code });
        if (!joined.ok) throw new Error(joined.error.message);
        return peer;
      }));
      const settings = await emitAck<RoomView>(host, 'room:updateSettings', { roomCode: created.data.room.code, maxPlayers: 6, gameMode: 'QUICK', requestId: randomUUID() });
      expect(settings).toMatchObject({ ok: true, data: { settings: { maxPlayers: 6, gameMode: 'QUICK' } } });
      await Promise.all([host, ...peers].map((client) => emitAck<RoomView>(client, 'room:ready', { roomCode: created.data.room.code, ready: true, requestId: randomUUID() })));
      const started = await emitAck<GameView>(host, 'game:start', { roomCode: created.data.room.code, requestId: randomUUID() });
      expect(started).toMatchObject({ ok: true, data: { gameMode: 'QUICK', turnDurationSeconds: 7 } });
      if (!started.ok) throw new Error('Game did not start');
      expect(started.data.players).toHaveLength(6);
      expect(started.data.players.reduce((sum, player) => sum + player.cardCount, 0)).toBe(30);
    } finally {
      clients.forEach((client) => client.disconnect());
      clients.length = 0;
      await app.close();
    }
  });

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
      const playerClients = new Map<string, typeof a>();
      playerClients.set(created.data.playerId, a);
      peers.forEach(({ peer, playerId }) => playerClients.set(playerId, peer));
      const gameStates = new Map<string, GameView>();
      for (const [playerId, client] of playerClients) client.on('game:state', (state: GameView) => gameStates.set(playerId, state));
      const started = await emitAck<GameView>(a, 'game:start', { roomCode: created.data.room.code, requestId: randomUUID() });
      expect(started.ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(gameStates.size).toBe(4);
      if (!started.ok) throw new Error('Game did not start');
      const turnState = gameStates.get(started.data.turnPlayerId);
      const turnClient = playerClients.get(started.data.turnPlayerId);
      if (!turnState || !turnClient) throw new Error('Missing turn state');
      const played = await emitAck<GameView>(turnClient, 'game:playCards', {
        roomCode: created.data.room.code, cardIndexes: [0], requestId: randomUUID(),
      });
      expect(played).toMatchObject({ ok: true, data: { discardCount: 1 } });
      const afterLeave = new Promise<number>((resolve) => a.on('room:state', (room: RoomView) => {
        if (room.players.length === 4 && room.players.some((player) => !player.isConnected)) resolve(4);
      }));
      peers[0]!.peer.disconnect();
      expect(await afterLeave).toBe(4);
    } finally {
      clients.forEach((client) => client.disconnect());
      clients.length = 0;
      await app.close();
    }
  });

  it('restores a disconnected game player through a real Socket.IO session', async () => {
    const { app } = await createApp({ host: '127.0.0.1', port: 0, clientOrigin: '*', logLevel: 'silent' });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Missing address');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      const host = await connect(url);
      const created = await emitAck<RoomMembership>(host, 'room:create', { nickname: 'Host' });
      if (!created.ok) throw new Error(created.error.message);
      const guest = await connect(url);
      const joined = await emitAck<RoomMembership>(guest, 'room:join', { nickname: 'Guest', roomCode: created.data.room.code });
      if (!joined.ok) throw new Error(joined.error.message);
      await Promise.all([host, guest].map((client) => emitAck<RoomView>(client, 'room:ready', {
        roomCode: created.data.room.code, ready: true, requestId: randomUUID(),
      })));
      const started = await emitAck<GameView>(host, 'game:start', { roomCode: created.data.room.code, requestId: randomUUID() });
      expect(started.ok).toBe(true);
      guest.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 30));
      const restored = await connect(url);
      const resumed = await emitAck<RoomMembership>(restored, 'session:resume', { sessionToken: joined.data.sessionToken });
      expect(resumed).toMatchObject({ ok: true, data: { playerId: joined.data.playerId } });
      if (!resumed.ok) throw new Error('Resume failed');
      expect(resumed.data.room.players).toHaveLength(2);
      expect(resumed.data.room.players.find((player) => player.id === joined.data.playerId)?.isConnected).toBe(true);
    } finally {
      clients.forEach((client) => client.disconnect());
      clients.length = 0;
      await app.close();
    }
  });
});
