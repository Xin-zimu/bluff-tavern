import type { CardRank, GamePhase, GameView } from '@bluff-tavern/shared';

const TABLE_REVEAL_PHASES = new Set<GamePhase>([
  'VERDICT',
  'PUNISHMENT_INTRO',
  'PUNISHMENT_TRIGGER',
  'PUNISHMENT_RESULT',
  'ROUND_END',
]);

export function getTablePileRevealedCards(game: Pick<GameView, 'phase' | 'challenge'>): CardRank[] {
  if (!TABLE_REVEAL_PHASES.has(game.phase)) return [];
  return game.challenge?.revealedCards ? [...game.challenge.revealedCards] : [];
}
