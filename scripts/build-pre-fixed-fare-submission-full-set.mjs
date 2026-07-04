import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const submissionDir = path.join(rootDir, "docs/submission/20260705");
const outputFilename = "pre-fixed-fare-submission-full-set-v1-candidate.pdf";
const outputPath = path.join(submissionDir, outputFilename);

const SOURCE_FILES = [
  {
    order: 1,
    label: "申請書様式2",
    filename: "pre-fixed-fare-application-form-style2-v1-candidate.pdf"
  },
  {
    order: 2,
    label: "画面証跡資料",
    filename: "pre-fixed-fare-screen-evidence-v1-candidate.pdf"
  },
  {
    order: 3,
    label: "配車アプリ概要・統合説明資料",
    filename: "pre-fixed-fare-integrated-summary-v1-candidate.pdf"
  },
  {
    order: 4,
    label: "運用フロー資料",
    filename: "pre-fixed-fare-operations-summary-v1-candidate.pdf"
  },
  {
    order: 5,
    label: "Q&A資料",
    filename: "pre-fixed-fare-qa-v1-candidate.pdf"
  },
  {
    order: 6,
    label: "追加資料・別紙セット",
    filename: "pre-fixed-fare-submission-appendix-set-v1-candidate.pdf"
  }
];

function sha256(filePath){
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assert(condition, message){
  if(!condition){
    throw new Error(message);
  }
}

async function buildFullSet(){
  const sourceStats = SOURCE_FILES.map(function(item){
    const filePath = path.join(submissionDir, item.filename);
    assert(fs.existsSync(filePath), "ソースPDFがありません: " + item.filename);
    const size = fs.statSync(filePath).size;
    assert(size > 1000, "ソースPDFサイズが小さすぎます: " + item.filename);
    return {
      order: item.order,
      label: item.label,
      filename: item.filename,
      filePath: filePath,
      size: size,
      hash: sha256(filePath)
    };
  });

  const mergedPdf = await PDFDocument.create();
  const partSummaries = [];
  let expectedTotalPages = 0;

  for(const source of sourceStats){
    const bytes = fs.readFileSync(source.filePath);
    const partPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = partPdf.getPageCount();
    assert(pageCount > 0, source.filename + " のページ数が0です");
    const copiedPages = await mergedPdf.copyPages(partPdf, partPdf.getPageIndices());
    copiedPages.forEach(function(page){
      mergedPdf.addPage(page);
    });
    expectedTotalPages += pageCount;
    partSummaries.push({
      order: source.order,
      label: source.label,
      filename: source.filename,
      pages: pageCount,
      size: source.size,
      hash: source.hash
    });
  }

  const mergedBytes = await mergedPdf.save();
  fs.mkdirSync(submissionDir, { recursive: true });
  fs.writeFileSync(outputPath, mergedBytes);

  const outputPdf = await PDFDocument.load(mergedBytes, { ignoreEncryption: true });
  const totalPages = outputPdf.getPageCount();
  assert(totalPages === expectedTotalPages, "結合後ページ数が一致しません: " + totalPages + " != " + expectedTotalPages);

  return {
    outputPath: outputPath,
    outputFilename: outputFilename,
    outputSize: mergedBytes.length,
    totalPages: totalPages,
    parts: partSummaries,
    sourceHashes: sourceStats.map(function(item){
      return { filename: item.filename, hash: item.hash, size: item.size };
    })
  };
}

async function main(){
  const result = await buildFullSet();
  console.log("PASS build pre-fixed fare submission full set");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exitCode = 1;
});
