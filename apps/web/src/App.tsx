import { useEffect, useState } from 'react';
import { ConnectionBadge } from './components/ConnectionBadge';
import { socket } from './socket/client';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { useSessionStore } from './stores/session-store';

export function App() {
  const state = useSessionStore();
  const { setConnection, updateRoom, leaveRoom: clearRoom } = state;
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const connected = () => setConnection('connected');
    const disconnected = () => setConnection('disconnected');
    const closeRoom = () => clearRoom();
    socket.on('connect', connected).on('disconnect', disconnected).on('room:state', updateRoom).on('room:closed', closeRoom);
    socket.connect();
    return () => { socket.off('connect', connected).off('disconnect', disconnected).off('room:state', updateRoom).off('room:closed', closeRoom); socket.disconnect(); };
  }, [setConnection, updateRoom, clearRoom]);

  const createRoom = (nickname: string) => {
    setBusy(true);
    socket.emit('room:create', { nickname }, (result) => {
      setBusy(false);
      if (result.ok) state.enterRoom(result.data.room, result.data.playerId);
      else state.setNotice(result.error.message);
    });
  };
  const joinRoom = (nickname: string, roomCode: string) => {
    setBusy(true);
    socket.emit('room:join', { nickname, roomCode }, (result) => {
      setBusy(false);
      if (result.ok) state.enterRoom(result.data.room, result.data.playerId);
      else state.setNotice(result.error.message);
    });
  };
  const leaveRoom = () => {
    if (!state.room) return;
    socket.emit('room:leave', { roomCode: state.room.code }, () => state.leaveRoom());
  };

  return <div className="app-shell">
    <ConnectionBadge status={state.connection} />
    {state.notice && <div className="notice" role="alert" onClick={() => state.setNotice(null)}>{state.notice}<span>×</span></div>}
    {state.room ? <LobbyScreen room={state.room} playerId={state.playerId} onLeave={leaveRoom} />
      : <HomeScreen busy={busy || state.connection !== 'connected'} onCreate={createRoom} onJoin={joinRoom} />}
    <footer>V0.1 · 原创占位视觉 · 不含原游戏版权资产</footer>
  </div>;
}
