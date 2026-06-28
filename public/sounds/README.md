# Practice-mode sound assets

Drop the audio files here and they wire up automatically (the sound manager loads
`/sounds/<name>.mp3` on demand; until a file exists, playback is a silent no-op).

Required files (filename → when it plays):

| File              | Trigger                                  | Type / feel                         | Length      |
|-------------------|------------------------------------------|-------------------------------------|-------------|
| `win.mp3`         | a winning entry (incl. perfect card)     | bright, satisfying chime/fanfare    | ~0.6–1.0 s  |
| `nearmiss.mp3`    | one short of perfect ("2 of 3 — so close")| tense "ooh, almost" sting           | ~0.4–0.7 s  |
| `loss.mp3`        | a flat loss                              | soft, brief, non-punishing          | ~0.3–0.5 s  |
| `tierup.mp3`      | crossing into a higher rank tier         | celebratory level-up sting          | ~1.0–1.4 s  |
| `coin.mp3`        | each step of the coin count-up           | very short "tick"/"ding"            | ~0.05–0.12 s|

Total: **5 short SFX**. Format: **MP3** (broadest browser support; AAC/`.m4a`
also fine if you rename the loader). Keep them small (a few KB–tens of KB) and
**normalized to a similar loudness**; `coin.mp3` must be very short since it
fires rapidly during the count-up.

Notes
- All playback respects the in-app **Sound** toggle (default ON) and, on mobile,
  the device ring/silent switch.
- License: source royalty-free / properly licensed SFX. Suggested libraries:
  freesound.org (CC0), Kenney UI audio (CC0), or a paid pack you hold rights to.
- No code change needed to add them — just drop the files in this folder.
