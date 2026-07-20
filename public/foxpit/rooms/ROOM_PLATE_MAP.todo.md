# Fox Pit room plates — usage model (per Frank, 2026-07-20)

These plates came from `05_ballroom_plates_FINAL/` and SUPERSEDE every older room plate.
Table-free backdrops (table + avatar are separate cutouts composited on top).

## Plates are an INTERCHANGEABLE POOL — not one-plate-per-room
- `coliseum_or_raven_22..26.png` are a **rotating pool of arena backdrops**. Alternate
  them across ROUNDS — do NOT pin one plate to one room.
- **Played once (fixed boss encounter):** Boss **Raven** (High Table) and Alpha **Wolf**
  (Coliseum). Everything else is interchangeable and cycles.
- `plate_dojo.png` / `plate_fox_den.png` are the named Dojo / Fox's Den plates
  (still only 611×611 — placeholders vs the 1264 arena plates; flag if you want them wide).

Implementation note: a round should pick the next plate from the pool (round-robin /
shuffle-without-repeat), reusing the same backdrop set — so a room shown twice can look
different across rounds.

## Opponent win-rate bounds (interchangeable opponents)
Win rates VARY per opponent but are clamped:
- **Upper bound:** never higher than **Grim** (2nd boss) or **Nyx** (3rd ranked).
- **Lower bound:** never lower than **5% of the Owl's** ranking win %.
(Owl = 1st boss / Dojo is the floor of the scale.)

Wire these when the brain/strength indicator (3c) + opponent config land.
