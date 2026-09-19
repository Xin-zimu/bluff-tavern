import type { GameView } from '@bluff-tavern/shared';

export interface SnapshotTiming {
  sequence: number;
  localReceivedAt: number;
  serverNow: number;
}

interface PhaseTimeoutResyncInput {
  game: Pick<GameView, 'phaseEndsAt'> | null;
  timing: SnapshotTiming;
  now: number;
  graceMs: number;
}

interface AuthoritativeResyncInput {
  hasSessionToken: boolean;
  socketConnected: boolean;
  now: number;
  lastResyncAt: number;
  throttleMs: number;
}

export function estimateServerNow(timing: SnapshotTiming, now: number): number {
  return timing.serverNow + (now - timing.localReceivedAt);
}

export function isPhaseTimeoutResyncDue({ game, timing, now, graceMs }: PhaseTimeoutResyncInput): boolean {
  if (!game?.phaseEndsAt) return false;
  return estimateServerNow(timing, now) > game.phaseEndsAt + graceMs;
}

export function canSendAuthoritativeResync({
  hasSessionToken,
  socketConnected,
  now,
  lastResyncAt,
  throttleMs,
}: AuthoritativeResyncInput): boolean {
  if (!hasSessionToken || !socketConnected) return false;
  return now - lastResyncAt >= throttleMs;
}
