import type { RoomView } from '@bluff-tavern/shared';

export function LobbyScreen({ room, playerId, onLeave }: { room: RoomView; playerId: string | null; onLeave: () => void }) {
  const copyCode = () => void navigator.clipboard?.writeText(room.code);
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
      <ul className="player-list">
        {room.players.map((player, index) => <li key={player.id} className={player.id === playerId ? 'is-self' : ''}>
          <div className={`avatar avatar--${index % 4}`} aria-hidden="true">{player.nickname.slice(0, 1).toUpperCase()}</div>
          <div><strong>{player.nickname}</strong><small>{player.id === playerId ? '你' : '已连接'}</small></div>
          {player.id === room.hostPlayerId && <span className="host-mark">创建者</span>}
        </li>)}
      </ul>
      <p className="future-note">房主设置、准备与开局将在后续版本开放。</p>
    </section>
  </main>;
}
