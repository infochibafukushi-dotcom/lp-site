import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const estimateUrl = "file:///" + path.join(rootDir, "estimate", "index.html").replace(/\\/g, "/");

const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const REQUIRED_SECTIONS = [
  "1. 事前確定運賃Mの概要",
  "2. LP見積 → 同意 → reservation-v4保存 → メーターアプリ読取 → 運行 → 精算 → 領収書 → 完了の流れ",
  "3. GitHub Pages → driver-proxy → reservation-v4 → Firebase / caseRecords の本番構成",
  "4. METER_DRIVER_TOKENをフロント・GitHub・distに含めない設計",
  "5. snapshotHashVerified / confirmedFareMatchesSnapshot / 同意スナップショットによる整合性確認",
  "6. caseRecords保存項目",
  "7. meter_fixed_fare_runs による start / complete 記録",
  "8. 領収書に「事前確定運賃」と表示すること",
  "9. 本番E2E確認結果",
  "10. 旅客都合変更時の基本運用",
  "11. 金額の扱い",
  "12. メーターアプリ上の操作導線",
  "13. 保存される監査証跡",
  "14. 通常完了との判別方法",
  "15. 予約詳細・管理画面の表示",
  "16. 運用開始前の目視確認項目",
  "17. 今後対応予定"
];

