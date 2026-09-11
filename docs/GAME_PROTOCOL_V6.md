# Bluff Tavern V6 Protocol

The V6 protocol keeps client commands small and makes `game:snapshot` sufficient to recover the whole gameplay view after delay, refresh, or reconnect.

## Principles

- The server is authoritative.
- Clients send intents, not resolved outcomes.
- Snapshots are authoritative.
- Cues are non-authoritative presentation hints.
- Public state and private player state are separated.
- Hidden information is revealed only at the correct phase.
- Every mutating client command includes `requestId`.

## Client Commands

V6 active commands:

- `game:start`
- `game:playCards`
- `game:challenge`
- `game:restart`
- `session:resume`

Disabled or removed for V6.0:

- `game:useItem`

If retained for compatibility, `game:useItem` must return `FEATURE_DISABLED`.

## Idempotency

All mutating requests must include:

```ts
requestId: string;
```

The server caches command results by:

```text
roomCode + playerId + requestId
```

A duplicate request returns the first result and must not apply gameplay effects twice.

This applies to:

- `game:start`
- `game:playCards`
- `game:challenge`
- `game:restart`

## `game:playCards`

Request:

```ts
interface PlayCardsRequest {
  roomCode: string;
  cardIndexes: number[];
  requestId: string;
}
```

Server validation:

- The room exists.
- The match exists.
- The player is in the room.
- The player is alive.
- The phase is `TURN`.
- The player is `turnPlayerId`.
- `mustChallenge` is false.
- `cardIndexes.length` is between 1 and 3.
- All indexes are valid for the player's current hand.
- No duplicate card index appears in the request.
- The request is not a new execution of an already applied `requestId`.

Success effects:

- Remove selected cards from the player's private hand.
- Store `lastPlay` internally.
- Publicly expose only claimed count and player id.
- Set `mustChallenge` if the player has no cards left.
- Advance turn to the next alive player.
- Broadcast `game:snapshot`.
- Optionally emit `game:cue` with `CARD_PLAYED`.

## `game:challenge`

Request:

```ts
interface ChallengeRequest {
  roomCode: string;
  requestId: string;
}
```

Server validation:

- The room exists.
- The match exists.
- The player is in the room.
- The player is alive.
- The phase is `TURN`.
- The player is `turnPlayerId`.
- `lastPlay` exists.
- The request is not a new execution of an already applied `requestId`.

Success effects:

- Internally calculate whether `lastPlay` was a bluff.
- Internally calculate punished player.
- Internally calculate revolver result.
- Enter `CHALLENGE_CALLOUT`.
- Do not publicly expose cards, verdict, or hit result yet.

## `game:snapshot`

`game:snapshot` is the authoritative state payload.

```ts
interface GameSnapshot {
  sequence: number;
  serverNow: number;
  phase: GamePhase;
  phaseStartedAt: number;
  phaseEndsAt: number | null;

  roundNumber: number;
  targetRank: 'A' | 'K' | 'Q' | null;

  turnPlayerId: string | null;
  mustChallenge: boolean;

  players: PublicPlayerState[];
  hand: CardRank[];

  lastPlay: PublicLastPlay | null;
  challenge: PublicChallengeState | null;
  punishment: PublicPunishmentState | null;
  winner: PublicWinnerState | null;
}
```

Public player state:

```ts
interface PublicPlayerState {
  playerId: string;
  name: string;
  seatIndex: number;
  connected: boolean;
  alive: boolean;
  handCount: number;
}
```

Private hand:

- `hand` contains only the receiving player's own cards.
- Other players' cards are never included.

Public last play:

```ts
interface PublicLastPlay {
  playerId: string;
  count: number;
  claimedRank: 'A' | 'K' | 'Q';
}
```

## Reveal Safety

Challenge data is revealed in stages.

`CHALLENGE_CALLOUT` exposes only:

```ts
interface PublicChallengeState {
  challengerId: string;
  challengedId: string;
}
```

`REVEAL` additionally exposes:

```ts
revealedCards: CardRank[];
```

`VERDICT` additionally exposes:

```ts
wasBluff: boolean;
punishedPlayerId: string;
```

`PUNISHMENT_INTRO` and `PUNISHMENT_TRIGGER` still do not expose:

```ts
hit
```

`PUNISHMENT_RESULT` finally exposes:

```ts
interface PublicPunishmentState {
  punishedPlayerId: string;
  hit: boolean;
  eliminatedPlayerId: string | null;
}
```

The server may know the hit result internally earlier, but clients must not receive it before `PUNISHMENT_RESULT`.

## `game:cue`

`game:cue` is a non-authoritative presentation event.

Allowed cue types:

- `ROUND_STARTED`
- `CARD_PLAYED`
- `CHALLENGE_CALLED`
- `PLAYER_ELIMINATED`
- `MATCH_FINISHED`

Cues may drive:

- Sound effects.
- Small particles.
- Toasts.
- Haptic-style visual feedback.

Losing a cue must not break recovery. A snapshot alone must always be enough to render the correct current game state.

## Resume

On `session:resume`, the server sends a fresh `game:snapshot` for the reconnecting player.

If the room is in `REVEAL`, the snapshot includes phase timing and currently public revealed-card data. The client uses server timing to render the animation at the correct progress point.

Reconnect must not send the user back to the lobby while their room and session are still valid.

