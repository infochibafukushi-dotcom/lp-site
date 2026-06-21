import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  await page.waitForSelector("[data-pdf-ready='1']", { timeout: 60000 });
  await page.waitForFunction(function(){
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs.every(function(img){ return img.complete && img.naturalWidth > 0; });
  }, { timeout: 60000 });
  await new Promise(function(resolve){ setTimeout(resolve, 400); });
}

async function captureA4(page, port, preset, filename){
  await page.setViewport({ width: 860, height: 1200, deviceScaleFactor: 1 });
  const query = "mode=full&version=after&preset=" + preset;
  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-preview-single.html?" + query, {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  await waitForReady(page);
  const sheet = await page.$("#a4Sheet");
  if(!sheet) throw new Error("A4 sheet not found: " + preset);
  await sheet.screenshot({ path: path.join(outputDir, filename), type: "png" });
}

async function captureZoom(page, port, mode, filename){
  await page.setViewport({ width: 1000, height: 900, deviceScaleFactor: 1 });
  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-preview-single.html?mode=" + mode + "&version=after&preset=standard", {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  await waitForReady(page);
  const wrap = await page.$("#zoomWrap");
  if(!wrap) throw new Error("Zoom wrap not found: " + mode);
  await wrap.screenshot({ path: path.join(outputDir, filename), type: "png" });
}

async function captureMobile(page, port, filename){
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-preview.html?viewport=mobile", {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  await waitForReady(page);
  await page.screenshot({ path: path.join(outputDir, filename), type: "png", fullPage: true });
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });

  try{
    const page = await browser.newPage();
    await captureA4(page, port, "standard", "01-pc-full-a4.png");
    await captureA4(page, port, "few", "01b-pc-full-a4-few-items.png");
    await captureA4(page, port, "many", "01c-pc-full-a4-many-items.png");
    await captureZoom(page, port, "breakdown", "02-breakdown-zoom.png");
    await captureZoom(page, port, "total", "03-total-zoom.png");
    await captureZoom(page, port, "qr", "04-qr-zoom.png");
    await captureMobile(page, port, "05-mobile-preview.png");
    console.log("Review screenshots saved to:", outputDir);
  }finally{
    await browser.close();
    await new Promise(function(resolve){ server.close(resolve); });
  }
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
