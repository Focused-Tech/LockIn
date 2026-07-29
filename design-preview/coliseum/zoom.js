// Zoom inspector — crop a region at high DPI so I can actually SEE the detail.
const puppeteer = require("puppeteer");
const path = require("path");
const [x, y, w, h, out] = process.argv.slice(2);

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 3 });
  await page.goto("file://" + path.join(__dirname, "coliseum-room.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({
    path: path.join(__dirname, out || "zoom.png"),
    clip: { x: +x, y: +y, width: +w, height: +h }
  });
  console.log("wrote", out || "zoom.png");
  await browser.close();
})();
