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
  setGame: (game: GameView, source?: string) => void;
  clearGame: () => void;
}

export function shouldAcceptGameSnapshot(current: GameView | null, incoming: GameView): boolean {
  if (!current) return true;
  if (incoming.sequence > current.sequence) return true;
  if (incoming.sequence < current.sequence) return false;
  return incoming.serverNow >= current.serverNow;
}

function logSnapshotReconciliation(source: string, current: GameView | null, incoming: GameView, accepted: boolean): void {
  if (!import.meta.env.DEV && accepted) return;
  if (!import.meta.env.DEV && !accepted) {
    console.warn('[game-sync] ignored stale snapshot', {
      source,
      incoming: snapshotLogFields(incoming),
      current: current ? snapshotLogFields(current) : null,
    });
    return;
  }
  console.debug('[game-sync] snapshot', {
    source,
    accepted,
    incoming: snapshotLogFields(incoming),
    current: current ? snapshotLogFields(current) : null,
  });
}

function snapshotLogFields(game: GameView) {
  return {
    sequence: game.sequence,
    serverNow: game.serverNow,
    phase: game.phase,
    turnPlayerId: game.turnPlayerId,
    mustChallenge: game.mustChallenge,
  };
}

export const useSessionStore = create<SessionState>((set) => ({
  connection: 'connecting', networkOnline: typeof navigator === 'undefined' ? true : navigator.onLine, room: null, playerId: null, sessionToken: null, notice: null, game: null,
  setConnection: (connection) => set({ connection }),
  setNetworkOnline: (networkOnline) => set({ networkOnline }),
  enterRoom: (room, playerId, sessionToken) => set({ room, playerId, sessionToken, notice: null }),
  updateRoom: (room) => set({ room }),
  leaveRoom: () => set({ room: null, playerId: null, sessionToken: null, game: null }),
  setNotice: (notice) => set({ notice }),
  setGame: (game, source = 'unknown') => set((state) => {
    const accepted = shouldAcceptGameSnapshot(state.game, game);
    logSnapshotReconciliation(source, state.game, game, accepted);
    return accepted ? { game } : {};
  }),
  clearGame: () => set({ game: null }),
}));