const REQUIRED_E2E = [
  "209906021400",
  "209906041030",
  "EST-PROD-SMOKE-1782485792",
  "12,000円",
  "事前確定運賃 12,000円",
  "事前確定M 完了",
  "事前確定M 旅客都合途中終了",
  "snapshotHashVerified",
  "confirmedFareMatchesSnapshot",
  "通常メーターで新規運行を開始",
  "/case/start",
  "completed_with_passenger_change",
  "passenger_requested_route_change",
  "test:phase5 18/18 PASS"
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

async function runAdminTests(page){
  await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 60000 });

  const buttonExists = await page.evaluate(function(){
    return Boolean(document.getElementById("preFixedFareOperationsSummaryExportBtn"));
  });
  assert(buttonExists, "③ボタン preFixedFareOperationsSummaryExportBtn が見つかりません");

  const moduleCheck = await page.evaluate(function(){
    const data = window.PreFixedFareOperationsSummaryData?.buildReportData?.();
    const html = window.PreFixedFareOperationsSummaryPdf?.buildReportHtml?.(data);
    return {
      pdfFilename: window.PreFixedFareOperationsSummaryPdf?.PDF_FILENAME || "",
      title: data?.title || "",
      htmlLength: String(html || "").length,
      textSample: String(html || "").slice(0, 500)
    };
  });

  assert(
    moduleCheck.pdfFilename === "pre-fixed-fare-operations-summary.pdf",
    "PDF_FILENAME が不正: " + moduleCheck.pdfFilename
  );
  assert(
    moduleCheck.title === "事前確定運賃M 運用・監査説明資料",
    "タイトルが不正: " + moduleCheck.title
  );
  assert(moduleCheck.htmlLength > 1000, "生成HTMLが短すぎます");

  const sectionCheck = await page.evaluate(function(sections){
    const data = window.PreFixedFareOperationsSummaryData.buildReportData();
    const html = window.PreFixedFareOperationsSummaryPdf.buildReportHtml(data);
    const missing = sections.filter(function(section){
      return !html.includes(section);
    });
    return { missing: missing, html: html };
  }, REQUIRED_SECTIONS);

  assert(sectionCheck.missing.length === 0, "不足セクション: " + sectionCheck.missing.join(", "));

  const e2eMissing = REQUIRED_E2E.filter(function(item){
    return !sectionCheck.html.includes(item);
  });
  assert(e2eMissing.length === 0, "E2E証跡不足: " + e2eMissing.join(", "));

  assert(
    sectionCheck.html.includes("事前確定運賃"),
    "領収書表示ルール「事前確定運賃」が見つかりません"
  );

  const regression = await page.evaluate(function(){
    const reportData = window.PreFixedFareReportData?.buildReportData?.({
      config: {},
      estimateConfig: { version: 1 }
    });
    const approvalData = window.PreFixedFareApprovalSummaryData?.buildReportData?.();
    return {
      reportTitle: reportData?.title || "",
      approvalTitle: approvalData?.title || "",
      reportPdfFilename: window.PreFixedFareReportPdf?.PDF_FILENAME || "pre-fixed-fare-regulatory-report.pdf",
      approvalPdfFilename: window.PreFixedFareApprovalSummaryPdf?.PDF_FILENAME || ""
    };
  });

  assert(
    regression.reportTitle.includes("関東運輸局公示要件対応表"),
    "① report data が壊れています"
  );
  assert(
    regression.approvalTitle === "事前確定運賃システム説明資料",
    "② approval data が壊れています"
  );
  assert(
    regression.approvalPdfFilename === "pre-fixed-fare-approval-summary.pdf",
    "② PDF_FILENAME が壊れています"
  );

  const html2pdfError = await page.evaluate(async function(){
    delete window.html2pdf;
    document.querySelectorAll("script[data-pre-fixed-fare-report-pdf='1']").forEach(function(node){
      node.remove();
    });
    const originalAppendChild = document.head.appendChild.bind(document.head);
    document.head.appendChild = function(node){
      if(node.tagName === "SCRIPT" && node.getAttribute("data-pre-fixed-fare-report-pdf") === "1"){
        setTimeout(function(){
          if(typeof node.onerror === "function"){
            node.onerror(new Event("error"));
          }
        }, 0);
        return node;
      }
      return originalAppendChild(node);
    };
    try{
      await window.PreFixedFareOperationsSummaryPdf.generatePreFixedFareOperationsSummaryPdf();
      return { ok: false, message: "エラーにならなかった" };
    }catch(error){
      return { ok: true, message: String(error?.message || "") };
    }
  });

  assert(html2pdfError.ok, "html2pdf失敗時のエラーが発生しませんでした");
  assert(
    html2pdfError.message.includes("読み込みに失敗"),
    "html2pdf失敗メッセージが不正: " + html2pdfError.message
  );

  const pdfBytes = await page.evaluate(async function(){
    const data = window.PreFixedFareOperationsSummaryData.buildReportData();
    const reportHtml = window.PreFixedFareOperationsSummaryPdf.buildReportHtml(data);
    const container = document.createElement("div");
    container.innerHTML = reportHtml;
    document.body.appendChild(container);
    const reportElement = container.querySelector(".pre-fixed-fare-operations-summary");
    const textLength = String(reportElement?.innerText || "").trim().length;
    container.remove();
    return { textLength: textLength };
  });
  assert(pdfBytes.textLength > 2000, "PDF用HTMLのテキスト量が不足: " + pdfBytes.textLength);

  return {
    buttonExists: true,
    sections: REQUIRED_SECTIONS.length,
    pdfFilename: moduleCheck.pdfFilename,
    regression: regression
  };
}

async function runEstimateRegression(page){
  await page.goto(estimateUrl, { waitUntil: "networkidle0", timeout: 60000 });
  const estimateCheck = await page.evaluate(function(){
    return {
      hasEstimatePdf: typeof window.EstimatePdf?.savePdf === "function",
      hasHtml2pdf: typeof window.html2pdf !== "undefined"
    };
  });
  assert(estimateCheck.hasEstimatePdf, "estimate EstimatePdf が読み込まれていません");
  assert(estimateCheck.hasHtml2pdf, "estimate html2pdf が読み込まれていません");
  return estimateCheck;
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
    const adminResult = await runAdminTests(page);
    const estimateResult = await runEstimateRegression(page);

    console.log("PASS admin operations summary PDF tests");
    console.log(JSON.stringify({ adminResult, estimateResult }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
