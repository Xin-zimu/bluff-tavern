# Bluff Tavern V6 State Machine

The V6 server owns one authoritative phase machine per active room. Clients render the current phase but never advance gameplay by reporting that an animation finished.

## Phases

```text
LOBBY
  |
  v
MATCH_START
  |
  v
ROUND_START
  |
  v
TURN
  | playCards
  +-----------> TURN
  |
  | challenge
  v
CHALLENGE_CALLOUT
  |
  v
REVEAL
  |
  v
VERDICT
  |
  v
PUNISHMENT_INTRO
  |
  v
PUNISHMENT_TRIGGER
  |
  v
PUNISHMENT_RESULT
  |
  v
ROUND_END
  | alive count > 1
  v
ROUND_START

ROUND_END
  | alive count == 1
  v
GAME_OVER
```

`TURN` also has a required substate:

```ts
mustChallenge: boolean;
```

When `mustChallenge` is true, the current player may only challenge.

## Internal State

```ts
interface InternalGameState {
  matchId: string;
  roomCode: string;

  phase: GamePhase;
  phaseSequence: number;
  phaseStartedAt: number;
  phaseEndsAt: number | null;

  roundNumber: number;

  playerOrder: string[];
  alivePlayerIds: Set<string>;

  hands: Map<string, CardRank[]>;
  targetRank: 'A' | 'K' | 'Q';

  turnPlayerId: string | null;

  lastPlay: InternalPlay | null;
  mustChallenge: boolean;

  pendingChallenge: PendingChallenge | null;
  revolvers: Map<string, RevolverState>;

  winnerId: string | null;
}
```

## Phase Sequence

Every phase transition increments:

```ts
phaseSequence += 1;
```

Clients only accept snapshots where:

```ts
incoming.sequence >= current.sequence
```

Older snapshots are ignored. This prevents stale network packets from reverting a client from a later phase back to an earlier phase.

## Server Time

Every authoritative snapshot includes:

```ts
interface PhaseTiming {
  serverNow: number;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
}
```

Clients use these fields to calculate the current animation progress. A late client must jump into the correct point in the phase instead of replaying from the beginning.

## Allowed Operations

`LOBBY`:

- Host may start the match when room requirements are met.
- Gameplay actions are rejected.

`MATCH_START`:

- No client gameplay actions are accepted.
- Server initializes match state, alive players, revolvers, stats, and first round metadata.

`ROUND_START`:

- No client gameplay actions are accepted.
- Server clears round data, deals cards, chooses target rank, and sets the first turn player.

`TURN`:

- `game:playCards` is allowed only when `mustChallenge` is false.
- `game:challenge` is allowed only when `lastPlay` exists.
- Eliminated players and non-turn players are rejected.

`TURN` with `mustChallenge = true`:

- `game:challenge` is the only legal gameplay action.
- `game:playCards` is rejected with `MUST_CHALLENGE`.

`CHALLENGE_CALLOUT`:

- All gameplay actions are locked.
- Publicly exposes challenger and challenged player only.

`REVEAL`:

- All gameplay actions are locked.
- Publicly exposes the challenged cards.

`VERDICT`:

- All gameplay actions are locked.
- Publicly exposes whether the challenged play was a bluff and who is punished.

`PUNISHMENT_INTRO`:

- All gameplay actions are locked.
- The hit result remains private.

`PUNISHMENT_TRIGGER`:

- All gameplay actions are locked.
- The hit result remains private.

`PUNISHMENT_RESULT`:

- All gameplay actions are locked.
- Publicly exposes hit or dry fire.
- Applies elimination if hit.

`ROUND_END`:

- All gameplay actions are locked.
- Server either starts another round or finishes the match.

`GAME_OVER`:

- Only the host may restart.

## Transition Durations

Default server phase durations:

- `MATCH_START`: implementation-defined, short.
- `ROUND_START`: 2700 ms.
- `CHALLENGE_CALLOUT`: 1800 ms.
- `REVEAL`: `500 + revealedCardCount * 750 + 1000` ms. The final 1000 ms hold ensures every revealed card is visible before `VERDICT`.
- `VERDICT`: 1300 ms.
- `PUNISHMENT_INTRO`: 900 ms.
- `PUNISHMENT_TRIGGER`: 550 ms.
- `PUNISHMENT_RESULT`: 1100 ms for dry fire, 1500 ms for hit.
- `ROUND_END`: 900 ms.
- `GAME_OVER`: persistent until restart.

Normal card-play animation is client-side and should last about 250 to 350 ms. The server may advance the turn immediately after accepting a legal play.

## Scheduler

`turnTimers` must be replaced or wrapped by a unified `GameScheduler`.

The scheduler is responsible for:

- Turn timeout.
- Challenge callout timeout.
- Reveal timeout.
- Verdict timeout.
- Punishment phase timeouts.
- Round-end transition.

Each room may have at most one authoritative phase timer.

On every phase transition:

1. Clear the previous timer.
2. Increment `phaseSequence`.
3. Set `phaseStartedAt`.
4. Set `phaseEndsAt`.
5. Broadcast a snapshot.
6. Schedule the next automatic transition when required.

Old timers must not be able to advance a newer phase.

## Illegal Action Errors

The state machine should reject invalid requests with stable error codes, including:

- `PHASE_LOCKED`
- `PLAYER_ELIMINATED`
- `NOT_YOUR_TURN`
- `MUST_CHALLENGE`
- `NO_PLAY_TO_CHALLENGE`
- `INVALID_CARD_SELECTION`
- `FEATURE_DISABLED`
- `DUPLICATE_REQUEST`

