// Screenshots for pit-tower-build.html. Reuses ../coliseum/node_modules/puppeteer via NODE_PATH.
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 432, height: 1056, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(__dirname, "pit-tower-build.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 500));

  // 1) establishing whole-house
  await page.evaluate(() => window.jump("whole"));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, "build-1-whole.png") });

  // 2) a floor push-in (Coliseum — the tall practice room)
  await page.evaluate(() => window.jump("coliseum"));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, "build-2-floor.png") });

  // 3) locked-door close-up (High Table: Raven sigil + closed padlock + Wolf key)
  await page.evaluate(() => window.jump("hightable"));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, "build-3-locked.png") });

  // 4) elevator parked ON a floor plate — whole-house view, cropped tight on the
  //    far-left shaft where the car rests on the High Table plate.
  await page.evaluate(() => window.jump("whole"));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, "build-4-elevator.png"),
    clip: { x: 18, y: 230, width: 240, height: 320 } });

  console.log("build shots written");
  await browser.close();
})();
