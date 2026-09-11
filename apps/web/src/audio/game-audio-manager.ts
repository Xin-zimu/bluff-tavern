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

function noise(duration = 0.14, gainValue = 0.04): void {
  const audio = getContext();
  if (!audio) return;
  const buffer = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * duration)), audio.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(gainValue, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  source.connect(gain).connect(audio.destination);
  source.start();
}

const phaseSound: Partial<Record<GamePhase, (snapshot: GameView) => void>> = {
  ROUND_START: () => {
    tone(330, 0.12, 0.035, 'triangle');
    setTimeout(() => tone(495, 0.16, 0.035, 'triangle'), 120);
  },
  CHALLENGE_CALLOUT: () => {
    noise(0.09, 0.06);
    tone(95, 0.26, 0.06, 'sawtooth');
  },
  REVEAL: () => {
    tone(560, 0.08, 0.025, 'triangle');
  },
  VERDICT: (snapshot) => {
    tone(snapshot.challenge?.wasBluff ? 130 : 620, 0.28, 0.045, snapshot.challenge?.wasBluff ? 'sawtooth' : 'triangle');
  },
  PUNISHMENT_INTRO: () => {
    tone(180, 0.22, 0.035, 'sawtooth');
    setTimeout(() => tone(150, 0.22, 0.03, 'sawtooth'), 150);
  },
  PUNISHMENT_TRIGGER: () => {
    tone(72, 0.35, 0.04, 'square');
  },
  PUNISHMENT_RESULT: (snapshot) => {
    if (snapshot.punishment?.hit) {
      noise(0.18, 0.08);
      tone(62, 0.32, 0.07, 'sawtooth');
    } else {
      tone(260, 0.08, 0.035, 'square');
      setTimeout(() => tone(410, 0.12, 0.025, 'triangle'), 160);
    }
  },
  GAME_OVER: () => {
    tone(392, 0.16, 0.035, 'triangle');
    setTimeout(() => tone(494, 0.18, 0.035, 'triangle'), 160);
    setTimeout(() => tone(659, 0.24, 0.035, 'triangle'), 340);
  },
};

export function playGamePhaseSound(snapshot: GameView): void {
  phaseSound[snapshot.phase]?.(snapshot);
}
