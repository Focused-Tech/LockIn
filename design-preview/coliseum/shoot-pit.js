// Screenshot all 7 camera states of pit-camera-preview.html + capture the SPEC.
const puppeteer = require("puppeteer");
const path = require("path");

const STATES = ["establishing","zoomin","land","transition","seated","tableanim","gamestart"];

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  // render the 1080x2640 phone scaled to fit a 432x1056 window (same aspect)
  await page.setViewport({ width: 432, height: 1056, deviceScaleFactor: 1 });

  let spec = null;
  page.on("console", m => { const t = m.text();
    if (t.startsWith("PIT_CAMERA_SPEC ")) spec = JSON.parse(t.slice("PIT_CAMERA_SPEC ".length)); });

  await page.goto("file://" + path.join(__dirname, "pit-camera-preview.html").replace(/\\/g, "/"));
  await new Promise(r => setTimeout(r, 400));

  for (let i = 0; i < STATES.length; i++) {
    await page.evaluate(s => window.setState(s), STATES[i]);
    // for the table-anim beat we need the flip to actually play, so let it settle
    await new Promise(r => setTimeout(r, STATES[i] === "tableanim" ? 800 : 350));
    await page.screenshot({ path: path.join(__dirname, `pit-${i+1}-${STATES[i]}.png`) });
    console.log(`shot ${i+1} ${STATES[i]}`);
  }

  console.log("\n=== PIT_CAMERA_SPEC ===");
  console.log(JSON.stringify(spec, null, 2));
  await browser.close();
})();
