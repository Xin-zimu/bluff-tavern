import { useEffect, useState } from 'react';
import { ConnectionBadge } from './components/ConnectionBadge';
import { socket } from './socket/client';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { useSessionStore } from './stores/session-store';
import type { GameMode } from '@bluff-tavern/shared';

export function App() {
  const state = useSessionStore();
  const { setConnection, setNetworkOnline, updateRoom, leaveRoom: clearRoom, setNotice, setGame } = state;
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const resumeStoredSession = () => {
      const sessionToken = localStorage.getItem('bluff-tavern.session-token');
      if (!sessionToken) return;
      socket.emit('session:resume', { sessionToken }, (result) => {
        if (result.ok) useSessionStore.getState().enterRoom(result.data.room, result.data.playerId, result.data.sessionToken);
        else localStorage.removeItem('bluff-tavern.session-token');
      });
    };
    const connected = () => {
      setConnection('connected');
      resumeStoredSession();
    };
    const disconnected = () => setConnection('disconnected');
    const online = () => { setNetworkOnline(true); socket.connect(); };
    const offline = () => setNetworkOnline(false);
    const visibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      setNetworkOnline(navigator.onLine);
      if (socket.connected) resumeStoredSession(); else socket.connect();
    };
    const closeRoom = () => clearRoom();
    const kicked = (message: string) => { clearRoom(); setNotice(message); };
    socket.on('connect', connected).on('disconnect', disconnected).on('room:state', updateRoom).on('room:closed', closeRoom).on('room:kicked', kicked).on('game:state', setGame).on('game:turnStarted', setGame);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visibilityChange);
    socket.connect();
    return () => { socket.off('connect', connected).off('disconnect', disconnected).off('room:state', updateRoom).off('room:closed', closeRoom).off('room:kicked', kicked).off('game:state', setGame); window.removeEventListener('online', online); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visibilityChange); socket.disconnect(); };
  }, [setConnection, setNetworkOnline, updateRoom, clearRoom, setNotice, setGame]);

  const createRoom = (nickname: string) => {
    setBusy(true);
    socket.emit('room:create', { nickname }, (result) => {
      setBusy(false);
      if (result.ok) { localStorage.setItem('bluff-tavern.session-token', result.data.sessionToken); state.enterRoom(result.data.room, result.data.playerId, result.data.sessionToken); }
      else state.setNotice(result.error.message);
    });
  };
  const joinRoom = (nickname: string, roomCode: string) => {
    setBusy(true);
    socket.emit('room:join', { nickname, roomCode }, (result) => {
      setBusy(false);
      if (result.ok) { localStorage.setItem('bluff-tavern.session-token', result.data.sessionToken); state.enterRoom(result.data.room, result.data.playerId, result.data.sessionToken); }
      else state.setNotice(result.error.message);
    });
  };
  const leaveRoom = () => {
    if (!state.room) return;
    socket.emit('room:leave', { roomCode: state.room.code }, () => { localStorage.removeItem('bluff-tavern.session-token'); state.leaveRoom(); });
  };
  const sendReady = (ready: boolean) => {
    if (!state.room) return;
    socket.emit('room:ready', { roomCode: state.room.code, ready, requestId: crypto.randomUUID() }, (result) => {
      if (!result.ok) state.setNotice(result.error.message);
    });
  };
  const updateSettings = (settings: { maxPlayers: number; gameMode: GameMode; turnDurationSeconds: number; eventEnabled: boolean; bulletCount: number | null }) => {
    if (!state.room) return;
    socket.emit('room:updateSettings', { roomCode: state.room.code, ...settings, requestId: crypto.randomUUID() }, (result) => {
      if (!result.ok) state.setNotice(result.error.message);
    });
  };
  const kickPlayer = (targetPlayerId: string) => {
    if (!state.room) return;
    socket.emit('room:kick', { roomCode: state.room.code, targetPlayerId, requestId: crypto.randomUUID() }, (result) => {
      if (!result.ok) state.setNotice(result.error.message);
    });
  };
  const startGame = () => {
    if (!state.room) return;
    socket.emit('game:start', { roomCode: state.room.code, requestId: crypto.randomUUID() }, (result) => {
      if (result.ok) setGame(result.data); else state.setNotice(result.error.message);
    });
  };
  const playCards = (cardIndexes: number[]) => {
    if (!state.room) return;
    socket.emit('game:playCards', { roomCode: state.room.code, cardIndexes, requestId: crypto.randomUUID() }, (result) => {
      if (result.ok) setGame(result.data); else state.setNotice(result.error.message);
    });
  };
  const challenge = () => {
    if (!state.room) return;
    socket.emit('game:challenge', { roomCode: state.room.code, requestId: crypto.randomUUID() }, (result) => {
      if (result.ok) setGame(result.data); else state.setNotice(result.error.message);
    });
  };
  const restartGame = () => {
    if (!state.room) return;
    socket.emit('game:restart', { roomCode: state.room.code, requestId: crypto.randomUUID() }, (result) => {
      if (result.ok) setGame(result.data); else state.setNotice(result.error.message);
    });
  };
  const selectCharacter = (characterId: NonNullable<NonNullable<typeof state.room>['players'][number]['characterId']>) => {
    if (!state.room) return;
    socket.emit('room:selectCharacter', { roomCode: state.room.code, characterId }, (result) => { if (!result.ok) state.setNotice(result.error.message); });
  };
  const useItem = (itemId: NonNullable<typeof state.game>['items'][number]) => {
    if (!state.room) return;
    socket.emit('game:useItem', { roomCode: state.room.code, itemId, requestId: crypto.randomUUID() }, (result) => { if (result.ok) setGame(result.data); else state.setNotice(result.error.message); });
  };
  const fullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => state.setNotice('当前浏览器无法进入全屏'));
    else void document.exitFullscreen();
  };
  const lowPerformance = navigator.hardwareConcurrency <= 4 || ('deviceMemory' in navigator && (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined && (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 4);

  return <div className={`app-shell${lowPerformance ? ' app-shell--low-power' : ''}`}>
    <ConnectionBadge status={state.connection} networkOnline={state.networkOnline} />
    {state.notice && <div className="notice" role="alert" onClick={() => state.setNotice(null)}>{state.notice}<span>×</span></div>}
    {state.room && state.game ? <GameScreen room={state.room} game={state.game} playerId={state.playerId} onPlay={playCards} onChallenge={challenge} onRestart={restartGame} onFullscreen={fullscreen} onUseItem={useItem} />
      : state.room ? <LobbyScreen room={state.room} playerId={state.playerId} onLeave={leaveRoom} onReady={sendReady} onSettingsChange={updateSettings} onKick={kickPlayer} onStart={startGame} onSelectCharacter={selectCharacter} />
      : <HomeScreen busy={busy || state.connection !== 'connected'} onCreate={createRoom} onJoin={joinRoom} />}
    <footer>V1.0 · 原创占位视觉 · 不含原游戏版权资产</footer>
  </div>;
}
