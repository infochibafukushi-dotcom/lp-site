import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "screenshots", "pdf-layout");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const PREVIEW_PATCH = `
  async function buildPreviewElement(data){
    const defaultLayout = getDefaultLayout();
    const qrDataUrls = await resolveQrDataUrls(data.pdfFooter, defaultLayout.footerQrSize);
    const measured = measureContentHeight(data, qrDataUrls);
    return buildPdfElement(data, measured.layout, qrDataUrls);
  }
`;

function writeBeforePdfModule(){
  let source = execSync("git show HEAD:estimate/estimate-pdf.js", {
    cwd: rootDir,
    encoding: "utf8"
  });
  if(!source.includes("buildPreviewElement")){
    source = source.replace(
      "  global.EstimatePdf = {",
      PREVIEW_PATCH + "\n  global.EstimatePdf = {"
    ).replace(
      "    savePdf: savePdf,",
      "    savePdf: savePdf,\n    buildPreviewElement: buildPreviewElement,"
    );
  }
  fs.writeFileSync(path.join(rootDir, "estimate", "estimate-pdf.before.js"), source, "utf8");
}

function startServer(){
  return new Promise(function(resolve){
    const server = http.createServer(function(req, res){
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(rootDir, safePath === path.sep ? "index.html" : safePath);
      if(!filePath.startsWith(rootDir)){
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.readFile(filePath, function(err, data){
        if(err){
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", function(){
      resolve({ server, port: server.address().port });
    });
  });
}

async function waitForReady(page){
  await page.waitForSelector("[data-pdf-ready='1']", { timeout: 30000 });
  await page.waitForFunction(function(){
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs.every(function(img){ return img.complete && img.naturalWidth > 0; });
  }, { timeout: 30000 });
  await new Promise(function(resolve){ setTimeout(resolve, 400); });
}

async function captureCompare(page, port, mode, filename){
  const heights = { full: 1300, breakdown: 520, total: 420, qr: 520 };
  await page.setViewport({ width: 1800, height: heights[mode] || 900, deviceScaleFactor: 1 });
  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-compare.html?mode=" + mode, {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  await waitForReady(page);
  await page.screenshot({ path: path.join(outputDir, filename), type: "png", fullPage: true });
}

async function captureSingleA4(page, port, version, filename){
  await page.setViewport({ width: 860, height: 1200, deviceScaleFactor: 1 });
  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-preview-single.html?mode=full&version=" + version, {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  await waitForReady(page);
  const sheet = await page.$("#a4Sheet");
  if(!sheet){
    throw new Error("A4 sheet not found for " + version);
  }
  await sheet.screenshot({ path: path.join(outputDir, filename), type: "png" });
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  writeBeforePdfModule();

  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });

  try{
    const page = await browser.newPage();

    await captureSingleA4(page, port, "after", "01-pc-full-a4-after.png");
    await captureSingleA4(page, port, "before", "01-pc-full-a4-before.png");
    await captureCompare(page, port, "full", "01-pc-full-a4-compare.png");
    await captureCompare(page, port, "breakdown", "02-breakdown-compare.png");
    await captureCompare(page, port, "total", "03-total-compare.png");
    await captureCompare(page, port, "qr", "04-qr-compare.png");

    console.log("Comparison screenshots saved to:", outputDir);
  }finally{
    await browser.close();
    await new Promise(function(resolve){ server.close(resolve); });
  }
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
