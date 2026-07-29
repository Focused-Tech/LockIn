// Screenshots for pit-rooms-build.html. Reuses ../coliseum/node_modules/puppeteer via NODE_PATH.
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 432, height: 1056, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(__dirname, "pit-rooms-build.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 500));

  // 1) door mid-open with light spill (Dojo)
  await page.evaluate(() => window.midOpen("dojo"));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, "rooms-1-dooropen.png") });

  // 2) one settled room interior — host + tables (Dojo, doors gone, welcome faded)
  await page.evaluate(() => window.settleRoom("dojo"));
  await new Promise(r => setTimeout(r, 1400));
  await page.screenshot({ path: path.join(__dirname, "rooms-2-settled.png") });

  // 3) the Coliseum indoor-stadium wide (settled)
  await page.evaluate(() => window.settleRoom("coliseum"));
  await new Promise(r => setTimeout(r, 1400));
  await page.screenshot({ path: path.join(__dirname, "rooms-3-coliseum.png") });

  // 4) "zoom to tables" push-in (High Table, settled then zoomed)
  await page.evaluate(() => window.settleRoom("hightable"));
  await new Promise(r => setTimeout(r, 1400));
  await page.evaluate(() => document.getElementById("zoom").click());
  await new Promise(r => setTimeout(r, 1300));
  await page.screenshot({ path: path.join(__dirname, "rooms-4-zoom.png") });

  console.log("rooms shots written");
  await browser.close();
})();
