import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const INTEGRATED_FILENAME = "pre-fixed-fare-integrated-summary.pdf";

const REQUIRED_CHAPTERS = [
  "第1章",
  "第2章",
  "第3章",
  "第4章",
  "第5章",
  "システム基本方針と公示要件対応",
  "利用者向け見積シミュレーターの動作と判定ロジック",
  "運行・精算における運用フローと監査証跡",
  "旅客都合変更時の途中終了運用",
  "確認済み証跡と運用開始前確認項目"
];

const REQUIRED_CONTENT = [
  "事前確定運賃システム 統合説明資料",
  "関東運輸局提出・説明用",
  "ちばケアタクシー",
  "目次",
  "209906021400",
  "209906041030",
  "completed_with_passenger_change",
  "passenger_requested_route_change",
  "通常メーターで新規運行を開始",
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

async function main(){
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveChromeExecutable() || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"]
  });

  try{
    const page = await browser.newPage();
    await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 120000 });

    const buttonExists = await page.evaluate(function(){
      return Boolean(document.getElementById("preFixedFareIntegratedSummaryExportBtn"));
    });
    assert(buttonExists, "④ボタン preFixedFareIntegratedSummaryExportBtn が見つかりません");

    const moduleCheck = await page.evaluate(function(){
      const data = window.PreFixedFareIntegratedSummaryData?.buildReportData?.({
        config: {},
        estimateConfig: { version: 1, pdfFooter: { businessName: "ちばケアタクシー" } }
      });
      const html = window.PreFixedFareIntegratedSummaryPdf?.buildReportHtml?.(data);
      return {
        pdfFilename: window.PreFixedFareIntegratedSummaryPdf?.PDF_FILENAME || "",
        title: data?.title || "",
        htmlLength: String(html || "").length,
        text: String(html || "")
      };
    });

    assert(
      moduleCheck.pdfFilename === INTEGRATED_FILENAME,
      "PDF_FILENAME が不正: " + moduleCheck.pdfFilename
    );
    assert(
      moduleCheck.title === "事前確定運賃システム 統合説明資料",
      "タイトルが不正: " + moduleCheck.title
    );
    assert(moduleCheck.htmlLength > 3000, "生成HTMLが短すぎます");

    const missingChapters = REQUIRED_CHAPTERS.filter(function(item){
      return !moduleCheck.text.includes(item);
    });
    assert(missingChapters.length === 0, "不足章: " + missingChapters.join(", "));

    const missingContent = REQUIRED_CONTENT.filter(function(item){
      return !moduleCheck.text.includes(item);
    });
    assert(missingContent.length === 0, "不足コンテンツ: " + missingContent.join(", "));

    const forbiddenFound = FORBIDDEN_PHRASES.filter(function(item){
      return moduleCheck.text.includes(item);
    });
    assert(forbiddenFound.length === 0, "避ける表現が含まれています: " + forbiddenFound.join(", "));

    const mainTableUnconfirmed = ["table-multi-route", "table-requirements"].some(function(marker){
      const start = moduleCheck.text.indexOf(marker);
      if(start < 0){
        return false;
      }
      const end = moduleCheck.text.indexOf("</div>", start + marker.length + 200);
      const chunk = moduleCheck.text.slice(start, end > start ? end : start + 4000);
      return chunk.includes("未確認");
    });
    assert(!mainTableUnconfirmed, "主要表（公示要件対応表・ルート選択表）に「未確認」が残っています");
    assert(
      !moduleCheck.text.includes("確認予定"),
      "「確認予定」は第5章以外に残さない方針です"
    );
    assert(
      moduleCheck.text.includes("申請予定または認可後の距離制運賃表"),
      "根拠資料一覧に運賃表別紙項目がありません"
    );
    assert(
      moduleCheck.text.includes("pdf-page"),
      "明示的ページブロック pdf-page がありません"
    );
    assert(
      (moduleCheck.text.match(/data-page-id=/g) || []).length === 13,
      "ページブロック数が13ではありません"
    );
    assert(
      moduleCheck.text.includes("quoteSnapshot / handoff の保存（続き）"),
      "第2章7P相当の続き見出しがありません"
    );
    assert(
      moduleCheck.text.includes("caseRecords・meter_fixed_fare_runs 保存項目"),
      "第3章9P相当の補足見出しがありません"
    );
    assert(
      moduleCheck.text.includes("本番E2E確認結果"),
      "第3章10P相当のE2E見出しがありません"
    );
    const gpsmCount = (moduleCheck.text.match(/GPSM/g) || []).length;
    assert(gpsmCount <= 1, "GPSMの記載が多すぎます: " + gpsmCount);

    const textLength = await page.evaluate(function(){
      const data = window.PreFixedFareIntegratedSummaryData.buildReportData({
        config: {},
        estimateConfig: { version: 1, pdfFooter: { businessName: "ちばケアタクシー" } }
      });
      const reportHtml = window.PreFixedFareIntegratedSummaryPdf.buildReportHtml(data);
      const container = document.createElement("div");
      container.innerHTML = reportHtml;
      document.body.appendChild(container);
      const reportElement = container.querySelector(".pre-fixed-fare-integrated-summary");
      const length = String(reportElement?.innerText || "").trim().length;
      container.remove();
      return length;
    });
    assert(textLength > 4000, "PDF用HTMLのテキスト量が不足: " + textLength);

    console.log("PASS integrated summary PDF tests");
    console.log(JSON.stringify({
      pdfFilename: INTEGRATED_FILENAME,
      textLength: textLength,
      chapters: REQUIRED_CHAPTERS.length
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error("FAIL", error);
  process.exit(1);
});
