# Bluff Tavern V6 Game Rules

V6 rebuilds the core game loop around explicit match, round, and turn rules. The first V6 release is scoped to the Classic and Quick modes only. Party, Custom, random events, and items are disabled until the base loop is proven stable.

## Goals

V6 must complete the full gameplay loop:

- Deal cards.
- Play cards.
- Challenge the previous play.
- Reveal cards.
- Resolve truth or bluff.
- Resolve revolver punishment.
- Eliminate players.
- Start the next round.
- End with a single winner.

The server is authoritative for all gameplay decisions. The client never decides whether a play is true, who is punished, whether the revolver hits, who is eliminated, or who wins.

## Modes

Classic:

- Players: 2 to 8.
- Cards per alive player per round: 5.
- Turn timeout: 15 seconds.
- Revolver: one independent 6-chamber revolver per player, with one bullet.
- Joker: wild card.

Quick:

- Same rules as Classic.
- Turn timeout: 7 seconds.

## Core Concepts

Match:

- Starts when the host starts the game.
- Ends when only one player remains alive.
- A match contains one or more rounds.

Round:

- Starts by dealing 5 cards to every alive player.
- Continues through one or more turns.
- Ends after a challenge, reveal, verdict, and punishment sequence.

Turn:

- One alive player may either play 1 to 3 cards or challenge the previous play.
- The first turn of a round cannot challenge because there is no previous play.

These names must be used consistently in code, logs, protocol fields, tests, and UI labels.

## Cards

The deck uses:

- `A`
- `K`
- `Q`
- `Joker`

At the start of each round, the server randomly chooses one target rank from:

- `A`
- `K`
- `Q`

A card is true when it is either the target rank or `Joker`. A multi-card play is false if at least one played card is neither the target rank nor `Joker`.

Example with target rank `K`:

- `K`: true.
- `Joker`: true.
- `A`: false.
- `Q`: false.
- `K K Q`: false.

## Dealing

Every alive player receives exactly 5 cards at the start of every round.

Eliminated players receive 0 cards and their hand is always empty.

The deck only needs enough cards for:

```text
alive player count * 5
```

Cards must not be distributed by dividing a fixed deck size across alive players. Two alive players must still receive 5 cards each, not 10.

## Playing Cards

On a normal turn, the current alive player may play 1 to 3 cards face down.

The server stores the exact cards internally:

```ts
interface InternalPlay {
  playerId: string;
  cards: CardRank[];
  count: number;
}
```

Publicly, other clients only know:

```text
Player X claimed N target-rank cards.
```

The server must validate:

- The player is alive.
- The player is the current turn player.
- The phase is `TURN`.
- `mustChallenge` is false.
- The selected card indexes are valid.
- The card count is between 1 and 3.
- The `requestId` has not already been applied.

## Challenge

After any play, the next alive player may challenge the previous play.

If a challenged play contains any false card, the player who made the play is punished. If all revealed cards are true or `Joker`, the challenger is punished.

Once a challenge is accepted:

- Normal card play is locked.
- The round enters the cinematic state sequence.
- The next round starts only after punishment and round-end resolution.

## Forced Challenge

If a player plays their final card and their hand becomes empty, the next alive player cannot continue normal play. The game enters a `TURN` state with:

```ts
mustChallenge: true
```

While `mustChallenge` is true:

- Only `game:challenge` is legal.
- `game:playCards` must be rejected with `MUST_CHALLENGE`.
- If the current player times out, the server automatically challenges.

This prevents deadlocks where all players run out of cards.

## Round Starter

After punishment:

- If the punished player is still alive, that player starts the next round.
- If the punished player was eliminated, the next alive player in clockwise player order starts the next round.

The starter is deterministic, never random.

## Elimination

When a player is hit by their revolver:

- `alive` becomes false.
- Their hand is immediately cleared.
- They cannot play cards.
- They cannot challenge.
- They cannot receive a turn.
- They cannot use game actions.

Eliminated players remain in the room as spectators. They may still watch, reconnect, see animations, and use non-gameplay social features if those features exist.

Room membership and online state belong to `RoomStore`. Gameplay life/death state belongs to `GameEngine`. V6 must not maintain conflicting alive/dead state in both modules.

## Revolver

Each player owns an independent revolver:

```ts
interface RevolverState {
  chamberCount: 6;
  bulletPosition: number;
  currentChamber: number;
  shotsTaken: number;
}
```

The bullet position is generated once per player at match start. Each punishment advances that player's own revolver only.

With one bullet in six chambers, the natural no-replacement probabilities are:

- First shot: 1/6.
- Second shot, if still alive: 1/5.
- Third shot, if still alive: 1/4.
- Fourth shot, if still alive: 1/3.
- Fifth shot, if still alive: 1/2.
- Sixth shot, if still alive: 1.

Do not add a separate fake progressive probability model.

## Match End

After every elimination, the server checks:

```ts
alivePlayers.length
```

If more than one player is alive, the game proceeds to the next round. If exactly one player is alive, the game enters `GAME_OVER` and sets `winnerId`.

## Timeout Rules

All turn timing is server-authoritative.

On normal `TURN` timeout:

- The server automatically plays one random legal card for the current player.

On forced-challenge `TURN` timeout:

- The server automatically challenges the previous play.

Disconnected alive players remain alive and are handled by the same timeout rules.

## Disabled Features

For V6.0, item usage is disabled. `game:useItem` should either be removed from the active protocol or return `FEATURE_DISABLED`.

