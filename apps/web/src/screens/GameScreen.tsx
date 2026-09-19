import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CardRank, GameView, RoomView, TargetRank } from '@bluff-tavern/shared';
import { CinematicLayer } from '../components/CinematicLayer';
import { RulesPanel } from '../components/RulesPanel';
import { playGamePhaseSound } from '../audio/game-audio-manager';
import { playUiTone } from '../audio/ui-sounds';
import { CHARACTER_ART, ITEM_ART, ITEM_NAMES, characterImage } from '../art';
import { getTablePileRevealedCards } from './game-table-pile';

const GAME_MODE_NAMES: Record<GameView['gameMode'], string> = {
  CLASSIC: '经典',
  QUICK: '快速',
  PARTY: '乱斗',
  FREE_CHALLENGE: '全民质疑',
  SHARED_REVOLVER: '死亡左轮',
  ESCALATION: '加注',
};

export function GameScreen({ room, game, playerId, audioMuted, lowPowerActive, reduceMotion, onToggleAudio, onToggleLowPower, onToggleReduceMotion, onPlay, onChallenge, onReturnToRoom, onLeaveRoom, onFullscreen, onUseItem, onShare }: { room: RoomView; game: GameView; playerId: string | null; audioMuted: boolean; lowPowerActive: boolean; reduceMotion: boolean; onToggleAudio: () => void; onToggleLowPower: () => void; onToggleReduceMotion: () => void; onPlay: (indexes: number[]) => void; onChallenge: () => void; onReturnToRoom: () => void; onLeaveRoom: () => void; onFullscreen: () => void; onUseItem: (itemId: GameView['items'][number]) => void; onShare: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [localNow, setLocalNow] = useState(() => Date.now());
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dismissedTip, setDismissedTip] = useState(() => localStorage.getItem('bluff-tavern.dismissed-tip.v6') === 'true');
  const clockRef = useRef({ sequence: game.sequence, localReceivedAt: Date.now(), serverNow: game.serverNow });
  const playedAudioSequence = useRef<number | null>(null);
  const selectionScopeRef = useRef({ phase: game.phase, turnPlayerId: game.turnPlayerId, roundNumber: game.roundNumber, handKey: game.hand.join('|') });
  const isTurn = game.turnPlayerId === playerId && game.phase === 'TURN';
  const canPlay = isTurn && !game.mustChallenge;
  const canSubmitPlay = canPlay && selected.length >= game.minimumPlayCount && selected.length <= game.maximumPlayCount;
  const canFreeChallenge = game.phase === 'CHALLENGE_WINDOW' && game.lastPlay !== null && playerId !== null && game.alivePlayerIds.includes(playerId) && game.lastPlay.playerId !== playerId;
  const canChallenge = (isTurn && game.lastPlay !== null && game.gameMode !== 'FREE_CHALLENGE') || canFreeChallenge;
  const isGameOver = game.phase === 'GAME_OVER';
  const eventClass = game.tavernEvent ? ` game-screen--event-${game.tavernEvent.type.toLowerCase().replace('_', '-')}` : '';
  const modeCopy = `${GAME_MODE_NAMES[game.gameMode]} ${game.turnDurationSeconds} 秒`;
  const turnInstruction = describeTurnInstruction(game);
  const players = useMemo(() => {
    const seated = room.players.map((player) => {
      const publicState = game.players.find((entry) => entry.playerId === player.id);
      return { ...player, cards: publicState ? publicState.cardCount : 0, alive: game.alivePlayerIds.includes(player.id) };
    });
    const self = seated.find((player) => player.id === playerId);
    return self ? [...seated.filter((player) => player.id !== playerId), self] : seated;
  }, [room.players, game.players, game.alivePlayerIds, playerId]);
  const winner = players.find((player) => player.id === game.winnerId);
  const currentPlayer = players.find((player) => player.id === game.turnPlayerId);
  const lastPlayer = players.find((player) => player.id === game.lastPlay?.playerId);
  const statusCopy = describeMatchStatus(game, currentPlayer?.nickname, lastPlayer?.nickname);
  const hintCopy = !dismissedTip && !isGameOver ? describeNewPlayerHint(game, isTurn) : null;
  const toggle = (index: number) => setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < game.maximumPlayCount ? [...current, index] : current);
  const play = () => {
    if (!canSubmitPlay) return;
    if (!audioMuted) playUiTone(420);
    onPlay(selected);
    setSelected([]);
  };
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
  useEffect(() => {
    const nextScope = { phase: game.phase, turnPlayerId: game.turnPlayerId, roundNumber: game.roundNumber, handKey: game.hand.join('|') };
    const previous = selectionScopeRef.current;
    const scopeChanged = previous.phase !== nextScope.phase
      || previous.turnPlayerId !== nextScope.turnPlayerId
      || previous.roundNumber !== nextScope.roundNumber
      || previous.handKey !== nextScope.handKey;
    selectionScopeRef.current = nextScope;
    if (scopeChanged || game.phase !== 'TURN' || game.turnPlayerId !== playerId) setSelected([]);
  }, [game.phase, game.turnPlayerId, game.roundNumber, game.hand, playerId]);
  const syncedNow = clockRef.current.serverNow + (localNow - clockRef.current.localReceivedAt);
  const secondsLeft = game.phaseEndsAt ? Math.max(0, Math.ceil((game.phaseEndsAt - syncedNow) / 1_000)) : null;
  const modeRuleCopy = describeModeRule(game, secondsLeft);
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
    {game.tavernEvent && <TavernEventBanner game={game} />}
    {!isGameOver && <div className="turn-banner" aria-live="polite">{isTurn ? (game.mustChallenge ? '你的回合：必须质疑上一手' : turnInstruction) : game.phase === 'CHALLENGE_WINDOW' ? '全民质疑窗口开启' : game.phase === 'TURN' ? `等待 ${currentPlayer?.nickname ?? '玩家'} 出牌` : statusCopy}</div>}
    {modeRuleCopy && <aside className="mode-rule" aria-live="polite">{modeRuleCopy}</aside>}
    <section className={`panel game-table${game.phase === 'PUNISHMENT_RESULT' && game.punishment?.hit ? ' game-table--elimination' : ''}${isGameOver ? ' game-table--victory' : ''}`}><div className="table-status"><span>{statusCopy}</span></div>
      <div className="table-surface" aria-label="牌桌">
        <RoundTargetHud target={game.targetCard} roundNumber={game.roundNumber} />
        {game.sharedRevolver && <SharedRevolverHud state={game.sharedRevolver} reloaded={game.punishment?.hit === true} />}
        <TablePile game={game} lastPlayerName={lastPlayer?.nickname} />
      </div>
      <ul className={`game-players game-players--${players.length}`}>{players.map((player) => <li key={player.id} className={`${player.id === game.turnPlayerId ? 'active-turn ' : ''}${player.id === playerId ? 'self-seat ' : ''}${game.punishment?.eliminatedPlayerId === player.id ? 'is-newly-eliminated ' : ''}${!player.alive ? 'is-eliminated' : ''}`}>
        {player.characterId && <div className="character-portrait character-portrait--game" aria-hidden="true"><img src={characterImage(player.characterId, !player.alive ? 'eliminated' : game.phase === 'GAME_OVER' && player.id === game.winnerId ? 'victory' : 'idle')} alt="" /></div>}
        <span className="seat-copy"><strong>{player.nickname}{player.id === playerId ? '（你）' : ''}{!player.isConnected ? '（离线）' : ''}</strong><small>{player.id === game.turnPlayerId && game.phase === 'TURN' ? '出牌中 · ' : ''}{player.characterId ? CHARACTER_ART[player.characterId].name : '未选角色'} · {player.alive ? `${formatCardCount(player.cards)} 张手牌` : '已淘汰'}</small></span>
      </li>)}</ul>
    </section>
    {!isGameOver && game.phase === 'CHALLENGE_WINDOW' && <ChallengeWindowPanel game={game} now={syncedNow} selfCanChallenge={canFreeChallenge} onChallenge={() => { if (!audioMuted) playUiTone(180); onChallenge(); }} />}
    {!isGameOver && <section className={`hand${tipsy ? ' hand--tipsy' : ''}${game.tavernEvent?.type === 'NO_JOKER' ? ' hand--no-joker' : ''}`} aria-label="你的手牌">{game.hand.map((card, index) => <button key={`${card}-${index}`} className={`card card--${card.toLowerCase()} ${selected.includes(index) ? 'selected' : ''}`} aria-pressed={selected.includes(index)} onClick={() => toggle(index)} disabled={!canPlay}>{card === 'JOKER' ? <img src="/assets/cards/joker.png" alt="Joker" /> : <span>{card}</span>}</button>)}</section>}
    {!isGameOver && <button className="button button--primary button--art-start play-button" disabled={!canSubmitPlay} onClick={play}>出 {selected.length || ''} 张牌</button>}
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
    {canChallenge && game.phase !== 'CHALLENGE_WINDOW' && <button className="button button--secondary button--art-challenge play-button" onClick={() => { if (!audioMuted) playUiTone(180); onChallenge(); }}>质疑上一手</button>}
    {game.challengeResult && <div className="challenge-result" aria-live="polite"><img src="/assets/effects/challenge_burst.png" alt="" aria-hidden="true" /><p>翻牌：{game.challengeResult.revealedCards.join('、')}；{game.challengeResult.wasBluff ? '上一位玩家撒谎' : '质疑失败'}，失败者：{players.find((player) => player.id === game.challengeResult?.failedPlayerId)?.nickname}</p></div>}
    {game.punishment && <p className="future-note">{describePunishmentNote(game.punishment)}</p>}
    <CinematicLayer room={room} game={game} now={syncedNow} />
    {room.players.some((player) => !player.isConnected) && <div className="reconnect-overlay" aria-live="polite">有玩家暂时离线，对局状态会在重连后恢复。</div>}
    <RulesPanel open={rulesOpen} game={game} onClose={() => setRulesOpen(false)} />
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
  const revealedCards = getTablePileRevealedCards(game);
  const hiddenBet = game.lastPlay?.count === null;
  const pileCards = revealedCards.length > 0 ? revealedCards.length : hiddenBet ? 1 : Math.max(game.lastPlay?.count ?? Math.min(game.discardCount, 3), game.discardCount > 0 ? 1 : 0);
  return <div className="table-pile" aria-label="公共牌区">
    <div className={`table-pile__cards${revealedCards.length > 0 ? ' table-pile__cards--revealed' : ''}`} aria-hidden="true">
      {revealedCards.length > 0
        ? revealedCards.map((rank, index) => <CardFace key={`${rank}-${index}`} rank={rank} className="table-pile__revealed-card" style={{ '--pile-index': index } as CSSProperties} />)
        : pileCards > 0
          ? Array.from({ length: Math.min(pileCards, 3) }, (_, index) => <span key={index} className="table-pile__card-back" style={{ '--pile-index': index } as CSSProperties} />)
          : <em>等待出牌</em>}
    </div>
    <div className="table-pile__copy">
      <strong>公共牌区</strong>
      <p>{describeLastPlay(game, lastPlayerName)}</p>
      <small>{revealedCards.length > 0 ? '已公开至本轮结束' : game.lastPlay ? hiddenBet ? '数量暂时隐藏' : '当前可质疑对象' : `目标牌是 ${game.targetCard}`}</small>
    </div>
  </div>;
}

