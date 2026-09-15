import { describe, expect, it } from 'vitest';
import type { CardRank, GamePhase, GameView } from '@bluff-tavern/shared';
import { getTablePileRevealedCards } from '../src/screens/game-table-pile';

function view(phase: GamePhase, revealedCards: CardRank[] | null): Pick<GameView, 'phase' | 'challenge'> {
  return {
    phase,
    challenge: {
      challengerId: 'p2',
      challengedId: 'p1',
      revealedCards,
      wasBluff: revealedCards ? false : null,
      punishedPlayerId: revealedCards ? 'p2' : null,
    },
  };
}

describe('table pile reveal lifecycle', () => {
  it('does not expose challenged cards before the reveal handoff', () => {
    expect(getTablePileRevealedCards(view('CHALLENGE_CALLOUT', null))).toEqual([]);
    expect(getTablePileRevealedCards(view('REVEAL', ['A', 'JOKER']))).toEqual([]);
  });

  it.each(['VERDICT', 'PUNISHMENT_INTRO', 'PUNISHMENT_TRIGGER', 'PUNISHMENT_RESULT', 'ROUND_END'] as const)('keeps challenged cards face-up during %s', (phase) => {
    expect(getTablePileRevealedCards(view(phase, ['A', 'JOKER', 'Q']))).toEqual(['A', 'JOKER', 'Q']);
  });

  it('clears public table cards when the next round starts', () => {
    expect(getTablePileRevealedCards(view('ROUND_START', null))).toEqual([]);
  });
});
