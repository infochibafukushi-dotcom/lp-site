import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, ".tmp-pdf-downloads");
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const WORD_FILENAME = "pre-fixed-fare-integrated-summary-word.html";

const REQUIRED_CONTENT = [
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
  "本番D1上の当該テスト予約は削除済み",
  "根拠資料・確認資料一覧",
  "運用開始前確認項目",
  "charset=utf-8",
  "Word.Document",
  "word-block",
  "table"
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

    const buttonExists = await page.evaluate(function(){
      return Boolean(document.getElementById("preFixedFareIntegratedSummaryWordExportBtn"));
    });
    assert(buttonExists, "Word出力ボタン preFixedFareIntegratedSummaryWordExportBtn が見つかりません");

    const generated = await page.evaluate(function(filename){
      const data = window.PreFixedFareIntegratedSummaryData.buildReportData({
        config: {},
        estimateConfig: { version: 1, pdfFooter: { businessName: "ちばケアタクシー" } }
      });
      const html = window.PreFixedFareIntegratedSummaryWord.buildWordDocumentHtml(data);
      return {
        filename: window.PreFixedFareIntegratedSummaryWord.WORD_FILENAME,
        html: html,
        blockCount: (html.match(/class='word-block/g) || []).length
      };
    });

    assert(generated.filename === WORD_FILENAME, "WORD_FILENAME が不正: " + generated.filename);
    assert(generated.html.length > 5000, "Word HTMLが短すぎます");
    assert(generated.blockCount === 13, "word-block 数が13ではありません: " + generated.blockCount);

    const missing = REQUIRED_CONTENT.filter(function(item){
      return !generated.html.includes(item);
    });
    assert(missing.length === 0, "不足コンテンツ: " + missing.join(", "));

    const filePath = path.join(outputDir, WORD_FILENAME);
    fs.writeFileSync(filePath, "\ufeff" + generated.html, "utf8");
    const readBack = fs.readFileSync(filePath, "utf8");
    assert(readBack.includes("ちばケアタクシー") || readBack.includes("事前確定運賃"), "UTF-8書き込み後の日本語が欠落しています");

    console.log("PASS integrated summary Word HTML tests");
    console.log(JSON.stringify({
      wordFilename: WORD_FILENAME,
      htmlLength: generated.html.length,
      wordBlocks: generated.blockCount,
      outputPath: filePath
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
