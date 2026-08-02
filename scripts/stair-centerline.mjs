import sharp from "sharp";
const f = "public/foxpit/map/tower_layers/tower_stairs_overlay.webp";
const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, ch = info.channels;
const ELEV_BAND = 170;
const raw = [];
for (let y = 2170; y <= 4350; y += 20) {
  let sum = 0, cnt = 0, maxX = -1;
  for (let x = ELEV_BAND; x < W; x++) {
    if (data[(y * W + x) * ch + 3] > 40) { sum += x; cnt++; if (x>maxX) maxX=x; }
  }
  if (cnt > 15) raw.push({ y, cx: sum/cnt, maxX });
}
// smooth cx with a 5-point moving average
const sm = raw.map((p,i) => {
  const w = raw.slice(Math.max(0,i-2), i+3);
  return { y:p.y, cx: w.reduce((s,q)=>s+q.cx,0)/w.length };
});
// Emit as % array, bottom(high y)→top(low y): reverse so index0 = Dojo base.
const pts = sm.map(p => ({ x:+(p.cx/W*100).toFixed(2), y:+(p.y/H*100).toFixed(2) })).reverse();
console.log("CENTERLINE_PCT (Dojo→High Table), "+pts.length+" pts:");
console.log(JSON.stringify(pts));
