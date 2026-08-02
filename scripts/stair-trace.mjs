import sharp from "sharp";
const f = "public/foxpit/map/tower_layers/tower_stairs_overlay.webp";
const img = sharp(f);
const meta = await img.metadata();
const W = meta.width, H = meta.height;
const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const ch = info.channels; // 4
console.log(`overlay ${W}x${H} ch=${ch}`);
// Per row band: find opaque (alpha>40) column extent + centroid. Sample every 90px.
const rows = [];
for (let y = 0; y < H; y += 90) {
  let minX = 1e9, maxX = -1, sum = 0, cnt = 0;
  for (let x = 0; x < W; x++) {
    const a = data[(y * W + x) * ch + 3];
    if (a > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; sum += x; cnt++; }
  }
  if (cnt > 8) {
    const cx = Math.round(sum / cnt);
    rows.push({ y, minX, maxX, cx, cnt, pctY: +(y/H*100).toFixed(1), pctCx: +(cx/W*100).toFixed(1), pctMin:+(minX/W*100).toFixed(1), pctMax:+(maxX/W*100).toFixed(1) });
  }
}
console.log("y\tpctY\tminX\tmaxX\tcx\tpctCx\tpctMin-Max\tcnt");
for (const r of rows) console.log(`${r.y}\t${r.pctY}\t${r.minX}\t${r.maxX}\t${r.cx}\t${r.pctCx}\t${r.pctMin}-${r.pctMax}\t${r.cnt}`);
