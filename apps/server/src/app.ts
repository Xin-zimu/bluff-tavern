import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyReply } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Server } from 'socket.io';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@bluff-tavern/shared';
import type { ServerConfig } from './config/env.js';
import { RoomStore } from './rooms/room-store.js';
import { registerRoomHandlers } from './socket/register-room-handlers.js';
import { GameService } from './game/game-service.js';
import { cryptoRandom } from './game/random.js';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function sendWebFile(reply: FastifyReply, filePath: string, cacheControl: string) {
  try {
    const file = await stat(filePath);
    if (!file.isFile()) return false;
    reply
      .header('Cache-Control', cacheControl)
      .header('X-Content-Type-Options', 'nosniff')
      .type(CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream')
      .send(createReadStream(filePath));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function createApp(config: ServerConfig) {
  const app = Fastify({ logger: { level: config.logLevel } });
  await app.register(cors, { origin: config.clientOrigin });
  app.get('/health', () => ({ status: 'ok', version: '5.0.0', timestamp: Date.now() }));
  if (config.webRoot) {
    const webRoot = resolve(config.webRoot);
    const webRootPrefix = `${webRoot}${sep}`;
    app.setNotFoundHandler(async (request, reply) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') return reply.code(404).send({ error: 'Not found' });

      let pathname: string;
      try {
        pathname = decodeURIComponent(new URL(request.raw.url ?? '/', 'http://localhost').pathname);
      } catch {
        return reply.code(400).send({ error: 'Invalid URL' });
      }

      const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const candidate = resolve(webRoot, requestedPath);
      if (candidate !== webRoot && !candidate.startsWith(webRootPrefix)) return reply.code(404).send({ error: 'Not found' });

      const cacheControl = pathname === '/sw.js' || pathname === '/' || pathname.endsWith('.html')
        ? 'no-cache'
        : 'public, max-age=3600';
      if (await sendWebFile(reply, candidate, cacheControl)) return reply;
      if (extname(pathname)) return reply.code(404).send({ error: 'Not found' });
      await sendWebFile(reply, resolve(webRoot, 'index.html'), 'no-cache');
      return reply;
    });
  }
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(app.server, {
    cors: { origin: config.clientOrigin }, transports: ['websocket', 'polling'],
  });
  const rooms = new RoomStore();
  const games = new GameService(cryptoRandom);
  io.on('connection', (socket) => registerRoomHandlers(io, socket, rooms, games, app.log));
  app.addHook('onClose', () => io.close());
  return { app, io, rooms };
}
