# Room → Plate mapping — FRANK TO FILL

These plates came from `05_ballroom_plates_FINAL/` and SUPERSEDE every older room plate.
They are table-free backdrops (table + avatar are separate cutouts composited on top).

The `coliseum_or_raven_22..26` set is **not yet labeled by room**. Neither the prior
session nor this one could visually confirm which plate is which room, so nothing is
asserted here. Fill the right-hand column, then I'll wire each into `src/lib/foxpit.ts`
(the `roomImg` fields) and rename the files to match.

| file                      | dimensions  | orientation | → ROOM (fill in) |
|---------------------------|-------------|-------------|------------------|
| coliseum_or_raven_22.png  | 1264×1264   | square      |                  |
| coliseum_or_raven_23.png  | 1264×1264   | square      |                  |
| coliseum_or_raven_24.png  | 1264×1264   | square      |                  |
| coliseum_or_raven_25.png  | 1264×1264   | square      |                  |
| coliseum_or_raven_26.png  | 1056×1504   | portrait    |                  |
| plate_dojo.png            | 611×611     | square      | Dojo (named)     |
| plate_fox_den.png         | 611×611     | square      | Fox's Den (named)|

NOTE: plate_dojo / plate_fox_den are only 611×611 (low-res vs the 1264 coliseum/raven
plates). Audit PART 4 listed Dojo + Fox's Den wide 16:9 backdrops as still owed — these
611px squares read as placeholders. Flag if you want them re-generated wide.

Rooms currently wired in src/lib/foxpit.ts point at the OLD /foxpit/room-*.png set —
those are untouched until this map is filled.