function describeLastPlay(game: GameView, lastPlayerName: string | undefined): string {
  if (!game.lastPlay) return '本轮尚未有人出牌';
  if (game.lastPlay.count === null) return `${lastPlayerName ?? '玩家'} 已下注，声明了一手 ${game.lastPlay.claimedRank}`;
  return `${lastPlayerName ?? '玩家'} 声明：${game.lastPlay.count} 张 ${game.lastPlay.claimedRank}`;
}

function CardFace({ rank, size = 'normal', className = '', style }: { rank: CardRank; size?: 'normal' | 'small'; className?: string; style?: CSSProperties }) {
  return <span className={`rank-card rank-card--${size} rank-card--${rank.toLowerCase()}${className ? ` ${className}` : ''}`} style={style}>
    {rank === 'JOKER' ? <img src="/assets/cards/joker.png" alt="Joker" /> : <span>{rank}</span>}
  </span>;
}

function TavernEventBanner({ game }: { game: GameView }) {
  const event = game.tavernEvent!;
  const currentRule = describePartyEventRule(game, null);
  return <aside className={`tavern-event tavern-event--${event.type.toLowerCase().replace('_', '-')}`} aria-live="polite">
    <div className="tavern-event__current"><strong>{event.title}</strong><span>{currentRule ?? event.description}</span></div>
    {game.partyEventHistory.length > 1 && <small>{game.partyEventHistory.slice(-2, -1).map((entry) => `上一轮：${entry.title}`).join('')}</small>}
  </aside>;
}

