import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const INK_THRESHOLD = 0.002;

function resolveChromeExecutable(){
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    DEFAULT_CHROME,
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  return candidates.find(function(candidate){ return fs.existsSync(candidate); }) || null;
}

export async function verifyPdfBlankPages(browser, pdfPath){
  const page = await browser.newPage();
  const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
  const result = await page.evaluate(async function(base64, threshold){
    await new Promise(function(resolve, reject){
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for(let i = 0; i < binary.length; i++){
      bytes[i] = binary.charCodeAt(i);
    }
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const inkRatios = [];
    const pageTexts = [];
    for(let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++){
      const pdfPage = await doc.getPage(pageNumber);
      const textContent = await pdfPage.getTextContent();
      pageTexts.push(textContent.items.map(function(item){ return item.str; }).join(" "));
      const viewport = pdfPage.getViewport({ scale: 0.4 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for(let i = 0; i < imageData.length; i += 4){
        if(imageData[i] < 200 || imageData[i + 1] < 200 || imageData[i + 2] < 200){
          dark++;
        }
      }
      inkRatios.push(dark / (canvas.width * canvas.height));
    }
    const blankPages = inkRatios.map(function(ratio, index){
      return ratio < threshold ? index + 1 : null;
    }).filter(Boolean);
    return {
      numPages: doc.numPages,
      inkRatios: inkRatios,
      blankPages: blankPages,
      pageTexts: pageTexts
    };
  }, pdfBase64, INK_THRESHOLD);
  await page.close();
  return result;
}

async function main(){
  const pdfPath = process.argv[2];
  if(!pdfPath){
    throw new Error("Usage: node scripts/verify-pdf-blank-pages.mjs <pdf-path>");
  }
  const resolved = path.resolve(pdfPath);
  if(!fs.existsSync(resolved)){
    throw new Error("PDF not found: " + resolved);
  }

  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  };
  const chromePath = resolveChromeExecutable();
  if(chromePath){
    launchOptions.executablePath = chromePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  try{
    const result = await verifyPdfBlankPages(browser, resolved);
    console.log(JSON.stringify(result, null, 2));
    if(result.blankPages.length > 0){
      process.exitCode = 1;
    }
  }finally{
    await browser.close();
  }
}

if(process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])){
  main().catch(function(error){
    console.error(error);
    process.exitCode = 1;
  });
}
