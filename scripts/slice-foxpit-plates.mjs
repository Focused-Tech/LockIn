// One-off: slice the Fox Pit arena contact sheets into individual room plates.
// The coliseum_or_raven_* files are 2x2 (and _26 is 2-up) review grids, not single
// backdrops. Each cell is a full "opponent seated at table" scene = one rotation plate.
import sharp from "sharp";
import path from "node:path";

const DIR = "public/foxpit/rooms";
const OUT = "public/foxpit/rooms/sliced";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

// grid sheets: [file, cols, rows, outPrefixList...] — content box measured via trim
const SHEETS = [
  { file: "coliseum_or_raven_22.png", cols: 2, rows: 2, names: ["ravensnest_01", "ravensnest_02", "ravensnest_03", "ravensnest_04"] },
  { file: "coliseum_or_raven_23.png", cols: 2, rows: 2, names: ["ravensnest_05", "ravensnest_06", "ravensnest_07", "ravensnest_08"] },
  { file: "coliseum_or_raven_24.png", cols: 2, rows: 2, names: ["coliseum_01", "coliseum_02", "coliseum_03", "coliseum_04"] },
  { file: "coliseum_or_raven_25.png", cols: 2, rows: 2, names: ["coliseum_05", "coliseum_06", "coliseum_07", "coliseum_08"] },
  { file: "coliseum_or_raven_26.png", cols: 2, rows: 1, names: ["foxden_boss", "dojo_boss"] },
];

async function contentBox(file) {
  const full = await sharp(file).metadata();
  const { info } = await sharp(file).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  return {
    x: -info.trimOffsetLeft,
    y: -info.trimOffsetTop,
    w: info.width,
    h: info.height,
    fullW: full.width,
    fullH: full.height,
  };
}

for (const s of SHEETS) {
  const src = path.join(DIR, s.file);
  const box = await contentBox(src);
  const cw = Math.floor(box.w / s.cols);
  const ch = Math.floor(box.h / s.rows);
  let n = 0;
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const name = s.names[n++];
      const left = Math.min(box.x + c * cw, box.fullW - cw);
      const top = Math.min(box.y + r * ch, box.fullH - ch);
      const outPath = path.join(OUT, `${name}.png`);
      // extract the cell, then trim any residual black seam for a clean edge
      const buf = await sharp(src).extract({ left, top, width: cw, height: ch }).toBuffer();
      const trimmed = await sharp(buf).trim({ threshold: 8 }).toBuffer();
      await sharp(trimmed).toFile(outPath);
      const m = await sharp(outPath).metadata();
      console.log(`${name}.png  ${m.width}x${m.height}  (from ${s.file} cell ${r},${c})`);
    }
  }
}
console.log("done");
