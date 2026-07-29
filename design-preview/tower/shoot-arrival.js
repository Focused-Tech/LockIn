const puppeteer = require("puppeteer"), path = require("path");
(async () => {
  const b = await puppeteer.launch({ args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setViewport({ width: 432, height: 1056, deviceScaleFactor: 2 });
  await p.goto("file://" + path.join(__dirname, "pit-rooms-build.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 500));
  await p.evaluate(() => window.settleRoom("arrival"));
  await new Promise(r => setTimeout(r, 900));
  await p.screenshot({ path: path.join(__dirname, "rooms-5-arrival.png") });
  console.log("arrival shot written");
  await b.close();
})();
