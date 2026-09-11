# Bluff Tavern V6 Animation

V6 animations are driven by authoritative server phases and timing. The frontend renders the current phase, but the server never waits for browser animation callbacks.

## Frontend Structure

Recommended screen structure:

```text
GameScreen
  GameHUD
  GameTable
  PlayerSeats
  PlayerHand
  ActionBar
  CinematicLayer
    RoundIntro
    ChallengeCallout
    CardReveal
    Verdict
    RevolverIntro
    TriggerSequence
    PunishmentResult
    EliminationOverlay
    VictorySequence
```

Gameplay logic must stay outside cinematic components. Cinematic components consume snapshots and timing data.

## Timing Source

Every animation phase uses:

```ts
serverNow
phaseStartedAt
phaseEndsAt
phaseSequence
```

The client calculates elapsed phase time:

```ts
elapsed = localSyncedServerNow - phaseStartedAt;
```

Late packets, page refresh, or reconnect should resume at the current point in the phase rather than replaying from 0 ms.

## Round Start

Phase:

```text
ROUND_START
```

Duration:

```text
1200 ms
```

Sequence:

- 0 ms: show round number.
- 300 ms: show target rank.
- 500 ms: show shuffle motion.
- 700 to 1150 ms: deal 5 cards rapidly into each alive player's hand.
- 1200 ms: enter `TURN`.

## Normal Card Play

Duration:

```text
250 to 350 ms
```

This is mostly a client-side transition after the server accepts a legal play. It should not block the whole game longer than needed.

Sequence:

- Selected cards move from hand toward the table center.
- Cards become face down.
- Table shows the public last-play claim.

## Challenge Callout

Phase:

```text
CHALLENGE_CALLOUT
```

Duration:

```text
650 ms
```

Visuals:

- Dim the table background.
- Emphasize challenger.
- Highlight challenged player.
- Add a short table shake.
- Show a large challenge callout.

Audio:

- Table hit.
- Low impact.

## Card Reveal

Phase:

```text
REVEAL
```

Duration:

```text
400 + revealedCardCount * 350 ms
```

Three cards should take about 1450 ms.

Visuals:

- Start from card backs.
- Flip cards one by one.
- Use CSS `perspective` and `rotateY`.

Three.js is not needed for this interaction.

## Verdict

Phase:

```text
VERDICT
```

Duration:

```text
850 ms
```

Bluff verdict:

- False cards receive red emphasis.
- Cards shake briefly.
- Center text communicates the bluff result.
- Punished player is shown.

Failed challenge verdict:

- All revealed cards receive normal or gold emphasis.
- Center text communicates failed challenge.
- Punished player is shown.

## Revolver Intro

Phase:

```text
PUNISHMENT_INTRO
```

Duration:

```text
900 ms
```

Visuals:

- Focus punished player.
- Change character expression from idle to nervous.
- Bring revolver into view.
- Spin cylinder.

Audio:

- Metal spin.

The server may already know the outcome internally, but the client must not receive `hit` yet.

## Trigger Sequence

Phase:

```text
PUNISHMENT_TRIGGER
```

Duration:

```text
550 ms
```

Visuals:

- Revolver stops.
- Character remains tense.
- Hold still for about 200 to 300 ms.
- Trigger motion plays.

This phase is the suspense beat and should not be rushed.

## Punishment Result

Phase:

```text
PUNISHMENT_RESULT
```

Dry fire duration:

```text
1100 ms
```

Dry fire visuals:

- Dry click.
- Small revolver recoil.
- Character changes from nervous to relieved or laugh.
- Display dry-fire result.

Hit duration:

```text
1500 ms
```

Hit visuals:

- Gunshot sound.
- Short white flash.
- Table shake.
- Character changes to eliminated expression.
- Seat darkens.
- Display elimination.

No gore or bloody content.

## Round End

Phase:

```text
ROUND_END
```

Duration:

```text
700 ms
```

Visuals:

- Old cards retract or fade out.
- Discard area clears.
- If more than one player remains, transition into the next `ROUND_START`.
- If only one player remains, transition into `GAME_OVER`.

## Victory

Phase:

```text
GAME_OVER
```

Duration:

```text
2 to 3 seconds for primary victory reveal
```

Visuals:

- Dim eliminated seats.
- Enlarge winner.
- Show victory expression.
- Add restrained particles.
- Show winner name.

Post-match stats:

- Player count.
- Match duration.
- Challenge count.
- Successful challenge count.
- Elimination order.

## Reduced Motion

When `prefers-reduced-motion` is enabled:

- Use static phase views.
- Keep server phase timing.
- Do not skip phases.
- Reveal cards immediately within `REVEAL`.
- Avoid shake, flash intensity, blur, and large movement.

## Low Performance Mode

Low performance mode may reduce:

- Particles.
- Blur.
- Shadow complexity.
- Background motion.

It must not remove the key feedback phases:

- Challenge.
- Reveal.
- Verdict.
- Trigger.
- Result.

## Audio

Create a dedicated game audio manager:

```text
audio/GameAudioManager
```

It should preload and trigger:

- `card_play`
- `card_flip`
- `challenge_hit`
- `verdict_lie`
- `verdict_truth`
- `revolver_spin`
- `trigger`
- `dry_fire`
- `gunshot`
- `elimination`
- `round_start`
- `victory`

Existing simple button tones may remain separate. Core cinematic feedback should not rely only on generated tones.

