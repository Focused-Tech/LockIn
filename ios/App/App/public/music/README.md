# LockIn audio asset spec sheet — BACKGROUND MUSIC

Drop the looping tracks here; they wire up automatically (the music manager loads
`/music/<track>.mp3` — until a file exists, it's a silent no-op). **No code
change needed.**

Folder: `public/music/`  ·  Format: **MP3** (or OGG if you update the loader).

| Filename          | Used on                          | Feel                                   | Suggested length |
|-------------------|----------------------------------|----------------------------------------|------------------|
| `solo.mp3`        | practice home / hosting          | calmer, focused, unobtrusive loop      | 30–90 s, **seamless loop** |
| `multiplayer.mp3` | a practice contest (vs friends)  | driving, higher-energy loop            | 30–90 s, **seamless loop** |

You can ship **one** first (e.g. `solo.mp3`); the second slot is already wired.

Behavior already built:
- Plays as a **seamless loop** (`audio.loop`); ensure the file loops with no gap
  (trim to a clean zero-crossing).
- **Separate ON/OFF** from SFX (the "Music" toggle; **default OFF** — set in
  `practice/config.ts → audio.musicDefaultOn`).
- **Ducks** under SFX, respects the device ring/silent switch, and **stops** on
  app background (tab hidden) and when leaving practice.
- Autoplay policies: the loop starts on the first user tap in practice.
- Volume + duck levels are config values (`audio.musicVolume`, `duckVolume`,
  `duckMs`).
