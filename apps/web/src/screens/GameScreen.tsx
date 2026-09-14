import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CardRank, GameView, RoomView, TargetRank } from '@bluff-tavern/shared';
import { CinematicLayer } from '../components/CinematicLayer';
import { RulesPanel } from '../components/RulesPanel';
import { playGamePhaseSound } from '../audio/game-audio-manager';
import { playUiTone } from '../audio/ui-sounds';
import { CHARACTER_ART, ITEM_ART, ITEM_NAMES, characterImage } from '../art';

export function GameScreen({ room, game, playerId, audioMuted, lowPowerActive, reduceMotion, onToggleAudio, onToggleLowPower, onToggleReduceMotion, onPlay, onChallenge, onReturnToRoom, onLeaveRoom, onFullscreen, onUseItem, onShare }: { room: RoomView; game: GameView; playerId: string | null; audioMuted: boolean; lowPowerActive: boolean; reduceMotion: boolean; onToggleAudio: () => void; onToggleLowPower: () => void; onToggleReduceMotion: () => void; onPlay: (indexes: number[]) => void; onChallenge: () => void; onReturnToRoom: () => void; onLeaveRoom: () => void; onFullscreen: () => void; onUseItem: (itemId: GameView['items'][number]) => void; onShare: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [localNow, setLocalNow] = useState(() => Date.now());
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dismissedTip, setDismissedTip] = useState(() => localStorage.getItem('bluff-tavern.dismissed-tip.v6') === 'true');
  const clockRef = useRef({ sequence: game.sequence, localReceivedAt: Date.now(), serverNow: game.serverNow });
  const playedAudioSequence = useRef<number | null>(null);
  const isTurn = game.turnPlayerId === playerId && game.phase === 'TURN';
  const canPlay = isTurn && !game.mustChallenge;
  const canChallenge = isTurn && game.lastPlay !== null;
  const isGameOver = game.phase === 'GAME_OVER';
  const eventClass = game.tavernEvent ? ` game-screen--event-${game.tavernEvent.type.toLowerCase().replace('_', '-')}` : '';
  const modeCopy = `${game.gameMode === 'QUICK' ? '快速' : '经典'} ${game.turnDurationSeconds} 秒`;
  const players = useMemo(() => {
    const seated = room.players.map((player) => ({ ...player, cards: game.players.find((entry) => entry.playerId === player.id)?.cardCount ?? 0, alive: game.alivePlayerIds.includes(player.id) }));
    const self = seated.find((player) => player.id === playerId);
    return self ? [...seated.filter((player) => player.id !== playerId), self] : seated;
  }, [room.players, game.players, game.alivePlayerIds, playerId]);
  const winner = players.find((player) => player.id === game.winnerId);
  const currentPlayer = players.find((player) => player.id === game.turnPlayerId);
  const lastPlayer = players.find((player) => player.id === game.lastPlay?.playerId);
  const statusCopy = describeMatchStatus(game, currentPlayer?.nickname, lastPlayer?.nickname);
  const hintCopy = !dismissedTip && !isGameOver ? describeNewPlayerHint(game, isTurn) : null;
  const toggle = (index: number) => setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < 3 ? [...current, index] : current);
  const play = () => { if (!audioMuted) playUiTone(420); onPlay(selected); setSelected([]); };
  const leaveWithConfirm = () => {
    if (window.confirm('确定退出当前房间？退出后本局将继续进行，你的位置会从房间中移除。')) onLeaveRoom();
  };
  const dismissTip = () => {
    localStorage.setItem('bluff-tavern.dismissed-tip.v6', 'true');
    setDismissedTip(true);
  };
  useEffect(() => {
    clockRef.current = { sequence: game.sequence, localReceivedAt: Date.now(), serverNow: game.serverNow };
    setLocalNow(Date.now());
  }, [game.sequence, game.serverNow]);
  useEffect(() => {
    if (game.phase === 'TURN' && !game.phaseEndsAt) return;
    const timer = window.setInterval(() => setLocalNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [game.phase, game.phaseEndsAt]);
  useEffect(() => {
    if (playedAudioSequence.current === game.sequence) return;
    playedAudioSequence.current = game.sequence;
    playGamePhaseSound(game, audioMuted);
  }, [game, audioMuted]);
  const syncedNow = clockRef.current.serverNow + (localNow - clockRef.current.localReceivedAt);
  const secondsLeft = game.phaseEndsAt ? Math.max(0, Math.ceil((game.phaseEndsAt - syncedNow) / 1_000)) : null;
  const activeItemEffect = game.itemEffect && (game.itemEffect.expiresAt === null || game.itemEffect.expiresAt > syncedNow) ? game.itemEffect : null;
  const activeAbilityEffect = game.abilityEffect && (game.abilityEffect.expiresAt === null || game.abilityEffect.expiresAt > syncedNow) ? game.abilityEffect : null;
  const tipsy = activeItemEffect?.type === 'TAVERN_MUG_TIPSY';
  return <main className={`game-screen${eventClass}`}>
    <p className="rotate-hint">为获得最佳牌桌视野，请横屏游玩</p>
    <header className="game-header"><div><p className="eyebrow">第 {game.roundNumber} 轮 · {modeCopy} · #{game.sequence}</p><h1>{isGameOver ? '本局结算' : '诡牌酒桌'}</h1></div><div className="game-header-actions">{secondsLeft !== null && <span className="phase-clock">{secondsLeft}s</span>}<span className="discard">已出 {game.discardCount} 张</span><button className="fullscreen-button" onClick={() => setRulesOpen(true)}>规则</button><button className="fullscreen-button" onClick={onFullscreen}>全屏</button><button className="fullscreen-button fullscreen-button--danger" onClick={leaveWithConfirm}>退出房间</button></div></header>
    <div className="cinematic-controls" aria-label="演出设置">
      <button type="button" aria-pressed={!audioMuted} onClick={onToggleAudio}>{audioMuted ? '音效关' : '音效开'}</button>
      <button type="button" aria-pressed={lowPowerActive} onClick={onToggleLowPower}>{lowPowerActive ? '性能省' : '性能满'}</button>
      <button type="button" aria-pressed={reduceMotion} onClick={onToggleReduceMotion}>{reduceMotion ? '动画少' : '动画全'}</button>
    </div>
    {hintCopy && <aside className="onboarding-tip" aria-live="polite"><p>{hintCopy}</p><button type="button" onClick={dismissTip}>知道了</button></aside>}
    {game.tavernEvent && <TavernEventBanner event={game.tavernEvent} />}
    {!isGameOver && <div className="turn-banner" aria-live="polite">{isTurn ? (game.mustChallenge ? '你的回合：必须质疑上一手' : '你的回合：选择 1 至 3 张牌') : game.phase === 'TURN' ? `等待 ${currentPlayer?.nickname ?? '玩家'} 出牌` : statusCopy}</div>}
    <section className={`panel game-table${game.phase === 'PUNISHMENT_RESULT' && game.punishment?.hit ? ' game-table--elimination' : ''}${isGameOver ? ' game-table--victory' : ''}`}><div className="table-status"><span>{statusCopy}</span></div>
      <div className="table-surface" aria-label="牌桌">
        <RoundTargetHud target={game.targetCard} roundNumber={game.roundNumber} />
        <TablePile game={game} lastPlayerName={lastPlayer?.nickname} />
      </div>
      <ul className={`game-players game-players--${players.length}`}>{players.map((player) => <li key={player.id} className={`${player.id === game.turnPlayerId ? 'active-turn ' : ''}${player.id === playerId ? 'self-seat ' : ''}${game.punishment?.eliminatedPlayerId === player.id ? 'is-newly-eliminated ' : ''}${!player.alive ? 'is-eliminated' : ''}`}>
        {player.characterId && <div className="character-portrait character-portrait--game" aria-hidden="true"><img src={characterImage(player.characterId, !player.alive ? 'eliminated' : game.phase === 'GAME_OVER' && player.id === game.winnerId ? 'victory' : 'idle')} alt="" /></div>}
        <span className="seat-copy"><strong>{player.nickname}{player.id === playerId ? '（你）' : ''}{!player.isConnected ? '（离线）' : ''}</strong><small>{player.id === game.turnPlayerId && game.phase === 'TURN' ? '出牌中 · ' : ''}{player.characterId ? CHARACTER_ART[player.characterId].name : '未选角色'} · {player.alive ? `${player.cards} 张手牌` : '已淘汰'}</small></span>
      </li>)}</ul>
    </section>
    {!isGameOver && <section className={`hand${tipsy ? ' hand--tipsy' : ''}`} aria-label="你的手牌">{game.hand.map((card, index) => <button key={`${card}-${index}`} className={`card card--${card.toLowerCase()} ${selected.includes(index) ? 'selected' : ''}`} aria-pressed={selected.includes(index)} onClick={() => toggle(index)} disabled={!canPlay}>{card === 'JOKER' ? <img src="/assets/cards/joker.png" alt="Joker" /> : <span>{card}</span>}</button>)}</section>}
    {!isGameOver && <button className="button button--primary button--art-start play-button" disabled={!canPlay || selected.length === 0} onClick={play}>出 {selected.length || ''} 张牌</button>}
    {!isGameOver && (game.items.length > 0 || activeItemEffect || activeAbilityEffect) && <div className="item-dock">
      {activeAbilityEffect && <p className={`ability-effect ability-effect--${activeAbilityEffect.riskLevel?.toLowerCase() ?? 'neutral'}`} aria-live="polite"><strong>{activeAbilityEffect.title}</strong>{activeAbilityEffect.message}</p>}
      {activeItemEffect && <p className={`item-effect item-effect--${activeItemEffect.riskLevel?.toLowerCase() ?? 'neutral'}`} aria-live="polite">{activeItemEffect.message}</p>}
      {game.items.length > 0 && <div className="item-bar" aria-label="可用道具">{game.items.map((item) => {
        const enabled = canUseItem(item, game, playerId);
        return <button key={item} className="item-button" onClick={() => onUseItem(item)} disabled={!enabled} title={describeItem(item)}>
          <img src={ITEM_ART[item]} alt="" loading="lazy" /><span>{ITEM_NAMES[item]}</span>
        </button>;
      })}</div>}
    </div>}
    {canChallenge && <button className="button button--secondary button--art-challenge play-button" onClick={() => { if (!audioMuted) playUiTone(180); onChallenge(); }}>质疑上一手</button>}
    {game.challengeResult && <div className="challenge-result" aria-live="polite"><img src="/assets/effects/challenge_burst.png" alt="" aria-hidden="true" /><p>翻牌：{game.challengeResult.revealedCards.join('、')}；{game.challengeResult.wasBluff ? '上一位玩家撒谎' : '质疑失败'}，失败者：{players.find((player) => player.id === game.challengeResult?.failedPlayerId)?.nickname}</p></div>}
    {game.punishment && <p className="future-note">轮盘第 {game.punishment.chamber + 1} 弹巢：{game.punishment.hit ? '中弹淘汰' : '空枪，继续游戏'}。</p>}
    <CinematicLayer room={room} game={game} now={syncedNow} />
    {room.players.some((player) => !player.isConnected) && <div className="reconnect-overlay" aria-live="polite">有玩家暂时离线，对局状态会在重连后恢复。</div>}
    <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
    {game.phase === 'GAME_OVER' && <section className="victory-panel" aria-label="本局结果">
      <img className="victory-particles" src="/assets/effects/victory_particles.png" alt="" aria-hidden="true" />
      <p className="eyebrow">酒馆最终胜者</p>
      {winner?.characterId && <div className="character-portrait victory-portrait" aria-hidden="true"><img src={characterImage(winner.characterId, 'victory')} alt="" /></div>}
      <h2>{winner?.nickname}</h2>
      {game.summary && <><div className="victory-stats"><span><strong>{game.summary.playerCount}</strong>人局</span><span><strong>{game.summary.durationSeconds}</strong>秒</span><span><strong>{game.summary.challengeCount}</strong>次质疑</span><span><strong>{game.summary.successfulChallenges}</strong>次成功</span></div><p className="victory-summary">淘汰顺序：{game.summary.eliminationOrder.map((id) => players.find((player) => player.id === id)?.nickname ?? '玩家').join(' → ') || '无人淘汰'}</p><button className="fullscreen-button" onClick={onShare}>分享结果</button></>}
      <div className="result-actions">
        {room.hostPlayerId === playerId && <button className="button button--primary button--art-start play-button" onClick={onReturnToRoom}>再来一局</button>}
        <button className="button button--secondary play-button" onClick={onReturnToRoom}>{room.hostPlayerId === playerId ? '返回房间 / 修改模式' : '返回房间'}</button>
        <button className="fullscreen-button fullscreen-button--danger" onClick={leaveWithConfirm}>退出房间</button>
      </div>
    </section>}
  </main>;
}

function RoundTargetHud({ target, roundNumber }: { target: TargetRank; roundNumber: number }) {
  return <aside className="round-target-hud" aria-label={`本轮目标牌 ${target}`}>
    <span>本轮目标</span>
    <CardFace rank={target} size="small" />
    <p>第 {roundNumber} 轮 · 出牌声明均视为 {target}</p>
  </aside>;
}

function TablePile({ game, lastPlayerName }: { game: GameView; lastPlayerName: string | undefined }) {
  const pileCards = Math.max(game.lastPlay?.count ?? Math.min(game.discardCount, 3), game.discardCount > 0 ? 1 : 0);
  return <div className="table-pile" aria-label="公共牌区">
    <div className="table-pile__cards" aria-hidden="true">
      {pileCards > 0 ? Array.from({ length: Math.min(pileCards, 3) }, (_, index) => <span key={index} style={{ '--pile-index': index } as CSSProperties} />) : <em>等待出牌</em>}
    </div>
    <div className="table-pile__copy">
      <strong>公共牌区</strong>
      <p>{game.lastPlay ? `${lastPlayerName ?? '玩家'} 声明：${game.lastPlay.count} 张 ${game.lastPlay.claimedRank}` : '本轮尚未有人出牌'}</p>
      <small>{game.lastPlay ? '当前可质疑对象' : `目标牌是 ${game.targetCard}`}</small>
    </div>
  </div>;
}

function CardFace({ rank, size = 'normal' }: { rank: CardRank; size?: 'normal' | 'small' }) {
  return <span className={`rank-card rank-card--${size} rank-card--${rank.toLowerCase()}`}>
    {rank === 'JOKER' ? <img src="/assets/cards/joker.png" alt="Joker" /> : <span>{rank}</span>}
  </span>;
}

function TavernEventBanner({ event }: { event: NonNullable<GameView['tavernEvent']> }) {
  return <aside className={`tavern-event tavern-event--${event.type.toLowerCase().replace('_', '-')}`} aria-live="polite">
    <strong>{event.title}</strong>
    <span>{event.description}</span>
  </aside>;
}

function canUseItem(item: GameView['items'][number], game: GameView, playerId: string | null): boolean {
  if (!playerId || !game.alivePlayerIds.includes(playerId) || game.phase !== 'TURN') return false;
  if (item === 'POCKET_WATCH') return game.turnPlayerId === playerId;
  return true;
}

function describeItem(item: GameView['items'][number]): string {
  if (item === 'SPYGLASS') return '查看自己下一次受罚风险';
  if (item === 'POCKET_WATCH') return '自己的回合延长倒计时';
  return '短暂干扰自己的界面提示，不改变判定';
}

function describeMatchStatus(game: GameView, currentPlayerName?: string, lastPlayerName?: string): string {
  if (game.phase === 'GAME_OVER') return '本局结束';
  if (game.phase === 'ROUND_START') return `第 ${game.roundNumber} 轮开始，目标牌 ${game.targetCard}`;
  if (game.phase === 'TURN') {
    if (game.mustChallenge) return `${currentPlayerName ?? '玩家'} 必须质疑上一手`;
    if (game.lastPlay) return `${lastPlayerName ?? '玩家'} 已出 ${game.lastPlay.count} 张，等待 ${currentPlayerName ?? '玩家'} 行动`;
    return `等待 ${currentPlayerName ?? '玩家'} 出牌`;
  }
  if (game.phase === 'CHALLENGE_CALLOUT') return '质疑发起，所有操作已锁定';
  if (game.phase === 'REVEAL') return game.tavernEvent?.type === 'CANDLE_FLICKER' ? '烛火摇曳，正在逐张揭牌' : '正在逐张揭牌';
  if (game.phase === 'VERDICT') return game.challenge?.wasBluff ? '质疑成功，谎言成立' : '质疑失败，声明成立';
  if (game.phase.startsWith('PUNISHMENT')) return game.tavernEvent?.type === 'DOUBLE_DANGER' ? '双倍危机下执行惩罚' : '正在执行惩罚';
  if (game.phase === 'ROUND_END') return '本轮结算中';
  return '牌局演出中';
}

function describeNewPlayerHint(game: GameView, isTurn: boolean): string | null {
  if (game.phase === 'ROUND_START') return `本轮目标是 ${game.targetCard}。你可以出任意牌，但声明都会按 ${game.targetCard} 处理。`;
  if (isTurn && !game.lastPlay) return '选择 1 至 3 张手牌，然后点击出牌。真实牌面可以和目标牌不同。';
  if (isTurn && game.lastPlay) return '你可以相信上一手继续出牌，也可以质疑。质疑失败会由你受罚。';
  if (game.phase === 'REVEAL') return '质疑后会逐张揭示真实牌面，Joker 视为真实目标牌。';
  return null;
}
