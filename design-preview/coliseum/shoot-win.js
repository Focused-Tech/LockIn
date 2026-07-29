// Filmstrip of the WIN choreography: insert → turn → shackle → gate → key drops.
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(__dirname, "coliseum-room.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 800));

  // crop tight on the padlock so each beat is legible
  const lock = { x: 230, y: 240, width: 150, height: 130 };
  const steps = [
    [0,    "win-0-locked.png",  "locked"],
    [950,  "win-1-insert.png",  "key inserted into fox keyhole"],
    [1500, "win-2-turn.png",    "key turning 90°"],
    [2050, "win-3-shackle.png", "shackle springs open"],
    [3000, "win-4-gate.png",    "gate opens + glow"]
  ];

  await page.screenshot({ path: path.join(__dirname, steps[0][1]), clip: lock });
  const t0 = Date.now();
  await page.click("#winBtn");

  for (let i = 1; i < steps.length; i++) {
    const [at, file, label] = steps[i];
    const wait = at - (Date.now() - t0);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    await page.screenshot({ path: path.join(__dirname, file), clip: lock });
    const cls = await page.$eval("#stage", e => e.className);
    console.log(`t=${at}ms  ${label.padEnd(30)} classes: ${cls.replace("stage", "").trim()}`);
  }

  await new Promise(r => setTimeout(r, 1600));
  await page.screenshot({ path: path.join(__dirname, "shot-won.png") });
  const keys = await page.$eval("#keyCount", e => e.textContent);
  console.log("final → keyCount =", keys);
  await browser.close();
})();
