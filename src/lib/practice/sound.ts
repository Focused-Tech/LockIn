"use client";

/**
 * PRACTICE SFX manager. Plays short one-shots from /public/sounds/<name>.mp3.
 *
 * PLACEHOLDER-SAFE: until real files are dropped into public/sounds/, play() is a
 * silent no-op (missing-file / autoplay rejection is swallowed). Muteable via a
 * toggle (default ON) and, on mobile, the device ring/silent switch. Each SFX
 * also DUCKS the background music briefly.
 */
import { PRACTICE_CONFIG } from "./config";
import { duckMusic } from "./music";

export type SoundName =
  | "tick" // leg selected (tactile)
  | "add" // leg added (pitch ascends with combo length)
  | "locking" // "locking soon" quickening tick
  | "seal" // a single leg snaps/seals shut during the lock-in flourish
  | "lockin" // the whole slate seals — the decisive commit moment
  | "reveal" // settlement: a leg lands (pitch rises leg by leg — anticipation)
  | "stamp" // "SO CLOSE" / impact slam
  | "win"
  | "nearmiss"
  | "loss"
  | "tierup"
  | "coin"; // coin count-up tick

const SFX_KEY = "lockin.practice.sfxOff";

export function isSfxOn(): boolean {
  if (typeof window === "undefined") return PRACTICE_CONFIG.audio.sfxDefaultOn;
  try {
    const v = localStorage.getItem(SFX_KEY);
    return v == null ? PRACTICE_CONFIG.audio.sfxDefaultOn : v !== "1";
  } catch {
    return PRACTICE_CONFIG.audio.sfxDefaultOn;
  }
}

export function setSfxOn(on: boolean): void {
  try {
    localStorage.setItem(SFX_KEY, on ? "0" : "1");
  } catch {
    /* ignore */
  }
}

const cache: Partial<Record<SoundName, HTMLAudioElement>> = {};

/** Play a one-shot SFX (if on). `rate` shifts pitch+speed (used by leg-add). */
export function playSound(
  name: SoundName,
  opts: { rate?: number; volume?: number } = {},
): void {
  if (typeof window === "undefined" || !isSfxOn()) return;
  try {
    let audio = cache[name];
    if (!audio) {
      audio = new Audio(`/sounds/${name}.mp3`);
      audio.preload = "auto";
      cache[name] = audio;
    }
    audio.playbackRate = opts.rate ?? 1;
    audio.volume = opts.volume ?? PRACTICE_CONFIG.audio.sfxVolume;
    audio.currentTime = 0;
    duckMusic(); // SFX duck the music
    void audio.play().catch(() => {});
  } catch {
    /* never let audio break the game loop */
  }
}

/**
 * "Leg added" with ascending pitch — combo momentum. `count` is how many legs
 * are now in the build (1 = first/low pitch, climbing each added leg).
 */
export function playLegAdded(count: number): void {
  const step = PRACTICE_CONFIG.audio.legAddPitchStep;
  playSound("add", { rate: 1 + Math.max(0, count - 1) * step });
}

/**
 * Settlement "leg lands" tick — the rising hook. Pitch climbs with each leg
 * revealed (`step` = 0-based position in the reveal order) so the slate resolves
 * with mounting tension and the deciding leg lands at the top of the climb.
 */
export function playReveal(step: number): void {
  const pitch = PRACTICE_CONFIG.audio.revealPitchStep;
  playSound("reveal", { rate: 1 + Math.max(0, step) * pitch });
}
