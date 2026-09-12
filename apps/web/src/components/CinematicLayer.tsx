import type { CardRank, GamePhase, GameView, RoomView } from '@bluff-tavern/shared';
import type { CSSProperties } from 'react';
import { CINEMATIC_ART } from '../art';

interface CinematicLayerProps {
  game: GameView;
  room: RoomView;
  now: number;
}

const phaseLabels: Record<GamePhase, string> = {
  LOBBY: '等待开局',
  MATCH_START: '牌局开始',
  ROUND_START: '新一轮',
  TURN: '行动中',
  CHALLENGE_CALLOUT: '质疑',
  REVEAL: '翻牌',
  VERDICT: '判定',
  PUNISHMENT_INTRO: '左轮准备',
  PUNISHMENT_TRIGGER: '扣动扳机',
  PUNISHMENT_RESULT: '惩罚结果',
  ROUND_END: '回合结束',
  GAME_OVER: '最终胜者',
};

export function CinematicLayer({ game, room, now }: CinematicLayerProps) {
  if (game.phase === 'TURN') return null;
  const elapsed = Math.max(0, now - game.phaseStartedAt);
  if (game.phase === 'GAME_OVER' && elapsed > 3_000) return null;
  const duration = game.phaseEndsAt ? Math.max(1, game.phaseEndsAt - game.phaseStartedAt) : 1;
  const progress = Math.min(1, elapsed / duration);
  const challenger = findName(room, game.challenge?.challengerId);
  const challenged = findName(room, game.challenge?.challengedId);
  const punished = findName(room, game.challenge?.punishedPlayerId ?? game.punishment?.punishedPlayerId);
  const winner = findName(room, game.winnerId);
  const result = game.punishment;

  return <div className={`cinematic cinematic--${game.phase.toLowerCase()}${game.punishment?.hit ? ' cinematic--hit' : ''}`} aria-live="polite" style={{ '--phase-progress': progress } as CSSProperties}>
    <div className="cinematic__progress" aria-hidden="true"><span /></div>
    <div className="cinematic__panel">
      <p className="cinematic__phase">{phaseLabels[game.phase]}</p>
      {game.phase === 'ROUND_START' && <RoundIntro game={game} progress={progress} />}
      {game.phase === 'CHALLENGE_CALLOUT' && <Callout challenger={challenger} challenged={challenged} />}
      {game.phase === 'REVEAL' && <Reveal cards={game.challenge?.revealedCards ?? []} targetRank={game.targetRank} progress={progress} />}
      {game.phase === 'VERDICT' && <Verdict game={game} punished={punished} />}
      {game.phase === 'PUNISHMENT_INTRO' && <RevolverBeat title={punished} subtitle="弹巢旋转" chamber={null} />}
      {game.phase === 'PUNISHMENT_TRIGGER' && <RevolverBeat title={punished} subtitle="扣动扳机" chamber={null} tense />}
      {game.phase === 'PUNISHMENT_RESULT' && <PunishmentResult result={result} punished={punished} />}
      {game.phase === 'ROUND_END' && <h2>清理牌桌</h2>}
      {game.phase === 'GAME_OVER' && <Victory winner={winner} />}
      {game.phase === 'MATCH_START' && <h2>酒馆开局</h2>}
      {game.phase === 'LOBBY' && <h2>等待入席</h2>}
    </div>
  </div>;
}

function RoundIntro({ game, progress }: { game: GameView; progress: number }) {
  return <div className="round-intro">
    <h2>ROUND {game.roundNumber}</h2>
    <strong className={progress > 0.22 ? 'is-visible' : ''}>目标牌 {game.targetRank}</strong>
    <div className={progress > 0.45 ? 'deal-line is-dealing' : 'deal-line'} aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
    </div>
  </div>;
}

function Callout({ challenger, challenged }: { challenger: string; challenged: string }) {
  return <div className="callout">
    <h2>质疑！</h2>
    <p>{challenger} 质疑 {challenged}</p>
  </div>;
}

function Reveal({ cards, targetRank, progress }: { cards: CardRank[]; targetRank: GameView['targetRank']; progress: number }) {
  return <div className={`reveal-cards ${progress > 0.84 ? 'is-settled' : ''}`}>
    {cards.map((card, index) => {
      const visible = progress >= (index + 1) / Math.max(cards.length, 1) - 0.12;
      const honest = card === targetRank || card === 'JOKER';
      return <div key={`${card}-${index}`} className={`reveal-card reveal-card--${card.toLowerCase()} ${visible ? 'is-flipped' : ''} ${honest ? 'is-honest' : 'is-bluff'}`} style={{ '--card-index': index } as CSSProperties}>
        <span className="reveal-card__back">?</span>
        <span className="reveal-card__front">{card}</span>
      </div>;
    })}
  </div>;
}

function Verdict({ game, punished }: { game: GameView; punished: string }) {
  const wasBluff = game.challenge?.wasBluff;
  return <div className={`verdict ${wasBluff ? 'verdict--bluff' : 'verdict--truth'}`}>
    <span className="verdict__seal" aria-hidden="true" />
    <h2>{wasBluff ? '谎言！' : '质疑失败'}</h2>
    <p>{punished} 受罚</p>
  </div>;
}

function RevolverBeat({ title, subtitle, chamber, tense = false, result }: { title: string; subtitle: string; chamber?: number | null; tense?: boolean; result?: GameView['punishment'] }) {
  return <div className={`revolver-beat ${tense ? 'is-tense' : ''}`}>
    <h2>{title}</h2>
    <div className={`revolver-stage ${result?.hit ? 'is-hit' : result ? 'is-dry' : ''}`} aria-hidden="true">
      <img className="revolver-stage__gun" src={CINEMATIC_ART.revolver} alt="" />
      <img className="revolver-stage__flash" src={CINEMATIC_ART.muzzleFlashSmoke} alt="" />
      <div className="revolver-stage__cylinder">
        {Array.from({ length: 6 }, (_, index) => <span key={index} className={chamber === index ? 'is-current' : ''} />)}
      </div>
    </div>
    <p>{subtitle}</p>
  </div>;
}

function PunishmentResult({ result, punished }: { result: GameView['punishment']; punished: string }) {
  return <div className={`punishment-result ${result?.hit ? 'is-hit' : 'is-dry'}`}>
    <RevolverBeat title={result?.hit ? '砰！' : '咔哒'} subtitle={result?.hit ? `${punished} 已淘汰` : `${punished} 暂时安全`} chamber={result?.chamber ?? null} result={result} />
  </div>;
}

function Victory({ winner }: { winner: string }) {
  return <div className="cinematic-victory">
    <h2>最终胜者</h2>
    <p>{winner}</p>
  </div>;
}

function findName(room: RoomView, playerId: string | null | undefined): string {
  if (!playerId) return '玩家';
  return room.players.find((player) => player.id === playerId)?.nickname ?? '玩家';
}
