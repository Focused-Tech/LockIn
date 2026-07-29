# Fox Pit Batch — Session Changelog

_Generated 2026-07-17. Hand this to Claude to fold into the running ledger._

## Snapshot
- **Branch:** `feat/foxpit-batch` (branched off `feat/foxpit-flow` @ `5de64fe`)
- **Commits this session:** 20 (all listed below)
- **Net diff:** 16 files, +996 / −234 (excludes `.bak` working files)
- **Live prod deploy (OTA on device):** `dpl_CrBibM7i7DymbBRyG1gaVbboL5jf` via `lockin-three-zeta.vercel.app`
- **Android:** `versionCode 8` / `versionName 1.4.0`
- **Every change was OTA-deployed and verified on the Z Flip 6 via ADB.**

## Safety / rollback
- Pre-batch backup tag: `backup/pre-foxpit-batch-20260717` @ `5de64fe`
- Pre-batch backup branch: `backup/pre-foxpit-batch` @ `5de64fe`
- Per-file `*.pre-batch.bak` copies exist on disk (git-ignored) for every edited file.
- `release/v1` @ `868b627` and `master` @ `2c80de9` are untouched.

## ⚠️ Temporary architect overrides — REMOVE / gate before launch
- `src/lib/foxpit.ts` → `FOXPIT_UNLOCK_ALL = true` — unlocks every room door for all accounts.
- `src/lib/foxpit.ts` → `ARCHITECT_CLEARED = ["dojo","coliseum","hightable"]` — treats the account as having cleared all rooms except Boss Fox's Suite (so the journey plays out: 3 keys won, elevator unlocked, only the final boss left).
- Both must be gated to real progression / a role check before real users.

## Known placeholders (not bugs)
- Membership-card avatar falls back to `/arena/fox-crest.png` when `profile.avatarUrl` is null (real avatar shows when set). Username is live from the profile.
- Locksmith (AI) launcher uses the Boss Fox head as a placeholder avatar.
- The boss faceoff is still the "GAME BEGINS" placeholder — real gameplay drops in there later.
- Beating a regular table is a mock win (no real game yet); it just marks the table ✓.

## What shipped (grouped)

### Routing & entry
- Fox Pit is the **single practice entry** (removed the standalone "Practice arena" card from the journey hub).
- Sequence: Landing → Fox Pit → **welcome gate** ("Will you follow in the footsteps that made Boss Fox the boss he is today?") → **lobby**.
- Lone Fox door → the existing **"Choose your arena"** screen (subtitle removed; card art fills the space).
- Boss Journey door → the tower map.

### Lobby
- Big banner cards replaced with **palm mini-door tokens** in Boss Fox's hands (orange Lone Fox / brass Boss Journey), **ball-bounce off the palms**, labels below the hands, biased to center so long names don't clip.
- Reused notice card ("Become the next Boss") + corridor push-in.

### Tower map
- Slim **floor plaques** (room art shows through), each seated **just below its room seam**, **nudged right off the elevator shaft**, header fades after 4s.
- **Pinch-to-zoom + pan.**
- **Elevator** = full split-door element labeled "ELEVATOR", rendered **beneath** the labels; locked popup (uses the LockIn padlock) until the High Table is cleared; once unlocked opens the **floor-select** (4 room cards, cleared/locked, tiered keys-won row).
- **The Lobby** landmark + **Practice Here ↓** (membership-card icon) affixed to the lobby floor — both **scroll with the tower** (walks down to the Dojo for free practice).
- All rooms unlocked for the architect; cleared rooms show ✓ + won-key badge.

### Rooms
- **Boss-table rule:** multi-table rooms (Wolf/Coliseum, Raven/High Table) lock the boss on the throne ("BEAT ALL N TABLES" + padlock) until every table is beaten (each turns ✓), then "CHALLENGE {boss} ›"; single-table rooms (Owl/Dojo, Fox/Suite) seat you straight at the boss ("SIT · {boss}").
- Slow, cinematic **boss-door open** that lingers on the standing boss (matches the glass-door timing); boss appears at the door AND seated at the faceoff.
- Prize key = tiered key asset (bronze/silver/gold/platinum), **centered in front of the throne, above its label**.
- Table hotspots tilted flat onto the felt.
- **Membership keycard** in the Dojo table panel embeds the member's **avatar + username**; panel clears the phone nav bar (responsive `env(safe-area-inset-bottom)`).
- Back buttons shrunk + shifted left so they clear the centered header.

