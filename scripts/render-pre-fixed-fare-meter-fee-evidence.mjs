import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const meterDir = path.resolve(rootDir, "../care-taxi-meter");
const evidenceDir = path.join(rootDir, "assets/evidence/pre-fixed-fare-20260705");
const outputPath = path.join(evidenceDir, "06_meter_service_fee_dispatch_202607050600.png");
const sourceReservationPath = path.join(
  rootDir,
  "screenshots/pre-fixed-fare-approval-20260705/03b_fixed_fare_meter_202607050600.png"
);
const reservationCopyPath = path.join(evidenceDir, "05_meter_reservation_detail_202607050600.png");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function resolveChromeExecutable(){
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    DEFAULT_CHROME,
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  return candidates.find(function(candidate){ return fs.existsSync(candidate); }) || null;
}

function assert(condition, message){
  if(!condition){
    throw new Error(message);
  }
}

function copyReservationEvidence(){
  assert(fs.existsSync(sourceReservationPath), "予約詳細証跡画像が見つかりません: " + sourceReservationPath);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.copyFileSync(sourceReservationPath, reservationCopyPath);
}

async function waitForServer(url, timeoutMs){
  const start = Date.now();
  while(Date.now() - start < timeoutMs){
    try{
      const response = await fetch(url, { method: "GET" });
      if(response.ok){
        return;
      }
    }catch(error){
      // retry
    }
    await new Promise(function(resolve){ setTimeout(resolve, 500); });
  }
  throw new Error("メーターアプリのプレビューサーバー起動待ちがタイムアウトしました: " + url);
}

async function captureDispatchModal(){
  if(!fs.existsSync(meterDir)){
    throw new Error("care-taxi-meter リポジトリが見つかりません: " + meterDir);
  }

  const preview = spawn(
    process.execPath,
    ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
    {
      cwd: meterDir,
      stdio: "ignore",
      shell: false
    }
  );

  const previewUrl = "http://127.0.0.1:4174/care-taxi-meter/case";
  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  };
  const chromePath = resolveChromeExecutable();
  if(chromePath){
    launchOptions.executablePath = chromePath;
  }

  try{
    await waitForServer("http://127.0.0.1:4174/care-taxi-meter/", 120000);
    const browser = await puppeteer.launch(launchOptions);
    try{
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      await page.goto(previewUrl, { waitUntil: "networkidle0", timeout: 120000 });
      await page.waitForSelector(".r9-status-button--pickup", { timeout: 60000 });
      await page.click(".r9-status-button--pickup");
      await page.waitForSelector("#dispatch-modal-title", { timeout: 30000 });
      await page.waitForFunction(function(){
        const buttons = Array.from(document.querySelectorAll(".r9-modal-choice strong"));
        return buttons.some(function(node){
          return (node.textContent || "").includes("800");
        });
      }, { timeout: 30000 });
      const modal = await page.$(".settings-modal.r9-operation-modal");
      assert(modal, "予約迎車モーダルが見つかりません");
      await modal.screenshot({ path: outputPath });
      const text = await page.evaluate(function(){
        return document.body.innerText || "";
      });
      assert(text.includes("予約迎車"), "予約迎車モーダル文言がありません");
      assert(text.includes("800"), "迎車料800円の表示がありません");
      assert(text.includes("1,000") || text.includes("1000"), "特殊車両1,000円の表示がありません");
      assert(!text.includes("600円"), "600円表示が残っています");
    }finally{
      await browser.close();
    }
  }finally{
    preview.kill("SIGTERM");
  }
}

async function main(){
  copyReservationEvidence();
  if(!fs.existsSync(path.join(meterDir, "dist/index.html"))){
    throw new Error("care-taxi-meter の dist が未ビルドです。先に npm run build を実行してください。");
  }
  await captureDispatchModal();
  assert(fs.existsSync(outputPath), "補足用メーター画面証跡の保存に失敗しました");
  assert(fs.statSync(outputPath).size > 10000, "補足用メーター画面証跡のサイズが小さすぎます");
  console.log("OK", reservationCopyPath);
  console.log("OK", outputPath);
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
