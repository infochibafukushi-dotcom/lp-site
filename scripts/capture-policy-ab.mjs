import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "screenshots", "lp-policy-ab");

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

  async function shot(viewport, suffix) {
    await page.setViewport({ width: viewport, height: 1080 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 90000 });
    await page.waitForFunction(() => document.querySelector("#vehicle-introduction-capacity .normal-image"), { timeout: 30000 });
    await page.evaluate(() => {
      try { sessionStorage.setItem("lp_popup_dismissed", "1"); } catch (e) {}
      document.getElementById("sitePopupOverlay")?.remove();
    });
    const metrics = await page.evaluate(() => {
      const heroImg = document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .slider-slide img");
      const normalImg = document.querySelector("#vehicle-introduction-capacity .normal-image");
      const areaImg = document.querySelector("#chiba-city-yotsukaido-city-ichihara-city-ni .normal-image");
      const pick = (img) => {
        if (!img) return null;
        const cs = getComputedStyle(img);
        const r = img.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          maxWidth: cs.maxWidth,
          objectFit: cs.objectFit,
          background: cs.backgroundColor,
        };
      };
      const inner = document.querySelector("#vehicle-introduction-capacity .section-inner");
      return {
        viewport: window.innerWidth,
        hero: pick(heroImg),
        normalVehicle: pick(normalImg),
        normalArea: pick(areaImg),
        normalInnerDisplay: inner ? getComputedStyle(inner).display : null,
        normalInnerFlexDirection: inner ? getComputedStyle(inner).flexDirection : null,
      };
    });
    const hero = await page.$("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi");
    const normal = await page.$("#vehicle-introduction-capacity");
    const mobileHero = viewport < 1024 ? await page.$("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi") : null;
    if (hero) await hero.screenshot({ path: path.join(dir, `hero-${suffix}.png`) });
    if (normal) await normal.screenshot({ path: path.join(dir, `normal-vehicle-${suffix}.png`) });
    if (mobileHero) await mobileHero.screenshot({ path: path.join(dir, `mobile-hero-${suffix}.png`) });
    return metrics;
  }

  const pc = await shot(1920, "1920");
  const mobile = await shot(390, "390");
  await browser.close();
  server.close();
  const data = { pc, mobile };
  await fs.promises.writeFile(path.join(dir, "metrics.json"), JSON.stringify(data, null, 2));
  return data;
}

const label = process.argv[2] || "after";
console.log(JSON.stringify(await capture(label), null, 2));
