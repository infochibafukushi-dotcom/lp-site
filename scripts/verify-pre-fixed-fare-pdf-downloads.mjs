import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, ".tmp-pdf-downloads");
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OPERATIONS_FILENAME = "pre-fixed-fare-operations-summary.pdf";

const OPERATIONS_CHECKS = [
  "1. 事前確定運賃Mの概要",
  "2. LP見積",
  "3. GitHub Pages",
  "4. METER_DRIVER_TOKEN",
  "5. snapshotHashVerified",
  "6. caseRecords保存項目",
  "7. meter_fixed_fare_runs",
  "8. 領収書に「事前確定運賃」",
  "9. 本番E2E確認結果",
  "10. 今後対応予定",
  "209906021400",
  "EST-PROD-SMOKE-1782485792",
  "12,000円",
  "事前確定運賃 12,000円",
  "driver-proxy",
  "METER_DRIVER_TOKEN",
  "Firebase ID Token"
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

async function clickButtonAndCheckStatus(page, buttonId, statusId){
  await page.evaluate(function(ids){
    const card = document.getElementById("card-pre-fixed-fare-report");
    if(card && !card.classList.contains("is-open")){
      card.querySelector(".js-card-toggle")?.click();
    }
    document.getElementById(ids.buttonId)?.click();
  }, { buttonId: buttonId, statusId: statusId });

  const statusText = await page.waitForFunction(function(id){
    const text = String(document.getElementById(id)?.textContent || "");
    if(text.includes("失敗") || text.includes("エラー")){
      return text;
    }
    if(text.includes("保存") || text.includes("出力")){
      return text;
    }
    return false;
  }, { timeout: 120000 }, statusId);

  const text = await statusText.jsonValue();
  assert(!String(text).includes("失敗"), buttonId + " のPDF生成に失敗: " + text);
}

async function exportOperationsPdf(page){
  const result = await page.evaluate(async function(expectedFilename){
    const reportData = window.PreFixedFareOperationsSummaryData.buildReportData();
    const reportHtml = window.PreFixedFareOperationsSummaryPdf.buildReportHtml(reportData);

    if(typeof html2pdf === "undefined"){
      await new Promise(function(resolve, reject){
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.async = true;
        script.setAttribute("data-pre-fixed-fare-report-pdf", "1");
        script.onload = resolve;
        script.onerror = function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); };
        document.head.appendChild(script);
      });
    }

    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.left = "0";
    wrapper.style.top = "0";
    wrapper.style.width = "720px";
    wrapper.style.background = "#ffffff";
    wrapper.innerHTML = reportHtml;
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-operations-summary");
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });

    const blob = await html2pdf().set({
      margin: [8, 8, 8, 8],
      filename: expectedFilename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] }
    }).from(reportElement).outputPdf("blob");

    const htmlText = String(reportElement?.innerText || "");
    wrapper.remove();
    const buffer = await blob.arrayBuffer();
    return {
      filename: expectedFilename,
      bytes: Array.from(new Uint8Array(buffer)),
      htmlText: htmlText
    };
  }, OPERATIONS_FILENAME);

  const filePath = path.join(outputDir, result.filename);
  fs.writeFileSync(filePath, Buffer.from(result.bytes));
  return {
    filePath: filePath,
    size: result.bytes.length,
    htmlText: result.htmlText
  };
}

async function main(){
  if(!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveChromeExecutable() || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"]
  });

  try{
    const page = await browser.newPage();
    await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 120000 });

    const buttonVisible = await page.evaluate(function(){
      return Boolean(document.getElementById("preFixedFareOperationsSummaryExportBtn"));
    });
    assert(buttonVisible, "③ボタンが表示されていません");

    const filenameCheck = await page.evaluate(function(){
      return window.PreFixedFareOperationsSummaryPdf.PDF_FILENAME;
    });
    assert(filenameCheck === OPERATIONS_FILENAME, "③出力ファイル名が不正: " + filenameCheck);

    await clickButtonAndCheckStatus(
      page,
      "preFixedFareOperationsSummaryExportBtn",
      "preFixedFareOperationsSummaryStatus"
    );

    const operations = await exportOperationsPdf(page);
    assert(path.basename(operations.filePath) === OPERATIONS_FILENAME, "③PDFファイル名が不正");
    assert(operations.size > 5000, "③PDFサイズが小さすぎます: " + operations.size);
    const missingOps = OPERATIONS_CHECKS.filter(function(item){
      return !operations.htmlText.includes(item);
    });
    assert(missingOps.length === 0, "③PDF本文に不足: " + missingOps.join(", "));

    await clickButtonAndCheckStatus(
      page,
      "preFixedFareReportExportBtn",
      "preFixedFareReportResult"
    );
    const regulatoryCheck = await page.evaluate(async function(){
      const data = window.PreFixedFareReportData.buildReportData({
        config: {},
        estimateConfig: { version: 1, pdfFooter: { businessName: "テスト" } }
      });
      return { title: data.title };
    });
    assert(
      regulatoryCheck.title.includes("関東運輸局公示要件対応表"),
      "①PDFデータタイトル不正"
    );

    await clickButtonAndCheckStatus(
      page,
      "preFixedFareApprovalSummaryExportBtn",
      "preFixedFareApprovalSummaryStatus"
    );
    const approvalCheck = await page.evaluate(function(){
      const data = window.PreFixedFareApprovalSummaryData.buildReportData();
      return {
        title: data.title,
        hasJudgment: Array.isArray(data.judgmentRows) && data.judgmentRows.length > 0
      };
    });
    assert(approvalCheck.title === "事前確定運賃システム説明資料", "②PDFデータタイトル不正");
    assert(approvalCheck.hasJudgment, "②判定ロジックデータなし");

    console.log("PASS browser manual PDF verification");
    console.log(JSON.stringify({
      operationsPdf: operations.filePath,
      operationsSize: operations.size,
      operationsFilename: OPERATIONS_FILENAME
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
