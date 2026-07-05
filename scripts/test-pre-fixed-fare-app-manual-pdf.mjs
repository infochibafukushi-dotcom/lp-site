import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const REQUIRED_PAGE_IDS = [
  "cover",
  "purpose",
  "overall-flow",
  "step-01",
  "step-02",
  "step-03",
  "step-04",
  "reservation-save",
  "admin-confirm",
  "driver-select",
  "operation-start",
  "meter-operation",
  "route-change",
  "settlement",
  "receipt-pdf",
  "checklist"
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

function assert(condition, message){
  if(!condition){
    throw new Error(message);
  }
}

async function main(){
  const executablePath = resolveChromeExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"]
  });

  try{
    const page = await browser.newPage();
    await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 60000 });

    const buttonExists = await page.evaluate(function(){
      return Boolean(document.getElementById("preFixedFareAppManualExportBtn"));
    });
    assert(buttonExists, "preFixedFareAppManualExportBtn が見つかりません");

    const moduleCheck = await page.evaluate(async function(pageIds){
      const data = window.PreFixedFareAppManualData?.buildReportData?.();
      const qrDataUrls = {};
      const qrItems = data?.qrItems || [];
      for(const item of qrItems){
        const url = window.PreFixedFareAppManualData.resolveManualUrl(item.urlKey);
        qrDataUrls[item.id] = await window.EstimateQr.toDataUrl(url, 120);
      }
      const html = window.PreFixedFareAppManualPdf?.buildReportHtml?.(data, { qrDataUrls: qrDataUrls });
      const container = document.createElement("div");
      container.innerHTML = html;
      const pages = container.querySelectorAll(".manual-page");
      const pageIdList = Array.from(pages).map(function(el){ return el.getAttribute("data-page-id"); });
      const missing = pageIds.filter(function(id){ return !pageIdList.includes(id); });
      return {
        pdfFilename: window.PreFixedFareAppManualPdf?.PDF_FILENAME || "",
        title: data?.title || "",
        pageCount: pages.length,
        pageIds: pageIdList,
        missing: missing,
        hasDemoNote: String(html || "").includes("審査用QRから操作した予約データ"),
        hasQrEstimate: String(html || "").includes("かんたん見積～予約実践"),
        hasQrOperation: String(html || "").includes("運行中のメーター操作"),
        hasChecklist: String(html || "").includes("認可説明チェックリスト"),
        screenEvidenceBtn: Boolean(document.getElementById("preFixedFareScreenEvidenceExportBtn")),
        reportBtn: Boolean(document.getElementById("preFixedFareReportExportBtn"))
      };
    }, REQUIRED_PAGE_IDS);

    assert(
      moduleCheck.pdfFilename === "pre-fixed-fare-app-operation-manual.pdf",
      "PDF_FILENAME が不正: " + moduleCheck.pdfFilename
    );
    assert(moduleCheck.pageCount === 16, "ページ数が不正: " + moduleCheck.pageCount);
    assert(moduleCheck.missing.length === 0, "不足ページ: " + moduleCheck.missing.join(", "));
    assert(moduleCheck.hasDemoNote, "デモ予約区別の文言がありません");
    assert(moduleCheck.hasQrEstimate, "QR①タイトルがありません");
    assert(moduleCheck.hasQrOperation, "QR②タイトルがありません");
    assert(moduleCheck.hasChecklist, "チェックリストがありません");
    assert(moduleCheck.screenEvidenceBtn, "既存の画面証跡ボタンが壊れています");
    assert(moduleCheck.reportBtn, "既存の認可説明資料ボタンが壊れています");

    const annotationCheck = await page.evaluate(async function(){
      const data = window.PreFixedFareAppManualData.buildReportData();
      const screenshots = [];
      (data.steps || []).forEach(function(step){
        if(step.screenshot && step.screenshot.imageSrc){
          screenshots.push(step.screenshot);
        }
      });
      (data.contentPages || []).forEach(function(pageItem){
        if(pageItem.screenshot && pageItem.screenshot.imageSrc){
          screenshots.push(pageItem.screenshot);
        }
      });
      const availability = await window.PreFixedFareAppManualPdf.probeImages(screenshots);
      const html = window.PreFixedFareAppManualPdf.buildReportHtml(data, { imageAvailability: availability });
      const availableCount = Object.values(availability).filter(Boolean).length;
      return {
        hasAnnotations: html.includes("manual-annotation"),
        availableCount: availableCount,
        screenshotCount: screenshots.length
      };
    });
    assert(annotationCheck.hasAnnotations, "赤枠 annotations がありません");
    assert(annotationCheck.availableCount === annotationCheck.screenshotCount, "スクショ未配置: " + annotationCheck.availableCount + "/" + annotationCheck.screenshotCount);

    const consoleErrors = [];
    page.on("console", function(msg){
      if(msg.type() === "error"){
        consoleErrors.push(msg.text());
      }
    });

    const pdfResult = await page.evaluate(async function(){
      try{
        const result = await window.PreFixedFareAppManualPdf.generatePreFixedFareAppManualPdf();
        return { ok: true, pageCount: result?.pageCount || 0 };
      }catch(error){
        return { ok: false, message: String(error?.message || error) };
      }
    });
    assert(pdfResult.ok, "PDF生成失敗: " + pdfResult.message);
    assert(pdfResult.pageCount === 16, "PDF生成ページ数が不正: " + pdfResult.pageCount);
    assert(consoleErrors.length === 0, "console error: " + consoleErrors.join(" | "));

    console.log("PASS pre-fixed-fare app manual PDF tests");
    console.log(JSON.stringify(moduleCheck, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
