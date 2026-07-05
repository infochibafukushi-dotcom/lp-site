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
  buildQaChildren,
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

const FULL_SET_DOCX = "pre-fixed-fare-submission-full-set-v1-candidate.docx";
const APPENDIX_SET_DOCX = "pre-fixed-fare-submission-appendix-set-v1-candidate.docx";

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

function readImageMap(screens){
  const map = {};
  (screens || []).forEach(function(screen){
    const filePath = path.join(evidenceDir, screen.imageFile || "");
    if(screen.imageFile && fs.existsSync(filePath)){
      map[screen.imageFile] = fs.readFileSync(filePath);
    }
  });
  return map;
}

async function extractSubmissionData(page){
  return page.evaluate(async function(appendixParts){
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

    const screenEvidence = window.PreFixedFareScreenEvidenceData.buildReportData();
    const integratedData = window.PreFixedFareIntegratedSummaryData.buildReportData(exportOptions);
    const integratedHtml = window.PreFixedFareIntegratedSummaryPdf.buildReportHtml(integratedData);
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
      screenEvidence: screenEvidence,
      integratedHtml: integratedHtml,
      operationsHtml: operationsHtml,
      qaData: qaData,
      appendixSetPayload: appendixSetPayload,
      appendixPayloads: appendixPayloads
    };
  }, CANDIDATE_APPENDIX_PARTS);
}

function buildFullSetSections(data, imageMap){
  const appendixById = {};
  (data.appendixPayloads || []).forEach(function(payload){
    appendixById[payload.documentId] = payload;
  });

  const sections = [
    buildApplicationChildren(data.applicationData),
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

function buildAppendixSetSections(data){
  const appendixById = {};
  (data.appendixPayloads || []).forEach(function(payload){
    appendixById[payload.documentId] = payload;
  });
  const sections = [
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

function countParagraphs(sections){
  return sections.reduce(function(sum, section){
    return sum + section.length;
  }, 0);
}

async function main(){
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
    const data = await extractSubmissionData(page);
    const imageMap = readImageMap(data.screenEvidence.screens || []);

    assert(data.integratedHtml.length > 5000, "統合説明資料HTMLが短すぎます");
    assert(data.operationsHtml.length > 3000, "運用フロー資料HTMLが短すぎます");
    assert((data.qaData.qaItems || []).length > 5, "Q&A項目が不足しています");
    assert(data.appendixPayloads.length === 3, "別紙パーツ数が3ではありません");

    const feePayload = data.appendixPayloads.find(function(item){
      return item.documentId === "service-fee-table";
    });
    const feeText = JSON.stringify(feePayload?.feeRows || []);
    assert(feeText.includes("800円"), "別紙2に迎車料800円がありません");
    assert(feeText.includes("1,100円"), "別紙2に乗降介助1,100円がありません");
    assert(feeText.includes("設定なし"), "別紙2に未設定項目がありません");

    const imageCount = Object.keys(imageMap).length;
    assert(imageCount >= 4, "画面証跡画像が4件未満です: " + imageCount);

    console.log("Building full set Word document...");
    const fullSections = buildFullSetSections(data, imageMap);
    const fullDoc = createSubmissionDocument(fullSections);
    const fullResult = await writeDocxFile(fullDoc, path.join(outputDir, FULL_SET_DOCX));
    console.log("  OK", fullResult.filePath, fullResult.size, "bytes", countParagraphs(fullSections), "blocks");

    console.log("Building appendix set Word document...");
    const appendixSections = buildAppendixSetSections(data);
    const appendixDoc = createSubmissionDocument(appendixSections);
    const appendixResult = await writeDocxFile(appendixDoc, path.join(outputDir, APPENDIX_SET_DOCX));
    console.log("  OK", appendixResult.filePath, appendixResult.size, "bytes", countParagraphs(appendixSections), "blocks");

    console.log("SUMMARY", JSON.stringify({
      fullSetDocx: FULL_SET_DOCX,
      fullSetSize: fullResult.size,
      appendixSetDocx: APPENDIX_SET_DOCX,
      appendixSetSize: appendixResult.size,
      screenEvidenceImages: imageCount,
      appendixParts: CANDIDATE_APPENDIX_PARTS
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
