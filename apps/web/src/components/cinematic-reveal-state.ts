import type { CardRank, GamePhase, GameView } from '@bluff-tavern/shared';

export const REVEAL_TIMING = {
  intro: 500,
  perCard: 750,
  finalHold: 1_000,
} as const;

const CINEMATIC_REVEAL_PHASES = new Set<GamePhase>([
  'REVEAL',
  'VERDICT',
  'PUNISHMENT_INTRO',
  'PUNISHMENT_TRIGGER',
  'PUNISHMENT_RESULT',
  'ROUND_END',
]);

export interface CinematicRevealCardState {
  rank: CardRank;
  flipped: boolean;
  frontLocked: boolean;
  honest: boolean;
}

export interface CinematicRevealState {
  cards: CinematicRevealCardState[];
  settled: boolean;
}

export function getCinematicRevealState(game: Pick<GameView, 'phase' | 'challenge' | 'targetRank' | 'tavernEvent'>, elapsed: number): CinematicRevealState {
  const cards = game.challenge?.revealedCards;
  if (!cards || !CINEMATIC_REVEAL_PHASES.has(game.phase)) return { cards: [], settled: false };
  const frontLocked = game.phase !== 'REVEAL';
  const settledAt = REVEAL_TIMING.intro + cards.length * REVEAL_TIMING.perCard;
  return {
    settled: frontLocked || elapsed >= settledAt,
    cards: cards.map((rank, index) => ({
      rank,
      frontLocked,
      flipped: frontLocked || elapsed >= REVEAL_TIMING.intro + index * REVEAL_TIMING.perCard,
      honest: rank === game.targetRank || (rank === 'JOKER' && game.tavernEvent?.type !== 'NO_JOKER'),
    })),
  };
}
