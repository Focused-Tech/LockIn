// Objective geometry checks — no eyeballing.
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 900 });
  await page.goto("file://" + path.join(__dirname, "coliseum-room.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 800));

  const res = await page.evaluate(() => {
    const p = document.getElementById("trailBase");
    const L = p.getTotalLength();
    const pts = [];
    for (let i = 0; i <= 1500; i++) pts.push(p.getPointAtLength((i / 1500) * L));

    const tables = TABLES.map(t => {
      let min = 1e9;
      for (const q of pts) {
        const d = Math.hypot(q.x - t.x, q.y - t.y);
        if (d < min) min = d;
      }
      return { name: t.name, x: t.x, y: t.y, distToTrail: +min.toFixed(2) };
    });

    // seat spacing: nearest-neighbour distance between seat centres (scene px)
    const seatCheck = TABLES.map(t => {
      const CRX = 132, CRY = 78, N = 5;
      const c = [];
      for (let i = 0; i < N; i++) {
        const a = (Math.PI * 2 * i) / N + Math.PI / 2;
        c.push({ x: Math.cos(a) * CRX * t.s, y: Math.sin(a) * CRY * t.s });
      }
      let min = 1e9;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++)
        min = Math.min(min, Math.hypot(c[i].x - c[j].x, c[i].y - c[j].y));
      return { name: t.name, minSeatGap: +min.toFixed(1), chairWidth: +(30 * t.s).toFixed(1) };
    });

    // crowd overlap: count figures per arch group
    const crowd = document.querySelectorAll("#archesTop circle, #archesBot circle").length;
    return { tables, seatCheck, crowdFigures: crowd };
  });

  console.log("--- TRAIL passes through table centres? (distance in px) ---");
  res.tables.forEach(t =>
    console.log(`  ${t.name.padEnd(12)} dist=${String(t.distToTrail).padStart(6)}  ${t.distToTrail < 2 ? "ON TRAIL ✓" : "OFF TRAIL ✗"}`));
  console.log("--- SEATS: gap between nearest seats vs chair width ---");
  res.seatCheck.forEach(s =>
    console.log(`  ${s.name.padEnd(12)} gap=${String(s.minSeatGap).padStart(6)}  chair=${s.chairWidth}  ${s.minSeatGap > s.chairWidth ? "NO OVERLAP ✓" : "OVERLAP ✗"}`));
  console.log("--- CROWD figures total:", res.crowdFigures, "(sparse target: well under a packed house)");

  await browser.close();
})();
