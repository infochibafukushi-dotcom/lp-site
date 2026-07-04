import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { verifyPdfBlankPages } from "./verify-pdf-blank-pages.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = pathToFileURL(path.join(rootDir, "admin.html")).href;
const outputDir = path.join(rootDir, "docs/submission/20260705");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const PDF_MARGIN = { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" };
const FOOTER_TEMPLATE = "<div style='font-size:9px;width:100%;text-align:center;color:#505050;'><span class='pageNumber'></span></div>";

const TARGETS = {
  application: "pre-fixed-fare-application-form-style2-v1-candidate.pdf",
  screenEvidence: "pre-fixed-fare-screen-evidence-v1-candidate.pdf",
  integrated: "pre-fixed-fare-integrated-summary-v1-candidate.pdf",
  operations: "pre-fixed-fare-operations-summary-v1-candidate.pdf",
  qa: "pre-fixed-fare-qa-v1-candidate.pdf",
  appendix: "pre-fixed-fare-submission-appendix-set-v1-candidate.pdf",
  fullSet: "pre-fixed-fare-submission-full-set-v1-candidate.pdf"
};

const CANDIDATE_APPENDIX_PARTS = [
  "application-helper",
  "distance-fare-table"
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

async function exportPdfFromHtml(browser, html, filePath, options){
  options = options || {};
  const tempHtmlPath = path.join(rootDir, ".tmp-export-" + path.basename(filePath, ".pdf") + ".html");
  fs.writeFileSync(tempHtmlPath, html, "utf8");
  const page = await browser.newPage();
  await page.goto(pathToFileURL(tempHtmlPath).href, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(async function(){
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
  await new Promise(function(resolve){ setTimeout(resolve, 1200); });
  const pdfOptions = {
    path: filePath,
    format: "A4",
    printBackground: true,
    margin: PDF_MARGIN
  };
  if(options.footer){
    pdfOptions.displayHeaderFooter = true;
    pdfOptions.headerTemplate = "<div></div>";
    pdfOptions.footerTemplate = FOOTER_TEMPLATE;
  }
  await page.pdf(pdfOptions);
  const htmlText = await page.evaluate(function(){
    return document.body ? document.body.innerText : "";
  });
  await page.close();
  try{
    fs.unlinkSync(tempHtmlPath);
  }catch(error){
    // ignore cleanup errors
  }
  const size = fs.statSync(filePath).size;
  const pageCount = await getPdfPageCount(filePath);
  return { filePath: filePath, size: size, htmlText: htmlText, pageCount: pageCount };
}

async function getPdfPageCount(filePath){
  const bytes = fs.readFileSync(filePath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getPageCount();
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

async function exportApplicationPdf(browser, page){
  const saved = JSON.parse(fs.readFileSync(path.join(rootDir, "data/pre-fixed-fare-application.json"), "utf8"));
  const html = await page.evaluate(function(data){
    return window.PreFixedFareApplicationPrint.buildPrintDocument(data, { autoPrint: false });
  }, saved);
  const filePath = path.join(outputDir, TARGETS.application);
  const result = await exportPdfFromHtml(browser, html, filePath, { footer: false });
  assert(result.pageCount === 1, "申請書様式2が1ページではありません: " + result.pageCount);
  assert(result.htmlText.includes("添付書類等"), "申請書に添付書類等がありません");
  return result;
}

async function exportScreenEvidencePdf(browser, page){
  const built = await page.evaluate(async function(){
    const reportData = window.PreFixedFareScreenEvidenceData.buildReportData();
    const availability = await window.PreFixedFareScreenEvidencePdf.probeImages(reportData.screens || []);
    const reportHtml = window.PreFixedFareScreenEvidencePdf.buildReportHtml(reportData, availability);
    const css = window.PreFixedFareScreenEvidencePdf.getEvidenceCss
      ? window.PreFixedFareScreenEvidencePdf.getEvidenceCss()
      : "";
    return {
      html: "<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'><style>" + css + "</style></head><body>" + reportHtml + "</body></html>",
      htmlText: reportHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      projectNumber: reportData.caseInfo?.projectNumber || ""
    };
  });
  assert(built.html.includes("screen-evidence-shot--receipt"), "画面証跡HTMLにレシート枠がありません");
  const filePath = path.join(outputDir, TARGETS.screenEvidence);
  const result = await exportPdfFromHtml(browser, built.html, filePath, { footer: false });
  assert(result.pageCount === 5, "画面証跡PDFが5ページではありません: " + result.pageCount);
  assert(built.htmlText.includes("260705-MAINS-0001"), "画面証跡に案件番号がありません");
  assert(built.htmlText.includes("28,000"), "画面証跡に確定運賃がありません");
  return result;
}

async function exportIntegratedPdf(browser, page, options){
  const built = await page.evaluate(function(exportOptions){
    const reportData = window.PreFixedFareIntegratedSummaryData.buildReportData(exportOptions);
    const html = window.PreFixedFareIntegratedSummaryPdf.buildPrintDocument(reportData);
    return {
      html: html,
      htmlText: window.PreFixedFareIntegratedSummaryPdf.buildReportHtml(reportData).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    };
  }, options);
  assert(built.html.includes("画面証跡資料"), "統合説明資料に画面証跡参照文がありません");
  assert(!built.html.includes("capture-image"), "統合説明資料に重複キャプチャ画像が残っています");
  assert(built.html.includes("page-break-before table-section no-split-table"), "平準化係数表の改ページクラスがありません");
  const filePath = path.join(outputDir, TARGETS.integrated);
  const result = await exportPdfFromHtml(browser, built.html, filePath, { footer: true });
  assert(result.size > 200000, "統合説明資料PDFが小さすぎます");
  assert(result.htmlText.includes("事前確定運賃システム 統合説明資料"), "統合説明資料タイトル不正");
  return result;
}

async function exportOperationsPdf(browser, page){
  const html = await page.evaluate(function(){
    const reportData = window.PreFixedFareOperationsSummaryData.buildReportData();
    return window.PreFixedFareOperationsSummaryPdf.buildPrintDocument(reportData);
  });
  const filePath = path.join(outputDir, TARGETS.operations);
  const result = await exportPdfFromHtml(browser, html, filePath, { footer: true });
  assert(result.size > 5000, "運用フローPDFが小さすぎます");
  assert(result.htmlText.includes("事前確定運賃M"), "運用フロー資料タイトル不正");
  return result;
}

async function exportQaPdf(browser, page){
  const html = await page.evaluate(function(){
    const reportData = window.PreFixedFareQaData.buildReportData();
    return window.PreFixedFareQaPdf.buildPrintDocument(reportData);
  });
  const filePath = path.join(outputDir, TARGETS.qa);
  const result = await exportPdfFromHtml(browser, html, filePath, { footer: false });
  assert(result.size > 20000, "Q&A PDFが小さすぎます");
  assert(result.htmlText.includes("想定質問と回答"), "Q&A HTMLが不正");
  return result;
}

async function exportAppendixPdf(browser, page, options){
  const exportOptions = Object.assign({}, options || {}, {
    appendixParts: CANDIDATE_APPENDIX_PARTS
  });
  const built = await page.evaluate(function(exportOptions){
    const result = window.PreFixedFareSubmissionAppendixWord.buildWordDocumentHtml("submission-appendix-set", exportOptions);
    return {
      html: result.html,
      title: result.payload.title
    };
  }, exportOptions);
  assert(built.html.length > 5000, "別紙セットHTMLが短すぎます");
  assert(built.html.includes("appendix-distance-fare"), "別紙1の改ページクラスがありません");
  assert(built.html.includes("appendix-section appendix-distance-fare"), "別紙1が新ページ開始用クラス付きではありません");
  assert(!built.html.includes("appendix-section appendix-service-fee"), "候補版別紙セットに別紙2が残っています");
  assert(!built.html.includes("appendix-section appendix-device-checklist"), "候補版別紙セットに別紙3が残っています");
  assert(!built.html.includes("appendix-section appendix-screen-reference"), "候補版別紙セットに別紙4が残っています");
  assert(built.html.includes("page-break-before table-section no-split-table"), "別紙の平準化係数表改ページクラスがありません");
  const filePath = path.join(outputDir, TARGETS.appendix);
  const result = await exportPdfFromHtml(browser, built.html, filePath, { footer: false });
  assert(result.size > 5000, "別紙セットPDFが小さすぎます");
  assert(result.htmlText.includes("別紙1"), "別紙セットに別紙1がありません");
  assert(!result.htmlText.includes("別紙2　各種料金表"), "候補版別紙セットに別紙2セクションが残っています");
  assert(result.pageCount <= 5, "候補版別紙セットのページ数が多すぎます: " + result.pageCount);
  return result;
}

async function trimTrailingBlankPages(browser, filePath){
  const review = await verifyPdfBlankPages(browser, filePath);
  let trimCount = 0;
  for(let index = review.pageTexts.length - 1; index >= 0; index--){
    const text = String(review.pageTexts[index] || "").replace(/\s+/g, "").trim();
    const ink = review.inkRatios[index] || 0;
    if(review.blankPages.includes(index + 1) || (text.length < 30 && ink < 0.01)){
      trimCount++;
      continue;
    }
    break;
  }
  if(trimCount === 0){
    return { trimmed: 0, numPages: review.numPages };
  }
  const bytes = fs.readFileSync(filePath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const keepCount = pdf.getPageCount() - trimCount;
  const trimmedPdf = await PDFDocument.create();
  const copiedPages = await trimmedPdf.copyPages(pdf, Array.from({ length: keepCount }, function(_, index){ return index; }));
  copiedPages.forEach(function(page){ trimmedPdf.addPage(page); });
  fs.writeFileSync(filePath, await trimmedPdf.save());
  return { trimmed: trimCount, numPages: keepCount };
}

async function buildFullSet(){
  const mergedPdf = await PDFDocument.create();
  const partSummaries = [];
  const order = [
    TARGETS.application,
    TARGETS.screenEvidence,
    TARGETS.integrated,
    TARGETS.operations,
    TARGETS.qa,
    TARGETS.appendix
  ];
  for(const filename of order){
    const filePath = path.join(outputDir, filename);
    const bytes = fs.readFileSync(filePath);
    const partPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = partPdf.getPageCount();
    const copiedPages = await mergedPdf.copyPages(partPdf, partPdf.getPageIndices());
    copiedPages.forEach(function(page){ mergedPdf.addPage(page); });
    partSummaries.push({ filename: filename, pages: pageCount });
  }
  const mergedBytes = await mergedPdf.save();
  const outputPath = path.join(outputDir, TARGETS.fullSet);
  fs.writeFileSync(outputPath, mergedBytes);
  return {
    outputPath: outputPath,
    totalPages: mergedPdf.getPageCount(),
    parts: partSummaries,
    size: mergedBytes.length
  };
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
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
    const exportOptions = await loadExportOptions(page);

    console.log("Exporting application form...");
    const application = await exportApplicationPdf(browser, page);
    console.log("  OK", application.filePath, application.size, "bytes", application.pageCount, "pages");

    console.log("Exporting screen evidence...");
    const screenEvidence = await exportScreenEvidencePdf(browser, page);
    console.log("  OK", screenEvidence.filePath, screenEvidence.size, "bytes", screenEvidence.pageCount, "pages");

    console.log("Exporting integrated summary...");
    const integrated = await exportIntegratedPdf(browser, page, exportOptions);
    console.log("  OK", integrated.filePath, integrated.size, "bytes", integrated.pageCount, "pages");

    console.log("Exporting operations summary...");
    const operations = await exportOperationsPdf(browser, page);
    console.log("  OK", operations.filePath, operations.size, "bytes", operations.pageCount, "pages");

    console.log("Exporting Q&A...");
    const qa = await exportQaPdf(browser, page);
    console.log("  OK", qa.filePath, qa.size, "bytes", qa.pageCount, "pages");

    console.log("Exporting appendix set...");
    const appendix = await exportAppendixPdf(browser, page, exportOptions);
    console.log("  OK", appendix.filePath, appendix.size, "bytes", appendix.pageCount, "pages");

    console.log("Building full set...");
    const fullSet = await buildFullSet();
    const trimResult = await trimTrailingBlankPages(browser, fullSet.outputPath);
    if(trimResult.trimmed > 0){
      fullSet.totalPages = trimResult.numPages;
      fullSet.size = fs.statSync(fullSet.outputPath).size;
      console.log("  trimmed trailing blank pages:", trimResult.trimmed);
    }
    console.log("  OK", fullSet.outputPath, fullSet.size, "bytes", fullSet.totalPages, "pages");

    const checks = [
      { label: "application", path: path.join(outputDir, TARGETS.application) },
      { label: "screen-evidence", path: path.join(outputDir, TARGETS.screenEvidence) },
      { label: "integrated", path: path.join(outputDir, TARGETS.integrated) },
      { label: "operations", path: path.join(outputDir, TARGETS.operations) },
      { label: "qa", path: path.join(outputDir, TARGETS.qa) },
      { label: "appendix", path: path.join(outputDir, TARGETS.appendix) },
      { label: "full-set", path: fullSet.outputPath }
    ];

    console.log("Blank page verification...");
    for(const check of checks){
      const review = await verifyPdfBlankPages(browser, check.path);
      assert(review.blankPages.length === 0, check.label + " に白紙ページがあります: " + review.blankPages.join(", "));
      console.log("  ", check.label, review.numPages, "pages, blank=0");
    }

    console.log("SUMMARY", JSON.stringify({
      applicationPages: application.pageCount,
      screenEvidencePages: screenEvidence.pageCount,
      integratedPages: integrated.pageCount,
      operationsPages: operations.pageCount,
      qaPages: qa.pageCount,
      appendixPages: appendix.pageCount,
      fullSetPages: fullSet.totalPages,
      fullSetParts: fullSet.parts
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
