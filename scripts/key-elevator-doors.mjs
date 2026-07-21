// One-off: chroma-key the bright-green background out of the elevator door frames
// (door-closed/mid1/mid2/open) to true transparency, with light green despill.
import sharp from "sharp";

const DIR = "public/foxpit/elevator";
const FRAMES = ["door-closed", "door-mid1", "door-mid2", "door-open"];

for (const name of FRAMES) {
  const src = `${DIR}/${name}.png`;
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  for (let i = 0; i < px; i++) {
    const o = i * info.channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    // bright green screen -> transparent
    if (g > 70 && g > r * 1.35 && g > b * 1.35) {
      data[o + 3] = 0;
    } else if (g > r && g > b && g - Math.max(r, b) > 24) {
      // edge despill: pull the green tint down toward the max of r/b
      data[o + 1] = Math.max(r, b);
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toFile(`${DIR}/${name}.keyed.png`);
  // verify corner is now transparent
  const { data: c } = await sharp(`${DIR}/${name}.keyed.png`).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  console.log(`${name}.keyed.png corner alpha=${c[3]}`);
}
console.log("done");
