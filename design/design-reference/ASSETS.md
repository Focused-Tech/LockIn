# Design reference — LockIn arena Practice-arena integration

Put this whole `design-reference/` folder at your **repo root**. It is reference only —
it must NOT be bundled/served by the app. Do not place `assets/` under `/public`.

- `arena-workflow-BASE.html` — the approved clickable prototype. Visual + flow truth.
- `assets/` — images, referenced by URL in the React port (do NOT inline as base64 data URIs).
- `masters/` — full-body mascot master(s) for later use (rules pages / future guises), not needed for the Practice integration itself.

## Arena images (one per mode card)

Card layers back-to-front: `arena-blur` → `arena-fill` (gradient) → image (`background-size:contain`, centered) → `content-shade` → UI. Image sits ON TOP of the gradient; UI on top of everything. Keep the `:not(.arena-fill)` exclusion in the z-index rule so the gradient stays behind the UI.

| file | mode (`data-mode`) | dims | notes |
|------|--------------------|------|-------|
| `assets/arena-practice.png`   | practice    | 555x620 | Practice Dojo |
| `assets/arena-coliseum.png`   | compete     | 554x620 | Coliseum (now the multiplayer/team mode) |
| `assets/arena-multislate.png` | multiplayer | 555x602 | Multi-Slate — the **LOCK IN slate art** (fox holding 3 category slates). Replaces the old poker art. |
| `assets/arena-creator.png`    | creator     | 518x614 | Creator Studio — **cropped** (white right-edge bar removed). If you see a ~549-wide version, it's the old one; use this. |

## Per-mode gradient fill (`.arena-fill`) — exact values

Background = horizontal (90deg) gradient sampled from each image's top edge (L/C/R). Vertical mask fades it into the image top. Include both `-webkit-mask-image` and `mask-image`.

- **practice** — `linear-gradient(90deg,#1c0900,#3c1301,#160701)`  · mask `linear-gradient(180deg,#000 0%,#000 20%,transparent 48%)`
- **compete (Coliseum)** — `linear-gradient(90deg,#303842,#5b7381,#dad1bb)` · mask `…#000 20%,transparent 48%`
- **multiplayer (Multi-Slate, new art)** — `linear-gradient(90deg,#050117,#07042b,#000539)` · mask `…#000 20%,transparent 48%`
- **creator** — `linear-gradient(90deg,#0e0b0b,#241217,#422629)` · mask `linear-gradient(180deg,#000 0%,#000 12%,transparent 26%)`

## UI / chrome assets

| file | element | dims |
|------|---------|------|
| `assets/fox-crest.png` | The Fox Pit head emblem (round crest above the marquee title) | 220x220 |
| `assets/wordmark-lockin.png` | `.brand-wordmark` (topbar), render ~78x24 | 1470x420 |
| `assets/icon-shield.png` | `.shield-mini` in each mode-tag | 185x230 |
| `assets/icon-lock.png` | `.lock-icon` in lock badge | 260x340 |

## Practice-only bottom blend

Practice has no skip button, so override ONLY its `content-shade` bottom to dissolve the image into the card (z2, above image, below text):
```css
.panel[data-mode="practice"] .content-shade{
  background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,0) 20%,
    rgba(0,0,0,0) 56%,rgba(8,9,12,.72) 84%,rgba(8,9,12,.95) 100%);}
```

## Color note

Per-mode gradients, mode colors, and solid buttons are intentional and final — do NOT reconcile against the old design system's reservations. Only chrome accent changes: `#ff5a3c` → `#FF3B00`.

## Order note

Carousel order: Practice Dojo → Multi-Slate → Coliseum → Creator Studio. Internally the data-mode names still read practice / multiplayer / compete / creator respectively (multiplayer slot = Multi-Slate, compete slot = Coliseum) — reconcile names later if desired; the art/gradient/label mapping above is what matters.
