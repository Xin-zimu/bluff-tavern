import type { GamePhase, GameView } from '@bluff-tavern/shared';

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(frequency: number, duration = 0.16, gainValue = 0.045, type: OscillatorType = 'sine'): void {
  const audio = getContext();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  gain.gain.setValueAtTime(gainValue, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function noise(duration = 0.14, gainValue = 0.04, filterFrequency?: number): void {
  const audio = getContext();
  if (!audio) return;
  const buffer = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * duration)), audio.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    const progress = index / channel.length;
    channel[index] = (Math.random() * 2 - 1) * (1 - progress) ** 1.8;
  }
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrequency ?? 2_600, audio.currentTime);
  source.buffer = buffer;
  gain.gain.setValueAtTime(gainValue, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start();
}

function cardFlip(): void {
  tone(720, 0.035, 0.018, 'triangle');
  setTimeout(() => tone(420, 0.055, 0.016, 'triangle'), 42);
  setTimeout(() => noise(0.035, 0.012, 4_200), 64);
}

function cylinderRattle(): void {
  [0, 72, 144, 216].forEach((delay, index) => {
    setTimeout(() => {
      tone(190 - index * 16, 0.055, 0.022, 'square');
      noise(0.025, 0.014, 3_400);
    }, delay);
  });
}

function triggerClick(): void {
  tone(76, 0.12, 0.025, 'square');
  setTimeout(() => tone(310, 0.035, 0.028, 'square'), 130);
}

function dryFire(): void {
  tone(260, 0.035, 0.038, 'square');
  setTimeout(() => tone(410, 0.055, 0.024, 'triangle'), 92);
}

function gunshot(): void {
  noise(0.28, 0.095, 1_450);
  tone(58, 0.38, 0.075, 'sawtooth');
  setTimeout(() => noise(0.2, 0.045, 650), 80);
  setTimeout(() => tone(118, 0.2, 0.032, 'sawtooth'), 95);
}

const phaseSound: Partial<Record<GamePhase, (snapshot: GameView) => void>> = {
  ROUND_START: () => {
    tone(330, 0.12, 0.035, 'triangle');
    setTimeout(() => tone(495, 0.16, 0.035, 'triangle'), 120);
  },
  CHALLENGE_CALLOUT: () => {
    noise(0.09, 0.06, 2_100);
    tone(95, 0.26, 0.06, 'sawtooth');
  },
  REVEAL: () => {
    cardFlip();
    setTimeout(cardFlip, 220);
    setTimeout(cardFlip, 440);
  },
  VERDICT: (snapshot) => {
    tone(snapshot.challenge?.wasBluff ? 130 : 620, 0.28, 0.045, snapshot.challenge?.wasBluff ? 'sawtooth' : 'triangle');
    if (snapshot.challenge?.wasBluff) setTimeout(() => noise(0.08, 0.035, 1_900), 80);
  },
  PUNISHMENT_INTRO: () => {
    cylinderRattle();
  },
  PUNISHMENT_TRIGGER: () => {
    triggerClick();
  },
  PUNISHMENT_RESULT: (snapshot) => {
    if (snapshot.punishment?.hit) {
      gunshot();
    } else {
      dryFire();
    }
  },
  GAME_OVER: () => {
    tone(392, 0.16, 0.035, 'triangle');
    setTimeout(() => tone(494, 0.18, 0.035, 'triangle'), 160);
    setTimeout(() => tone(659, 0.24, 0.035, 'triangle'), 340);
    setTimeout(() => noise(0.22, 0.025, 3_200), 420);
  },
};

export function playGamePhaseSound(snapshot: GameView, muted = false): void {
  if (muted) return;
  phaseSound[snapshot.phase]?.(snapshot);
}
