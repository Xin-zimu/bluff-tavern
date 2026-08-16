import { create } from 'zustand';
import type { ConnectionStatus, GameView, RoomView } from '@bluff-tavern/shared';

interface SessionState {
  connection: ConnectionStatus;
  room: RoomView | null;
  playerId: string | null;
  notice: string | null;
  game: GameView | null;
  setConnection: (connection: ConnectionStatus) => void;
  enterRoom: (room: RoomView, playerId: string) => void;
  updateRoom: (room: RoomView) => void;
  leaveRoom: () => void;
  setNotice: (notice: string | null) => void;
  setGame: (game: GameView) => void;
  clearGame: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  connection: 'connecting', room: null, playerId: null, notice: null, game: null,
  setConnection: (connection) => set({ connection }),
  enterRoom: (room, playerId) => set({ room, playerId, notice: null }),
  updateRoom: (room) => set({ room }),
  leaveRoom: () => set({ room: null, playerId: null, game: null }),
  setNotice: (notice) => set({ notice }),
  setGame: (game) => set({ game }),
  clearGame: () => set({ game: null }),
}));
