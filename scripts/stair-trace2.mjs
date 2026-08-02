import sharp from "sharp";
const f = "public/foxpit/map/tower_layers/tower_stairs_overlay.webp";
const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, ch = info.channels;
const ELEV_BAND = 170; // exclude the elevator shaft column (x<170) — it's not the staircase
// Fine scan: per row, opaque staircase centroid + outer(max) edge, x>=ELEV_BAND.
const path = [];
for (let y = 2140; y < H; y += 30) {
  let maxX = -1, sum = 0, cnt = 0;
  for (let x = ELEV_BAND; x < W; x++) {
    if (data[(y * W + x) * ch + 3] > 40) { if (x > maxX) maxX = x; sum += x; cnt++; }
  }
  if (cnt > 15) path.push({ y, cx: Math.round(sum/cnt), maxX, cnt });
}
// Detect switchback turns = local maxima of outer edge (right landings) and minima (left/near-elevator).
console.log("y\tpctY\tcx\tpctCx\tmaxX\tpctMax\tcnt");
for (const p of path) if (p.y % 90 < 30) console.log(`${p.y}\t${(p.y/H*100).toFixed(1)}\t${p.cx}\t${(p.cx/W*100).toFixed(1)}\t${p.maxX}\t${(p.maxX/W*100).toFixed(1)}\t${p.cnt}`);
// Find local maxima of maxX (the outer landing turn rows)
const turns = [];
for (let i = 3; i < path.length-3; i++) {
  const w = path.slice(i-3, i+4).map(p=>p.maxX);
  if (path[i].maxX === Math.max(...w) && path[i].maxX > 700) turns.push({y:path[i].y, maxX:path[i].maxX, kind:"RIGHT-landing"});
}
console.log("\n=== RIGHT-landing turn rows (outer-edge local maxima) ===");
for (const t of turns) console.log(`y=${t.y} (${(t.y/H*100).toFixed(1)}%) outer=${t.maxX} (${(t.maxX/W*100).toFixed(1)}%)`);
