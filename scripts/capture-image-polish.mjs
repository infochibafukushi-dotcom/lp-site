import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "screenshots", "lp-image-polish");

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
  const dir = path.join(outDir, label);
  await fs.promises.mkdir(dir, { recursive: true });
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  for (const [w, suffix] of [[1920, "pc"], [390, "mobile"]]) {
    await page.setViewport({ width: w, height: w === 1920 ? 1080 : 844 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 90000 });
    await page.waitForFunction(() => document.querySelectorAll("section.section").length >= 5, { timeout: 30000 });
    await page.evaluate(() => {
      try { sessionStorage.setItem("lp_popup_dismissed", "1"); } catch (e) {}
      document.getElementById("sitePopupOverlay")?.remove();
    });
    for (const [id, name] of [
      ["chiba-city-24h-365days-kaigo-taxi-chibakeatakushi", "hero"],
      ["reason-chiba-care-taxi", "card3"],
      ["vehicle-introduction-capacity", "normal"],
      ["service-heno-i", "card1"],
    ]) {
      const el = await page.$(`#${id}`);
      if (el) await el.screenshot({ path: path.join(dir, `${name}-${suffix}.png`) });
    }
  }

  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => {
    try { sessionStorage.setItem("lp_popup_dismissed", "1"); } catch (e) {}
    document.getElementById("sitePopupOverlay")?.remove();
  });
  const metrics = await page.evaluate(() => {
    const pick = (sel) => {
      const img = document.querySelector(sel);
      if (!img) return null;
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      return { w: Math.round(r.width), h: Math.round(r.height), maxW: cs.maxWidth, fit: cs.objectFit };
    };
    return {
      hero: pick("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .slider-slide img"),
      card: pick("#reason-chiba-care-taxi .card-item img"),
      normal: pick("#vehicle-introduction-capacity .normal-image"),
      media: pick("#service-heno-i .media-row img"),
    };
  });

  await browser.close();
  server.close();
  await fs.promises.writeFile(path.join(dir, "metrics.json"), JSON.stringify(metrics, null, 2));
  return metrics;
}

const label = process.argv[2] || "after";
console.log(label, JSON.stringify(await capture(label), null, 2));
