import fs from "fs";
import http from "http";
import path from "path";
import puppeteer from "puppeteer";

const root = process.cwd();
const outDir = path.join(root, "screenshots", "lp-hero-contain-auto");
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]);
  const fp = path.join(root, rel === "/" ? "index.html" : rel.replace(/^\//, ""));
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(fp).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const results = {};

for (const w of [1920, 1366, 390]) {
  await page.setViewport({ width: w, height: 1080 });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.waitForFunction(
    () => document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .slider-slide img"),
    { timeout: 30000 }
  );
  await page.evaluate(() => {
    try {
      sessionStorage.setItem("lp_popup_dismissed", "1");
    } catch (e) {}
    document.getElementById("sitePopupOverlay")?.remove();
  });
  results[w] = await page.evaluate(() => {
    const img = document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .slider-slide img");
    const cs = getComputedStyle(img);
    const r = img.getBoundingClientRect();
    const inner = document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .section-inner");
    const ir = inner.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      displayW: Math.round(r.width),
      displayH: Math.round(r.height),
      cssHeight: cs.height,
      cssWidth: cs.width,
      objectFit: cs.objectFit,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
      innerW: Math.round(ir.width),
      sideMargin: Math.round((ir.width - r.width) / 2),
    };
  });
  if (w >= 1024) {
    const el = await page.$("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi");
    await el.screenshot({ path: path.join(outDir, `hero-${w}.png`) });
  }
}

await browser.close();
server.close();
fs.writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
