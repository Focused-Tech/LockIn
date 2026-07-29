// Headless screenshot of the room mockup. Scratch-dir only — not part of the app build.
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(__dirname, "coliseum-room.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 900)); // let JS build the scene
  await page.screenshot({ path: path.join(__dirname, "shot.png") });
  console.log("wrote shot.png");
  await browser.close();
})();
