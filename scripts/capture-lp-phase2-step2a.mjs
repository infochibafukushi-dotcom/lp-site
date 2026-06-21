import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "screenshots", "lp-phase2-step2a");

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
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = (req.url || "/").split("?")[0];
      const filePath = path.join(rootDir, rel === "/" ? "index.html" : rel.replace(/^\//, ""));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function prep(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem("lp_popup_dismissed", "1");
    } catch (e) {}
    document.getElementById("sitePopupOverlay")?.remove();
  });
}

async function metrics(page) {
  return page.evaluate(() => {
    const heroInner = document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .section-inner");
    const heroImg = document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .slider-slide img");
    const normalInner = document.querySelector("#vehicle-introduction-capacity .section-inner");
    const normalImg = document.querySelector("#vehicle-introduction-capacity .normal-image");
    const noImgInner = document.querySelector("#go-yoyaku-kara-tojitsu-made-no-nagare .section-inner");
    const card3 = document.querySelector("#reason-chiba-care-taxi .card-grid-3");
    const menuInner = document.querySelector("#shii-price-menyu .section-inner");

    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      viewport: window.innerWidth,
      heroInnerDisplay: heroInner ? cs(heroInner).display : null,
      heroInnerGridTemplate: heroInner ? cs(heroInner).gridTemplateColumns : null,
      heroImgWidth: heroImg ? Math.round(heroImg.getBoundingClientRect().width) : null,
      heroImgMaxWidth: heroImg ? cs(heroImg).maxWidth : null,
      heroImgHeight: heroImg ? cs(heroImg).height : null,
      heroImgObjectFit: heroImg ? cs(heroImg).objectFit : null,
      normalInnerDisplay: normalInner ? cs(normalInner).display : null,
      normalInnerGridTemplate: normalInner ? cs(normalInner).gridTemplateColumns : null,
      normalImgWidth: normalImg ? Math.round(normalImg.getBoundingClientRect().width) : null,
      normalImgMaxWidth: normalImg ? cs(normalImg).maxWidth : null,
      noImgInnerDisplay: noImgInner ? cs(noImgInner).display : null,
      card3Gap: card3 ? cs(card3).gap : null,
      menuInnerMaxWidth: menuInner ? cs(menuInner).maxWidth : null,
      mobileHeroFlex: window.innerWidth < 1024 && heroInner ? cs(heroInner).flexDirection : null,
    };
  });
}

await fs.promises.mkdir(outDir, { recursive: true });
const { server, port } = await startServer();
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const allMetrics = { pc: [], mobile: [] };

try {
  for (const [label, width] of [
    ["1920", 1920],
    ["1600", 1600],
    ["1366", 1366],
    ["1280", 1280],
  ]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll("section.section").length >= 5, { timeout: 30000 });
    await prep(page);
    allMetrics.pc.push({ viewport: label, ...(await metrics(page)) });
    await page.screenshot({ path: path.join(outDir, `pc-full-${label}.png`), fullPage: true });
    for (const [id, name] of [
      ["chiba-city-24h-365days-kaigo-taxi-chibakeatakushi", "hero"],
      ["vehicle-introduction-capacity", "normal"],
      ["reason-chiba-care-taxi", "card3"],
      ["shii-price-menyu", "menu-list"],
      ["go-yoyaku-kara-tojitsu-made-no-nagare", "normal-no-image"],
      ["tesuto", "accordion"],
    ]) {
      const el = await page.$(`#${id}`);
      if (el) await el.screenshot({ path: path.join(outDir, `pc-${name}-${label}.png`) });
    }
  }

  for (const [label, width] of [
    ["390", 390],
    ["430", 430],
  ]) {
    await page.setViewport({ width, height: 844 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll("section.section").length >= 5, { timeout: 30000 });
    await prep(page);
    allMetrics.mobile.push({ viewport: label, ...(await metrics(page)) });
    await page.screenshot({ path: path.join(outDir, `mobile-full-${label}.png`), fullPage: true });
  }
} finally {
  await browser.close();
  server.close();
}

await fs.promises.writeFile(path.join(outDir, "metrics.json"), JSON.stringify(allMetrics, null, 2));
console.log("Saved", outDir);
