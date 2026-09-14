import type { GameMode, PlayableGameMode, RoomView, V7ExtensionSettings } from '@bluff-tavern/shared';
import { CHARACTER_ABILITIES, CHARACTER_ART, CHARACTER_IDS } from '../art';

const MODE_OPTIONS: Array<{ id: GameMode; title: string; badge: string; description: string; enabled: boolean }> = [
  { id: 'CLASSIC', title: '经典模式', badge: '15 秒', description: '标准诈唬、质疑、左轮惩罚。', enabled: true },
  { id: 'QUICK', title: '快速模式', badge: '7 秒', description: '更短回合倒计时，保持原规则。', enabled: true },
  { id: 'ESCALATION', title: '加注模式', badge: '新开放', description: '每手出牌数不得低于上一手。', enabled: true },
  { id: 'SHARED_REVOLVER', title: '死亡左轮', badge: '新开放', description: '全桌共用一把左轮。', enabled: true },
  { id: 'FREE_CHALLENGE', title: '全民质疑', badge: '新开放', description: '多人抢先质疑窗口。', enabled: true },
  { id: 'PARTY', title: '酒馆乱斗', badge: '新开放', description: '每轮一个随机酒馆事件。', enabled: true },
  { id: 'CUSTOM', title: '自定义', badge: '计划中', description: '自由组合规则参数。', enabled: false },
];

const V7_FEATURE_SWITCHES: Array<{ key: keyof V7ExtensionSettings; label: string }> = [
  { key: 'itemsEnabled', label: '启用道具' },
  { key: 'tavernEventsEnabled', label: '启用酒馆事件' },
  { key: 'characterAbilitiesEnabled', label: '启用角色能力' },
];

function toPlayableMode(gameMode: RoomView['settings']['gameMode']): PlayableGameMode {
  if (gameMode === 'CUSTOM') return 'CLASSIC';
  return gameMode;
}

function isPlayableMode(gameMode: GameMode): gameMode is PlayableGameMode {
  return gameMode !== 'CUSTOM';
}

function supportsLegacyTavernEvents(gameMode: PlayableGameMode): boolean {
  return gameMode === 'CLASSIC' || gameMode === 'QUICK';
}

interface LobbyProps {
  room: RoomView;
  playerId: string | null;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
  onSettingsChange: (settings: RoomView['settings'] & { gameMode: PlayableGameMode }) => void;
  onKick: (playerId: string) => void;
  onStart: () => void;
  onSelectCharacter: (characterId: NonNullable<RoomView['players'][number]['characterId']>) => void;
}

export function LobbyScreen({ room, playerId, onLeave, onReady, onSettingsChange, onKick, onStart, onSelectCharacter }: LobbyProps) {
  const copyCode = () => void navigator.clipboard?.writeText(room.code);
  const isHost = room.hostPlayerId === playerId;
  const self = room.players.find((player) => player.id === playerId);
  const extensionSettings = room.settings.v7;
  const selectedMode = toPlayableMode(room.settings.gameMode);
  const updateMode = (gameMode: PlayableGameMode) => onSettingsChange({
    ...room.settings,
    gameMode,
    turnDurationSeconds: gameMode === 'QUICK' ? 7 : 15,
    eventEnabled: false,
    bulletCount: null,
    v7: { ...extensionSettings, tavernEventsEnabled: supportsLegacyTavernEvents(gameMode) ? extensionSettings.tavernEventsEnabled : false },
  });
  const updateExtension = (key: keyof V7ExtensionSettings, enabled: boolean) => onSettingsChange({
    ...room.settings,
    gameMode: selectedMode,
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
        <select id="max-players" value={room.settings.maxPlayers} onChange={(event) => onSettingsChange({ ...room.settings, gameMode: selectedMode, maxPlayers: Number(event.target.value) })}>
          {[2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count} disabled={count < room.players.length}>{count} 人</option>)}
        </select>
      </label>}
      <section className={`mode-selector${isHost ? '' : ' mode-selector--readonly'}`} aria-label="游戏模式">
        {MODE_OPTIONS.map((mode) => {
          const selected = selectedMode === mode.id;
          const disabled = !isHost || !mode.enabled;
          return <button
            key={mode.id}
            type="button"
            className={selected ? 'selected' : ''}
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => { if (isPlayableMode(mode.id)) updateMode(mode.id); }}
          >
            <span className="mode-card__top"><strong>{mode.title}</strong><small>{mode.badge}</small></span>
            <span>{mode.description}</span>
          </button>;
        })}
      </section>
      <div className={`feature-switches${isHost ? '' : ' feature-switches--readonly'}`} aria-label="V7 扩展玩法开关">
        {V7_FEATURE_SWITCHES.map((feature) => {
          const tavernSwitch = feature.key === 'tavernEventsEnabled';
          const legacyEventsAllowed = supportsLegacyTavernEvents(selectedMode);
          const lockedTavernSwitch = tavernSwitch && !legacyEventsAllowed;
          const effectiveEnabled = tavernSwitch && selectedMode === 'PARTY' ? true : tavernSwitch && !legacyEventsAllowed ? false : extensionSettings[feature.key];
          const status = tavernSwitch && selectedMode === 'PARTY'
            ? 'Party 固定启用'
            : tavernSwitch && !legacyEventsAllowed
              ? '特殊模式不叠加'
              : effectiveEnabled ? '已开启' : '关闭';
          return <label className={`feature-switch${lockedTavernSwitch ? ' feature-switch--locked' : ''}`} key={feature.key}>
            {isHost && !lockedTavernSwitch ? <>
              <input type="checkbox" checked={extensionSettings[feature.key]} onChange={(event) => updateExtension(feature.key, event.target.checked)} />
              <span className="feature-switch__toggle" aria-hidden="true" />
            </> : <span className={`feature-switch__status${effectiveEnabled ? ' is-enabled' : ''}`} aria-hidden="true" />}
            <span>{tavernSwitch && selectedMode === 'PARTY' ? '每轮随机事件' : feature.label}</span>
            <small>{status}</small>
          </label>;
        })}
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
          <span className="character-picker__copy">
            <strong>{CHARACTER_ART[character].name}</strong>
            <small>{CHARACTER_ABILITIES[character].title}</small>
          </span>
        </button>;
      })}</div>}
      {self?.characterId && <p className="ability-preview"><strong>{CHARACTER_ABILITIES[self.characterId].title}</strong>{CHARACTER_ABILITIES[self.characterId].description}</p>}
      {self && <button className={`button ${self.status === 'READY' ? 'button--secondary' : 'button--primary'}`} onClick={() => onReady(self.status !== 'READY')}>
        {self.status === 'READY' ? '取消准备' : '准备就绪'}
      </button>}
      {isHost && <button className="button button--primary button--art-start" disabled={room.players.length < 2 || !room.players.every((player) => player.status === 'READY')} onClick={onStart}>开始牌局</button>}
      <p className="future-note">所有玩家准备后，由房主开始这局牌。</p>
    </section>
  </main>;
}
