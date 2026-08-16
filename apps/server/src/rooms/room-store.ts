import { randomUUID } from 'node:crypto';
import { MAX_PLAYERS, type PlayerView, type RoomView } from '@bluff-tavern/shared';
import { createRoomCode, type RandomIndex } from './room-code.js';

interface InternalPlayer extends PlayerView { socketId: string }
interface InternalRoom extends Omit<RoomView, 'players'> { players: InternalPlayer[] }

export class RoomError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export class RoomStore {
  private readonly rooms = new Map<string, InternalRoom>();
  constructor(private readonly randomIndex?: RandomIndex) {}

  create(nickname: string, socketId: string): { room: RoomView; playerId: string } {
    const code = this.generateUniqueCode();
    const player = this.makePlayer(nickname, socketId);
    const now = Date.now();
    this.rooms.set(code, {
      id: randomUUID(), code, hostPlayerId: player.id, status: 'LOBBY', maxPlayers: MAX_PLAYERS,
      players: [player], createdAt: now,
    });
    return { room: this.getView(code), playerId: player.id };
  }

  join(code: string, nickname: string, socketId: string): { room: RoomView; playerId: string } {
    const room = this.requireRoom(code);
    if (room.status !== 'LOBBY') throw new RoomError('ROOM_NOT_JOINABLE', '牌局已经开始');
    if (room.players.length >= room.maxPlayers) throw new RoomError('ROOM_FULL', '房间已满');
    if (room.players.some((player) => player.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase())) {
      throw new RoomError('NICKNAME_TAKEN', '该昵称已在房间中使用');
    }
    const player = this.makePlayer(nickname, socketId);
    room.players.push(player);
    return { room: this.getView(code), playerId: player.id };
  }

  leaveBySocket(socketId: string): { code: string; room: RoomView | null } | null {
    for (const [code, room] of this.rooms) {
      const index = room.players.findIndex((player) => player.socketId === socketId);
      if (index < 0) continue;
      room.players.splice(index, 1);
      if (room.players.length === 0) {
        this.rooms.delete(code);
        return { code, room: null };
      }
      if (room.hostPlayerId === room.players[index]?.id || !room.players.some((p) => p.id === room.hostPlayerId)) {
        room.hostPlayerId = room.players[0]!.id;
      }
      return { code, room: this.getView(code) };
    }
    return null;
  }

  has(code: string): boolean { return this.rooms.has(code); }

  private getView(code: string): RoomView {
    const room = this.requireRoom(code);
    return {
      id: room.id, code: room.code, hostPlayerId: room.hostPlayerId, status: room.status,
      maxPlayers: room.maxPlayers, createdAt: room.createdAt,
      players: room.players.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        status: player.status,
        joinedAt: player.joinedAt,
      })),
    };
  }

  private requireRoom(code: string): InternalRoom {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', '房间不存在');
    return room;
  }

  private makePlayer(nickname: string, socketId: string): InternalPlayer {
    return { id: randomUUID(), nickname, socketId, status: 'CONNECTED', joinedAt: Date.now() };
  }

  private generateUniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = createRoomCode(this.randomIndex);
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('CODE_EXHAUSTED', '暂时无法创建房间，请稍后再试');
  }
}
