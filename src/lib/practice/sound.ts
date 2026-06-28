"use client";

/**
 * PRACTICE MODE sound manager. Plays short SFX from /public/sounds/<name>.mp3.
 *
 * PLACEHOLDER-SAFE: until the real audio files are dropped into public/sounds/,
 * play() simply no-ops (the missing-file load / autoplay rejection is swallowed)
 * — so the system is fully wired now and "lights up" the moment files exist.
 *
 * Muteable: a single toggle persisted in localStorage (default ON). On mobile,
 * HTML5 Audio also respects the device ring/silent switch automatically.
 */

export type SoundName = "win" | "nearmiss" | "tierup" | "coin" | "loss";

const MUTE_KEY = "lockin.practice.soundOff";

export function isSoundOn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(MUTE_KEY) !== "1"; // default ON
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, on ? "0" : "1");
  } catch {
    /* storage blocked — ignore */
  }
}

const cache: Partial<Record<SoundName, HTMLAudioElement>> = {};

/** Play a one-shot SFX if sound is on. Safe no-op when the file is absent. */
export function playSound(name: SoundName, volume = 0.6): void {
  if (typeof window === "undefined" || !isSoundOn()) return;
  try {
    let audio = cache[name];
    if (!audio) {
      audio = new Audio(`/sounds/${name}.mp3`);
      audio.preload = "auto";
      cache[name] = audio;
    }
    audio.volume = volume;
    audio.currentTime = 0;
    // Missing file, codec, or autoplay policy → rejected promise → stay silent.
    void audio.play().catch(() => {});
  } catch {
    /* never let audio break the game loop */
  }
}
