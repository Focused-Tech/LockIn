// Screenshots for the tower hub. Reuses ../coliseum/node_modules/puppeteer via NODE_PATH.
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 432, height: 1056, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(__dirname, "pit-tower-hub.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 500));

  // 1) establishing whole-tower
  await page.evaluate(() => window.jump("establishing"));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, "shot-tower-establishing.png") });

  // 2) floor-focused zoom (Dojo, the current floor)
  await page.evaluate(() => window.jump("dojo"));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, "shot-tower-dojo.png") });

  // 3) locked-door close-up (Coliseum: Wolf crest + padlock + OWL key needed)
  await page.evaluate(() => window.jump("coliseum"));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, "shot-tower-locked.png") });

  console.log("tower shots written");
  await browser.close();
})();