function SharedRevolverHud({ state, reloaded }: { state: NonNullable<GameView['sharedRevolver']>; reloaded: boolean }) {
  const spent = Math.min(state.currentChamber, state.chamberCount);
  return <aside className="shared-revolver-hud" aria-label="共享左轮状态">
    <strong>共享左轮</strong>
    <div className="shared-revolver-hud__track" aria-hidden="true">
      {Array.from({ length: state.chamberCount }, (_, index) => <span key={index} className={index < spent ? 'is-spent' : ''} />)}
    </div>
    <p>连续空膛：{spent} · 剩余膛位：{state.chamberCount - spent}</p>
    {reloaded && <small>重新装填并旋转弹巢</small>}
  </aside>;
}

function ChallengeWindowPanel({ game, now, selfCanChallenge, onChallenge }: { game: GameView; now: number; selfCanChallenge: boolean; onChallenge: () => void }) {
  const remaining = game.freeChallenge ? Math.max(0, ((game.freeChallenge.endsAt - now) / 1_000)).toFixed(1) : '0.0';
  return <aside className="challenge-window-panel" aria-live="polite">
    <strong>质疑窗口</strong>
    <span>{remaining}s</span>
    <p>{game.lastPlay ? game.lastPlay.count === null ? '上一手已下注，数量暂时隐藏' : `上一手声明 ${game.lastPlay.claimedRank} × ${game.lastPlay.count}` : '等待质疑'}</p>
    <button type="button" disabled={!selfCanChallenge} onClick={onChallenge}>{selfCanChallenge ? '质疑！' : '等待其他玩家质疑'}</button>
  </aside>;
}

