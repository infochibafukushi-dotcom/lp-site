import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const printPagePath = path.join(rootDir, "manual", "pre-fixed-fare-app-operation-manual-print.html");
const printPageUrl = "file:///" + printPagePath.replace(/\\/g, "/");
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

function filterConsoleErrors(consoleErrors){
  return consoleErrors.filter(function(message){
    return !/Failed to load resource|net::ERR_FILE_NOT_FOUND|favicon/i.test(message);
  });
}

async function main(){
  assert(fs.existsSync(printPagePath), "印刷用HTMLページがありません: " + printPagePath);

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

    await page.goto(printPageUrl, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(function(){
      return document.body.getAttribute("data-print-ready") === "1";
    }, { timeout: 60000 });

    const printCheck = await page.evaluate(function(pageIds, expectedPageCount){
      const root = document.getElementById("preFixedFareAppManualPrintRoot");
      const pages = root ? root.querySelectorAll(".manual-page") : [];
      const pageIdList = Array.from(pages).map(function(el){ return el.getAttribute("data-page-id"); });
      const missing = pageIds.filter(function(id){ return !pageIdList.includes(id); });
      const coverPage = root?.querySelector(".manual-page[data-page-id='cover']");
      const routeChangePage = root?.querySelector(".manual-page[data-page-id='route-change']");
      const routeChangeOperationPage = root?.querySelector(".manual-page[data-page-id='route-change-operation']");
      const screenshotImgs = root ? root.querySelectorAll(".manual-screenshot-img") : [];
      return {
        hasToolbar: Boolean(document.querySelector(".print-toolbar")),
        hasPrintBtn: Boolean(document.getElementById("preFixedFareAppManualPrintBtn")),
        hasBackLink: Boolean(document.querySelector(".print-toolbar-link[href*='admin.html']")),
        pageCount: pages.length,
        pageIds: pageIdList,
        missing: missing,
        coverExists: Boolean(coverPage),
        coverQrCount: coverPage ? coverPage.querySelectorAll(".cover-qr-image").length : 0,
        screenshotCount: screenshotImgs.length,
        routeChangeHasTable: Boolean(routeChangePage?.querySelector("table")),
        routeChangeHasScreenshot: Boolean(routeChangePage?.querySelector(".manual-screenshot-img")),
        routeChangeOperationHasScreenshot: Boolean(routeChangeOperationPage?.querySelector(".manual-screenshot-img")),
        routeChangeOperationHasTable: Boolean(routeChangeOperationPage?.querySelector("table")),
        expectedPageCount: window.PreFixedFareAppManualPdf?.EXPECTED_PAGE_COUNT || 0,
        printPagePath: window.PreFixedFareAppManualPdf?.PRINT_PAGE_RELATIVE_PATH || ""
      };
    }, REQUIRED_PAGE_IDS, EXPECTED_PAGE_COUNT);

    assert(printCheck.hasToolbar, "印刷用ページにツールバーがありません");
    assert(printCheck.hasPrintBtn, "PDF保存・印刷ボタンがありません");
    assert(printCheck.hasBackLink, "管理画面に戻るリンクがありません");
    assert(printCheck.pageCount === EXPECTED_PAGE_COUNT, "manual-page 件数が不正: " + printCheck.pageCount);
    assert(printCheck.expectedPageCount === EXPECTED_PAGE_COUNT, "EXPECTED_PAGE_COUNT が不正: " + printCheck.expectedPageCount);
    assert(printCheck.missing.length === 0, "不足ページ: " + printCheck.missing.join(", "));
    assert(printCheck.coverExists, "表紙ページがありません");
    assert(printCheck.coverQrCount === 2, "QRコード数が不正: " + printCheck.coverQrCount);
    assert(printCheck.screenshotCount === 12, "スクショ画像数が不正: " + printCheck.screenshotCount);
    assert(printCheck.routeChangeHasTable, "route-change ページに表がありません");
    assert(!printCheck.routeChangeHasScreenshot, "route-change ページにスクショが混在しています");
    assert(printCheck.routeChangeOperationHasScreenshot, "route-change-operation ページにスクショがありません");
    assert(!printCheck.routeChangeOperationHasTable, "route-change-operation ページに表が混在しています");
    assert(
      printCheck.printPagePath === "./manual/pre-fixed-fare-app-operation-manual-print.html",
      "PRINT_PAGE_RELATIVE_PATH が不正: " + printCheck.printPagePath
    );
    assert(fs.existsSync(operationManualPath), "QR②リンク先 manual/pre-fixed-fare-operation.html がありません");

    await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 60000 });

    const adminCheck = await page.evaluate(async function(pageIds, expectedPageCount){
      const buttonExists = Boolean(document.getElementById("preFixedFareAppManualExportBtn"));
      const buttonText = document.getElementById("preFixedFareAppManualExportBtn")?.textContent?.trim() || "";
      const hasPrintNote = String(document.body.innerHTML || "").includes("ブラウザの印刷画面から「PDFに保存」を選択");
      const hasOpenPrintPage = typeof window.openPreFixedFareAppManualPrintPage === "function"
        || typeof window.PreFixedFareAppManualPdf?.openPreFixedFareAppManualPrintPage === "function";
      const printPageUrlValue = window.PreFixedFareAppManualPdf?.getPrintPageUrl?.() || "";
      const data = window.PreFixedFareAppManualData?.buildReportData?.();
      const html = window.PreFixedFareAppManualPdf?.buildReportHtml?.(data, { imageAvailability: {}, qrDataUrls: {} });
      const container = document.createElement("div");
      container.innerHTML = html;
      const pages = container.querySelectorAll(".manual-page");
      return {
        buttonExists: buttonExists,
        buttonText: buttonText,
        hasPrintNote: hasPrintNote,
        hasOpenPrintPage: hasOpenPrintPage,
        printPageUrlValue: printPageUrlValue,
        previewBtn: Boolean(document.getElementById("preFixedFareAppManualPreviewBtn")),
        previewBox: Boolean(document.getElementById("preFixedFareAppManualPreview")),
        pageCount: pages.length,
        screenEvidenceBtn: Boolean(document.getElementById("preFixedFareScreenEvidenceExportBtn")),
        reportBtn: Boolean(document.getElementById("preFixedFareReportExportBtn"))
      };
    }, REQUIRED_PAGE_IDS, EXPECTED_PAGE_COUNT);

    assert(adminCheck.buttonExists, "preFixedFareAppManualExportBtn が見つかりません");
    assert(adminCheck.buttonText.includes("PDF保存ページ"), "管理画面ボタン文言が不正: " + adminCheck.buttonText);
    assert(adminCheck.hasPrintNote, "管理画面に印刷手順の説明がありません");
    assert(adminCheck.hasOpenPrintPage, "openPreFixedFareAppManualPrintPage が定義されていません");
    assert(/pre-fixed-fare-app-operation-manual-print\.html/.test(adminCheck.printPageUrlValue), "印刷用ページURLが不正: " + adminCheck.printPageUrlValue);
    assert(adminCheck.previewBtn, "操作マニュアルPDFプレビューボタンがありません");
    assert(adminCheck.previewBox, "操作マニュアルPDFプレビュー表示先がありません");
    assert(adminCheck.pageCount === EXPECTED_PAGE_COUNT, "管理画面側HTML生成ページ数が不正: " + adminCheck.pageCount);
    assert(adminCheck.screenEvidenceBtn, "既存の画面証跡ボタンが壊れています");
    assert(adminCheck.reportBtn, "既存の認可説明資料ボタンが壊れています");

    const filteredConsoleErrors = filterConsoleErrors(consoleErrors);
    assert(filteredConsoleErrors.length === 0, "console error: " + filteredConsoleErrors.join(" | "));

    console.log("PASS pre-fixed-fare app manual print page tests");
    console.log(JSON.stringify({ printCheck: printCheck, adminCheck: adminCheck }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
