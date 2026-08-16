import type { RoomView } from '@bluff-tavern/shared';

interface LobbyProps {
  room: RoomView;
  playerId: string | null;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
  onMaxPlayersChange: (maxPlayers: number) => void;
  onKick: (playerId: string) => void;
  onStart: () => void;
}

export function LobbyScreen({ room, playerId, onLeave, onReady, onMaxPlayersChange, onKick, onStart }: LobbyProps) {
  const copyCode = () => void navigator.clipboard?.writeText(room.code);
  const isHost = room.hostPlayerId === playerId;
  const self = room.players.find((player) => player.id === playerId);
  return <main className="lobby">
    <header className="lobby-header">
      <div><p className="eyebrow">等待牌友入席</p><h1>酒馆大厅</h1></div>
      <button className="button button--ghost" onClick={onLeave}>离开房间</button>
    </header>
    <section className="room-sign" aria-label={`房间码 ${room.code}`}>
      <span>房间码</span><strong>{room.code}</strong>
      <button onClick={copyCode}>复制</button>
    </section>
    <section className="panel player-panel">
      <div className="panel-title"><h2>已入席玩家</h2><span>{room.players.length} / {room.maxPlayers}</span></div>
      {isHost && <label className="settings-control" htmlFor="max-players">最大人数
        <select id="max-players" value={room.settings.maxPlayers} onChange={(event) => onMaxPlayersChange(Number(event.target.value))}>
          {[2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count} disabled={count < room.players.length}>{count} 人</option>)}
        </select>
      </label>}
      <ul className="player-list">
        {room.players.map((player, index) => <li key={player.id} className={player.id === playerId ? 'is-self' : ''}>
          <div className={`avatar avatar--${index % 4}`} aria-hidden="true">{player.nickname.slice(0, 1).toUpperCase()}</div>
          <div><strong>{player.nickname}</strong><small>{player.id === playerId ? '你' : player.status === 'READY' ? '已准备' : '已连接'}</small></div>
          {player.status === 'READY' && <span className="ready-mark">准备</span>}
          {player.id === room.hostPlayerId && <span className="host-mark">创建者</span>}
          {isHost && player.id !== playerId && <button className="kick-button" onClick={() => onKick(player.id)}>移出</button>}
        </li>)}
      </ul>
      {self && <button className={`button ${self.status === 'READY' ? 'button--secondary' : 'button--primary'}`} onClick={() => onReady(self.status !== 'READY')}>
        {self.status === 'READY' ? '取消准备' : '准备就绪'}
      </button>}
      {isHost && <button className="button button--primary" disabled={room.players.length < 2 || !room.players.every((player) => player.status === 'READY')} onClick={onStart}>开始牌局</button>}
      <p className="future-note">准备、房主配置与移出玩家已开放；开局将在下一版本实现。</p>
    </section>
  </main>;
}
