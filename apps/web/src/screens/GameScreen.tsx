import { useMemo, useState } from 'react';
import type { GameView, RoomView } from '@bluff-tavern/shared';

export function GameScreen({ room, game, playerId, onPlay }: { room: RoomView; game: GameView; playerId: string | null; onPlay: (indexes: number[]) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const isTurn = game.turnPlayerId === playerId;
  const players = useMemo(() => room.players.map((player) => ({ ...player, cards: game.players.find((entry) => entry.playerId === player.id)?.cardCount ?? 0 })), [room.players, game.players]);
  const toggle = (index: number) => setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < 3 ? [...current, index] : current);
  const play = () => { onPlay(selected); setSelected([]); };
  return <main className="game-screen">
    <header className="game-header"><div><p className="eyebrow">第 {game.roundNumber} 轮</p><h1>目标牌：{game.targetCard}</h1></div><span className="discard">已出 {game.discardCount} 张</span></header>
    <section className="panel game-table"><h2>{isTurn ? '轮到你出牌' : `等待 ${players.find((player) => player.id === game.turnPlayerId)?.nickname ?? '玩家'} 出牌`}</h2>
      <ul className="game-players">{players.map((player) => <li key={player.id} className={player.id === game.turnPlayerId ? 'active-turn' : ''}><strong>{player.nickname}{player.id === playerId ? '（你）' : ''}</strong><span>{player.cards} 张手牌</span></li>)}</ul>
    </section>
    <section className="hand" aria-label="你的手牌">{game.hand.map((card, index) => <button key={`${card}-${index}`} className={`card ${selected.includes(index) ? 'selected' : ''}`} onClick={() => toggle(index)} disabled={!isTurn}><span>{card === 'JOKER' ? '★' : card}</span></button>)}</section>
    <button className="button button--primary play-button" disabled={!isTurn || selected.length === 0} onClick={play}>出 {selected.length || ''} 张牌</button>
  </main>;
}
