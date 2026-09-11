import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameView, RoomView } from '@bluff-tavern/shared';
import { CinematicLayer } from '../components/CinematicLayer';
import { playGamePhaseSound } from '../audio/game-audio-manager';
import { playUiTone } from '../audio/ui-sounds';
import { CHARACTER_ART, ITEM_ART, ITEM_NAMES, characterImage } from '../art';

export function GameScreen({ room, game, playerId, onPlay, onChallenge, onRestart, onFullscreen, onUseItem, onShare }: { room: RoomView; game: GameView; playerId: string | null; onPlay: (indexes: number[]) => void; onChallenge: () => void; onRestart: () => void; onFullscreen: () => void; onUseItem: (itemId: GameView['items'][number]) => void; onShare: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [localNow, setLocalNow] = useState(() => Date.now());
  const clockRef = useRef({ sequence: game.sequence, localReceivedAt: Date.now(), serverNow: game.serverNow });
  const playedAudioSequence = useRef<number | null>(null);
  const isTurn = game.turnPlayerId === playerId && game.phase === 'TURN';
  const canPlay = isTurn && !game.mustChallenge;
  const canChallenge = isTurn && game.lastPlay !== null;
  const isGameOver = game.phase === 'GAME_OVER';
  const players = useMemo(() => {
    const seated = room.players.map((player) => ({ ...player, cards: game.players.find((entry) => entry.playerId === player.id)?.cardCount ?? 0, alive: game.alivePlayerIds.includes(player.id) }));
    const self = seated.find((player) => player.id === playerId);
    return self ? [...seated.filter((player) => player.id !== playerId), self] : seated;
  }, [room.players, game.players, game.alivePlayerIds, playerId]);
  const winner = players.find((player) => player.id === game.winnerId);
  const toggle = (index: number) => setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < 3 ? [...current, index] : current);
  const play = () => { playUiTone(420); onPlay(selected); setSelected([]); };
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
    playGamePhaseSound(game);
  }, [game]);
  const syncedNow = clockRef.current.serverNow + (localNow - clockRef.current.localReceivedAt);
  const secondsLeft = game.phaseEndsAt ? Math.max(0, Math.ceil((game.phaseEndsAt - syncedNow) / 1_000)) : null;
  return <main className="game-screen">
    <p className="rotate-hint">为获得最佳牌桌视野，请横屏游玩</p>
    <header className="game-header"><div><p className="eyebrow">第 {game.roundNumber} 轮 · {game.gameMode === 'QUICK' ? '快速 7 秒' : '经典 15 秒'} · #{game.sequence}</p><h1>目标牌：{game.targetCard}</h1></div><div className="game-header-actions">{secondsLeft !== null && <span className="phase-clock">{secondsLeft}s</span>}<span className="discard">已出 {game.discardCount} 张</span><button className="fullscreen-button" onClick={onFullscreen}>全屏</button></div></header>
    <section className="panel game-table"><h2>{isGameOver ? '本局结束' : game.phase === 'VERDICT' ? '质疑结果' : isTurn ? (game.mustChallenge ? '必须质疑上一手' : '轮到你出牌或质疑') : game.phase === 'TURN' ? `等待 ${players.find((player) => player.id === game.turnPlayerId)?.nickname ?? '玩家'} 操作` : '牌局演出中'}</h2>
      <ul className={`game-players game-players--${players.length}`}>{players.map((player) => <li key={player.id} className={`${player.id === game.turnPlayerId ? 'active-turn ' : ''}${player.id === playerId ? 'self-seat ' : ''}${!player.alive ? 'is-eliminated' : ''}`}>
        {player.characterId && <div className="character-portrait character-portrait--game" aria-hidden="true"><img src={characterImage(player.characterId, !player.alive ? 'eliminated' : game.phase === 'GAME_OVER' && player.id === game.winnerId ? 'victory' : 'idle')} alt="" /></div>}
        <span className="seat-copy"><strong>{player.nickname}{player.id === playerId ? '（你）' : ''}{!player.isConnected ? '（离线）' : ''}</strong><small>{player.characterId ? CHARACTER_ART[player.characterId].name : '未选角色'} · {player.alive ? `${player.cards} 张手牌` : '已淘汰'}</small></span>
      </li>)}</ul>
    </section>
    {!isGameOver && <section className="hand" aria-label="你的手牌">{game.hand.map((card, index) => <button key={`${card}-${index}`} className={`card card--${card.toLowerCase()} ${selected.includes(index) ? 'selected' : ''}`} aria-pressed={selected.includes(index)} onClick={() => toggle(index)} disabled={!canPlay}>{card === 'JOKER' ? <img src="/assets/cards/joker.png" alt="Joker" /> : <span>{card}</span>}</button>)}</section>}
    {!isGameOver && <button className="button button--primary button--art-start play-button" disabled={!canPlay || selected.length === 0} onClick={play}>出 {selected.length || ''} 张牌</button>}
    {game.items.length > 0 && <div className="item-bar" aria-label="可用道具">{game.items.map((item) => <button key={item} className="item-button" onClick={() => onUseItem(item)} title={ITEM_NAMES[item]}>
      <img src={ITEM_ART[item]} alt="" loading="lazy" /><span>{ITEM_NAMES[item]}</span>
    </button>)}</div>}
    {canChallenge && <button className="button button--secondary button--art-challenge play-button" onClick={() => { playUiTone(180); onChallenge(); }}>质疑上一手</button>}
    {game.challengeResult && <div className="challenge-result" aria-live="polite"><img src="/assets/effects/challenge_burst.png" alt="" aria-hidden="true" /><p>翻牌：{game.challengeResult.revealedCards.join('、')}；{game.challengeResult.wasBluff ? '上一位玩家撒谎' : '质疑失败'}，失败者：{players.find((player) => player.id === game.challengeResult?.failedPlayerId)?.nickname}</p></div>}
    {game.punishment && <p className="future-note">轮盘第 {game.punishment.chamber + 1} 弹巢：{game.punishment.hit ? '中弹淘汰' : '空枪，继续游戏'}。</p>}
    <CinematicLayer room={room} game={game} now={syncedNow} />
    {game.phase === 'GAME_OVER' && <section className="victory-panel" aria-label="本局结果">
      <img className="victory-particles" src="/assets/effects/victory_particles.png" alt="" aria-hidden="true" />
      <p className="eyebrow">酒馆最终胜者</p>
      {winner?.characterId && <div className="character-portrait victory-portrait" aria-hidden="true"><img src={characterImage(winner.characterId, 'victory')} alt="" /></div>}
      <h2>{winner?.nickname}</h2>
      {game.summary && <><p className="victory-summary">{game.summary.playerCount} 人局 · {game.summary.durationSeconds} 秒 · 质疑 {game.summary.challengeCount} 次（成功 {game.summary.successfulChallenges}）</p><button className="fullscreen-button" onClick={onShare}>分享结果</button></>}
      {room.hostPlayerId === playerId && <button className="button button--primary button--art-start play-button" onClick={onRestart}>再来一局</button>}
    </section>}
  </main>;
}
