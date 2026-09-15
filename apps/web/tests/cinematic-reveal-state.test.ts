import { describe, expect, it } from 'vitest';
import type { CardRank, GamePhase, GameView } from '@bluff-tavern/shared';
import { getCinematicRevealState, REVEAL_TIMING } from '../src/components/cinematic-reveal-state';

function game(phase: GamePhase, cards: CardRank[] | null = ['A', 'Q', 'JOKER']): Pick<GameView, 'phase' | 'challenge' | 'targetRank' | 'tavernEvent'> {
  return {
    phase,
    targetRank: 'A',
    tavernEvent: null,
    challenge: cards
      ? {
          challengerId: 'p2',
          challengedId: 'p1',
          revealedCards: cards,
          wasBluff: phase === 'REVEAL' ? null : true,
          punishedPlayerId: phase === 'REVEAL' ? null : 'p1',
        }
      : null,
  };
}

describe('cinematic reveal visual state', () => {
  it('does not render challenged cards before the reveal phase', () => {
    expect(getCinematicRevealState(game('CHALLENGE_CALLOUT', null), 0).cards).toEqual([]);
  });

  it('flips cards in one direction during REVEAL', () => {
    const firstFlip = REVEAL_TIMING.intro;
    const secondFlip = REVEAL_TIMING.intro + REVEAL_TIMING.perCard;
    const thirdFlip = REVEAL_TIMING.intro + REVEAL_TIMING.perCard * 2;

    expect(getCinematicRevealState(game('REVEAL'), firstFlip - 1).cards.map((card) => card.flipped)).toEqual([false, false, false]);
    expect(getCinematicRevealState(game('REVEAL'), firstFlip).cards.map((card) => card.flipped)).toEqual([true, false, false]);
    expect(getCinematicRevealState(game('REVEAL'), secondFlip).cards.map((card) => card.flipped)).toEqual([true, true, false]);
    expect(getCinematicRevealState(game('REVEAL'), thirdFlip).cards.map((card) => card.flipped)).toEqual([true, true, true]);
  });

  it.each(['VERDICT', 'PUNISHMENT_INTRO', 'PUNISHMENT_TRIGGER', 'PUNISHMENT_RESULT', 'ROUND_END'] as const)('keeps cards front-locked during %s', (phase) => {
    const state = getCinematicRevealState(game(phase), 0);

    expect(state.settled).toBe(true);
    expect(state.cards.map((card) => ({ flipped: card.flipped, frontLocked: card.frontLocked }))).toEqual([
      { flipped: true, frontLocked: true },
      { flipped: true, frontLocked: true },
      { flipped: true, frontLocked: true },
    ]);
  });

  it('clears the persistent reveal on the next round start', () => {
    expect(getCinematicRevealState(game('ROUND_START', null), 0).cards).toEqual([]);
  });
});
