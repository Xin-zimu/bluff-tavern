import { create } from 'zustand';
import type { ConnectionStatus, RoomView } from '@bluff-tavern/shared';

interface SessionState {
  connection: ConnectionStatus;
  room: RoomView | null;
  playerId: string | null;
  notice: string | null;
  setConnection: (connection: ConnectionStatus) => void;
  enterRoom: (room: RoomView, playerId: string) => void;
  updateRoom: (room: RoomView) => void;
  leaveRoom: () => void;
  setNotice: (notice: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  connection: 'connecting', room: null, playerId: null, notice: null,
  setConnection: (connection) => set({ connection }),
  enterRoom: (room, playerId) => set({ room, playerId, notice: null }),
  updateRoom: (room) => set({ room }),
  leaveRoom: () => set({ room: null, playerId: null }),
  setNotice: (notice) => set({ notice }),
}));
