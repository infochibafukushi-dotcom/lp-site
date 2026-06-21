import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputBase = path.join(rootDir, "screenshots", "lp-pc-phase1");

const viewports = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1600", width: 1600, height: 900 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1280", width: 1280, height: 800 },
];

const sectionIds = [
  "chiba-city-24h-365days-kaigo-taxi-chibakeatakushi",
  "reason-chiba-care-taxi",
  "usage-scenes",
  "equipment-line-up",
  "chiba-city-yotsukaido-city-ichihara-city-ni",
  "shii-price-menyu",
];

function startServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.join(rootDir, rel.replace(/^\//, "").replace(/\.\./g, ""));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function dismissPopup(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem("lp_popup_dismissed", "1");
    } catch (e) {}
    const overlay = document.getElementById("sitePopupOverlay");
    if (overlay) overlay.remove();
  });
}

async function waitForSections(page) {
  await page.waitForFunction(
    () => {
      const container = document.getElementById("sectionsContainer");
      return container && container.querySelectorAll("section.section").length >= 5;
    },
    { timeout: 30000 }
  );
  await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
}

async function collectMetrics(page, viewportWidth) {
  return page.evaluate((vpWidth) => {
    const firstInner = document.querySelector(".section-inner");
    const innerRect = firstInner?.getBoundingClientRect();
    const innerStyle = firstInner ? getComputedStyle(firstInner) : null;

    const card3 = document.querySelector(".card-grid-3 .card-item");
    const card3Rect = card3?.getBoundingClientRect();

    const sliderImg = document.querySelector(".slider-slide img");
    const sliderRect = sliderImg?.getBoundingClientRect();

    const menuInner = document.querySelector("#shii-price-menyu .section-inner");
    const menuRect = menuInner?.getBoundingClientRect();

    return {
      viewportWidth: vpWidth,
      sectionInnerWidth: innerRect ? Math.round(innerRect.width) : null,
      sectionInnerMaxWidth: innerStyle?.maxWidth || null,
      utilizationPct: innerRect ? Math.round((innerRect.width / vpWidth) * 1000) / 10 : null,
      card3Width: card3Rect ? Math.round(card3Rect.width) : null,
      sliderImgWidth: sliderRect ? Math.round(sliderRect.width) : null,
      menuListInnerWidth: menuRect ? Math.round(menuRect.width) : null,
      sectionCount: document.querySelectorAll("section.section").length,
    };
  }, viewportWidth);
}

async function capture(label) {
  const out = path.join(outputBase, label);
  await fs.promises.mkdir(out, { recursive: true });

  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const metrics = [];

  try {
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
      await waitForSections(page);
      await dismissPopup(page);

      metrics.push(await collectMetrics(page, vp.width));

      await page.screenshot({
        path: path.join(out, `full-${vp.name}.png`),
        type: "png",
        fullPage: true,
      });

      for (const id of sectionIds) {
        const el = await page.$(`#${id}`);
        if (!el) continue;
        const tag = id.includes("reason") ? "card3-reason" :
          id.includes("usage") ? "card3-scenes" :
          id.includes("equipment") ? "card4" :
          id.includes("shii") ? "menu-list" :
          id.includes("slider") || id.includes("chiba-city-24h") ? "slider" :
          "normal";
        await el.screenshot({
          path: path.join(out, `${tag}-${vp.name}.png`),
          type: "png",
        });
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  await fs.promises.writeFile(
    path.join(out, "metrics.json"),
    JSON.stringify(metrics, null, 2),
    "utf8"
  );
  console.log(`Screenshots saved: ${out}`);
}

const label = process.argv[2] || "after";
await capture(label);
