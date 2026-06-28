import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, ".tmp-pdf-downloads");
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const DOCUMENTS = [
  {
    id: "application-helper",
    filename: "pre-fixed-fare-application-helper.html",
    required: [
      "事前確定運賃 認可申請様式リンク・記入補助シート",
      "関東運輸局 タクシー関係申請手続き（運賃関係）",
      "事前確定運賃認可申請様式（Word）",
      "本シートは公式申請様式ではありません",
      "記入補助項目"
    ]
  },
  {
    id: "distance-fare-table",
    filename: "pre-fixed-fare-distance-fare-table.html",
    required: [
      "別紙1　距離制運賃表",
      "申請書本体・認可運賃表に基づき記入",
      "初乗運賃",
      "時間距離併用運賃"
    ]
  },
  {
    id: "service-fee-table",
    filename: "pre-fixed-fare-service-fee-table.html",
    required: [
      "別紙2　各種料金表",
      "迎車料金",
      "予約料金",
      "介助料",
      "事前確定運賃に含めるか"
    ]
  },
  {
    id: "device-checklist",
    filename: "pre-fixed-fare-device-checklist.html",
    required: [
      "別紙3　実機目視確認チェックリスト",
      "A. LP見積画面",
      "B. 予約システム・管理画面",
      "C. メーターアプリ",
      "D. 証跡保存",
      "snapshotHash",
      "署名欄",
      "☐"
    ]
  },
  {
    id: "screenshot-sheet",
    filename: "pre-fixed-fare-screenshot-sheet.html",
    required: [
      "別紙4　画面スクリーンショット台紙",
      "LP見積入力画面",
      "通常メーター新規運行開始導線",
      "paste-box"
    ]
  },
  {
    id: "submission-appendix-set",
    filename: "pre-fixed-fare-submission-appendix-set.html",
    required: [
      "事前確定運賃 提出用別紙セット",
      "別紙1　距離制運賃表",
      "別紙2　各種料金表",
      "別紙3　実機目視確認チェックリスト",
      "別紙4　画面スクリーンショット台紙",
      "認可申請様式リンク・記入補助シート"
    ]
  }
];

const FORBIDDEN_PHRASES = [
  "完全準拠",
  "認可済み",
  "満額収受"
];

const BUTTON_IDS = [
  "preFixedFareAppendixApplicationHelperBtn",
  "preFixedFareAppendixDistanceFareBtn",
  "preFixedFareAppendixServiceFeeBtn",
  "preFixedFareAppendixDeviceChecklistBtn",
  "preFixedFareAppendixScreenshotSheetBtn",
  "preFixedFareAppendixFullSetBtn"
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

    const buttonsOk = await page.evaluate(function(ids){
      return ids.every(function(id){
        return Boolean(document.getElementById(id));
      });
    }, BUTTON_IDS);
    assert(buttonsOk, "別紙出力ボタンが不足しています");

    const results = await page.evaluate(function(docs){
      const options = {
        config: {},
        estimateConfig: { version: 1, pdfFooter: { businessName: "ちばケアタクシー" } }
      };
      return docs.map(function(doc){
        const built = window.PreFixedFareSubmissionAppendixWord.buildWordDocumentHtml(doc.id, options);
        return {
          id: doc.id,
          filename: built.payload.wordFilename,
          html: built.html,
          checklistCount: (built.html.match(/☐/g) || []).length,
          pasteBoxCount: (built.html.match(/paste-box/g) || []).length,
          tableCount: (built.html.match(/<table/g) || []).length
        };
      });
    }, DOCUMENTS);

    results.forEach(function(result, index){
      const spec = DOCUMENTS[index];
      assert(result.filename === spec.filename, result.id + " のファイル名が不正: " + result.filename);
      assert(result.html.length > 1500, result.id + " のHTMLが短すぎます");
      assert(result.html.includes("charset=utf-8"), result.id + " に charset がありません");
      assert(result.html.includes("Word.Document"), result.id + " に Word メタがありません");

      const missing = spec.required.filter(function(item){
        return !result.html.includes(item);
      });
      assert(missing.length === 0, result.id + " に不足コンテンツ: " + missing.join(", "));

      const forbidden = FORBIDDEN_PHRASES.filter(function(item){
        return result.html.includes(item);
      });
      assert(forbidden.length === 0, result.id + " に避ける表現: " + forbidden.join(", "));

      const filePath = path.join(outputDir, spec.filename);
      fs.writeFileSync(filePath, "\ufeff" + result.html, "utf8");
    });

    const checklist = results.find(function(item){ return item.id === "device-checklist"; });
    assert(checklist.checklistCount >= 25, "チェックリスト項目数が不足: " + checklist.checklistCount);

    const screenshot = results.find(function(item){ return item.id === "screenshot-sheet"; });
    assert(screenshot.pasteBoxCount >= 14, "スクリーンショット貼付欄が不足: " + screenshot.pasteBoxCount);

    const distance = results.find(function(item){ return item.id === "distance-fare-table"; });
    assert(!distance.html.includes("円/km") && !distance.html.match(/初乗運賃<\/td><td>\d+/),
      "距離制運賃表に仮の金額が入っています");

    console.log("PASS submission appendix Word HTML tests");
    console.log(JSON.stringify({
      documents: results.map(function(item){
        return {
          id: item.id,
          filename: item.filename,
          htmlLength: item.html.length,
          tableCount: item.tableCount
        };
      })
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
