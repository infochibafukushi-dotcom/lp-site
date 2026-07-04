import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = pathToFileURL(path.join(rootDir, "admin.html")).href;
const outputDir = path.join(rootDir, "docs/submission/20260705");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const TARGETS = {
  integrated: "pre-fixed-fare-integrated-summary-v1-candidate.pdf",
  operations: "pre-fixed-fare-operations-summary-v1-candidate.pdf",
  qa: "pre-fixed-fare-qa-v1-candidate.pdf",
  appendix: "pre-fixed-fare-submission-appendix-set-v1-candidate.pdf"
};

const EXISTING = [
  "pre-fixed-fare-application-form-style2-v1-candidate.pdf",
  "pre-fixed-fare-screen-evidence-v1-candidate.pdf"
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

async function ensureHtml2Pdf(page){
  await page.evaluate(async function(){
    if(typeof html2pdf !== "undefined"){
      return;
    }
    await new Promise(function(resolve, reject){
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.async = true;
      script.setAttribute("data-pre-fixed-fare-report-pdf", "1");
      script.onload = resolve;
      script.onerror = function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); };
      document.head.appendChild(script);
    });
  });
}

async function loadExportOptions(page){
  return page.evaluate(async function(){
    let config = {};
    let estimateConfig = { version: 1, pdfFooter: { businessName: "ちばケアタクシー" } };
    try{
      const [configRes, estimateRes] = await Promise.all([
        fetch("./data/config.json?" + Date.now(), { cache: "no-store" }),
        fetch("./data/estimate-config.json?" + Date.now(), { cache: "no-store" })
      ]);
      if(configRes.ok) config = await configRes.json();
      if(estimateRes.ok) estimateConfig = await estimateRes.json();
    }catch(error){
      console.warn("config fetch fallback", error);
    }
    return { config: config, estimateConfig: estimateConfig };
  });
}

async function exportIntegratedPdf(page, options){
  const result = await page.evaluate(async function(exportOptions){
    const reportData = window.PreFixedFareIntegratedSummaryData.buildReportData(exportOptions);
    const rendered = await window.PreFixedFareIntegratedSummaryPdf.renderPdfBlob(reportData);
    const buffer = await rendered.blob.arrayBuffer();
    return {
      bytes: Array.from(new Uint8Array(buffer)),
      htmlText: rendered.htmlText,
      pageCount: rendered.pageCount
    };
  }, options);
  const filePath = path.join(outputDir, TARGETS.integrated);
  fs.writeFileSync(filePath, Buffer.from(result.bytes));
  return { filePath: filePath, size: result.bytes.length, htmlText: result.htmlText, pageCount: result.pageCount };
}

async function exportOperationsPdf(page){
  const result = await page.evaluate(async function(){
    const reportData = window.PreFixedFareOperationsSummaryData.buildReportData();
    const reportHtml = window.PreFixedFareOperationsSummaryPdf.buildReportHtml(reportData);
    const reportCss = window.PreFixedFareOperationsSummaryPdf.getReportCss();
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.left = "0";
    wrapper.style.top = "0";
    wrapper.style.width = "720px";
    wrapper.style.background = "#ffffff";
    wrapper.innerHTML = "<style>" + reportCss + "</style>" + reportHtml;
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-operations-summary");
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    const blob = await html2pdf().set({
      margin: [6, 14, 18, 14],
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] }
    }).from(reportElement).outputPdf("blob");
    const htmlText = String(reportElement.innerText || "");
    wrapper.remove();
    const buffer = await blob.arrayBuffer();
    return { bytes: Array.from(new Uint8Array(buffer)), htmlText: htmlText };
  });
  const filePath = path.join(outputDir, TARGETS.operations);
  fs.writeFileSync(filePath, Buffer.from(result.bytes));
  return { filePath: filePath, size: result.bytes.length, htmlText: result.htmlText };
}

