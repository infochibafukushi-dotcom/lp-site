import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const imagePath = path.join(
  rootDir,
  "assets/evidence/pre-fixed-fare-20260705/05_meter_reservation_detail_202607050600.png"
);
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const HIGHLIGHT_STYLE = {
  stroke: "#dc2626",
  fill: "rgba(220,38,38,0.04)",
  lineWidth: 4
};

// Coordinates tuned against 780x3654 mobile reservation detail capture.
const HIGHLIGHT_BOXES = [
  {
    id: "basic-info",
    x: 28,
    y: 1188,
    width: 724,
    height: 600,
    label: "予約ID・事前確定M"
  },
  {
    id: "itinerary",
    x: 28,
    y: 2478,
    width: 724,
    height: 890,
    label: "出発地・目的地"
  },
  {
    id: "fixed-fare",
    x: 28,
    y: 3378,
    width: 724,
    height: 170,
    label: "確定運賃"
  }
];

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

async function annotateImage(browser){
  const page = await browser.newPage();
  const imageUrl = pathToFileURL(imagePath).href;
  await page.goto("about:blank");
  await page.setContent("<!DOCTYPE html><html><body style='margin:0;background:#fff'></body></html>");

  const result = await page.evaluate(async function(imageSrc, boxes, style){
    const img = new Image();
    img.src = imageSrc;
    await new Promise(function(resolve, reject){
      img.onload = resolve;
      img.onerror = function(){ reject(new Error("画像の読み込みに失敗しました")); };
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    boxes.forEach(function(box){
      ctx.save();
      ctx.strokeStyle = style.stroke;
      ctx.fillStyle = style.fill;
      ctx.lineWidth = style.lineWidth;
      ctx.strokeRect(box.x + style.lineWidth / 2, box.y + style.lineWidth / 2, box.width - style.lineWidth, box.height - style.lineWidth);
      ctx.fillRect(box.x + style.lineWidth / 2, box.y + style.lineWidth / 2, box.width - style.lineWidth, box.height - style.lineWidth);
      ctx.restore();
    });

    return {
      width: canvas.width,
      height: canvas.height,
      dataUrl: canvas.toDataURL("image/png")
    };
  }, imageUrl, HIGHLIGHT_BOXES, HIGHLIGHT_STYLE);

  const base64 = String(result.dataUrl || "").replace(/^data:image\/png;base64,/, "");
  assert(base64.length > 1000, "annotated image export failed");
  fs.writeFileSync(imagePath, Buffer.from(base64, "base64"));
  return result;
}

async function main(){
  assert(fs.existsSync(imagePath), "target image missing: " + imagePath);
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
    const result = await annotateImage(browser);
    const redCount = await browser.newPage().then(async function(page){
      await page.goto("about:blank");
      return page.evaluate(function(dataUrl){
        return new Promise(function(resolve, reject){
          const img = new Image();
          img.onload = function(){
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            let count = 0;
            for(let y = 0; y < canvas.height; y++){
              for(let x = 0; x < canvas.width; x++){
                const data = ctx.getImageData(x, y, 1, 1).data;
                if(data[0] > 190 && data[1] < 80 && data[2] < 80 && (data[0] - data[1]) > 80){
                  count++;
                }
              }
            }
            resolve(count);
          };
          img.onerror = reject;
          img.src = dataUrl;
        });
      }, "data:image/png;base64," + fs.readFileSync(imagePath).toString("base64"));
    });

    console.log("Annotated:", imagePath);
    console.log("Size:", result.width + "x" + result.height, fs.statSync(imagePath).size, "bytes");
    console.log("Red pixel count:", redCount);
    console.log("Boxes:", HIGHLIGHT_BOXES.map(function(box){ return box.id + "@" + box.x + "," + box.y + "," + box.width + "x" + box.height; }).join("; "));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
