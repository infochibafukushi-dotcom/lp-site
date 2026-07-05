import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import {
  buildApplicationChildren,
  buildAppendixApplicationHelper,
  buildAppendixDistanceFare,
  buildAppendixServiceFee,
  buildAppendixSetCover,
  buildAttachmentIndexChildren,
  buildQaChildren,
  buildReviewChecklistChildren,
  buildScreenEvidenceChildren,
  createSubmissionDocument,
  htmlToDocxChildren,
  writeDocxFile
} from "./lib/pre-fixed-fare-word-docx-builder.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = pathToFileURL(path.join(rootDir, "admin.html")).href;
const outputDir = path.join(rootDir, "docs/submission/20260705");
const evidenceDir = path.join(rootDir, "assets/evidence/pre-fixed-fare-20260705");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const FULL_SET_DOCX = "pre-fixed-fare-submission-full-set-v1-final-candidate.docx";

const CANDIDATE_APPENDIX_PARTS = [
  "application-helper",
  "distance-fare-table",
  "service-fee-table"
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

function readImageMap(screens, supplementPage){
  const map = {};
  const files = (screens || []).map(function(screen){ return screen.imageFile; });
  if(supplementPage && supplementPage.imageFile){
    files.push(supplementPage.imageFile);
  }
  files.forEach(function(imageFile){
    const filePath = path.join(evidenceDir, imageFile || "");
    if(imageFile && fs.existsSync(filePath)){
      map[imageFile] = fs.readFileSync(filePath);
    }
  });
  return map;
}

async function extractSubmissionData(page, pageMap){
  return page.evaluate(async function(appendixParts, pageMap){
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

    const exportOptions = { config: config, estimateConfig: estimateConfig };
    let applicationSaved = {};
    try{
      const appRes = await fetch("./data/pre-fixed-fare-application.json?" + Date.now(), { cache: "no-store" });
      if(appRes.ok) applicationSaved = await appRes.json();
    }catch(error){
      console.warn("application fetch fallback", error);
    }

    const applicationData = window.PreFixedFareApplicationPrint.normalizeFormData(applicationSaved, exportOptions);
    const reiwa = window.PreFixedFareApplicationPrint.formatReiwaDate(applicationData.applicationDate);

    const reviewChecklist = window.PreFixedFareReviewChecklistData.buildReportData();
    const attachmentIndex = window.PreFixedFareAttachmentIndexData.buildReportData(pageMap || {});
    const screenEvidence = window.PreFixedFareScreenEvidenceData.buildReportData();
    const integratedData = window.PreFixedFareIntegratedSummaryData.buildReportData(exportOptions);
    integratedData.reviewOriented = true;
    const integratedHtml = window.PreFixedFareIntegratedSummaryPdf.buildReviewOrientedReportHtml(integratedData);
    const operationsData = window.PreFixedFareOperationsSummaryData.buildReportData();
    const operationsHtml = window.PreFixedFareOperationsSummaryPdf.buildReportHtml(operationsData);
    const qaData = window.PreFixedFareQaData.buildReportData();

    const appendixSetPayload = window.PreFixedFareSubmissionAppendixData.buildDocumentPayload(
      "submission-appendix-set",
      Object.assign({}, exportOptions, { appendixParts: appendixParts })
    );
    const appendixPayloads = appendixParts.map(function(partId){
      return window.PreFixedFareSubmissionAppendixData.buildDocumentPayload(partId, exportOptions);
    });

    return {
      applicationData: Object.assign({}, applicationData, { reiwaDisplay: reiwa.display }),
      reviewChecklist: reviewChecklist,
      attachmentIndex: attachmentIndex,
      screenEvidence: screenEvidence,
      integratedHtml: integratedHtml,
      operationsHtml: operationsHtml,
      qaData: qaData,
      appendixSetPayload: appendixSetPayload,
      appendixPayloads: appendixPayloads
    };
  }, CANDIDATE_APPENDIX_PARTS, pageMap);
}

function buildFinalFullSetSections(data, imageMap){
  const appendixById = {};
  (data.appendixPayloads || []).forEach(function(payload){
    appendixById[payload.documentId] = payload;
  });

  const sections = [
    buildApplicationChildren(data.applicationData),
    buildReviewChecklistChildren(data.reviewChecklist),
    buildAttachmentIndexChildren(data.attachmentIndex),
    buildScreenEvidenceChildren(data.screenEvidence, imageMap),
    htmlToDocxChildren(data.integratedHtml),
    htmlToDocxChildren(data.operationsHtml),
    buildQaChildren(data.qaData),
    buildAppendixSetCover(data.appendixSetPayload)
      .concat(buildAppendixApplicationHelper(appendixById["application-helper"] || {}))
  ];

  if(appendixById["distance-fare-table"]){
    sections.push(buildAppendixDistanceFare(appendixById["distance-fare-table"]));
  }
  if(appendixById["service-fee-table"]){
    sections.push(buildAppendixServiceFee(appendixById["service-fee-table"]));
  }

  return sections;
}

function loadPageMapFromSummary(){
  const summaryPath = path.join(outputDir, ".final-set-page-map.json");
  if(fs.existsSync(summaryPath)){
    try{
      return JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    }catch(error){
      console.warn("page map read failed", error);
    }
  }
  return {};
}

async function main(){
  const pageMap = loadPageMapFromSummary();
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
    const data = await extractSubmissionData(page, pageMap);
    const imageMap = readImageMap(data.screenEvidence.screens, data.screenEvidence.supplementPage);
    assert(Object.keys(imageMap).length >= 6, "画面証跡画像が不足: " + Object.keys(imageMap).length);

    console.log("Building final-candidate Word document...");
    const sections = buildFinalFullSetSections(data, imageMap);
    const doc = createSubmissionDocument(sections);
    const fullSetPath = path.join(outputDir, FULL_SET_DOCX);
    const fullSetResult = await writeDocxFile(doc, fullSetPath);
    console.log("  OK", fullSetResult.filePath, fullSetResult.size, "bytes");

    assert(data.reviewChecklist.checkpoints.length === 16, "審査確認ポイントが16件ではありません");
    assert((data.attachmentIndex.rows || []).length >= 8, "添付資料一覧の行数が不足");
    assert(data.integratedHtml.includes("認可審査要件への対応"), "Word統合説明に審査向け章がありません");
    assert(data.integratedHtml.includes("運用開始前確認項目"), "Word統合説明に運用開始前確認項目がありません");

    const feePayload = (data.appendixPayloads || []).find(function(p){ return p.documentId === "service-fee-table"; });
    const feeText = JSON.stringify(feePayload || {});
    assert(feeText.includes("800"), "別紙2に迎車料800円がありません");

    console.log("SUMMARY", JSON.stringify({
      fullSetDocx: FULL_SET_DOCX,
      fullSetSize: fullSetResult.size,
      screenEvidenceImages: Object.keys(imageMap).length,
      reviewCheckpoints: data.reviewChecklist.checkpoints.length,
      attachmentRows: (data.attachmentIndex.rows || []).length
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
