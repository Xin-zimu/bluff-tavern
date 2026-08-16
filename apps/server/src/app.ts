import cors from '@fastify/cors';
import Fastify from 'fastify';
import { Server } from 'socket.io';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@bluff-tavern/shared';
import type { ServerConfig } from './config/env.js';
import { RoomStore } from './rooms/room-store.js';
import { registerRoomHandlers } from './socket/register-room-handlers.js';
import { GameService } from './game/game-service.js';
import { cryptoRandom } from './game/random.js';

export async function createApp(config: ServerConfig) {
  const app = Fastify({ logger: { level: config.logLevel } });
  await app.register(cors, { origin: config.clientOrigin });
  app.get('/health', () => ({ status: 'ok', version: '0.1.0', timestamp: Date.now() }));
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(app.server, {
    cors: { origin: config.clientOrigin }, transports: ['websocket', 'polling'],
  });
  const rooms = new RoomStore();
  const games = new GameService(cryptoRandom);
  io.on('connection', (socket) => registerRoomHandlers(io, socket, rooms, games, app.log));
  app.addHook('onClose', () => io.close());
  return { app, io, rooms };
}
