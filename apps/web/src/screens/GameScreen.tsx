import { useMemo, useState } from 'react';
import type { GameView, RoomView } from '@bluff-tavern/shared';
import { playUiTone } from '../audio/ui-sounds';

export function GameScreen({ room, game, playerId, onPlay, onChallenge, onRestart, onFullscreen, onUseItem }: { room: RoomView; game: GameView; playerId: string | null; onPlay: (indexes: number[]) => void; onChallenge: () => void; onRestart: () => void; onFullscreen: () => void; onUseItem: (itemId: GameView['items'][number]) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const isTurn = game.turnPlayerId === playerId && game.phase !== 'ROUND_RESULT' && game.phase !== 'GAME_OVER';
  const players = useMemo(() => {
    const seated = room.players.map((player) => ({ ...player, cards: game.players.find((entry) => entry.playerId === player.id)?.cardCount ?? 0 }));
    const self = seated.find((player) => player.id === playerId);
    return self ? [...seated.filter((player) => player.id !== playerId), self] : seated;
  }, [room.players, game.players, playerId]);
  const toggle = (index: number) => setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < 3 ? [...current, index] : current);
  const play = () => { playUiTone(420); onPlay(selected); setSelected([]); };
  return <main className="game-screen">
    <p className="rotate-hint">为获得最佳牌桌视野，请横屏游玩</p>
    <header className="game-header"><div><p className="eyebrow">第 {game.roundNumber} 轮 · {game.gameMode === 'QUICK' ? '快速 7 秒' : '经典 15 秒'}</p><h1>目标牌：{game.targetCard}</h1></div><div className="game-header-actions"><span className="discard">已出 {game.discardCount} 张</span><button className="fullscreen-button" onClick={onFullscreen}>全屏</button></div></header>
    <section className="panel game-table"><h2>{game.phase === 'ROUND_RESULT' ? '质疑结果' : isTurn ? '轮到你出牌或质疑' : `等待 ${players.find((player) => player.id === game.turnPlayerId)?.nickname ?? '玩家'} 操作`}</h2>
      {game.tavernEvent && <p className="tavern-event">酒馆事件：{({ DRUNKEN: '醉酒洗牌', RAPID_NIGHT: '快速夜', DOUBLE_DANGER: '双倍危机', BLACKOUT: '停电' } as const)[game.tavernEvent.type]}</p>}
      <ul className={`game-players game-players--${players.length}`}>{players.map((player) => <li key={player.id} className={`${player.id === game.turnPlayerId ? 'active-turn ' : ''}${player.id === playerId ? 'self-seat' : ''}`}><strong>{player.nickname}{player.id === playerId ? '（你）' : ''}{!player.isConnected ? '（离线）' : ''}</strong><span>{player.cards} 张手牌</span></li>)}</ul>
    </section>
    <section className="hand" aria-label="你的手牌">{game.hand.map((card, index) => <button key={`${card}-${index}`} className={`card ${selected.includes(index) ? 'selected' : ''}`} onClick={() => toggle(index)} disabled={!isTurn}><span>{card === 'JOKER' ? '★' : card}</span></button>)}</section>
    <button className="button button--primary play-button" disabled={!isTurn || selected.length === 0} onClick={play}>出 {selected.length || ''} 张牌</button>
    {game.items.length > 0 && <div className="item-bar">{game.items.map((item) => <button key={item} className="fullscreen-button" onClick={() => onUseItem(item)}>{item}</button>)}</div>}
    {game.phase === 'CHALLENGE_WINDOW' && isTurn && <button className="button button--secondary play-button" onClick={() => { playUiTone(180); onChallenge(); }}>质疑上一手</button>}
    {game.challengeResult && <p className="future-note">翻牌：{game.challengeResult.revealedCards.join('、')}；{game.challengeResult.wasBluff ? '上一位玩家撒谎' : '质疑失败'}，失败者：{players.find((player) => player.id === game.challengeResult?.failedPlayerId)?.nickname}</p>}
    {game.punishment && <p className="future-note">轮盘第 {game.punishment.chamber + 1} 弹巢：{game.punishment.hit ? '中弹淘汰' : '空枪，继续游戏'}。</p>}
    {game.phase === 'GAME_OVER' && <><h2>胜者：{players.find((player) => player.id === game.winnerId)?.nickname}</h2>{room.hostPlayerId === playerId && <button className="button button--primary play-button" onClick={onRestart}>再来一局</button>}</>}
  </main>;
}
