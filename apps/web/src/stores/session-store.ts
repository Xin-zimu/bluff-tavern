import { create } from 'zustand';
import type { ConnectionStatus, GameView, RoomView } from '@bluff-tavern/shared';

interface SessionState {
  connection: ConnectionStatus;
  networkOnline: boolean;
  room: RoomView | null;
  playerId: string | null;
  sessionToken: string | null;
  notice: string | null;
  game: GameView | null;
  setConnection: (connection: ConnectionStatus) => void;
  setNetworkOnline: (networkOnline: boolean) => void;
  enterRoom: (room: RoomView, playerId: string, sessionToken: string) => void;
  updateRoom: (room: RoomView) => void;
  leaveRoom: () => void;
  setNotice: (notice: string | null) => void;
  setGame: (game: GameView) => void;
  clearGame: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  connection: 'connecting', networkOnline: navigator.onLine, room: null, playerId: null, sessionToken: null, notice: null, game: null,
  setConnection: (connection) => set({ connection }),
  setNetworkOnline: (networkOnline) => set({ networkOnline }),
  enterRoom: (room, playerId, sessionToken) => set({ room, playerId, sessionToken, notice: null }),
  updateRoom: (room) => set({ room }),
  leaveRoom: () => set({ room: null, playerId: null, sessionToken: null, game: null }),
  setNotice: (notice) => set({ notice }),
  setGame: (game) => set({ game }),
  clearGame: () => set({ game: null }),
}));
