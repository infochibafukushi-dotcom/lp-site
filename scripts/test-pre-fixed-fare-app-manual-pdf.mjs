import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const operationManualPath = path.join(rootDir, "manual", "pre-fixed-fare-operation.html");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EXPECTED_PAGE_COUNT = 17;

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
  "route-change-operation",
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
  const consoleErrors = [];

  try{
    const page = await browser.newPage();
    page.on("console", function(msg){
      if(msg.type() === "error"){
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", function(error){
      consoleErrors.push(String(error.message || error));
    });

    await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 60000 });

    const buttonExists = await page.evaluate(function(){
      return Boolean(document.getElementById("preFixedFareAppManualExportBtn"));
    });
    assert(buttonExists, "preFixedFareAppManualExportBtn が見つかりません");

    const moduleCheck = await page.evaluate(async function(pageIds, expectedPageCount){
      const data = window.PreFixedFareAppManualData?.buildReportData?.();
      const qrDataUrls = {};
      const qrItems = data?.qrItems || [];
      for(const item of qrItems){
        const url = window.PreFixedFareAppManualData.resolveManualUrl(item.urlKey);
        qrDataUrls[item.id] = await window.EstimateQr.toDataUrl(url, 120);
      }
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
      const imageAvailability = await window.PreFixedFareAppManualPdf.probeImages(screenshots);
      const html = window.PreFixedFareAppManualPdf?.buildReportHtml?.(data, {
        qrDataUrls: qrDataUrls,
        imageAvailability: imageAvailability
      });
      const container = document.createElement("div");
      container.innerHTML = html;
      const pages = container.querySelectorAll(".manual-page");
      const pageIdList = Array.from(pages).map(function(el){ return el.getAttribute("data-page-id"); });
      const missing = pageIds.filter(function(id){ return !pageIdList.includes(id); });
      const routeChangePage = container.querySelector(".manual-page[data-page-id='route-change']");
      const routeChangeOperationPage = container.querySelector(".manual-page[data-page-id='route-change-operation']");
      const coverHtml = container.querySelector(".manual-page[data-page-id='cover']")?.innerHTML || "";
      return {
        pdfFilename: window.PreFixedFareAppManualPdf?.PDF_FILENAME || "",
        expectedPageCount: window.PreFixedFareAppManualPdf?.EXPECTED_PAGE_COUNT || 0,
        title: data?.title || "",
        pageCount: pages.length,
        pageIds: pageIdList,
        missing: missing,
        hasDemoNote: String(html || "").includes("審査用QRから操作した予約データ"),
        hasDemoScreenNote: String(html || "").includes("審査用デモ画面です"),
        hasEdition: String(html || "").includes("第1版") && String(html || "").includes("令和8年7月5日"),
        hasQrReviewNote: String(html || "").includes("審査用QRからの操作は、実予約と区別して管理する想定です"),
        hasQrEstimate: String(html || "").includes("かんたん見積～予約実践"),
        hasQrOperation: String(html || "").includes("運行中のメーター操作"),
        hasChecklist: String(html || "").includes("認可説明チェックリスト"),
        coverQrCount: container.querySelectorAll(".cover-qr-image").length,
        coverHasLongUrl: /https?:\/\//.test(coverHtml),
        coverHasCaption: coverHtml.includes("cover-qr-caption"),
        coverHasDemoNote: coverHtml.includes("審査用デモモードを開きます"),
        coverHasOperationNote: coverHtml.includes("運行操作説明ページを開きます"),
        routeChangeHasTable: Boolean(routeChangePage?.querySelector("table")),
        routeChangeHasScreenshot: Boolean(routeChangePage?.querySelector(".manual-screenshot-img")),
        routeChangeOperationHasScreenshot: Boolean(routeChangeOperationPage?.querySelector(".manual-screenshot-img")),
        routeChangeOperationHasTable: Boolean(routeChangeOperationPage?.querySelector("table")),
        mobileFrameCount: container.querySelectorAll(".manual-screenshot-frame.is-mobile").length,
        desktopFrameCount: container.querySelectorAll(".manual-screenshot-frame.is-desktop").length,
        containCss: String(window.PreFixedFareAppManualPdf?.getManualCss?.() || "").includes("object-fit:contain"),
        screenEvidenceBtn: Boolean(document.getElementById("preFixedFareScreenEvidenceExportBtn")),
        reportBtn: Boolean(document.getElementById("preFixedFareReportExportBtn"))
      };
    }, REQUIRED_PAGE_IDS, EXPECTED_PAGE_COUNT);

    assert(
      moduleCheck.pdfFilename === "pre-fixed-fare-app-operation-manual.pdf",
      "PDF_FILENAME が不正: " + moduleCheck.pdfFilename
    );
    assert(moduleCheck.expectedPageCount === EXPECTED_PAGE_COUNT, "EXPECTED_PAGE_COUNT が不正: " + moduleCheck.expectedPageCount);
    assert(moduleCheck.pageCount === EXPECTED_PAGE_COUNT, "ページ数が不正: " + moduleCheck.pageCount);
    assert(moduleCheck.missing.length === 0, "不足ページ: " + moduleCheck.missing.join(", "));
    assert(moduleCheck.hasDemoNote, "デモ予約区別の文言がありません");
    assert(moduleCheck.hasDemoScreenNote, "審査用デモ画面の説明がありません");
    assert(moduleCheck.hasEdition, "作成日・版数がありません");
    assert(moduleCheck.hasQrReviewNote, "QR①注記がありません");
    assert(fs.existsSync(operationManualPath), "QR②リンク先 manual/pre-fixed-fare-operation.html がありません");
    assert(moduleCheck.hasQrEstimate, "QR①タイトルがありません");
    assert(moduleCheck.hasQrOperation, "QR②タイトルがありません");
    assert(moduleCheck.hasChecklist, "チェックリストがありません");
    assert(moduleCheck.coverQrCount === 2, "QRコード数が不正: " + moduleCheck.coverQrCount);
    assert(!moduleCheck.coverHasLongUrl, "表紙にフルURLが表示されています");
    assert(moduleCheck.coverHasCaption, "表紙QR下の短い説明文がありません");
    assert(moduleCheck.coverHasDemoNote, "QR①説明文がありません");
    assert(moduleCheck.coverHasOperationNote, "QR②説明文がありません");
    assert(moduleCheck.routeChangeHasTable, "route-change ページに表がありません");
    assert(!moduleCheck.routeChangeHasScreenshot, "route-change ページにスクショが混在しています");
    assert(moduleCheck.routeChangeOperationHasScreenshot, "route-change-operation ページにスクショがありません");
    assert(!moduleCheck.routeChangeOperationHasTable, "route-change-operation ページに表が混在しています");
    assert(moduleCheck.mobileFrameCount === 11, "mobile スクショ枠数が不正: " + moduleCheck.mobileFrameCount);
    assert(moduleCheck.desktopFrameCount === 1, "desktop スクショ枠数が不正: " + moduleCheck.desktopFrameCount);
    assert(moduleCheck.containCss, "object-fit:contain がCSSにありません");
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
        screenshotCount: screenshots.length,
        imageTagCount: (html.match(/manual-screenshot-img/g) || []).length
      };
    });
    assert(annotationCheck.hasAnnotations, "赤枠 annotations がありません");
    assert(annotationCheck.availableCount === annotationCheck.screenshotCount, "スクショ未配置: " + annotationCheck.availableCount + "/" + annotationCheck.screenshotCount);
    assert(annotationCheck.imageTagCount === 12, "画像表示数が不正: " + annotationCheck.imageTagCount);

    const pdfResult = await page.evaluate(async function(expectedPageCount){
      try{
        const result = await window.PreFixedFareAppManualPdf.generatePreFixedFareAppManualPdf();
        return { ok: true, pageCount: result?.pageCount || 0, pageIds: result?.pageIds || [] };
      }catch(error){
        return { ok: false, message: String(error?.message || error) };
      }
    }, EXPECTED_PAGE_COUNT);
    assert(pdfResult.ok, "PDF生成失敗: " + pdfResult.message);
    assert(pdfResult.pageCount === EXPECTED_PAGE_COUNT, "PDF生成ページ数が不正: " + pdfResult.pageCount);
    assert(pdfResult.pageIds.includes("route-change"), "PDFに route-change ページがありません");
    assert(pdfResult.pageIds.includes("route-change-operation"), "PDFに route-change-operation ページがありません");

    const filteredConsoleErrors = consoleErrors.filter(function(message){
      return !/Failed to load resource|net::ERR_FILE_NOT_FOUND|favicon/i.test(message);
    });
    assert(filteredConsoleErrors.length === 0, "console error: " + filteredConsoleErrors.join(" | "));

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
