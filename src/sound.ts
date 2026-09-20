import type { GameEventKind } from "./game/reducer";
import { DEFAULT_SOUND_THEME, SOUND_THEME_BY_ID } from "./soundThemes";

/**
 * Sound feedback for game events.
 *
 * Each event first looks for an audio file in `public/sounds/` (see the
 * README there for where to get open-licensed ones). If a file isn't
 * present, a short tone is synthesised instead, so the app is audible
 * without shipping any audio assets.
 *
 * Muting is per-device on purpose: the screen by the board should make
 * noise, a phone being used as a second view usually shouldn't.
 */

const MUTE_KEY = "autodarts.muted";

const DEFAULT_THEME = SOUND_THEME_BY_ID[DEFAULT_SOUND_THEME];

type BufferState = AudioBuffer | "missing" | "loading";

class SoundBoard {
  private context: AudioContext | null = null;
  private buffers = new Map<string, BufferState>();
  private muted = readMuted();
  private unlocked = false;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // Private browsing or blocked storage: the setting just won't persist.
    }
    if (!muted) this.unlock();
  }

  /**
   * Browsers won't start audio until the page has been interacted with.
   * Called from the first pointer/key event, by which point the person has
   * clicked through to start a game anyway.
   */
  unlock() {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();
    this.unlocked = true;
  }

  play(kind: GameEventKind, soundThemeId: string = DEFAULT_SOUND_THEME) {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context || !this.unlocked) return;
    const theme = SOUND_THEME_BY_ID[soundThemeId as keyof typeof SOUND_THEME_BY_ID] ?? DEFAULT_THEME;
    const url = theme.files[kind] ?? DEFAULT_THEME.files[kind];
    const key = `${theme.id}:${kind}`;
    const buffer = this.buffers.get(key);
    if (buffer === undefined) {
      this.load(key, url);
      synthesize(context, kind);
      return;
    }
    if (buffer === "loading" || buffer === "missing") {
      synthesize(context, kind);
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = 0.8;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    this.context = new Ctor();
    return this.context;
  }

  private load(key: string, url: string) {
    const context = this.ensureContext();
    if (!context) return;
    this.buffers.set(key, "loading");

    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error("missing"))))
      .then((bytes) => context.decodeAudioData(bytes))
      .then((decoded) => this.buffers.set(key, decoded))
      .catch(() => this.buffers.set(key, "missing"));
  }
}

function readMuted(): boolean {
  try {
    const raw = localStorage.getItem(MUTE_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

/** A short envelope so nothing clicks on start or stop. */
function tone(
  context: AudioContext,
  { type, from, to, duration, gain = 0.2, delay = 0 }: {
    type: OscillatorType;
    from: number;
    to?: number;
    duration: number;
    gain?: number;
    delay?: number;
  },
) {
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const amp = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, start + duration);

  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp).connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Filtered noise burst — the "thud" part of a dart landing. */
function thud(context: AudioContext, duration: number, gain: number) {
  const frames = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;

  const amp = context.createGain();
  amp.gain.value = gain;

  source.connect(filter).connect(amp).connect(context.destination);
  source.start();
}

function synthesize(context: AudioContext, kind: GameEventKind) {
  switch (kind) {
    case "hit":
      thud(context, 0.09, 0.35);
      tone(context, { type: "sine", from: 320, to: 180, duration: 0.09, gain: 0.18 });
      break;
    case "miss":
      thud(context, 0.13, 0.22);
      tone(context, { type: "sine", from: 120, to: 70, duration: 0.14, gain: 0.12 });
      break;
    case "advance":
      tone(context, { type: "triangle", from: 660, duration: 0.08, gain: 0.15 });
      tone(context, { type: "triangle", from: 880, duration: 0.1, gain: 0.15, delay: 0.07 });
      break;
    case "turn":
      tone(context, { type: "sine", from: 440, duration: 0.12, gain: 0.14 });
      tone(context, { type: "sine", from: 587, duration: 0.16, gain: 0.14, delay: 0.1 });
      break;
    case "bust":
      tone(context, { type: "sawtooth", from: 220, to: 70, duration: 0.35, gain: 0.16 });
      break;
    case "win":
      [523, 659, 784, 1047].forEach((freq, i) => {
        tone(context, { type: "triangle", from: freq, duration: 0.22, gain: 0.16, delay: i * 0.1 });
      });
      break;
  }
}

export const sounds = new SoundBoard();

/** Wires up the one-time gesture needed before a browser will play audio. */
export function installAudioUnlock() {
  const unlock = () => sounds.unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
