import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(
  rootDir,
  "assets/evidence/pre-fixed-fare-20260705/04_receipt_detail_202607050600.png"
);
const screenshotCopyPath = path.join(
  rootDir,
  "screenshots/pre-fixed-fare-approval-20260705/04_receipt_detail_202607050600.png"
);
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const RECEIPT_FIELDS = {
  phone: "090-6331-4289",
  projectNumber: "260705-MAINS-0001",
  preFixedFare: "28,000円",
  total: "28,000円",
  issuedAt: "2026/07/05 06:35",
  usedAt: "2026/07/05 06:00",
  usageTime: "35分",
  distance: "43.1km"
};

const RECEIPT_HTML = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><style>
html,body{margin:0;padding:0;background:#fff}
canvas{display:block}
</style></head><body><canvas id="c"></canvas><script>
const W=384,H=1200;
const canvas=document.getElementById("c");
canvas.width=W;canvas.height=H;
const ctx=canvas.getContext("2d");
ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
const font='"Yu Gothic UI","Yu Gothic",Meiryo,sans-serif';
let y=24;
function line(text,font,size,align="left",bold=false){
  ctx.font=(bold?"bold ":"")+size+"px "+font;
  ctx.fillStyle="#111827";
  ctx.textAlign=align;
  ctx.fillText(text, align==="center"?W/2:0, y);
  y += size + 8;
}
function divider(){ y += 6; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.strokeStyle="#111"; ctx.stroke(); ctx.setLineDash([]); y += 10; }
function labelAmount(label, amount, bold=false){
  ctx.font=(bold?"bold ":"")+"24px "+font; ctx.textAlign="left"; ctx.fillStyle="#111827";
  ctx.fillText(label, 0, y);
  ctx.textAlign="right"; ctx.fillText(amount, W, y);
  y += 32;
}
line("ちばケアタクシー",font,26,"left",true);
line("株式会社千葉福祉サポート",font,26);
line("〒260-0023",font,20);
line("千葉県千葉市中央区出洲港8-3-2",font,20);
line("TEL ${RECEIPT_FIELDS.phone}",font,20);
y += 8; divider();
line("領収書",font,32,"center",true);
divider();
line("発行日 ${RECEIPT_FIELDS.issuedAt}",font,18);
line("利用日 ${RECEIPT_FIELDS.usedAt}",font,18);
line("案件番号 ${RECEIPT_FIELDS.projectNumber}",font,18);
divider();
labelAmount("事前確定運賃","${RECEIPT_FIELDS.preFixedFare}");
divider();
labelAmount("合計","${RECEIPT_FIELDS.total}",true);
labelAmount("支払","現金");
labelAmount("内訳 現金","${RECEIPT_FIELDS.total}");
y += 8;
line("但し書き 介護タクシー利用料として",font,20);
line("発行担当者 山本",font,20);
line("ありがとうございました",font,20,"center",true);
divider();
line("ご利用時間 ${RECEIPT_FIELDS.usageTime}",font,18);
line("走行距離 ${RECEIPT_FIELDS.distance}",font,18);
divider();
window.__receiptFields = ${JSON.stringify(RECEIPT_FIELDS)};
<\/script></body></html>`;

async function run(){
  const launchOptions = { headless: true };
  if(fs.existsSync(DEFAULT_CHROME)){
    launchOptions.executablePath = DEFAULT_CHROME;
  }
  const browser = await puppeteer.launch(launchOptions);
  try{
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 1300, deviceScaleFactor: 2 });
    await page.setContent(RECEIPT_HTML, { waitUntil: "networkidle0" });
    const hasCanvas = await page.evaluate(function(){
      const canvas = document.getElementById("c");
      return Boolean(canvas && canvas.width === 384 && canvas.height === 1200);
    });
    if(!hasCanvas){
      throw new Error("Receipt canvas was not rendered");
    }
    const element = await page.$("canvas");
    await element.screenshot({ path: outputPath });
    const fields = await page.evaluate(function(){
      return window.__receiptFields || null;
    });
    if(!fields){
      throw new Error("Receipt field metadata was not rendered");
    }
    Object.keys(RECEIPT_FIELDS).forEach(function(key){
      if(fields[key] !== RECEIPT_FIELDS[key]){
        throw new Error("Receipt field mismatch: " + key);
      }
    });
    fs.mkdirSync(path.dirname(screenshotCopyPath), { recursive: true });
    fs.copyFileSync(outputPath, screenshotCopyPath);
    console.log("Rendered:", outputPath);
    console.log("Copied:", screenshotCopyPath);
    console.log("Receipt fields:", JSON.stringify(RECEIPT_FIELDS));
  }finally{
    await browser.close();
  }
}

run().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