function canUseItem(item: GameView['items'][number], game: GameView, playerId: string | null): boolean {
  if (!playerId || !game.alivePlayerIds.includes(playerId) || game.phase !== 'TURN') return false;
  if (item === 'POCKET_WATCH') return game.turnPlayerId === playerId;
  return true;
}

function formatCardCount(count: number | null): string {
  return count === null ? '?' : String(count);
}

function describeModeRule(game: GameView, secondsLeft: number | null): string | null {
  if (game.phase === 'CHALLENGE_WINDOW') return `全民质疑：所有其他存活玩家可抢先质疑${secondsLeft !== null ? `，剩余 ${secondsLeft} 秒` : ''}`;
  if (game.gameMode === 'ESCALATION' && game.phase === 'TURN') return `加注模式：本次至少出 ${game.minimumPlayCount} 张`;
  if (game.gameMode === 'PARTY') return describePartyEventRule(game, secondsLeft);
  return null;
}

function describeTurnInstruction(game: GameView): string {
  if (game.minimumPlayCount === game.maximumPlayCount) return `你的回合：请选择 ${game.minimumPlayCount} 张牌`;
  if (game.minimumPlayCount > 1) return `你的回合：选择 ${game.minimumPlayCount} 至 ${game.maximumPlayCount} 张牌`;
  return `你的回合：选择 1 至 ${game.maximumPlayCount} 张牌`;
}

function describePartyEventRule(game: GameView, secondsLeft: number | null): string | null {
  switch (game.tavernEvent?.type) {
    case 'ONE_CARD_ONLY':
      return '单张夜：请选择 1 张';
    case 'MATCH_BET':
      return game.minimumPlayCount === game.maximumPlayCount ? `跟注夜：必须出 ${game.minimumPlayCount} 张` : '跟注夜：第一手决定张数';
    case 'HEAVY_HAND':
      return '豪饮之夜：至少出 2 张';
    case 'LAST_CALL':
      return `最后点单：本回合 ${game.turnDurationSeconds} 秒${secondsLeft !== null ? `，剩余 ${secondsLeft} 秒` : ''}`;
    case 'NO_JOKER':
      return '禁忌小丑：Joker 本轮按假牌判定';
    case 'FORCED_BET':
      return `强制豪赌：本次至少出 ${game.minimumPlayCount} 张`;
    case 'DRUNKEN':
      return '醉酒之夜：本轮出牌方向反转';
    case 'RAPID_NIGHT':
      return `快速夜：本轮每人 ${game.turnDurationSeconds} 秒`;
    case 'DOUBLE_DANGER':
      return '双倍危机：受罚者最多连续开两枪';
    case 'HIDDEN_BET':
      return '暗注夜：他人的出牌数量翻牌前隐藏';
    default:
      return null;
  }
}

function describeItem(item: GameView['items'][number]): string {
  if (item === 'SPYGLASS') return '查看自己下一次受罚风险';
  if (item === 'POCKET_WATCH') return '自己的回合延长倒计时';
  return '短暂干扰自己的界面提示，不改变判定';
}

