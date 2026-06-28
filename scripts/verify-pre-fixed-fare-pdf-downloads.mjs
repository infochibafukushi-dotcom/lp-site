import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { PDFParse } from "pdf-parse";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, ".tmp-pdf-downloads");
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OPERATIONS_FILENAME = "pre-fixed-fare-operations-summary.pdf";
const INTEGRATED_FILENAME = "pre-fixed-fare-integrated-summary.pdf";
const INTEGRATED_WORD_FILENAME = "pre-fixed-fare-integrated-summary-word.html";

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
  "10. 旅客都合変更時の基本運用",
  "11. 金額の扱い",
  "12. メーターアプリ上の操作導線",
  "13. 保存される監査証跡",
  "14. 通常完了との判別方法",
  "15. 予約詳細・管理画面の表示",
  "16. 運用開始前の目視確認項目",
  "17. 今後対応予定",
  "209906021400",
  "209906041030",
  "EST-PROD-SMOKE-1782485792",
  "12,000円",
  "事前確定運賃 12,000円",
  "事前確定M 旅客都合途中終了",
  "completed_with_passenger_change",
  "passenger_requested_route_change",
  "通常メーターで新規運行を開始",
  "driver-proxy",
  "METER_DRIVER_TOKEN",
  "Firebase ID Token"
];

const INTEGRATED_CHECKS = [
  "事前確定運賃システム 統合説明資料",
  "関東運輸局提出・説明用",
  "目次",
  "第1章",
  "第2章",
  "第3章",
  "第4章",
  "第5章",
  "旅客都合変更時の途中終了運用",
  "209906021400",
  "209906041030",
  "通常メーターで新規運行を開始",
  "completed_with_passenger_change",
  "passenger_requested_route_change",
  "test:phase5 18/18 PASS",
  "本番D1上の当該テスト予約は削除済み",
  "根拠資料・確認資料一覧",
  "本番D1 migration 0005 適用確認",
  "運用開始前確認項目",
  "コード・API・DB上の動作確認後、提出前または運用開始前に運用者が画面上で最終目視確認を行う項目",
  "管理画面予約詳細の目視確認",
  "運転者画面における同一ルートまたは主要経由地点の目視確認",
  "通常メーター新規運行導線の目視確認",
  "コード・API・DB上確認済み",
  "主要経由地点・予約情報の読取確認済み",
  "同意導線・保存はコード・API・DB上確認済み",
  "通常メーター運行には表示されない"
];

