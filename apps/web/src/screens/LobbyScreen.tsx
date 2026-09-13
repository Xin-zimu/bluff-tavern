import type { RoomView, V6GameMode, V7ExtensionSettings } from '@bluff-tavern/shared';
import { CHARACTER_ART, CHARACTER_IDS } from '../art';

const V7_FEATURE_SWITCHES: Array<{ key: keyof V7ExtensionSettings; label: string }> = [
  { key: 'itemsEnabled', label: '启用道具' },
  { key: 'tavernEventsEnabled', label: '启用酒馆事件' },
  { key: 'characterAbilitiesEnabled', label: '启用角色能力' },
];

function toV6Mode(gameMode: RoomView['settings']['gameMode']): V6GameMode {
  return gameMode === 'QUICK' ? 'QUICK' : 'CLASSIC';
}

interface LobbyProps {
  room: RoomView;
  playerId: string | null;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
  onSettingsChange: (settings: RoomView['settings'] & { gameMode: V6GameMode }) => void;
  onKick: (playerId: string) => void;
  onStart: () => void;
  onSelectCharacter: (characterId: NonNullable<RoomView['players'][number]['characterId']>) => void;
}

export function LobbyScreen({ room, playerId, onLeave, onReady, onSettingsChange, onKick, onStart, onSelectCharacter }: LobbyProps) {
  const copyCode = () => void navigator.clipboard?.writeText(room.code);
  const isHost = room.hostPlayerId === playerId;
  const self = room.players.find((player) => player.id === playerId);
  const extensionSettings = room.settings.v7;
  const updateExtension = (key: keyof V7ExtensionSettings, enabled: boolean) => onSettingsChange({
    ...room.settings,
    gameMode: toV6Mode(room.settings.gameMode),
    eventEnabled: false,
    bulletCount: null,
    v7: { ...extensionSettings, [key]: enabled },
  });
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
        <select id="max-players" value={room.settings.maxPlayers} onChange={(event) => onSettingsChange({ ...room.settings, gameMode: room.settings.gameMode === 'QUICK' ? 'QUICK' : 'CLASSIC', maxPlayers: Number(event.target.value) })}>
          {[2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count} disabled={count < room.players.length}>{count} 人</option>)}
        </select>
      </label>}
      {isHost && <label className="settings-control" htmlFor="game-mode">节奏
        <select id="game-mode" value={room.settings.gameMode} onChange={(event) => onSettingsChange({ ...room.settings, gameMode: event.target.value as V6GameMode, eventEnabled: false, bulletCount: null })}>
          <option value="CLASSIC">经典（15 秒）</option><option value="QUICK">快速（7 秒）</option>
        </select>
      </label>}
      <div className={`feature-switches${isHost ? '' : ' feature-switches--readonly'}`} aria-label="V7 扩展玩法开关">
        {V7_FEATURE_SWITCHES.map((feature) => <label className="feature-switch" key={feature.key}>
          {isHost ? <>
            <input type="checkbox" checked={extensionSettings[feature.key]} onChange={(event) => updateExtension(feature.key, event.target.checked)} />
            <span className="feature-switch__toggle" aria-hidden="true" />
          </> : <span className={`feature-switch__status${extensionSettings[feature.key] ? ' is-enabled' : ''}`} aria-hidden="true" />}
          <span>{feature.label}</span>
          <small>{extensionSettings[feature.key] ? '已开启' : '关闭'}</small>
        </label>)}
      </div>
      <ul className="player-list">
        {room.players.map((player) => <li key={player.id} className={player.id === playerId ? 'is-self' : ''}>
          {player.characterId ? <div className="character-portrait character-portrait--small" aria-hidden="true"><img src={CHARACTER_ART[player.characterId].image} alt="" /></div>
            : <div className="avatar" aria-hidden="true">{player.nickname.slice(0, 1).toUpperCase()}</div>}
          <div><strong>{player.nickname}</strong><small>{player.id === playerId ? '你' : player.status === 'READY' ? '已准备' : '已连接'}</small></div>
          {player.status === 'READY' && <span className="ready-mark">准备</span>}
          {player.id === room.hostPlayerId && <span className="host-mark">创建者</span>}
          {isHost && player.id !== playerId && <button className="kick-button" onClick={() => onKick(player.id)}>移出</button>}
        </li>)}
      </ul>
      {self && <div className="character-picker" aria-label="选择原创角色">{CHARACTER_IDS.map((character) => {
        const selected = self.characterId === character;
        const unavailable = room.players.some((player) => player.id !== playerId && player.characterId === character);
        return <button key={character} type="button" disabled={unavailable} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => onSelectCharacter(character)}>
          <img src={CHARACTER_ART[character].image} alt="" loading="lazy" />
          <span>{CHARACTER_ART[character].name}</span>
        </button>;
      })}</div>}
      {self && <button className={`button ${self.status === 'READY' ? 'button--secondary' : 'button--primary'}`} onClick={() => onReady(self.status !== 'READY')}>
        {self.status === 'READY' ? '取消准备' : '准备就绪'}
      </button>}
      {isHost && <button className="button button--primary button--art-start" disabled={room.players.length < 2 || !room.players.every((player) => player.status === 'READY')} onClick={onStart}>开始牌局</button>}
      <p className="future-note">所有玩家准备后，由房主开始这局牌。</p>
    </section>
  </main>;
}
