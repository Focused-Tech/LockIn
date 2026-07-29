# LockIn audio asset spec sheet — SOUND EFFECTS

Drop the files here; they wire up automatically (the SFX manager loads
`/sounds/<name>.mp3` on demand — until a file exists, playback is a silent
no-op). **No code change needed** — just match the filenames below.

Folder: `public/sounds/`  ·  Format: **MP3** (broadest support; AAC/`.m4a` also
fine if you keep the `.mp3` name or update the loader). Keep files small and
**loudness-normalized** to each other.

| Filename        | Plays when…                                            | Feel / type                          | Suggested length |
|-----------------|--------------------------------------------------------|--------------------------------------|------------------|
| `tick.mp3`      | a leg pick is selected / changed                       | short tactile tick                   | 100–150 ms       |
| `add.mp3`       | a NEW leg is added to the build                        | clean "add" blip — **pitch-shifted up per leg** by playbackRate (combo momentum), so source it at a neutral mid pitch | 120–200 ms |
| `locking.mp3`   | "lock in" pressed / locking-soon quickening cue        | tense quick "tick"/"beep"            | 80–150 ms        |
| `win.mp3`       | a winning entry (incl. perfect card)                   | bright satisfying chime/fanfare      | 0.6–1.0 s        |
| `nearmiss.mp3`  | one short of perfect ("2 of 3 — so close")             | tense "ooh, almost" sting            | 0.4–0.7 s        |
| `loss.mp3`      | a flat loss                                            | soft, brief, non-punishing           | 0.3–0.5 s        |
| `tierup.mp3`    | crossing into a higher rank tier                       | celebratory level-up sting           | 1.0–1.4 s        |
| `coin.mp3`      | each step of the coin count-up                         | very short "tick"/"ding"             | 50–120 ms        |

Total: **8 SFX**.

Behavior already built:
- `add.mp3` ascends in pitch each leg via `playbackRate` (config `legAddPitchStep`),
  so provide it at a **neutral mid pitch** with minimal silence at the start.
- `coin.mp3` fires rapidly during the count-up — keep it tiny.
- Every SFX **ducks** the background music briefly, respects the in-app **SFX**
  toggle (default ON) and the device ring/silent switch.
- License royalty-free / properly: freesound.org (CC0), Kenney UI audio (CC0),
  or a paid pack you hold rights to.
