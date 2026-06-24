import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "screenshots", "special-vehicle-fee");

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

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600 });

  await page.goto("http://127.0.0.1:" + port + "/admin.html", { waitUntil: "networkidle0" });
  await page.click('a[href="#card-estimate-settings"]');
  await page.waitForSelector('[data-estimate-path="basicFees.specialVehicleFee.amount"]', { timeout: 15000 });
  const feeHandle = await page.$('[data-estimate-path="basicFees.specialVehicleFee.amount"]');
  if(feeHandle){
    await feeHandle.evaluate((el) => el.scrollIntoView({ block: "center" }));
  }
  await new Promise(function(resolve){ setTimeout(resolve, 300); });
  await page.screenshot({ path: path.join(outputDir, "admin-special-vehicle-fee.png") });

  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-layout-test.html", {
    waitUntil: "networkidle0"
  });
  await page.screenshot({ path: path.join(outputDir, "estimate-result-special-vehicle-fee.png"), fullPage: true });

  await browser.close();
  server.close();
  console.log("Screenshots saved to", outputDir);
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
