/* Boss Fox chomping head — production module.
 * Architect-calibrated 2026-07-30. DO NOT change CAL without a device pass.
 *
 * Layer order (the architect's template, do not reorder):
 *   1 base_closed  full Boss Fox, mouth shut, black shirt   <- bottom
 *   2 throat
 *   2 jaw
 *   3 tongue
 *   4 head_open    same fox, sliced below the teeth          <- top
 * Layers 2,3,4 all fade out as the mouth shuts, so a shut mouth is
 * base_closed alone — the "flip back to the closed fox".
 *
 * Usage:
 *   const fox = FoxHead.mount(document.querySelector('#fox'), {assets:'assets/'});
 *   fox.feed('donut');        // fly a snack in; the jaw chomps when it lands
 *   fox.chomp();              // chomp with no snack
 *   fox.on('eaten', n => ...) // fires each time a snack is swallowed
 */
(function (global) {
  'use strict';

  // ---- ARCHITECT CALIBRATION — approved values, do not tune ----
  var CAL = {
    headX: 82, headY: -4, headSize: 96,   // seats head_open on base_closed
    gape: 120,                            // full mouth opening, px
    mouthX: -65, mouthY: -36, mouthSize: 100, // seats jaw/tongue/throat in the hole
    tongue: 52,                           // tongue offset below the jaw top
    snackY: 109                           // snack landing trim, into the mouth
  };
  // mouth hole measured on head_open.png at 100% scale
  var HOLE = { x0: 249, x1: 565, y0: 354 };
  var PLATE = { w: 823, h: 911 };         // base_closed canvas — the stage size
  var HEAD_W = 691;

  var SNACKS = ['donut','cake','cheese','cherries','pie',
                'wing','pizza','pastry','pretzel','soda'];

  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }

  function mount(container, opts) {
    opts = opts || {};
    var base = (opts.assets || 'assets/');
    var cal  = Object.assign({}, CAL, opts.cal || {});

    var stage = el('div', 'foxhead-stage');
    stage.style.cssText = 'position:relative;width:' + PLATE.w + 'px;height:' + PLATE.h +
      'px;transform-origin:center center';
    container.appendChild(stage);

    function img(id, src, z) {
      var i = el('img'); i.id = 'fh-' + id; i.src = base + src;
      i.style.cssText = 'position:absolute;display:block;pointer-events:none;user-select:none;z-index:' + z;
      i.draggable = false; stage.appendChild(i); return i;
    }
    var L = {
      base:   img('base',   'fox/base_closed.png', 1),
      throat: img('throat', 'fox/throat.png',      2),
      jaw:    img('jaw',    'fox/jaw.png',         3),
      tongue: img('tongue', 'fox/tongue.png',      4),
      top:    img('top',    'fox/head_open.png',   5)
    };
    L.base.style.left = '0px'; L.base.style.top = '0px'; L.base.style.width = PLATE.w + 'px';

    // derive mouth geometry from the calibration
    var k  = cal.headSize / 100,
        GC = cal.headX + (HOLE.x0 + HOLE.x1) / 2 * k + cal.mouthX,
        GY = cal.headY + HOLE.y0 * k + cal.mouthY,
        GW = (HOLE.x1 - HOLE.x0) * k,
        m  = cal.mouthSize / 100,
        THW = GW * 0.90 * m, JWW = GW * 1.00 * m, TGW = GW * 0.44 * m;

    L.top.style.width = (HEAD_W * k) + 'px';
    L.top.style.left  = cal.headX + 'px';
    L.top.style.top   = cal.headY + 'px';
    L.throat.style.width = THW + 'px'; L.throat.style.left = (GC - THW / 2) + 'px';
    L.jaw.style.width    = JWW + 'px'; L.jaw.style.left    = (GC - JWW / 2) + 'px';
    L.tongue.style.width = TGW + 'px'; L.tongue.style.left = (GC - TGW / 2) + 'px';

    var open = 0, target = 0, eaten = 0, lick = 0, last = 0, flying = [], handlers = {};

    function layout() {
      var jt = GY + open;
      L.throat.style.top = (GY + 10 + open * 0.15) + 'px';
      L.jaw.style.top    = jt + 'px';
      L.tongue.style.top = (jt + cal.tongue + Math.sin(lick) * 11) + 'px';
      L.tongue.style.transform = 'rotate(' + (Math.sin(lick * 0.7) * 3) + 'deg)';
      var o = Math.min(1, open / 28);
      L.throat.style.opacity = o; L.jaw.style.opacity = o;
      L.tongue.style.opacity = o; L.top.style.opacity = o;   // shut -> closed fox only
    }

    function fit() {
      var w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      stage.style.transform = 'scale(' + Math.min(w / PLATE.w, h / PLATE.h) + ')';
    }
    window.addEventListener('resize', fit);

    function feed(kind) {
      kind = kind || SNACKS[(Math.random() * SNACKS.length) | 0];
      var i = el('img'); i.src = base + 'snacks/' + kind + '.png';
      i.style.cssText = 'position:absolute;display:block;pointer-events:none;width:130px;z-index:6;left:0;top:0';
      stage.appendChild(i);
      var side = Math.random() < 0.5 ? -1 : 1;
      flying.push({
        el: i, kind: kind, t: 0, dur: 920 + Math.random() * 300,
        x0: GC + side * (470 + Math.random() * 160), y0: PLATE.h - 60 + Math.random() * 100,
        x1: GC, y1: GY + cal.gape * 0.85 + cal.tongue * 0.45 + cal.snackY,
        arc: 280 + Math.random() * 140, rot: Math.random() * 720 - 360
      });
      return kind;
    }

    function chomp() { target = cal.gape; setTimeout(function () { target = 0; }, 280); }
    function emit(n, a) { (handlers[n] || []).forEach(function (f) { f(a); }); }

    function step(ts) {
      if (!last) last = ts;
      var dt = Math.min(50, ts - last); last = ts;
      open += (target - open) * Math.min(1, dt / 70);
      if (open > cal.gape) open = cal.gape;
      lick += dt * 0.009 * (open > 18 ? 1 : 0);
      layout();
      for (var i = flying.length - 1; i >= 0; i--) {
        var s = flying[i]; s.t += dt;
        var p = Math.min(1, s.t / s.dur), e = p * p * (3 - 2 * p);
        var x = s.x0 + (s.x1 - s.x0) * e,
            y = s.y0 + (s.y1 - s.y0) * e - Math.sin(Math.PI * e) * s.arc,
            sc = 1 - 0.5 * e;
        s.el.style.transform = 'translate(' + (x - 65) + 'px,' + (y - 65) + 'px) rotate(' +
          (s.rot * e) + 'deg) scale(' + sc + ')';
        if (p > 0.68 && !s.opened) { s.opened = true; target = cal.gape; }
        if (p >= 1) {
          stage.removeChild(s.el); flying.splice(i, 1);
          eaten++; target = 0; emit('eaten', { count: eaten, kind: s.kind });
        }
      }
      requestAnimationFrame(step);
    }

    fit(); layout(); requestAnimationFrame(step);

    return {
      stage: stage, cal: cal, snacks: SNACKS.slice(),
      feed: feed, chomp: chomp, fit: fit,
      get eaten() { return eaten; },
      get gape() { return open; },
      set gape(v) { target = Math.max(0, Math.min(cal.gape, v)); },
      on: function (n, f) { (handlers[n] = handlers[n] || []).push(f); return this; }
    };
  }

  global.FoxHead = { mount: mount, CAL: CAL, SNACKS: SNACKS, PLATE: PLATE };
})(window);