### Assets wired
- Neon fox emblem on the room door + the glass-door "Boss Fox" intro (replaced the crest); shrunk for padding.
- Tiered keys (owl-bronze, wolf-silver, raven-gold, bossfox-platinum) for room prize keys + elevator keys-won.
- `membership-card.png` as the free-entry keycard + member card.

### App-wide
- **Lock emojis (🔒) → the LockIn padlock glyph** everywhere (elevator popup, map, Beginner "locked in", parlay legs, PWA prompt).
- AI (Locksmith) + parlay launchers hidden on the Fox Pit landing/journey, arena picker, and Creator — they show only in Beginner/Advanced.
- **Boot splash** lock raised so the fox's fingertips show under the lock base.

## Full commit list (oldest → newest)
| # | Hash | Summary |
|---|------|---------|
| 1 | `f89bb62` | P1-2: single practice entry; lobby welcome gate + palm-door tokens + corridor push-in |
| 2 | `9c1ae4b` | P3-4: tower map pinch-zoom + pan, slim plaques, 4s header fade, elevator floor-select |
| 3 | `d384613` | P5+P7: prize key off throne + tilted tables; wire tiered keys, door emblem, membership keycard |
| 4 | `142552b` | P6: drop practice-arena subtitle so card art fills the space |
| 5 | `b6c1024` | bump versionCode 8 / versionName 1.4.0; ignore batch .bak files |
| 6 | `9e5217a` | device-test fixes: palm tokens over hands; tables onto felt; prize key in front of throne; wider plaques |
| 7 | `02a0e96` | polish: palm tokens float above palms + smaller labels; prize-key label padding |
| 8 | `b19d869` | bias palm-token labels toward center so long names don't clip |
| 9 | `6a9e1de` | lobby doors ball-bounce off palms; glass-door crest → emblem-fox-neon |
| 10 | `c9fb70e` | center prize key over its label (animation was overriding centering) |
| 11 | `df6cff3` | drop palm labels below hands; prize key closer to label; shrink glass emblem |
| 12 | `2335fa6` | Locksmith uses Boss Fox head; hide AI + parlay launchers on the arena picker |
| 13 | `35a0729` | architect unlock-all; elevator locked popup; slow room door; back buttons off header; hide launchers outside Beginner/Advanced |
| 14 | `67a585c` | LockGlyph replaces lock emojis; elevator split-door; membership card avatar+name; nav-safe panel; free-practice icon |
| 15 | `4dc3348` | boss-table rule (multi vs single); membership avatar from profile.avatarUrl |
| 16 | `a3194ab` | architect clears all but Boss Fox; elevator beneath labels; Practice Here padlock; cleared rooms skip grind |
| 17 | `849aed2` | move Lobby landmark right (collision fix — later reverted) |
| 18 | `08313d4` | raise Lobby + Dojo labels; revert Practice icon to membership card |
| 19 | `9ab0eef` | labels just below room seams + nudged right off elevator; Lobby lowered; splash lock raised |
| 20 | `a641d08` | affix Practice Here to the lobby floor so it scrolls with the tower |

## Files changed
```
.gitignore                                          |   4 +
android/app/build.gradle                            |   4 +-
src/app/app/beginner/BeginnerJourney.tsx            |   5 +-
src/app/app/choose/JourneyPicker.tsx                |  18 -
src/app/app/foxpit/Lobby.tsx                        | 217 +++++--
src/app/app/foxpit/map/Map.tsx                      | 569 +++++++++++++---
src/app/app/foxpit/room/[room]/Room.tsx             | 290 ++++++---
src/app/app/foxpit/room/[room]/page.tsx             |   8 +-
src/app/app/practice/arena/chooser/ArenaChooser.tsx |   3 -
src/app/app/practice/arena/chooser/ArenaIntro.tsx   |  12 +-
src/components/ChatAssistant.tsx                    |  23 +-
src/components/cross-parlay/CrossParlayBuilder.tsx  |  12 +-
src/components/practice/LegPicker.tsx               |   4 +-
src/components/pwa/PwaSetup.tsx                     |   5 +-
src/components/splash/BootSplash.tsx                |   3 +-
src/lib/foxpit.ts                                   |  53 +-
```

## New assets added (public/foxpit/)
`key-owl-bronze.png`, `key-wolf-silver.png`, `key-raven-gold.png`, `key-bossfox-platinum.png`, `emblem-fox-neon.png`, `membership-card.png`

## Not yet done / next
- Merge `feat/foxpit-batch` when ready (currently only OTA-deployed, not merged to `master`).
- Real gameplay in the boss faceoff.
- Real avatar-select feeding the membership card + Locksmith.
- Gate/remove the two architect overrides before launch.
