import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, "assets", "manual", "pre-fixed-fare");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true
};

const DESKTOP_VIEWPORT = {
  width: 1366,
  height: 900,
  deviceScaleFactor: 1
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const TARGETS = [
  {
    file: "estimate-step-01.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=estimate-step-01",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=estimate-step-01"
  },
  {
    file: "estimate-step-02.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=estimate-step-02",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=estimate-step-02"
  },
  {
    file: "estimate-step-03.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=estimate-step-03",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=estimate-step-03"
  },
  {
    file: "estimate-step-04.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=estimate-step-04",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=estimate-step-04"
  },
  {
    file: "reservation-save.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=reservation-save",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=reservation-save"
  },
  {
    file: "admin-confirm.png",
    urlPath: "/manual/pre-fixed-fare-admin-demo.html",
    viewport: DESKTOP_VIEWPORT,
    source: "manual/pre-fixed-fare-admin-demo.html"
  },
  {
    file: "driver-select.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=driver-select",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=driver-select"
  },
  {
    file: "operation-start.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=operation-start",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=operation-start"
  },
  {
    file: "meter-operation.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=meter-operation",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=meter-operation"
  },
  {
    file: "route-change.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=route-change",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=route-change"
  },
  {
    file: "settlement.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=settlement",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=settlement"
  },
  {
    file: "receipt-pdf.png",
    urlPath: "/manual/pre-fixed-fare-demo-screens.html?screen=receipt-pdf",
    viewport: MOBILE_VIEWPORT,
    source: "manual/pre-fixed-fare-demo-screens.html?screen=receipt-pdf"
  }
];

function resolveChromeExecutable(){
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    DEFAULT_CHROME,
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  return candidates.find(function(candidate){
    return fs.existsSync(candidate);
  }) || null;
}

function startServer(){
  return new Promise(function(resolve){
    const server = http.createServer(function(req, res){
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(rootDir, safePath === path.sep ? "index.html" : safePath.replace(/^\//, ""));
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

async function captureTarget(page, baseUrl, target){
  await page.setViewport(target.viewport);
  await page.goto(baseUrl + target.urlPath, {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  await page.waitForSelector('[data-capture-ready="1"]', { timeout: 15000 });
  await page.waitForSelector("#capture-root", { timeout: 15000 });
  await new Promise(function(resolve){ setTimeout(resolve, 300); });

  const outputPath = path.join(outputDir, target.file);
  const clip = await page.evaluate(function(){
    const root = document.getElementById("capture-root");
    if(!root){
      return null;
    }
    const rect = root.getBoundingClientRect();
    return {
      x: Math.max(0, Math.floor(rect.x)),
      y: Math.max(0, Math.floor(rect.y)),
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height)
    };
  });

  if(!clip || clip.width <= 0 || clip.height <= 0){
    throw new Error("capture root not found for " + target.file);
  }

  await page.screenshot({
    path: outputPath,
    type: "png",
    clip: clip
  });

  return {
    file: target.file,
    source: target.source,
    bytes: fs.statSync(outputPath).size
  };
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  const { server, port } = await startServer();
  const baseUrl = "http://127.0.0.1:" + port;
  const executablePath = resolveChromeExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const results = [];
  try{
    const page = await browser.newPage();
    for(const target of TARGETS){
      console.log("capturing", target.file, "from", target.source);
      results.push(await captureTarget(page, baseUrl, target));
    }
  }finally{
    await browser.close();
    await new Promise(function(resolve){ server.close(resolve); });
  }

  console.log("Saved screenshots to:", outputDir);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
