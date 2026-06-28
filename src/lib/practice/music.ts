"use client";

/**
 * PRACTICE background music — a single seamless loop, separate ON/OFF from SFX.
 * PLACEHOLDER-SAFE (no /music/<track>.mp3 yet → no-op). Ducks under SFX, respects
 * device silent mode (HTML5 Audio), and STOPS on app background / leaving practice.
 */
import { PRACTICE_CONFIG } from "./config";

export type MusicTrack = "solo" | "multiplayer";

const MUSIC_KEY = "lockin.practice.musicOn";
let audio: HTMLAudioElement | null = null;
let track: MusicTrack | null = null;
let duckTimer: ReturnType<typeof setTimeout> | null = null;

export function isMusicOn(): boolean {
  if (typeof window === "undefined") return PRACTICE_CONFIG.audio.musicDefaultOn;
  try {
    const v = localStorage.getItem(MUSIC_KEY);
    return v == null ? PRACTICE_CONFIG.audio.musicDefaultOn : v === "1";
  } catch {
    return PRACTICE_CONFIG.audio.musicDefaultOn;
  }
}

export function setMusicOn(on: boolean): void {
  try {
    localStorage.setItem(MUSIC_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (!on) stopMusic();
}

export function startMusic(t: MusicTrack): void {
  if (typeof window === "undefined" || !isMusicOn()) return;
  if (track === t && audio && !audio.paused) return;
  stopMusic();
  try {
    const a = new Audio(`/music/${t}.mp3`);
    a.loop = true;
    a.volume = PRACTICE_CONFIG.audio.musicVolume;
    audio = a;
    track = t;
    void a.play().catch(() => {}); // missing file / autoplay block → stay silent
  } catch {
    /* never break the loop */
  }
}

export function stopMusic(): void {
  try {
    if (audio) {
      audio.pause();
      audio.src = "";
    }
  } catch {
    /* ignore */
  }
  audio = null;
  track = null;
  if (duckTimer) {
    clearTimeout(duckTimer);
    duckTimer = null;
  }
}

/** Briefly lower the music under a playing SFX, then restore. */
export function duckMusic(): void {
  if (!audio) return;
  try {
    audio.volume = PRACTICE_CONFIG.audio.duckVolume;
    if (duckTimer) clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      if (audio) audio.volume = PRACTICE_CONFIG.audio.musicVolume;
    }, PRACTICE_CONFIG.audio.duckMs);
  } catch {
    /* ignore */
  }
}