function describePunishmentNote(punishment: NonNullable<GameView['punishment']>): string {
  const shotPrefix = punishment.totalShots > 1 ? `第 ${punishment.shotNumber}/${punishment.totalShots} 枪，` : '';
  const result = punishment.hit
    ? '中弹淘汰'
    : punishment.shotNumber < punishment.totalShots ? '空枪，还需再开一枪' : '空枪，继续游戏';
  return `${shotPrefix}轮盘第 ${punishment.chamber + 1} 弹巢：${result}。`;
}

function describeMatchStatus(game: GameView, currentPlayerName?: string, lastPlayerName?: string): string {
  if (game.phase === 'GAME_OVER') return '本局结束';
  if (game.phase === 'ROUND_START') return `第 ${game.roundNumber} 轮开始，目标牌 ${game.targetCard}`;
  if (game.phase === 'TURN') {
    if (game.mustChallenge) return `${currentPlayerName ?? '玩家'} 必须质疑上一手`;
    if (game.lastPlay?.count === null) return `${lastPlayerName ?? '玩家'} 已下注，等待 ${currentPlayerName ?? '玩家'} 行动`;
    if (game.minimumPlayCount === game.maximumPlayCount && game.lastPlay) return `${lastPlayerName ?? '玩家'} 已出 ${game.lastPlay.count} 张，${currentPlayerName ?? '玩家'} 必须出 ${game.minimumPlayCount} 张或质疑`;
    if (game.gameMode === 'PARTY' && game.tavernEvent?.type === 'FORCED_BET' && game.lastPlay) return `${lastPlayerName ?? '玩家'} 已出 ${game.lastPlay.count} 张，${currentPlayerName ?? '玩家'} 至少出 ${game.minimumPlayCount} 张或质疑`;
    if (game.gameMode === 'ESCALATION' && game.lastPlay) return `${lastPlayerName ?? '玩家'} 已出 ${game.lastPlay.count} 张，${currentPlayerName ?? '玩家'} 至少出 ${game.minimumPlayCount} 张或质疑`;
    if (game.lastPlay) return `${lastPlayerName ?? '玩家'} 已出 ${game.lastPlay.count} 张，等待 ${currentPlayerName ?? '玩家'} 行动`;
    return `等待 ${currentPlayerName ?? '玩家'} 出牌`;
  }
  if (game.phase === 'CHALLENGE_WINDOW') return '全民质疑窗口开启，等待抢先质疑';
  if (game.phase === 'CHALLENGE_CALLOUT') return '质疑发起，所有操作已锁定';
  if (game.phase === 'REVEAL') return game.tavernEvent?.type === 'CANDLE_FLICKER' ? '烛火摇曳，正在逐张揭牌' : '正在逐张揭牌';
  if (game.phase === 'VERDICT') return game.challenge?.wasBluff ? '质疑成功，谎言成立' : '质疑失败，声明成立';
  if (game.phase.startsWith('PUNISHMENT')) return game.tavernEvent?.type === 'DOUBLE_DANGER' ? '双倍危机下执行惩罚' : '正在执行惩罚';
  if (game.phase === 'ROUND_END') return '本轮结算中';
  return '牌局演出中';
}

function describeNewPlayerHint(game: GameView, isTurn: boolean): string | null {
  if (game.phase === 'ROUND_START') return `本轮目标是 ${game.targetCard}。你可以出任意牌，但声明都会按 ${game.targetCard} 处理。`;
  if (isTurn && game.gameMode === 'ESCALATION' && game.lastPlay) return `加注模式：这手至少出 ${game.minimumPlayCount} 张，也可以质疑上一手。`;
  if (game.gameMode === 'FREE_CHALLENGE' && game.phase === 'CHALLENGE_WINDOW') return '全民质疑：不是出牌者的存活玩家都可以抢先质疑。';
  if (game.gameMode === 'SHARED_REVOLVER' && game.sharedRevolver) return '死亡左轮：全桌共用一把枪，连续空膛会保留到下一次惩罚。';
  if (game.gameMode === 'PARTY' && game.tavernEvent) return `${game.tavernEvent.title}：${game.tavernEvent.description}`;
  if (isTurn && !game.lastPlay) return '选择 1 至 3 张手牌，然后点击出牌。真实牌面可以和目标牌不同。';
  if (isTurn && game.lastPlay) return '你可以相信上一手继续出牌，也可以质疑。质疑失败会由你受罚。';
  if (game.phase === 'REVEAL') return '质疑后会逐张揭示真实牌面，Joker 视为真实目标牌。';
  return null;
}
