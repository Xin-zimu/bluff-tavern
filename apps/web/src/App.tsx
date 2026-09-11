import { useEffect, useRef, useState } from 'react';
import { ConnectionBadge } from './components/ConnectionBadge';
import { socket } from './socket/client';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { useSessionStore } from './stores/session-store';
import type { V6GameMode } from '@bluff-tavern/shared';

function requestId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);

    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

    const hex = Array.from(
      bytes,
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function App() {
  const state = useSessionStore();
  const { setConnection, setNetworkOnline, updateRoom, leaveRoom: clearRoom, setNotice, setGame } = state;
  const [busy, setBusy] = useState(false);
  const recordedSummary = useRef<string | null>(null);
  useEffect(() => {
    const summary = state.game?.summary;
    if (!summary || !state.playerId) { recordedSummary.current = null; return; }
    const key = `${summary.winnerId}:${summary.durationSeconds}:${summary.challengeCount}`;
    if (recordedSummary.current === key) return;
    recordedSummary.current = key;
    const saved = JSON.parse(localStorage.getItem('bluff-tavern.local-stats') ?? '{"games":0,"wins":0,"challenges":0,"successfulChallenges":0}') as { games: number; wins: number; challenges: number; successfulChallenges: number };
    const next = { games: saved.games + 1, wins: saved.wins + Number(summary.winnerId === state.playerId), challenges: saved.challenges + summary.challengeCount, successfulChallenges: saved.successfulChallenges + summary.successfulChallenges };
    localStorage.setItem('bluff-tavern.local-stats', JSON.stringify(next));
  }, [state.game, state.playerId]);
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
    socket.on('connect', connected).on('disconnect', disconnected).on('room:state', updateRoom).on('room:closed', closeRoom).on('room:kicked', kicked).on('game:snapshot', setGame).on('game:state', setGame).on('game:turnStarted', setGame);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visibilityChange);
    socket.connect();
    return () => { socket.off('connect', connected).off('disconnect', disconnected).off('room:state', updateRoom).off('room:closed', closeRoom).off('room:kicked', kicked).off('game:snapshot', setGame).off('game:state', setGame).off('game:turnStarted', setGame); window.removeEventListener('online', online); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visibilityChange); socket.disconnect(); };
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
    socket.emit('room:ready', { roomCode: state.room.code, ready, requestId: requestId() }, (result) => {
      if (!result.ok) state.setNotice(result.error.message);
    });
  };
  const updateSettings = (settings: { maxPlayers: number; gameMode: V6GameMode; turnDurationSeconds: number; eventEnabled: boolean; bulletCount: number | null }) => {
    if (!state.room) return;
    socket.emit('room:updateSettings', { roomCode: state.room.code, ...settings, requestId: requestId() }, (result) => {
      if (!result.ok) state.setNotice(result.error.message);
    });
  };
  const kickPlayer = (targetPlayerId: string) => {
    if (!state.room) return;
    socket.emit('room:kick', { roomCode: state.room.code, targetPlayerId, requestId: requestId() }, (result) => {
      if (!result.ok) state.setNotice(result.error.message);
    });
  };
  const startGame = () => {
    if (!state.room) return;
    socket.emit('game:start', { roomCode: state.room.code, requestId: requestId() }, (result) => {
      if (result.ok) setGame(result.data); else state.setNotice(result.error.message);
    });
  };
  const playCards = (cardIndexes: number[]) => {
    if (!state.room) return;
    socket.emit('game:playCards', { roomCode: state.room.code, cardIndexes, requestId: requestId() }, (result) => {
      if (result.ok) setGame(result.data); else state.setNotice(result.error.message);
    });
  };
  const challenge = () => {
    if (!state.room) return;
    socket.emit('game:challenge', { roomCode: state.room.code, requestId: requestId() }, (result) => {
      if (result.ok) setGame(result.data); else state.setNotice(result.error.message);
    });
  };
  const restartGame = () => {
    if (!state.room) return;
    socket.emit('game:restart', { roomCode: state.room.code, requestId: requestId() }, (result) => {
      if (result.ok) setGame(result.data); else state.setNotice(result.error.message);
    });
  };
  const selectCharacter = (characterId: NonNullable<NonNullable<typeof state.room>['players'][number]['characterId']>) => {
    if (!state.room) return;
    socket.emit('room:selectCharacter', { roomCode: state.room.code, characterId }, (result) => { if (!result.ok) state.setNotice(result.error.message); });
  };
  const useItem = (itemId: NonNullable<typeof state.game>['items'][number]) => {
    if (!state.room) return;
    socket.emit('game:useItem', { roomCode: state.room.code, itemId, requestId: requestId() }, (result) => { if (result.ok) setGame(result.data); else state.setNotice(result.error.message); });
  };
  const fullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => state.setNotice('当前浏览器无法进入全屏'));
    else void document.exitFullscreen();
  };
  const shareResult = () => {
    const summary = state.game?.summary;
    if (!summary) return;
    const text = `诡牌酒馆战报：${summary.playerCount} 人局，${summary.challengeCount} 次质疑，胜者已诞生！`;
    if (navigator.share) void navigator.share({ title: '诡牌酒馆战报', text }).catch(() => undefined);
    else void navigator.clipboard?.writeText(text).then(() => state.setNotice('战报已复制'));
  };
  const lowPerformance = navigator.hardwareConcurrency <= 4 || ('deviceMemory' in navigator && (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined && (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 4);
  const screen = state.room && state.game ? 'game' : state.room ? 'lobby' : 'home';

  return <div className={`app-shell app-shell--${screen}${state.game?.phase === 'GAME_OVER' ? ' app-shell--victory' : ''}${lowPerformance ? ' app-shell--low-power' : ''}`}>
    <ConnectionBadge status={state.connection} networkOnline={state.networkOnline} />
    {state.notice && <div className="notice" role="alert" onClick={() => state.setNotice(null)}>{state.notice}<span>×</span></div>}
    {state.room && state.game ? <GameScreen room={state.room} game={state.game} playerId={state.playerId} onPlay={playCards} onChallenge={challenge} onRestart={restartGame} onFullscreen={fullscreen} onUseItem={useItem} onShare={shareResult} />
      : state.room ? <LobbyScreen room={state.room} playerId={state.playerId} onLeave={leaveRoom} onReady={sendReady} onSettingsChange={updateSettings} onKick={kickPlayer} onStart={startGame} onSelectCharacter={selectCharacter} />
      : <HomeScreen busy={busy || state.connection !== 'connected'} onCreate={createRoom} onJoin={joinRoom} />}
    <footer>V6.0 · 原创酒馆视觉 · 不含第三方游戏版权素材</footer>
  </div>;
}
