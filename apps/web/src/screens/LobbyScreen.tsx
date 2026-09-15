import { useState } from 'react';
import type { GameMode, PlayableGameMode, RoomView, V7ExtensionSettings } from '@bluff-tavern/shared';
import { CHARACTER_ABILITIES, CHARACTER_ART, CHARACTER_IDS } from '../art';

interface ModeOption {
  id: GameMode;
  title: string;
  badge: string;
  description: string;
  coreRules: string;
  classicDifference: string;
  enabled: boolean;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'CLASSIC',
    title: '经典模式',
    badge: '15 秒',
    description: '标准诈唬、质疑、左轮惩罚。',
    coreRules: '每轮公布目标牌，玩家轮流声明出牌；下一名玩家可以继续出牌或质疑上一手。',
    classicDifference: '这是基准规则，没有额外模式限制。',
    enabled: true,
  },
  {
    id: 'QUICK',
    title: '快速模式',
    badge: '7 秒',
    description: '更短回合倒计时，保持原规则。',
    coreRules: '每名玩家只有 7 秒行动时间，超时由服务器自动执行合法操作。',
    classicDifference: '只压缩行动时间，不改变真假牌、质疑或惩罚规则。',
    enabled: true,
  },
  {
    id: 'ESCALATION',
    title: '加注模式',
    badge: '新开放',
    description: '每手出牌数不得低于上一手。',
    coreRules: '首手可出 1 至 3 张；之后每手至少跟上上一手的出牌数量。',
    classicDifference: 'Classic 每手都可自由选择 1 至 3 张；加注模式会逐步抬高最低出牌数。',
    enabled: true,
  },
  {
    id: 'SHARED_REVOLVER',
    title: '死亡左轮',
    badge: '新开放',
    description: '全桌共用一把左轮。',
    coreRules: '所有受罚者共享同一把左轮，空枪后下一次惩罚继续使用后续膛位；命中后重新装填。',
    classicDifference: 'Classic 中每名玩家有自己的左轮状态；死亡左轮把风险集中到全桌共享。',
    enabled: true,
  },
  {
    id: 'FREE_CHALLENGE',
    title: '全民质疑',
    badge: '新开放',
    description: '多人抢先质疑窗口。',
    coreRules: '出牌后开启 3 秒质疑窗口，除出牌者外的存活玩家都可以抢先质疑。',
    classicDifference: 'Classic 只有下一名玩家能质疑；全民质疑允许其他玩家在窗口内竞争质疑权。',
    enabled: true,
  },
  {
    id: 'PARTY',
    title: '酒馆乱斗',
    badge: '新开放',
    description: '每轮一个随机酒馆事件。',
    coreRules: '每轮开始抽取一个公开事件，例如反转方向、禁用 Joker 或双倍危机。',
    classicDifference: 'Classic 没有每轮随机事件；酒馆乱斗每轮只附加一个独立事件。',
    enabled: true,
  },
  {
    id: 'CUSTOM',
    title: '自定义',
    badge: '计划中',
    description: '自由组合规则参数。',
    coreRules: '计划提供可配置规则参数，由房主创建自定义玩法。',
    classicDifference: '当前版本还不能开局，只保留为后续入口。',
    enabled: false,
  },
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
  const [modeDetailId, setModeDetailId] = useState<GameMode | null>(null);
  const copyCode = () => void navigator.clipboard?.writeText(room.code);
  const isHost = room.hostPlayerId === playerId;
  const self = room.players.find((player) => player.id === playerId);
  const extensionSettings = room.settings.v7;
  const abilitiesEnabled = extensionSettings.characterAbilitiesEnabled;
  const selectedMode = toPlayableMode(room.settings.gameMode);
  const modeDetail = MODE_OPTIONS.find((mode) => mode.id === modeDetailId) ?? null;
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
  const selectModeFromDetail = (mode: ModeOption) => {
    if (!isPlayableMode(mode.id)) return;
    updateMode(mode.id);
    setModeDetailId(null);
  };

  return <>
  <main className="lobby">
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
      <div className="lobby-panel-grid">
        <div className="lobby-rules-column">
          <section className={`mode-selector${isHost ? '' : ' mode-selector--readonly'}`} aria-label="游戏模式">
            {MODE_OPTIONS.map((mode) => {
              const selected = selectedMode === mode.id;
              return <button
                key={mode.id}
                type="button"
                className={`${selected ? 'selected' : ''}${mode.enabled ? '' : ' is-planned'}`}
                aria-pressed={selected}
                onClick={() => setModeDetailId(mode.id)}
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
        </div>
        <div className="lobby-players-column">
          <ul className="player-list">
            {room.players.map((player) => <li key={player.id} className={player.id === playerId ? 'is-self' : ''}>
              {player.characterId ? <div className="character-portrait character-portrait--small" aria-hidden="true"><img src={CHARACTER_ART[player.characterId].image} alt="" /></div>
                : <div className="avatar" aria-hidden="true">{player.nickname.slice(0, 1).toUpperCase()}</div>}
              <div><strong>{player.nickname}</strong><small>{formatLobbyPlayerStatus(player, playerId)}</small></div>
              {player.status === 'READY' && <span className="ready-mark">准备</span>}
              {player.id === room.hostPlayerId && <span className="host-mark">创建者</span>}
              {isHost && player.id !== playerId && <button className="kick-button" onClick={() => onKick(player.id)}>移出</button>}
            </li>)}
          </ul>
          {self && <div className={`character-picker${abilitiesEnabled ? '' : ' character-picker--visual-only'}`} aria-label="选择原创角色">{CHARACTER_IDS.map((character) => {
            const selected = self.characterId === character;
            const unavailable = room.players.some((player) => player.id !== playerId && player.characterId === character);
            return <button key={character} type="button" disabled={unavailable} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => onSelectCharacter(character)}>
              <img src={CHARACTER_ART[character].image} alt="" loading="lazy" />
              <span className="character-picker__copy">
                <strong>{abilitiesEnabled ? `${CHARACTER_ART[character].name} · ${CHARACTER_ABILITIES[character].title}` : CHARACTER_ART[character].name}</strong>
              </span>
            </button>;
          })}</div>}
          {self?.characterId && <p className="ability-preview">
            {abilitiesEnabled
              ? <><strong>{`${CHARACTER_ART[self.characterId].name} · ${CHARACTER_ABILITIES[self.characterId].title}`}</strong>{CHARACTER_ABILITIES[self.characterId].description}</>
              : <><strong>角色能力未启用</strong>本局角色仅作为玩家形象使用。</>}
          </p>}
        </div>
      </div>
      <div className="lobby-actions">
        {self && <button className={`button ${self.status === 'READY' ? 'button--secondary' : 'button--primary'}`} onClick={() => onReady(self.status !== 'READY')}>
          {self.status === 'READY' ? '取消准备' : '准备就绪'}
        </button>}
        {isHost && <button className="button button--primary button--art-start" disabled={room.players.length < 2 || !room.players.every((player) => player.status === 'READY')} onClick={onStart}>开始牌局</button>}
      </div>
      <p className="future-note">所有玩家准备后，由房主开始这局牌。</p>
    </section>
  </main>
  {modeDetail && <ModeDetailDialog
    mode={modeDetail}
    isHost={isHost}
    selected={selectedMode === modeDetail.id}
    onClose={() => setModeDetailId(null)}
    onSelect={() => selectModeFromDetail(modeDetail)}
  />}
  </>;
}

function ModeDetailDialog({ mode, isHost, selected, onClose, onSelect }: { mode: ModeOption; isHost: boolean; selected: boolean; onClose: () => void; onSelect: () => void }) {
  const selectable = isHost && mode.enabled && !selected;

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="mode-detail-title">
    <section className="mode-detail-panel">
      <div className="rules-panel__header">
        <div>
          <p className="eyebrow">模式详情</p>
          <h2 id="mode-detail-title">{mode.title}</h2>
        </div>
        <button type="button" className="icon-close" onClick={onClose} aria-label="关闭模式详情">×</button>
      </div>
      <p className="mode-detail-panel__summary">{mode.description}</p>
      <dl className="mode-detail-list">
        <div>
          <dt>核心规则</dt>
          <dd>{mode.coreRules}</dd>
        </div>
        <div>
          <dt>与 Classic 的区别</dt>
          <dd>{mode.classicDifference}</dd>
        </div>
      </dl>
      <div className="mode-detail-actions">
        {isHost
          ? <button type="button" className="button button--primary" disabled={!selectable} onClick={onSelect}>
            {selected ? '当前模式' : mode.enabled ? '选择此模式' : '计划中'}
          </button>
          : <p>{mode.enabled ? '只有房主可以选择模式。' : '该模式计划中，当前不可选择。'}</p>}
      </div>
    </section>
  </div>;
}

function formatLobbyPlayerStatus(player: RoomView['players'][number], selfId: string | null): string {
  const labels = [];
  if (player.id === selfId) labels.push('你');
  labels.push(player.isConnected ? '在线' : '离线');
  labels.push(player.status === 'READY' ? '已准备' : '未准备');
  return labels.join(' · ');
}
