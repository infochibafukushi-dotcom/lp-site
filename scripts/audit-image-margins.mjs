import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

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
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || "/").split("?")[0]);
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

const { server, port } = await startServer();
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 90000 });
await page.waitForFunction(() => document.querySelectorAll("section.section").length >= 5, { timeout: 30000 });
await page.evaluate(() => {
  try {
    sessionStorage.setItem("lp_popup_dismissed", "1");
  } catch (e) {}
  document.getElementById("sitePopupOverlay")?.remove();
});

const report = await page.evaluate(() => {
  function analyzeImg(img, label) {
    if (!img) return { label, missing: true };
    const cs = getComputedStyle(img);
    const rect = img.getBoundingClientRect();
    const parent = img.parentElement;
    const parentRect = parent?.getBoundingClientRect();
    return {
      label,
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      naturalAspect: img.naturalWidth && img.naturalHeight ? +(img.naturalWidth / img.naturalHeight).toFixed(3) : null,
      computedWidth: Math.round(rect.width),
      computedHeight: Math.round(rect.height),
      cssWidth: cs.width,
      cssHeight: cs.height,
      maxWidth: cs.maxWidth,
      minWidth: cs.minWidth,
      objectFit: cs.objectFit,
      objectPosition: cs.objectPosition,
      display: cs.display,
      margin: cs.margin,
      background: cs.backgroundColor,
      parentWidth: parentRect ? Math.round(parentRect.width) : null,
      parentTag: parent?.className || parent?.tagName,
      widthFillPct: parentRect && parentRect.width ? Math.round((rect.width / parentRect.width) * 1000) / 10 : null,
      scaleFromNaturalPct: img.naturalWidth ? Math.round((rect.width / img.naturalWidth) * 1000) / 10 : null,
      boxVsNaturalWidthGap: img.naturalWidth ? img.naturalWidth - rect.width : null,
    };
  }

  const hero = document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .slider-slide img");
  const normal = document.querySelector("#vehicle-introduction-capacity .normal-image");
  const card = document.querySelector("#reason-chiba-care-taxi .card-grid-3 .card-item img");
  const cardItem = document.querySelector("#reason-chiba-care-taxi .card-grid-3 .card-item");
  const sliderShell = document.querySelector("#chiba-city-24h-365days-kaigo-taxi-chibakeatakushi .slider-window");

  const cardCs = cardItem ? getComputedStyle(cardItem) : null;
  const shellRect = sliderShell?.getBoundingClientRect();

  return {
    viewport: window.innerWidth,
    hero: analyzeImg(hero, "slider-slide img"),
    sliderWindowWidth: shellRect ? Math.round(shellRect.width) : null,
    normal: analyzeImg(normal, "normal-image"),
    cardImg: analyzeImg(card, "card-item img"),
    cardItemWidth: cardItem ? Math.round(cardItem.getBoundingClientRect().width) : null,
    cardItemPadding: cardCs?.padding,
    cardInnerImageArea: cardItem ? Math.round(cardItem.getBoundingClientRect().width - parseFloat(cardCs.paddingLeft) - parseFloat(cardCs.paddingRight)) : null,
  };
});

await browser.close();
server.close();

console.log(JSON.stringify(report, null, 2));
