import type { CardRank, GamePhase, GameView, RoomView } from '@bluff-tavern/shared';
import type { CSSProperties } from 'react';

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
      {game.phase === 'REVEAL' && <Reveal cards={game.challenge?.revealedCards ?? []} progress={progress} />}
      {game.phase === 'VERDICT' && <Verdict game={game} punished={punished} />}
      {game.phase === 'PUNISHMENT_INTRO' && <RevolverBeat title={punished} subtitle="弹巢旋转" />}
      {game.phase === 'PUNISHMENT_TRIGGER' && <RevolverBeat title={punished} subtitle="扣动扳机" tense />}
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

function Reveal({ cards, progress }: { cards: CardRank[]; progress: number }) {
  return <div className="reveal-cards">
    {cards.map((card, index) => {
      const visible = progress >= (index + 1) / Math.max(cards.length, 1) - 0.12;
      return <div key={`${card}-${index}`} className={`reveal-card ${visible ? 'is-flipped' : ''}`}>
        <span className="reveal-card__back">?</span>
        <span className="reveal-card__front">{card}</span>
      </div>;
    })}
  </div>;
}

function Verdict({ game, punished }: { game: GameView; punished: string }) {
  const wasBluff = game.challenge?.wasBluff;
  return <div className={`verdict ${wasBluff ? 'verdict--bluff' : 'verdict--truth'}`}>
    <h2>{wasBluff ? '谎言！' : '质疑失败'}</h2>
    <p>{punished} 受罚</p>
  </div>;
}

function RevolverBeat({ title, subtitle, tense = false }: { title: string; subtitle: string; tense?: boolean }) {
  return <div className={`revolver-beat ${tense ? 'is-tense' : ''}`}>
    <h2>{title}</h2>
    <div className="revolver" aria-hidden="true">
      <span className="revolver__barrel" />
      <span className="revolver__cylinder" />
    </div>
    <p>{subtitle}</p>
  </div>;
}

function PunishmentResult({ result, punished }: { result: GameView['punishment']; punished: string }) {
  return <div className={`punishment-result ${result?.hit ? 'is-hit' : 'is-dry'}`}>
    <h2>{result?.hit ? '中弹淘汰' : '空枪'}</h2>
    <p>{result?.hit ? `${punished} 已淘汰` : `${punished} 暂时安全`}</p>
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
