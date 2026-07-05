import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pdfPath = path.join(rootDir, "docs/submission/20260705/pre-fixed-fare-submission-full-set-v1-candidate.pdf");
const outDir = path.join(rootDir, ".tmp-pdf-visual-review");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const PARTS = [
  { label: "申請書様式2", start: 1, pages: 1 },
  { label: "画面証跡", start: 2, pages: 7 },
  { label: "統合説明", start: 9, pages: 40 },
  { label: "運用フロー", start: 49, pages: 14 },
  { label: "Q&A", start: 63, pages: 4 },
  { label: "別紙セット", start: 67, pages: 15 }
];

const P5_REQUIRED = [
  "090-6331-4289",
  "260705-MAINS-0001",
  "28,000",
  "35分",
  "43.1km"
];

function resolveChromeExecutable(){
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    DEFAULT_CHROME,
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  return candidates.find(function(candidate){ return fs.existsSync(candidate); }) || null;
}

function buildReviewerHtml(pdfUrl, pageNumbers){
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
body{margin:0;padding:12px;background:#e5e7eb;font-family:sans-serif;}
.page-card{margin:0 0 16px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15);padding:8px;}
.page-card h2{margin:0 0 8px;font-size:14px;color:#111827;}
canvas{display:block;max-width:100%;height:auto;border:1px solid #d1d5db;}
.text-panel{margin-top:8px;font-size:11px;line-height:1.45;color:#374151;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;background:#f9fafb;padding:8px;border:1px solid #e5e7eb;}
</style></head><body>
<div id="root"></div>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const pdfUrl = ${JSON.stringify(pdfUrl)};
const pageNumbers = ${JSON.stringify(pageNumbers)};
(async function(){
  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  const root = document.getElementById("root");
  const results = [];
  for (const pageNum of pageNumbers) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    const textContent = await page.getTextContent();
    const text = textContent.items.map(function(item){ return item.str; }).join(" ").replace(/\\s+/g, " ").trim();
    const card = document.createElement("div");
    card.className = "page-card";
    card.id = "page-" + pageNum;
    const title = document.createElement("h2");
    title.textContent = "Page " + pageNum + " / " + pdf.numPages;
    card.appendChild(title);
    card.appendChild(canvas);
    const panel = document.createElement("div");
    panel.className = "text-panel";
    panel.textContent = text.slice(0, 2500);
    card.appendChild(panel);
    root.appendChild(card);
    results.push({ pageNum: pageNum, text: text, width: viewport.width, height: viewport.height });
  }
  window.__PDF_REVIEW__ = { totalPages: pdf.numPages, pages: results };
})();
</script></body></html>`;
}

function pickReviewPages(totalPages){
  const pages = new Set([1, 2, 3, 7, 8, totalPages]);
  PARTS.forEach(function(part){
    pages.add(part.start);
    pages.add(part.start + part.pages - 1);
    const mid = part.start + Math.floor(part.pages / 2);
    pages.add(mid);
  });
  for(let page = 10; page <= 46; page += 4){
    pages.add(page);
  }
  for(let page = 48; page <= 61; page += 3){
    pages.add(page);
  }
  for(let page = 66; page <= 80; page += 2){
    pages.add(page);
  }
  return Array.from(pages).filter(function(n){ return n >= 1 && n <= totalPages; }).sort(function(a, b){ return a - b; });
}

async function main(){
  if(!fs.existsSync(pdfPath)){
    throw new Error("PDF not found: " + pdfPath);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"]
  };
  const chromePath = resolveChromeExecutable();
  if(chromePath){
    launchOptions.executablePath = chromePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  try{
    const page = await browser.newPage();
    await page.setViewport({ width: 920, height: 1400, deviceScaleFactor: 1 });

    const probePage = await browser.newPage();
    const probeHtml = buildReviewerHtml(pathToFileURL(pdfPath).href, [1]);
    const probeHtmlPath = path.join(outDir, "probe.html");
    fs.writeFileSync(probeHtmlPath, probeHtml, "utf8");
    await probePage.goto(pathToFileURL(probeHtmlPath).href, { waitUntil: "networkidle0", timeout: 180000 });
    await probePage.waitForFunction("window.__PDF_REVIEW__ && window.__PDF_REVIEW__.totalPages > 0", { timeout: 180000 });
    const totalPages = await probePage.evaluate(function(){ return window.__PDF_REVIEW__.totalPages; });
    await probePage.close();

    const reviewPages = pickReviewPages(totalPages);
    const reviewerHtml = buildReviewerHtml(pathToFileURL(pdfPath).href, reviewPages);
    const reviewerHtmlPath = path.join(outDir, "review.html");
    fs.writeFileSync(reviewerHtmlPath, reviewerHtml, "utf8");
    await page.goto(pathToFileURL(reviewerHtmlPath).href, { waitUntil: "networkidle0", timeout: 300000 });
    await page.waitForFunction(function(expected){
      return window.__PDF_REVIEW__ &&
        window.__PDF_REVIEW__.pages &&
        window.__PDF_REVIEW__.pages.length === expected;
    }, { timeout: 300000 }, reviewPages.length);

    const extracted = await page.evaluate(function(){
      return window.__PDF_REVIEW__;
    });

    for(const item of extracted.pages){
      const handle = await page.$("#page-" + item.pageNum);
      if(!handle) continue;
      await handle.screenshot({
        path: path.join(outDir, "page-" + String(item.pageNum).padStart(3, "0") + ".png"),
        type: "png"
      });
    }

    const orderChecks = PARTS.map(function(part){
      const page = extracted.pages.find(function(p){ return p.pageNum === part.start; });
      return {
        label: part.label,
        startPage: part.start,
        textSample: page ? page.text.slice(0, 180) : ""
      };
    });

    const p5 = extracted.pages.find(function(p){ return p.pageNum === 7; });
    const p5Text = p5 ? p5.text : "";
    const p5Checks = P5_REQUIRED.map(function(token){
      return { token: token, found: p5Text.includes(token) };
    });

    const capturePageHits = extracted.pages
      .filter(function(p){
        return /ルート選択|旅客同意|確定ルート|領収書|レシート|キャプチャ|画面/.test(p.text);
      })
      .map(function(p){ return { pageNum: p.pageNum, sample: p.text.slice(0, 160) }; });

    const report = {
      pdfPath: pdfPath,
      totalPages: totalPages,
      reviewedPages: reviewPages.length,
      orderChecks: orderChecks,
      p5Checks: p5Checks,
      p5TextSample: p5Text.slice(0, 500),
      capturePageHits: capturePageHits,
      screenshotDir: outDir
    };
    fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
