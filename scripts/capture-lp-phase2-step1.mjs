import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputBase = path.join(rootDir, "screenshots", "lp-phase2-step1");

const pcViewports = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1600", width: 1600, height: 900 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1280", width: 1280, height: 800 },
];

const mobileViewports = [
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
];

const sectionIds = [
  { id: "chiba-city-24h-365days-kaigo-taxi-chibakeatakushi", label: "slider" },
  { id: "reason-chiba-care-taxi", label: "card3-reason" },
  { id: "usage-scenes", label: "card3-scenes" },
  { id: "equipment-line-up", label: "card4" },
  { id: "shii-price-menyu", label: "menu-list" },
  { id: "chiba-city-yotsukaido-city-ichihara-city-ni", label: "normal" },
  { id: "service-heno-i", label: "card1-right" },
  { id: "annai-no-katsudo-jokyo", label: "card1-left" },
  { id: "tesuto", label: "accordion" },
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
      resolve({ server, port: server.address().port });
    });
  });
}

async function dismissPopup(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem("lp_popup_dismissed", "1");
    } catch (e) {}
    document.getElementById("sitePopupOverlay")?.remove();
  });
}

async function waitForSections(page) {
  await page.waitForFunction(
    () => document.querySelectorAll("section.section").length >= 5,
    { timeout: 30000 }
  );
  await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const pick = (sel, prop) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return getComputedStyle(el)[prop];
    };

    const inner = document.querySelector(".section-inner");
    const menuInner = document.querySelector("#shii-price-menyu .section-inner");
    const card3 = document.querySelector(".card-grid-3 .card-item");
    const title = document.querySelector(".section-title");
    const medium = document.querySelector(".text-medium");

    return {
      viewportWidth: window.innerWidth,
      sectionInnerMaxWidth: inner ? getComputedStyle(inner).maxWidth : null,
      sectionInnerWidth: inner ? Math.round(inner.getBoundingClientRect().width) : null,
      menuListInnerMaxWidth: menuInner ? getComputedStyle(menuInner).maxWidth : null,
      menuListInnerWidth: menuInner ? Math.round(menuInner.getBoundingClientRect().width) : null,
      sectionPadding: pick(".section", "padding"),
      sectionTitleFontSize: title ? getComputedStyle(title).fontSize : null,
      sectionTitleMarginBottom: title ? getComputedStyle(title).marginBottom : null,
      textMediumFontSize: medium ? getComputedStyle(medium).fontSize : null,
      cardItemTitleFontSize: pick(".card-item-title", "fontSize"),
      cardGrid3Gap: pick(".card-grid-3", "gap"),
      cardItemPadding: card3 ? getComputedStyle(card3).padding : null,
      mediaRowGap: pick(".media-row", "gap"),
      sectionBottomLinkFontSize: pick(".section-bottom-link", "fontSize"),
    };
  });
}

async function capture() {
  await fs.promises.mkdir(outputBase, { recursive: true });
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const metrics = { pc: [], mobile: [] };

  try {
    for (const vp of pcViewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
      await waitForSections(page);
      await dismissPopup(page);
      metrics.pc.push({ viewport: vp.name, ...(await collectMetrics(page)) });
      await page.screenshot({
        path: path.join(outputBase, `pc-full-${vp.name}.png`),
        type: "png",
        fullPage: true,
      });
      for (const { id, label } of sectionIds) {
        const el = await page.$(`#${id}`);
        if (el) {
          await el.screenshot({ path: path.join(outputBase, `pc-${label}-${vp.name}.png`), type: "png" });
        }
      }
    }

    for (const vp of mobileViewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
      await waitForSections(page);
      await dismissPopup(page);
      metrics.mobile.push({ viewport: vp.name, ...(await collectMetrics(page)) });
      await page.screenshot({
        path: path.join(outputBase, `mobile-full-${vp.name}.png`),
        type: "png",
        fullPage: true,
      });
    }
  } finally {
    await browser.close();
    server.close();
  }

  await fs.promises.writeFile(
    path.join(outputBase, "metrics.json"),
    JSON.stringify(metrics, null, 2),
    "utf8"
  );
  console.log("Saved:", outputBase);
}

await capture();
