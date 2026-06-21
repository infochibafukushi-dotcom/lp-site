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
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
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
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function captureViewport(browser, port, viewport, filename){
  const page = await browser.newPage();
  const width = viewport === "mobile" ? 375 : 1280;
  const height = viewport === "mobile" ? 812 : 900;
  await page.setViewport({ width, height, deviceScaleFactor: viewport === "mobile" ? 2 : 1 });
  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-preview.html?viewport=" + viewport, {
    waitUntil: "networkidle0",
    timeout: 30000
  });
  await page.waitForSelector("[data-pdf-ready='1']", { timeout: 30000 });
  await page.waitForFunction(function(){
    const imgs = Array.from(document.querySelectorAll(".estimate-pdf-source img"));
    return imgs.every(function(img){ return img.complete && img.naturalWidth > 0; });
  }, { timeout: 30000 });
  await new Promise(function(resolve){ setTimeout(resolve, 300); });

  await page.screenshot({ path: path.join(outputDir, filename), type: "png", fullPage: true });
  await page.close();
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });

  try{
    await captureViewport(browser, port, "desktop", "pdf-preview-desktop.png");
    await captureViewport(browser, port, "mobile", "pdf-preview-mobile.png");
    console.log("Screenshots saved to:", outputDir);
  }finally{
    await browser.close();
    await new Promise(function(resolve){ server.close(resolve); });
  }
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
