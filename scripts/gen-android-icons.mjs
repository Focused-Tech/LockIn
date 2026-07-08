/**
 * Regenerate the committed Android launcher icons from the source art in
 * assets/. Mirrors the ad-hoc sharp pass used at commit c7ef5b3 so a plain APK
 * build (no @capacitor/assets run) ships the current icon. Native only — icons
 * ship IN the APK, not via OTA.
 *
 *   assets/app-icon-1024.png            -> ic_launcher.png (square, opaque) +
 *                                          ic_launcher_round.png (circle-masked)
 *   assets/app-icon-foreground-1024.png -> ic_launcher_foreground.png (keeps alpha)
 *   adaptive background                 -> @color/ic_launcher_background (#0A0D12),
 *                                          untouched; no background image.
 *
 * Run: node scripts/gen-android-icons.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RES = path.join(ROOT, "android/app/src/main/res");
const SRC_SQUARE = path.join(ROOT, "assets/app-icon-1024.png");
const SRC_FOREGROUND = path.join(ROOT, "assets/app-icon-foreground-1024.png");
const BG = "#0A0D12"; // matches @color/ic_launcher_background

// density -> [legacy/round px, adaptive foreground px]
const DENSITIES = {
  mdpi: [48, 108],
  hdpi: [72, 162],
  xhdpi: [96, 216],
  xxhdpi: [144, 324],
  xxxhdpi: [192, 432],
};

const circleMask = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${
      size / 2
    }" r="${size / 2}" fill="#fff"/></svg>`,
  );

async function run() {
  for (const [density, [legacy, fg]] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, `mipmap-${density}`);
    await mkdir(dir, { recursive: true });

    // ic_launcher.png — full-square, opaque (flatten guarantees no alpha).
    await sharp(SRC_SQUARE)
      .resize(legacy, legacy, { fit: "cover" })
      .flatten({ background: BG })
      .png()
      .toFile(path.join(dir, "ic_launcher.png"));

    // ic_launcher_round.png — same, then circular-masked (transparent corners).
    await sharp(SRC_SQUARE)
      .resize(legacy, legacy, { fit: "cover" })
      .flatten({ background: BG })
      .composite([{ input: circleMask(legacy), blend: "dest-in" }])
      .png()
      .toFile(path.join(dir, "ic_launcher_round.png"));

    // ic_launcher_foreground.png — adaptive foreground, KEEP transparency.
    await sharp(SRC_FOREGROUND)
      .resize(fg, fg, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(dir, "ic_launcher_foreground.png"));

    console.log(
      `mipmap-${density}: ic_launcher ${legacy}px, ic_launcher_round ${legacy}px (masked), ic_launcher_foreground ${fg}px (alpha)`,
    );
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
