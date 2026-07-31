# Boss Fox chomping head — drop-in package

Architect-calibrated 2026-07-30. Device-approved values are baked into `foxhead.js`
as `CAL`. **Do not retune without a device pass.**

    headX 82   headY -4   headSize 96   gape 120
    mouthX -65 mouthY -36 mouthSize 100 tongue 52   snackY 109

## Files
    foxhead.js                     the module (no dependencies)
    foxhead_demo.html              standalone proof — open it to verify
    assets/fox/base_closed.png     layer 1 — full Boss Fox, mouth shut, BLACK shirt
    assets/fox/throat.png          layer 2
    assets/fox/jaw.png             layer 2
    assets/fox/tongue.png          layer 3
    assets/fox/head_open.png       layer 4 — same fox sliced below the teeth
    assets/snacks/*.png            10 sprites: donut cake cheese cherries pie
                                   wing pizza pastry pretzel soda
    assets/scenes/snackbar.png     bar scene for the landing/order screen

## Layer order — do not reorder
base_closed < throat < jaw < tongue < head_open

Layers 2-4 fade out together as the mouth shuts, so a shut mouth is
`base_closed` alone. That is the flip back to the closed fox at the end
of a chomp.

## Use
    const fox = FoxHead.mount(container, {assets: 'assets/'});
    fox.feed('donut');   // fly a snack in; the jaw chomps on landing
    fox.chomp();         // chomp with nothing
    fox.on('eaten', e => score += VALUE[e.kind]);
    fox.gape = 0;        // drive the mouth directly if needed

`mount` sizes an 823x911 stage and scales it to the container on resize.
