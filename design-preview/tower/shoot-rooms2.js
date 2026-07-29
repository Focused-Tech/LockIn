const puppeteer = require("puppeteer"), path = require("path");
(async () => {
  const b = await puppeteer.launch({ args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setViewport({ width: 432, height: 1056, deviceScaleFactor: 2 });
  await p.goto("file://" + path.join(__dirname, "pit-rooms-build2.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 500));

  // 1) settled room — proper table + chairs + avatar plinth (Dojo)
  await p.evaluate(() => window.settleRoom("dojo"));
  await new Promise(r => setTimeout(r, 1400));
  await p.screenshot({ path: path.join(__dirname, "b2-1-settled.png") });

  // 2) door mid-open revealing the interior (Dojo)
  await p.evaluate(() => window.midOpen("dojo"));
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: path.join(__dirname, "b2-2-dooropen.png") });

  // 3) Coliseum wide (settled)
  await p.evaluate(() => window.settleRoom("coliseum"));
  await new Promise(r => setTimeout(r, 1400));
  await p.screenshot({ path: path.join(__dirname, "b2-3-coliseum.png") });

  // 4) arrival warm hall revealed (mid-open)
  await p.evaluate(() => window.midOpen("arrival"));
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: path.join(__dirname, "b2-4-arrival.png") });

  console.log("build2 shots written");
  await b.close();
})();
