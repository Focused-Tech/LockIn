const puppeteer = require("puppeteer"), path = require("path");
(async () => {
  const b = await puppeteer.launch({ args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setViewport({ width: 432, height: 1056 });
  await p.goto("file://" + path.join(__dirname, "pit-camera-preview.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 400));
  await p.evaluate(() => window.setState("establishing"));
  await new Promise(r => setTimeout(r, 300));
  const r = await p.evaluate(() => {
    const q = sel => { const e = sel[0] === "#" ? document.getElementById(sel.slice(1)) : document.querySelector(sel);
      const b = e.getBoundingClientRect();
      return { x:+b.x.toFixed(1), y:+b.y.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1) }; };
    return { win:{w:innerWidth,h:innerHeight}, phone:q("#phone"), room:q("#room"),
      crowdL:q(".crowd"), node1:q("#node1"),
      roomTransform:getComputedStyle(document.getElementById("room")).transform };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
