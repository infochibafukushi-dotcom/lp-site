import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "screenshots", "lp-hero-policy-a");

function startServer() {
  const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".json": "application/json", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || "/").split("?")[0]);
      const filePath = path.join(rootDir, rel === "/" ? "index.html" : rel.replace(/^\//, ""));
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function capture(label) {
  await fs.promises.mkdir(path.join(outDir, label), { recursive: true });
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.waitForFunction(() => document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi"), { timeout: 30000 });
  await page.evaluate(() => {
    try { sessionStorage.setItem("lp_popup_dismissed", "1"); } catch (e) {}
    document.getElementById("sitePopupOverlay")?.remove();
  });
  const metrics = await page.evaluate(() => {
    const img = document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .slider-slide img");
    const cs = getComputedStyle(img);
    const r = img.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      maxWidth: cs.maxWidth,
      objectFit: cs.objectFit,
      background: cs.backgroundColor,
      margin: cs.margin,
    };
  });
  const el = await page.$("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi");
  await el.screenshot({ path: path.join(outDir, label, "hero-1920.png") });
  await browser.close();
  server.close();
  return metrics;
}

const label = process.argv[2] || "after";
const metrics = await capture(label);
await fs.promises.writeFile(path.join(outDir, `${label}-metrics.json`), JSON.stringify(metrics, null, 2));
console.log(label, metrics);
