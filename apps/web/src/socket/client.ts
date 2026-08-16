import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@bluff-tavern/shared';

const configuredUrl: string | undefined = import.meta.env.VITE_SERVER_URL;
// Production uses the same origin so Nginx can proxy /socket.io/ without exposing Node's port.
const url = configuredUrl || window.location.origin;
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, { autoConnect: false });