const FORBIDDEN_PHRASES = [
  "完全準拠",
  "100％認可",
  "99％認可",
  "認可済み",
  "運輸局が許可済み",
  "自動的に通常運行開始へ遷移",
  "満額収受"
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

async function writeUtf8FileSafe(filePath, content){
  for(let attempt = 0; attempt < 5; attempt++){
    try{
      fs.writeFileSync(filePath, content, "utf8");
      return filePath;
    }catch(error){
      if(error?.code !== "EBUSY" || attempt === 4){
        if(error?.code === "EBUSY"){
          const altPath = filePath.replace(/(\.[^.]+)$/, "-" + Date.now() + "$1");
          fs.writeFileSync(altPath, content, "utf8");
          console.warn("WARN locked file, wrote alternate:", altPath);
          return altPath;
        }
        throw error;
      }
      await new Promise(function(resolve){
        setTimeout(resolve, 400);
      });
    }
  }
  return filePath;
}

async function assertIntegratedPdfLayout(filePath){
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  const info = await parser.getInfo();
  assert(info.total === 13, "統合PDFのページ数が13ではありません: " + info.total);
  const pageNumbers = Array.from({ length: info.total }, function(_, index){
    return index + 1;
  });
  const shots = await parser.getScreenshot({ partial: pageNumbers, imageBuffer: true, scale: 0.5 });
  await parser.destroy();

  function inkRatio(page){
    let dark = 0;
    const total = page.width * page.height;
    for(let y = 0; y < page.height; y++){
      for(let x = 0; x < page.width; x++){
        const index = (y * page.width + x) * 4;
        if(page.data[index] < 200 || page.data[index + 1] < 200 || page.data[index + 2] < 200){
          dark++;
        }
      }
    }
    return total > 0 ? dark / total : 0;
  }

  const blankPages = (shots.pages || []).filter(function(page){
    return inkRatio(page) < 0.001;
  }).map(function(page){
    return page.pageNumber;
  });
  assert(blankPages.length === 0, "統合PDFに空白ページがあります: " + blankPages.join(", "));

  const reviewDir = path.join(outputDir, "integrated-page-review");
  if(!fs.existsSync(reviewDir)){
    fs.mkdirSync(reviewDir, { recursive: true });
  }
  [6, 7, 8, 9, 10, 12, 13].forEach(function(pageNumber){
    const shot = (shots.pages || []).find(function(page){
      return page.pageNumber === pageNumber;
    });
    assert(shot, "統合PDFの" + pageNumber + "ページ目がありません");
    assert(inkRatio(shot) >= 0.002, "統合PDFの" + pageNumber + "ページ目の内容が不足しています");
    fs.writeFileSync(
      path.join(reviewDir, "page-" + String(pageNumber).padStart(2, "0") + ".png"),
      Buffer.from(shot.data)
    );
  });

  const page12 = (shots.pages || []).find(function(page){
    return page.pageNumber === 12;
  });
  const page13 = (shots.pages || []).find(function(page){
    return page.pageNumber === 13;
  });
  const page12BottomInk = (function(){
    const startY = Math.floor(page12.height * 0.88);
    let dark = 0;
    let total = 0;
    for(let y = startY; y < page12.height; y++){
      for(let x = 0; x < page12.width; x++){
        total++;
        const index = (y * page12.width + x) * 4;
        if(page12.data[index] < 200 || page12.data[index + 1] < 200 || page12.data[index + 2] < 200){
          dark++;
        }
      }
    }
    return total > 0 ? dark / total : 0;
  })();
  const page13TopInk = (function(){
    const endY = Math.floor(page13.height * 0.12);
    let dark = 0;
    let total = 0;
    for(let y = 0; y < endY; y++){
      for(let x = 0; x < page13.width; x++){
        total++;
        const index = (y * page13.width + x) * 4;
        if(page13.data[index] < 200 || page13.data[index + 1] < 200 || page13.data[index + 2] < 200){
          dark++;
        }
      }
    }
    return total > 0 ? dark / total : 0;
  })();
  assert(page12BottomInk < 0.008, "12P下部に次ページ内容がはみ出している可能性があります: ink=" + page12BottomInk);
  assert(page13TopInk >= 0.01, "13P先頭に第5章タイトルが表示されていません: ink=" + page13TopInk);
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

async function exportIntegratedPdf(page){
  const result = await page.evaluate(async function(expectedFilename){
    const reportData = window.PreFixedFareIntegratedSummaryData.buildReportData({
      config: {},
      estimateConfig: { version: 1, pdfFooter: { businessName: "ちばケアタクシー" } }
    });
    const rendered = await window.PreFixedFareIntegratedSummaryPdf.renderPdfBlob(reportData);
    const buffer = await rendered.blob.arrayBuffer();
    return {
      filename: expectedFilename,
      bytes: Array.from(new Uint8Array(buffer)),
      htmlText: rendered.htmlText
    };
  }, INTEGRATED_FILENAME);

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

    const integratedButtonVisible = await page.evaluate(function(){
      return Boolean(document.getElementById("preFixedFareIntegratedSummaryExportBtn"));
    });
    assert(integratedButtonVisible, "④ボタンが表示されていません");

    const integratedFilenameCheck = await page.evaluate(function(){
      return window.PreFixedFareIntegratedSummaryPdf.PDF_FILENAME;
    });
    assert(integratedFilenameCheck === INTEGRATED_FILENAME, "④出力ファイル名が不正: " + integratedFilenameCheck);

    await clickButtonAndCheckStatus(
      page,
      "preFixedFareIntegratedSummaryExportBtn",
      "preFixedFareIntegratedSummaryStatus"
    );

    const integrated = await exportIntegratedPdf(page);
    assert(path.basename(integrated.filePath) === INTEGRATED_FILENAME, "④PDFファイル名が不正");
    assert(integrated.size > 5000, "④PDFサイズが小さすぎます: " + integrated.size);
    const missingIntegrated = INTEGRATED_CHECKS.filter(function(item){
      return !integrated.htmlText.includes(item);
    });
    assert(missingIntegrated.length === 0, "④PDF本文に不足: " + missingIntegrated.join(", "));
    const forbiddenFound = FORBIDDEN_PHRASES.filter(function(item){
      return integrated.htmlText.includes(item);
    });
    assert(forbiddenFound.length === 0, "④PDF本文に避ける表現: " + forbiddenFound.join(", "));
    await assertIntegratedPdfLayout(integrated.filePath);

    const integratedWordButtonVisible = await page.evaluate(function(){
      return Boolean(document.getElementById("preFixedFareIntegratedSummaryWordExportBtn"));
    });
    assert(integratedWordButtonVisible, "④Wordボタンが表示されていません");

    const wordGenerated = await page.evaluate(function(){
      const data = window.PreFixedFareIntegratedSummaryData.buildReportData({
        config: {},
        estimateConfig: { version: 1, pdfFooter: { businessName: "ちばケアタクシー" } }
      });
      const html = window.PreFixedFareIntegratedSummaryWord.buildWordDocumentHtml(data);
      return {
        filename: window.PreFixedFareIntegratedSummaryWord.WORD_FILENAME,
        html: html
      };
    });
    assert(wordGenerated.filename === INTEGRATED_WORD_FILENAME, "④Word出力ファイル名が不正");
    assert(wordGenerated.html.includes("根拠資料・確認資料一覧"), "④Word HTMLに根拠資料一覧がありません");
    assert(wordGenerated.html.includes("本番D1上の当該テスト予約は削除済み"), "④Word HTMLにE2E注記がありません");
    const wordPath = await writeUtf8FileSafe(path.join(outputDir, INTEGRATED_WORD_FILENAME), "\ufeff" + wordGenerated.html);

    const appendixButtonsVisible = await page.evaluate(function(){
      return [
        "preFixedFareAppendixApplicationHelperBtn",
        "preFixedFareAppendixDistanceFareBtn",
        "preFixedFareAppendixServiceFeeBtn",
        "preFixedFareAppendixDeviceChecklistBtn",
        "preFixedFareAppendixScreenshotSheetBtn",
        "preFixedFareAppendixFullSetBtn"
      ].every(function(id){
        return Boolean(document.getElementById(id));
      });
    });
    assert(appendixButtonsVisible, "提出用別紙ボタンが表示されていません");

    const appendixGenerated = await page.evaluate(function(){
      const options = {
        config: {},
        estimateConfig: { version: 1, pdfFooter: { businessName: "ちばケアタクシー" } }
      };
      const fullSet = window.PreFixedFareSubmissionAppendixWord.buildWordDocumentHtml("submission-appendix-set", options);
      const helper = window.PreFixedFareSubmissionAppendixWord.buildWordDocumentHtml("application-helper", options);
      return {
        fullSetFilename: fullSet.payload.wordFilename,
        fullSetHtml: fullSet.html,
        helperHtml: helper.html
      };
    });
    assert(
      appendixGenerated.fullSetFilename === "pre-fixed-fare-submission-appendix-set.html",
      "別紙セットのファイル名が不正"
    );
    assert(
      appendixGenerated.fullSetHtml.includes("別紙1　距離制運賃表")
        && appendixGenerated.fullSetHtml.includes("別紙4　画面スクリーンショット台紙"),
      "別紙セットに全別紙が含まれていません"
    );
    assert(
      appendixGenerated.helperHtml.includes("本シートは公式申請様式ではありません"),
      "記入補助シートに注意文言がありません"
    );
    const appendixSetPath = await writeUtf8FileSafe(
      path.join(outputDir, "pre-fixed-fare-submission-appendix-set.html"),
      "\ufeff" + appendixGenerated.fullSetHtml
    );

    console.log("PASS browser manual PDF verification");
    console.log(JSON.stringify({
      operationsPdf: operations.filePath,
      operationsSize: operations.size,
      operationsFilename: OPERATIONS_FILENAME,
      integratedPdf: integrated.filePath,
      integratedSize: integrated.size,
      integratedFilename: INTEGRATED_FILENAME,
      integratedWordHtml: wordPath,
      submissionAppendixSetHtml: appendixSetPath
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
