import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = pathToFileURL(path.join(rootDir, "admin.html")).href;
const applicationJsonPath = path.join(rootDir, "data/pre-fixed-fare-application.json");
const outputDir = path.join(rootDir, "docs/submission/20260705");
const outputPdf = path.join(outputDir, "pre-fixed-fare-application-form-style2-v1-candidate.pdf");
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const EXPECTED = {
  applicantAddress: "千葉県千葉市中央区出洲港8-3-2",
  applicantName: "株式会社 千葉福祉サポート",
  representativeName: "山本 信勝",
  contact: "090-6331-4289",
  operatingArea: "千葉交通圏",
  dispatchAppName: "ちばケアタクシー 事前確定運賃システム"
};

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

function loadPrintModule(){
  const source = fs.readFileSync(path.join(rootDir, "shared/pre-fixed-fare-application-print.js"), "utf8");
  const fn = new Function("global", source + "\nreturn global.PreFixedFareApplicationPrint;");
  return fn(globalThis);
}

async function verifyAdminForm(page){
  const values = await page.evaluate(function(){
    return {
      representativeName: document.getElementById("pffaRepresentativeName")?.value || "",
      contact: document.getElementById("pffaContact")?.value || "",
      operatingArea: document.getElementById("pffaOperatingArea")?.value || "",
      dispatchAppName: document.getElementById("pffaDispatchAppName")?.value || "",
      applicantAddress: document.getElementById("pffaApplicantAddress")?.value || "",
      applicantName: document.getElementById("pffaApplicantName")?.value || "",
      hasPreviewBtn: Boolean(document.getElementById("pffaPreviewBtn")),
      hasPrintBtn: Boolean(document.getElementById("pffaPrintBtn")),
      screenEvidenceBtn: Boolean(document.getElementById("preFixedFareScreenEvidenceExportBtn")),
      integratedBtn: Boolean(document.getElementById("preFixedFareIntegratedSummaryExportBtn")),
      appendixBtn: Boolean(document.getElementById("preFixedFareApprovalAppendixExportBtn"))
    };
  });
  assert(values.representativeName === EXPECTED.representativeName, "代表者氏名が不正: " + values.representativeName);
  assert(values.contact === EXPECTED.contact, "連絡先が不正: " + values.contact);
  assert(values.dispatchAppName === EXPECTED.dispatchAppName, "配車アプリ名称が不正: " + values.dispatchAppName);
  assert(values.operatingArea === EXPECTED.operatingArea, "営業区域が不正: " + values.operatingArea);
  assert(values.applicantAddress === EXPECTED.applicantAddress, "申請者住所が不正");
  assert(values.applicantName === EXPECTED.applicantName, "氏名又は名称が不正");
  assert(values.hasPreviewBtn && values.hasPrintBtn, "プレビュー/印刷ボタンがありません");
  assert(values.screenEvidenceBtn && values.integratedBtn && values.appendixBtn, "既存PDF出力ボタンが欠落しています");
  return values;
}

async function buildPreviewHtml(page, formData){
  return page.evaluate(function(data){
    if(!window.PreFixedFareApplicationPrint){
      throw new Error("申請書印刷モジュールが読み込まれていません。");
    }
    return window.PreFixedFareApplicationPrint.buildPrintDocument(data, { autoPrint: false });
  }, formData);
}

async function verifyOtherPdfModules(page){
  const ok = await page.evaluate(function(){
    return Boolean(
      window.PreFixedFareScreenEvidencePdf
      && window.PreFixedFareIntegratedSummaryPdf
      && window.PreFixedFareApprovalAppendixPdf
    );
  });
  assert(ok, "既存PDFモジュールが欠落しています");
}

async function main(){
  const saved = JSON.parse(fs.readFileSync(applicationJsonPath, "utf8"));
  Object.keys(EXPECTED).forEach(function(key){
    assert(saved[key] === EXPECTED[key], "JSONの " + key + " が不正: " + saved[key]);
  });

  const print = loadPrintModule();
  const formData = print.normalizeFormData(saved);
  const html = print.buildPrintDocument(formData, { autoPrint: false });
  assert(html.includes("山本 信勝") && html.includes("印"), "HTMLに代表者印欄がありません");
  assert(html.includes("090-6331-4289"), "HTMLに連絡先がありません");
  assert(html.includes("ちばケアタクシー 事前確定運賃システム"), "HTMLに配車アプリ名称がありません");
  assert(html.includes("千葉交通圏"), "HTMLに営業区域がありません");
  assert(html.includes("size:A4 portrait"), "A4縦CSSがありません");

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
    const adminPage = await browser.newPage();
    await adminPage.goto(adminUrl, { waitUntil: "networkidle0", timeout: 120000 });
    await verifyAdminForm(adminPage);
    await verifyOtherPdfModules(adminPage);
    const previewHtml = await buildPreviewHtml(adminPage, saved);
    assert(previewHtml.includes("山本 信勝") && previewHtml.includes("印"), "プレビューHTMLに代表者印欄がありません");
    assert(previewHtml.includes("ちばケアタクシー 事前確定運賃システム"), "プレビューHTMLに配車アプリ名称がありません");

    const printPage = await browser.newPage();
    await printPage.setContent(previewHtml, { waitUntil: "networkidle0" });
    const layout = await printPage.evaluate(function(){
      const pageRule = document.documentElement.innerHTML.includes("size:A4 portrait");
      const title = document.querySelector(".doc-title")?.textContent || "";
      const bodyText = document.body.innerText || "";
      return {
        pageRule: pageRule,
        title: title,
        bodyText: bodyText,
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight
      };
    });
    assert(layout.pageRule, "A4縦のページルールがありません");
    assert(layout.title.includes("事前確定運賃"), "タイトルが不正");
    assert(layout.bodyText.includes("山本 信勝") && layout.bodyText.includes("印"), "印刷表示に代表者印欄がありません");
    assert(layout.bodyText.includes("090-6331-4289"), "印刷表示に連絡先がありません");
    assert(layout.bodyText.includes("ちばケアタクシー 事前確定運賃システム"), "印刷表示に配車アプリ名称がありません");
    assert(layout.bodyText.includes("千葉交通圏"), "印刷表示に営業区域がありません");

    await printPage.pdf({
      path: outputPdf,
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" }
    });

    assert(fs.existsSync(outputPdf), "PDFの保存に失敗しました");
    const size = fs.statSync(outputPdf).size;
    assert(size > 20000, "PDFサイズが小さすぎます: " + size);

    console.log("Admin form values: PASS");
    console.log("Preview HTML: PASS");
    console.log("Print layout: PASS (", layout.width, "x", layout.height, ")");
    console.log("Saved PDF:", outputPdf, "(" + size + " bytes)");
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