async function exportAppendixPdf(browser, page, options){
  const built = await page.evaluate(function(exportOptions){
    const result = window.PreFixedFareSubmissionAppendixWord.buildWordDocumentHtml("submission-appendix-set", exportOptions);
    return {
      html: result.html,
      title: result.payload.title,
      pdfFilename: result.payload.pdfFilename
    };
  }, options);
  assert(built.html.length > 5000, "別紙セットHTMLが短すぎます");
  assert(built.html.includes("別紙1"), "別紙セットHTMLに別紙1がありません");
  assert(built.html.includes("画面キャプチャ貼付資料"), "別紙セットに画面キャプチャ貼付資料がありません");
  assert(!built.html.includes("class='paste-box'") && !built.html.includes('class="paste-box"'), "別紙セットに空欄貼付欄が残っています");
  assert(built.html.includes("capture-image"), "別紙セットに実画像が含まれていません");

  const appendixHtml = built.html;
  const tempHtmlPath = path.join(rootDir, ".tmp-submission-appendix-export.html");
  fs.writeFileSync(tempHtmlPath, appendixHtml, "utf8");

  const appendixPage = await browser.newPage();
  await appendixPage.goto(pathToFileURL(tempHtmlPath).href, { waitUntil: "domcontentloaded", timeout: 120000 });
  await appendixPage.evaluate(async function(){
    const images = Array.from(document.images);
    await Promise.all(images.map(function(img){
      if(img.complete && img.naturalWidth > 0){
        return Promise.resolve();
      }
      return new Promise(function(resolve){
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }));
  });
  await new Promise(function(resolve){ setTimeout(resolve, 1500); });
  const filePath = path.join(outputDir, TARGETS.appendix);
  await appendixPage.pdf({
    path: filePath,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", right: "14mm", bottom: "18mm", left: "14mm" }
  });
  try{
    fs.unlinkSync(tempHtmlPath);
  }catch(error){
    // ignore cleanup errors
  }
  const size = fs.statSync(filePath).size;
  const htmlText = await appendixPage.evaluate(function(){
    return document.body ? document.body.innerText : "";
  });
  await appendixPage.close();
  return { filePath: filePath, size: size, htmlText: htmlText };
}

async function exportQaPdf(browser, page){
  const html = await page.evaluate(function(){
    const reportData = window.PreFixedFareQaData.buildReportData();
    return window.PreFixedFareQaPdf.buildPrintDocument(reportData);
  });
  assert(html.includes("想定質問と回答"), "Q&A HTMLが不正");
  assert(html.includes("事前確定運賃システム"), "Q&A HTMLタイトル不正");
  const qaPage = await browser.newPage();
  await qaPage.setContent(html, { waitUntil: "networkidle0" });
  const filePath = path.join(outputDir, TARGETS.qa);
  await qaPage.pdf({
    path: filePath,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", right: "14mm", bottom: "18mm", left: "14mm" }
  });
  const size = fs.statSync(filePath).size;
  await qaPage.close();
  return { filePath: filePath, size: size, htmlText: html };
}

async function verifyButtons(page){
  const buttons = await page.evaluate(function(){
    return {
      integrated: Boolean(document.getElementById("preFixedFareIntegratedSummaryExportBtn")),
      operations: Boolean(document.getElementById("preFixedFareOperationsSummaryExportBtn")),
      qa: Boolean(document.getElementById("preFixedFareQaExportBtn")),
      appendix: Boolean(document.getElementById("preFixedFareAppendixFullSetBtn")),
      screenEvidence: Boolean(document.getElementById("preFixedFareScreenEvidenceExportBtn")),
      application: Boolean(document.getElementById("pffaPrintBtn")),
      integratedModule: Boolean(window.PreFixedFareIntegratedSummaryPdf),
      operationsModule: Boolean(window.PreFixedFareOperationsSummaryPdf),
      qaModule: Boolean(window.PreFixedFareQaPdf),
      appendixModule: Boolean(window.PreFixedFareSubmissionAppendixPdf),
      screenEvidenceModule: Boolean(window.PreFixedFareScreenEvidencePdf)
    };
  });
  Object.keys(buttons).forEach(function(key){
    assert(buttons[key], "出力確認に失敗: " + key);
  });
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  EXISTING.forEach(function(name){
    const filePath = path.join(outputDir, name);
    assert(fs.existsSync(filePath), "既存PDFがありません: " + name);
    assert(fs.statSync(filePath).size > 10000, "既存PDFサイズが小さすぎます: " + name);
  });

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
    const page = await browser.newPage();
    await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 180000 });
    await verifyButtons(page);
    await ensureHtml2Pdf(page);
    const exportOptions = await loadExportOptions(page);

    console.log("Exporting integrated summary...");
    const integrated = await exportIntegratedPdf(page, exportOptions);
    assert(integrated.size > 50000, "統合説明資料PDFが小さすぎます");
    assert(integrated.htmlText.includes("事前確定運賃システム 統合説明資料"), "統合説明資料タイトル不正");
    assert(integrated.htmlText.includes("関東運輸局提出・説明用"), "統合説明資料の位置づけ不正");
    console.log("  OK", integrated.filePath, integrated.size, "bytes", "pages(html):", integrated.pageCount);

    console.log("Exporting operations summary...");
    const operations = await exportOperationsPdf(page);
    assert(operations.size > 5000, "運用フローPDFが小さすぎます");
    assert(operations.htmlText.includes("事前確定運賃M"), "運用フロー資料タイトル不正");
    assert(operations.htmlText.includes("領収書に「事前確定運賃」"), "運用フロー資料の領収書説明不正");
    console.log("  OK", operations.filePath, operations.size, "bytes");

    console.log("Exporting Q&A...");
    const qa = await exportQaPdf(browser, page);
    assert(qa.size > 20000, "Q&A PDFが小さすぎます");
    assert(qa.htmlText.includes("事前確定運賃システム"), "Q&A HTMLタイトル不正");
    console.log("  OK", qa.filePath, qa.size, "bytes");

    console.log("Exporting appendix set...");
    const appendix = await exportAppendixPdf(browser, page, exportOptions);
    assert(appendix.size > 5000, "別紙セットPDFが小さすぎます");
    assert(appendix.htmlText.includes("別紙1"), "別紙セットに別紙1がありません");
    assert(appendix.htmlText.includes("株式会社 千葉福祉サポート"), "別紙セットに事業者名がありません");
    console.log("  OK", appendix.filePath, appendix.size, "bytes");

    const allFiles = EXISTING.concat(Object.values(TARGETS));
    allFiles.forEach(function(name){
      const filePath = path.join(outputDir, name);
      assert(fs.existsSync(filePath), "提出セットに不足: " + name);
      console.log("SET", name, fs.statSync(filePath).size, "bytes");
    });
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
