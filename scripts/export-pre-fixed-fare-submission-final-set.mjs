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

const PDF_MARGIN = { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" };
const FOOTER_TEMPLATE = "<div style='font-size:9px;width:100%;text-align:center;color:#505050;'><span class='pageNumber'></span></div>";

const CANDIDATE_SOURCES = {
  application: "pre-fixed-fare-application-form-style2-v1-candidate.pdf",
  screenEvidence: "pre-fixed-fare-screen-evidence-v1-candidate.pdf",
  operations: "pre-fixed-fare-operations-summary-v1-candidate.pdf",
  qa: "pre-fixed-fare-qa-v1-candidate.pdf",
  appendix: "pre-fixed-fare-submission-appendix-set-v1-candidate.pdf"
};

const FINAL_TARGETS = {
  reviewChecklist: "pre-fixed-fare-review-checklist-v1-final-candidate.pdf",
  attachmentIndex: "pre-fixed-fare-attachment-index-v1-final-candidate.pdf",
  integrated: "pre-fixed-fare-integrated-summary-v1-final-candidate.pdf",
  fullSet: "pre-fixed-fare-submission-full-set-v1-final-candidate.pdf"
};

const CANDIDATE_APPENDIX_PARTS = [
  "application-helper",
  "distance-fare-table",
  "service-fee-table"
];

const MERGE_ORDER = [
  { key: "application", source: CANDIDATE_SOURCES.application },
  { key: "reviewChecklist", source: FINAL_TARGETS.reviewChecklist },
  { key: "attachmentIndex", source: FINAL_TARGETS.attachmentIndex },
  { key: "screenEvidence", source: CANDIDATE_SOURCES.screenEvidence },
  { key: "integrated", source: FINAL_TARGETS.integrated },
  { key: "operations", source: CANDIDATE_SOURCES.operations },
  { key: "qa", source: CANDIDATE_SOURCES.qa },
  { key: "appendix", source: CANDIDATE_SOURCES.appendix }
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
    // ignore
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

async function findPdfPageMarkers(browser, filePath, markers){
  const page = await browser.newPage();
  const pdfBase64 = fs.readFileSync(filePath).toString("base64");
  const result = await page.evaluate(async function(base64, markers){
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
    const found = {};
    for(let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++){
      const pdfPage = await doc.getPage(pageNumber);
      const textContent = await pdfPage.getTextContent();
      const text = textContent.items.map(function(item){ return item.str; }).join("");
      markers.forEach(function(marker){
        if(!found[marker] && text.includes(marker)){
          found[marker] = pageNumber;
        }
      });
    }
    return found;
  }, pdfBase64, markers);
  await page.close();
  return result;
}

async function exportReviewChecklistPdf(browser, page){
  const built = await page.evaluate(function(){
    const reportData = window.PreFixedFareReviewChecklistData.buildReportData();
    const html = window.PreFixedFareReviewChecklistPdf.buildPrintDocument(reportData);
    return {
      html: html,
      htmlText: window.PreFixedFareReviewChecklistPdf.buildReportHtml(reportData).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    };
  });
  assert(built.htmlText.includes("認可審査確認ポイント一覧"), "審査確認ポイント一覧タイトルがありません");
  assert(built.htmlText.includes("2以上の走行予定ルート提示"), "審査確認ポイントにルート提示がありません");
  assert(built.htmlText.includes("800") || built.htmlText.includes("各種料金"), "審査確認ポイントに各種料金区分がありません");
  const filePath = path.join(outputDir, FINAL_TARGETS.reviewChecklist);
  const result = await exportPdfFromHtml(browser, built.html, filePath, { footer: false });
  assert(result.pageCount >= 1 && result.pageCount <= 3, "審査確認ポイント一覧のページ数が想定外: " + result.pageCount);
  return result;
}

async function exportIntegratedReviewPdf(browser, page, options){
  const built = await page.evaluate(function(exportOptions){
    const reportData = window.PreFixedFareIntegratedSummaryData.buildReportData(exportOptions);
    reportData.reviewOriented = true;
    const html = window.PreFixedFareIntegratedSummaryPdf.buildPrintDocument(reportData, { reviewOriented: true });
    return {
      html: html,
      htmlText: window.PreFixedFareIntegratedSummaryPdf.buildReviewOrientedReportHtml(reportData).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    };
  }, options);
  assert(built.htmlText.includes("認可審査要件への対応"), "統合説明（審査向け）に第2章がありません");
  assert(built.htmlText.includes("実画面証跡"), "統合説明（審査向け）に画面証跡章がありません");
  assert(built.htmlText.includes("運用開始前確認項目"), "統合説明（審査向け）に運用開始前確認項目がありません");
  assert(!built.html.includes("capture-image"), "統合説明資料に重複キャプチャ画像が残っています");
  const filePath = path.join(outputDir, FINAL_TARGETS.integrated);
  const result = await exportPdfFromHtml(browser, built.html, filePath, { footer: true });
  assert(result.size > 200000, "統合説明資料（final）が小さすぎます");
  return result;
}

async function exportAttachmentIndexPdf(browser, page, pageMap){
  const built = await page.evaluate(function(pageMap){
    const reportData = window.PreFixedFareAttachmentIndexData.buildReportData(pageMap);
    const html = window.PreFixedFareAttachmentIndexPdf.buildPrintDocument(reportData);
    return {
      html: html,
      htmlText: window.PreFixedFareAttachmentIndexPdf.buildReportHtml(reportData).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      rows: reportData.rows
    };
  }, pageMap);
  assert(built.htmlText.includes("添付資料一覧"), "添付資料一覧タイトルがありません");
  assert(built.htmlText.includes("資料1"), "添付資料一覧に資料1がありません");
  assert(built.htmlText.includes("別紙1"), "添付資料一覧に別紙1がありません");
  const filePath = path.join(outputDir, FINAL_TARGETS.attachmentIndex);
  const result = await exportPdfFromHtml(browser, built.html, filePath, { footer: false });
  assert(result.pageCount >= 1 && result.pageCount <= 3, "添付資料一覧のページ数が想定外: " + result.pageCount);
  return result;
}

async function extractPdfPageTexts(browser, filePath){
  const page = await browser.newPage();
  const pdfBase64 = fs.readFileSync(filePath).toString("base64");
  const texts = await page.evaluate(async function(base64){
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
    const pageTexts = [];
    for(let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++){
      const pdfPage = await doc.getPage(pageNumber);
      const textContent = await pdfPage.getTextContent();
      pageTexts.push(textContent.items.map(function(item){ return item.str; }).join(""));
    }
    return pageTexts;
  }, pdfBase64);
  await page.close();
  return texts;
}

async function exportApplicationPdf(browser, page){
  const saved = JSON.parse(fs.readFileSync(path.join(rootDir, "data/pre-fixed-fare-application.json"), "utf8"));
  const html = await page.evaluate(function(data){
    return window.PreFixedFareApplicationPrint.buildPrintDocument(data, { autoPrint: false });
  }, saved);
  const filePath = path.join(outputDir, CANDIDATE_SOURCES.application);
  const result = await exportPdfFromHtml(browser, html, filePath, { footer: false });
  assert(result.pageCount === 1, "申請書が1ページではありません: " + result.pageCount);
  return result;
}

async function exportScreenEvidencePdf(browser, page){
  const built = await page.evaluate(async function(){
    const reportData = window.PreFixedFareScreenEvidenceData.buildReportData();
    const availability = await window.PreFixedFareScreenEvidencePdf.probeImages(
      reportData.screens || [],
      reportData.supplementPage
    );
    const reportHtml = window.PreFixedFareScreenEvidencePdf.buildReportHtml(reportData, availability);
    const css = window.PreFixedFareScreenEvidencePdf.getEvidenceCss
      ? window.PreFixedFareScreenEvidencePdf.getEvidenceCss()
      : "";
    return {
      html: "<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'><style>" + css + "</style></head><body>" + reportHtml + "</body></html>",
      htmlText: reportHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    };
  });
  assert(built.html.includes("screen-evidence-shot--meter-detail"), "画面証跡HTMLに予約詳細拡大枠がありません");
  const filePath = path.join(outputDir, CANDIDATE_SOURCES.screenEvidence);
  const result = await exportPdfFromHtml(browser, built.html, filePath, { footer: false });
  assert(result.pageCount === 7, "画面証跡PDFが7ページではありません: " + result.pageCount);
  return result;
}

async function exportOperationsPdf(browser, page){
  const html = await page.evaluate(function(){
    const reportData = window.PreFixedFareOperationsSummaryData.buildReportData();
    return window.PreFixedFareOperationsSummaryPdf.buildPrintDocument(reportData);
  });
  const filePath = path.join(outputDir, CANDIDATE_SOURCES.operations);
  return exportPdfFromHtml(browser, html, filePath, { footer: true });
}

async function exportQaPdf(browser, page){
  const html = await page.evaluate(function(){
    const reportData = window.PreFixedFareQaData.buildReportData();
    return window.PreFixedFareQaPdf.buildPrintDocument(reportData);
  });
  const filePath = path.join(outputDir, CANDIDATE_SOURCES.qa);
  return exportPdfFromHtml(browser, html, filePath, { footer: false });
}

async function exportAppendixPdf(browser, page, exportOptions){
  const built = await page.evaluate(function(exportOptions){
    const result = window.PreFixedFareSubmissionAppendixWord.buildWordDocumentHtml("submission-appendix-set", exportOptions);
    return { html: result.html };
  }, Object.assign({}, exportOptions || {}, { appendixParts: CANDIDATE_APPENDIX_PARTS }));
  const filePath = path.join(outputDir, CANDIDATE_SOURCES.appendix);
  return exportPdfFromHtml(browser, built.html, filePath, { footer: false });
}

async function verifyFinalSetStructure(browser, filePath){
  const pages = await extractPdfPageTexts(browser, filePath);
  assert(pages.length >= 54 && pages.length <= 60, "final-candidateのページ数が想定外: " + pages.length);
  const p1 = pages[0] || "";
  const p2 = pages[1] || "";
  const p3 = pages[2] || "";
  const p4 = pages[3] || "";
  const p5 = pages[4] || "";
  const p12 = pages[11] || "";
  assert(p1.includes("認可申請書") || p1.includes("申請書") || p1.includes("設定認可"), "P1に申請書がありません");
  assert(p2.includes("審査確認ポイント") || p2.includes("申請様式"), "P2に審査確認ポイント一覧がありません");
  assert(p4.includes("添付資料") || p4.includes("資料1"), "P4に添付資料一覧がありません");
  assert(p5.includes("証跡") || p5.includes("EST-20260705") || p5.includes("28,000"), "P5に画面証跡表紙がありません");
  const allText = pages.join("");
  assert(allText.includes("認可審査要件への対応") || allText.includes("審査論点順"), "統合説明に審査向け10章構成がありません");
  assert(allText.includes("第10章") || allText.includes("事前確定運賃の申請概要"), "統合説明に第10章がありません");
  assert(!allText.includes("利用者向け見積シミュレーターの動作と判定ロジック"), "統合説明が旧6章構成のままです");
  return { pageCount: pages.length, pages: pages };
}

async function ensureCandidateParts(browser, page, exportOptions){
  console.log("Exporting application form...");
  const application = await exportApplicationPdf(browser, page);
  console.log("  OK application", application.pageCount, "pages");

  console.log("Exporting screen evidence...");
  const screenEvidence = await exportScreenEvidencePdf(browser, page);
  console.log("  OK screen-evidence", screenEvidence.pageCount, "pages");

  console.log("Exporting operations summary...");
  const operations = await exportOperationsPdf(browser, page);
  console.log("  OK operations", operations.pageCount, "pages");

  console.log("Exporting Q&A...");
  const qa = await exportQaPdf(browser, page);
  console.log("  OK qa", qa.pageCount, "pages");

  console.log("Exporting appendix set...");
  const appendix = await exportAppendixPdf(browser, page, exportOptions);
  console.log("  OK appendix", appendix.pageCount, "pages");

  return {
    application: application.pageCount,
    screenEvidence: screenEvidence.pageCount,
    operations: operations.pageCount,
    qa: qa.pageCount,
    appendix: appendix.pageCount
  };
}

async function buildPageMap(partCounts, appendixMarkers, appendixStart){
  const parts = [];
  let page = 1;
  MERGE_ORDER.forEach(function(def){
    const pages = def.key === "attachmentIndex"
      ? (partCounts.attachmentIndex || 1)
      : (partCounts[def.key] || 0);
    parts.push({ key: def.key, pages: pages, start: page, end: page + pages - 1 });
    page += pages;
  });
  const map = windowLikeComputePageMap(parts);
  if(appendixMarkers["別紙1"] && appendixStart){
    const offset = appendixStart - 1;
    map.appendix1 = {
      start: offset + appendixMarkers["別紙1"],
      end: offset + (appendixMarkers["別紙2"] ? appendixMarkers["別紙2"] - 1 : partCounts.appendix + offset),
      pages: appendixMarkers["別紙2"] ? appendixMarkers["別紙2"] - appendixMarkers["別紙1"] : 2
    };
    map.appendix2 = {
      start: offset + appendixMarkers["別紙2"],
      end: offset + partCounts.appendix,
      pages: partCounts.appendix + offset - (offset + appendixMarkers["別紙2"]) + 1
    };
  }
  return map;
}

function windowLikeComputePageMap(parts){
  const map = {};
  (parts || []).forEach(function(part){
    const pages = Number(part.pages) || 0;
    if(pages < 1){
      return;
    }
    map[part.key] = {
      start: part.start,
      end: part.end,
      pages: pages
    };
  });
  if(map.integrated){
    map.integratedE2E = Object.assign({}, map.integrated);
  }
  return map;
}

function buildAttachmentRowsFromMap(pageMap){
  function range(key){
    const entry = pageMap[key] || {};
    if(!entry.start){
      return "—";
    }
    if(!entry.end || entry.end <= entry.start){
      return "P" + entry.start;
    }
    return "P" + entry.start + "〜P" + entry.end;
  }
  const screen = pageMap.screenEvidence || {};
  const screenStart = screen.start || 0;
  const screenPages = screen.pages || 7;
  return [
    ["資料1", "申請書", "申請者、営業区域、運賃及び料金の種類・額・適用方法", range("application"), ""],
    ["資料2", "審査確認ポイント一覧", "認可審査時の主要確認項目と掲載資料の対応", range("reviewChecklist"), ""],
    ["資料3", "実画面証跡資料", "ルート選択、旅客同意、ドライバー確認、領収書、各種料金確認", range("screenEvidence"), "表紙・案件情報含む"],
    ["資料4", "システム概要・公示要件対応表", "算定式、公示要件対応、ルート提示、同意、監査証跡の統合説明", range("integrated"), "統合説明資料（審査向け章構成）"],
    ["資料5", "運用・監査説明資料", "運行フロー、旅客都合変更、E2E、保存・照合の運用説明", range("operations"), ""],
    ["資料6", "Q&A", "想定質問と回答、運輸局説明用の短答", range("qa"), ""],
    ["別紙1", "距離制運賃表", "初乗運賃、加算運賃、深夜早朝割増、障害者割引、端数処理、適用開始予定日", range("appendix1") || range("appendix"), "別紙セット内"],
    ["別紙2", "各種料金表", "迎車料、介助料、待機料、付き添い料、有料道路代、駐車場代等", range("appendix2") || range("appendix"), "別紙セット内"],
    [
      "補足資料",
      "乗務員端末における各種料金確認画面証跡",
      "事前確定運賃本体と各種料金の別行確認・精算",
      screenStart ? ("P" + (screenStart + screenPages - 1)) : "—",
      "画面証跡資料P7"
    ],
    [
      "補足資料",
      "E2E確認結果・保存規程・改ざん検知説明",
      "本番相当環境E2E、データ保存規程、snapshotHash照合",
      range("integrated"),
      "統合説明資料第7〜8章、運用・監査説明資料"
    ]
  ];
}

async function mergeFullSet(){
  const mergedPdf = await PDFDocument.create();
  const partSummaries = [];
  for(const def of MERGE_ORDER){
    const filePath = path.join(outputDir, def.source);
    const bytes = fs.readFileSync(filePath);
    const partPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = partPdf.getPageCount();
    const copiedPages = await mergedPdf.copyPages(partPdf, partPdf.getPageIndices());
    copiedPages.forEach(function(page){ mergedPdf.addPage(page); });
    partSummaries.push({ key: def.key, filename: def.source, pages: pageCount });
  }
  const outputPath = path.join(outputDir, FINAL_TARGETS.fullSet);
  fs.writeFileSync(outputPath, await mergedPdf.save());
  return {
    outputPath: outputPath,
    totalPages: mergedPdf.getPageCount(),
    parts: partSummaries,
    size: fs.statSync(outputPath).size
  };
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

    console.log("Checking candidate PDF parts...");
    const candidateCounts = await ensureCandidateParts(browser, page, exportOptions);
    console.log("  candidate parts OK", candidateCounts);

    console.log("Exporting review checklist...");
    const reviewChecklist = await exportReviewChecklistPdf(browser, page);
    console.log("  OK", reviewChecklist.pageCount, "pages");

    console.log("Exporting integrated summary (review-oriented)...");
    const integrated = await exportIntegratedReviewPdf(browser, page, exportOptions);
    console.log("  OK", integrated.pageCount, "pages");

    const provisionalCounts = Object.assign({}, candidateCounts, {
      reviewChecklist: reviewChecklist.pageCount,
      integrated: integrated.pageCount,
      attachmentIndex: 1
    });
    let runningPage = 1;
    const provisionalParts = [];
    MERGE_ORDER.forEach(function(def){
      const pages = provisionalCounts[def.key];
      provisionalParts.push({ key: def.key, pages: pages, start: runningPage, end: runningPage + pages - 1 });
      runningPage += pages;
    });
    let provisionalMap = windowLikeComputePageMap(provisionalParts);
    const appendixPath = path.join(outputDir, CANDIDATE_SOURCES.appendix);
    const appendixMarkers = await findPdfPageMarkers(browser, appendixPath, ["別紙1", "別紙2", "距離制運賃表", "各種料金表"]);
    const appendixPart = provisionalParts.find(function(p){ return p.key === "appendix"; });
    if(appendixMarkers["別紙1"] && appendixPart){
      const offset = appendixPart.start - 1;
      provisionalMap.appendix1 = {
        start: offset + appendixMarkers["別紙1"],
        end: appendixMarkers["別紙2"] ? offset + appendixMarkers["別紙2"] - 1 : appendixPart.end,
        pages: appendixMarkers["別紙2"] ? appendixMarkers["別紙2"] - appendixMarkers["別紙1"] : 2
      };
      provisionalMap.appendix2 = {
        start: offset + (appendixMarkers["別紙2"] || appendixMarkers["別紙1"]),
        end: appendixPart.end,
        pages: appendixPart.end - (offset + (appendixMarkers["別紙2"] || appendixMarkers["別紙1"])) + 1
      };
    }

    console.log("Exporting attachment index (provisional page map)...");
    let attachmentIndex = await exportAttachmentIndexPdf(browser, page, provisionalMap);
    console.log("  OK", attachmentIndex.pageCount, "pages");

    provisionalCounts.attachmentIndex = attachmentIndex.pageCount;
    runningPage = 1;
    const finalParts = [];
    MERGE_ORDER.forEach(function(def){
      const pages = provisionalCounts[def.key];
      finalParts.push({ key: def.key, pages: pages, start: runningPage, end: runningPage + pages - 1 });
      runningPage += pages;
    });
    const finalMap = windowLikeComputePageMap(finalParts);
    if(appendixMarkers["別紙1"] || appendixMarkers["距離制運賃表"]){
      const appendixPartFinal = finalParts.find(function(p){ return p.key === "appendix"; });
      const offset = appendixPartFinal.start - 1;
      const a1Page = appendixMarkers["距離制運賃表"] || appendixMarkers["別紙1"];
      const a2Page = appendixMarkers["各種料金表"] || appendixMarkers["別紙2"];
      const a1 = offset + a1Page;
      const a2 = a2Page ? offset + a2Page : null;
      if(a2 && a2 > a1){
        finalMap.appendix1 = { start: a1, end: a2 - 1, pages: a2 - a1 };
        finalMap.appendix2 = { start: a2, end: appendixPartFinal.end, pages: appendixPartFinal.end - a2 + 1 };
      }else{
        finalMap.appendix1 = { start: a1, end: appendixPartFinal.end, pages: appendixPartFinal.end - a1 + 1 };
        finalMap.appendix2 = { start: a1, end: appendixPartFinal.end, pages: appendixPartFinal.end - a1 + 1 };
      }
    }

    if(attachmentIndex.pageCount !== 1){
      console.log("Re-exporting attachment index with adjusted page map...");
      attachmentIndex = await exportAttachmentIndexPdf(browser, page, finalMap);
    }else{
      attachmentIndex = await exportAttachmentIndexPdf(browser, page, finalMap);
    }

    console.log("Building final-candidate full set...");
    const fullSet = await mergeFullSet();
    const trimResult = await trimTrailingBlankPages(browser, fullSet.outputPath);
    if(trimResult.trimmed > 0){
      fullSet.totalPages = trimResult.numPages;
      fullSet.size = fs.statSync(fullSet.outputPath).size;
      console.log("  trimmed trailing blank pages:", trimResult.trimmed);
    }
    console.log("  OK", fullSet.outputPath, fullSet.totalPages, "pages");

    const checks = [
      { label: "review-checklist", path: path.join(outputDir, FINAL_TARGETS.reviewChecklist) },
      { label: "attachment-index", path: path.join(outputDir, FINAL_TARGETS.attachmentIndex) },
      { label: "integrated-final", path: path.join(outputDir, FINAL_TARGETS.integrated) },
      { label: "full-set-final", path: fullSet.outputPath }
    ];
    console.log("Blank page verification...");
    for(const check of checks){
      const review = await verifyPdfBlankPages(browser, check.path);
      assert(review.blankPages.length === 0, check.label + " に白紙ページがあります: " + review.blankPages.join(", "));
      console.log("  ", check.label, review.numPages, "pages, blank=0");
    }

    const fullText = await verifyPdfBlankPages(browser, fullSet.outputPath);
    const joined = fullText.pageTexts.join(" ");
    assert(joined.includes("審査確認ポイント") || joined.includes("申請様式"), "一式に審査確認ポイント一覧がありません");
    assert(joined.includes("添付資料") || joined.includes("資料1"), "一式に添付資料一覧がありません");
    assert(joined.includes("28") && joined.includes("000"), "一式に確定運賃がありません");
    assert(joined.includes("800"), "一式に迎車料800円がありません");

    const structure = await verifyFinalSetStructure(browser, fullSet.outputPath);
    console.log("Final set structure OK", structure.pageCount, "pages");

    console.log("SUMMARY", JSON.stringify({
      reviewChecklistPages: reviewChecklist.pageCount,
      attachmentIndexPages: attachmentIndex.pageCount,
      integratedFinalPages: integrated.pageCount,
      fullSetFinalPages: fullSet.totalPages,
      fullSetParts: fullSet.parts,
      pageMap: finalMap
    }, null, 2));

    fs.writeFileSync(
      path.join(outputDir, ".final-set-page-map.json"),
      JSON.stringify(finalMap, null, 2),
      "utf8"
    );
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
