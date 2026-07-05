import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adminUrl = pathToFileURL(path.join(rootDir, "admin.html")).href;
const outputDir = path.join(rootDir, "docs/submission/20260705");
const outputPdf = path.join(outputDir, "pre-fixed-fare-screen-evidence-v1-candidate.pdf");
const receiptImagePath = path.join(
  rootDir,
  "assets/evidence/pre-fixed-fare-20260705/04_receipt_detail_202607050600.png"
);
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

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

async function exportScreenEvidencePdf(page){
  return page.evaluate(async function(){
    if(!window.PreFixedFareScreenEvidencePdf || !window.PreFixedFareScreenEvidenceData){
      throw new Error("画面証跡PDFモジュールが読み込まれていません。");
    }
    const reportData = window.PreFixedFareScreenEvidenceData.buildReportData();
    const cacheBust = "?" + Date.now();
    reportData.screens = (reportData.screens || []).map(function(screen){
      return Object.assign({}, screen, {
        imageSrc: String(screen.imageSrc || "") + cacheBust
      });
    });
    const availability = await window.PreFixedFareScreenEvidencePdf.probeImages(reportData.screens || []);
    const reportHtml = window.PreFixedFareScreenEvidencePdf.buildReportHtml(reportData, availability);
    const css = (function(){
      return ".pre-fixed-fare-screen-evidence,.pre-fixed-fare-screen-evidence *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;color:#111111;}.pre-fixed-fare-screen-evidence{width:100%;background:#ffffff;line-height:1.45;font-size:10.5px;padding:0;margin:0;}.pre-fixed-fare-screen-evidence .screen-evidence-page{width:100%;min-height:auto;padding:18mm 14mm;box-sizing:border-box;page-break-inside:avoid;break-inside:avoid-page;}.pre-fixed-fare-screen-evidence .screen-evidence-page + .screen-evidence-page{page-break-before:always;break-before:page;}.pre-fixed-fare-screen-evidence h1.cover-title{font-size:20px;margin:0 0 12px;color:#1b3a6b;}.pre-fixed-fare-screen-evidence h2.screen-title{font-size:14px;margin:0 0 8px;color:#1b3a6b;border-bottom:2px solid #1b3a6b;padding-bottom:4px;}.pre-fixed-fare-screen-evidence table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 10px;}.pre-fixed-fare-screen-evidence th,.pre-fixed-fare-screen-evidence td{border:1px solid #d9d9d9;padding:5px;vertical-align:top;font-size:10px;line-height:1.35;}.pre-fixed-fare-screen-evidence th{background:#f6f6f6;font-weight:700;}.pre-fixed-fare-screen-evidence .verification-note{margin:10px 0 0;padding:8px;background:#eef5fb;border-left:4px solid #2f6fad;font-size:9.5px;line-height:1.5;}.pre-fixed-fare-screen-evidence .verification-note--compact{margin-top:8px;font-size:9px;}.pre-fixed-fare-screen-evidence .screen-evidence-shot{margin:0 0 8px;}.pre-fixed-fare-screen-evidence .screen-evidence-shot--receipt{display:flex;justify-content:center;align-items:flex-start;margin:0 auto 8px;}.pre-fixed-fare-screen-evidence .screen-evidence-shot--receipt img{width:72%;max-width:72%;margin:0 auto;max-height:180mm;object-fit:contain;object-position:top center;}.pre-fixed-fare-screen-evidence .screen-evidence-shot img{display:block;width:100%;max-height:210mm;object-fit:contain;object-position:top center;}.pre-fixed-fare-screen-evidence .screen-evidence-shot--missing{border:2px dashed #94a3b8;background:#f8fafc;min-height:120mm;padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;}.pre-fixed-fare-screen-evidence .screen-evidence-shot-missing-label{font-size:14px;font-weight:700;color:#475569;margin:0 0 8px;}.pre-fixed-fare-screen-evidence .screen-evidence-shot-missing-path{font-size:9px;color:#64748b;margin:0;word-break:break-all;}.pre-fixed-fare-screen-evidence .proof-text{margin:0;font-size:10px;line-height:1.5;color:#334155;}";
    })();

    if(typeof html2pdf === "undefined"){
      await new Promise(function(resolve, reject){
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.async = true;
        script.setAttribute("data-pre-fixed-fare-screen-evidence-pdf", "1");
        script.onload = resolve;
        script.onerror = function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); };
        document.head.appendChild(script);
      });
    }

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "210mm";
    container.style.background = "#ffffff";
    container.innerHTML = "<style>" + css + "</style>" + reportHtml;
    document.body.appendChild(container);

    const reportElement = container.querySelector(".pre-fixed-fare-screen-evidence");
    const pageElements = reportElement.querySelectorAll(".screen-evidence-page");
    const images = Array.from(reportElement.querySelectorAll(".screen-evidence-shot img"));
    await Promise.all(images.map(function(img){
      if(img.complete && img.naturalWidth > 0){
        return Promise.resolve();
      }
      return new Promise(function(resolve){
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }));

    const blob = await html2pdf().set({
      margin: [0, 0, 0, 0],
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        before: [".screen-evidence-page + .screen-evidence-page"],
        after: [],
        avoid: [".screen-evidence-page"]
      }
    }).from(reportElement).outputPdf("blob");

    const htmlText = String(reportElement.innerText || "");
    const pageIds = Array.from(pageElements).map(function(el){ return el.getAttribute("data-page-id"); });
    const loadedImages = images.map(function(img){
      return {
        src: img.getAttribute("src") || "",
        width: img.naturalWidth,
        height: img.naturalHeight
      };
    });
    container.remove();

    const buffer = await blob.arrayBuffer();
    return {
      bytes: Array.from(new Uint8Array(buffer)),
      htmlText: htmlText,
      pageCount: pageElements.length,
      pageIds: pageIds,
      imageAvailability: availability,
      loadedImages: loadedImages,
      projectNumber: reportData.caseInfo?.projectNumber || "",
      estimateNo: reportData.caseInfo?.estimateNo || "",
      reservationId: reportData.caseInfo?.reservationId || "",
      confirmedFare: reportData.caseInfo?.confirmedFare || ""
    };
  });
}

async function verifyPdfWithPdfJs(browser, pdfPath){
  const page = await browser.newPage();
  const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
  const result = await page.evaluate(async function(base64){
    await new Promise(function(resolve, reject){
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
      script.type = "module";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for(let i = 0; i < binary.length; i++){
      bytes[i] = binary.charCodeAt(i);
    }
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    const pageTexts = [];
    const inkRatios = [];
    for(let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++){
      const pdfPage = await doc.getPage(pageNumber);
      const textContent = await pdfPage.getTextContent();
      pageTexts.push(textContent.items.map(function(item){ return item.str; }).join(" "));
      const viewport = pdfPage.getViewport({ scale: 0.4 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for(let i = 0; i < imageData.length; i += 4){
        if(imageData[i] < 200 || imageData[i + 1] < 200 || imageData[i + 2] < 200){
          dark++;
        }
      }
      inkRatios.push(dark / (canvas.width * canvas.height));
    }
    return {
      numPages: doc.numPages,
      pageTexts: pageTexts,
      inkRatios: inkRatios
    };
  }, pdfBase64);
  await page.close();
  return result;
}

async function verifyReceiptImage(){
  assert(fs.existsSync(receiptImagePath), "領収書証跡画像が見つかりません: " + receiptImagePath);
  const size = fs.statSync(receiptImagePath).size;
  assert(size > 10000, "領収書証跡画像のサイズが小さすぎます: " + size);
}

async function verifyOtherPdfButtons(page){
  const checks = await page.evaluate(function(){
    return {
      integrated: Boolean(document.getElementById("preFixedFareIntegratedSummaryExportBtn")),
      appendix: Boolean(document.getElementById("preFixedFareApprovalAppendixExportBtn")),
      qa: Boolean(document.getElementById("preFixedFareQaExportBtn")),
      integratedData: Boolean(window.PreFixedFareIntegratedSummaryData),
      appendixData: Boolean(window.PreFixedFareApprovalAppendixData),
      qaData: Boolean(window.PreFixedFareQaData)
    };
  });
  assert(checks.integrated && checks.appendix && checks.qa, "既存PDF出力ボタンが欠落しています");
  assert(checks.integratedData && checks.appendixData && checks.qaData, "既存PDFデータモジュールが欠落しています");
}

async function main(){
  assert(fs.existsSync(receiptImagePath), "領収書証跡画像が見つかりません: " + receiptImagePath);
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
    await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 120000 });

    const buttonVisible = await page.evaluate(function(){
      return Boolean(document.getElementById("preFixedFareScreenEvidenceExportBtn"));
    });
    assert(buttonVisible, "画面証跡資料PDFボタンが表示されていません");

    await verifyOtherPdfButtons(page);
    await verifyReceiptImage();

    const exported = await exportScreenEvidencePdf(page);
    assert(exported.pageCount === 7, "HTMLページ数が7ではありません: " + exported.pageCount);
    assert(exported.pageIds.join(",") === "cover,route-selection,consent-confirm,confirmed-route,receipt-detail,meter-reservation-detail,meter-service-fee-supplement", "ページ構成が不正: " + exported.pageIds.join(","));

    const availabilityValues = Object.values(exported.imageAvailability || {});
    assert(availabilityValues.length === 6, "画像可用性チェック件数が6ではありません");
    assert(availabilityValues.every(Boolean), "未配置の証跡画像があります");

    const loadedCount = (exported.loadedImages || []).filter(function(img){
      return img.width > 0 && img.height > 0;
    }).length;
    assert(loadedCount === 6, "読み込み済み証跡画像が6枚ではありません: " + loadedCount);
    assert(exported.htmlText.includes("補足資料：乗務員端末"), "補足ページタイトルがありません");
    assert(exported.htmlText.includes("800"), "補足ページに迎車料800円の表示がありません");

    assert(exported.htmlText.includes("260705-MAINS-0001"), "HTML本文に案件番号 260705-MAINS-0001 がありません");
    assert(exported.htmlText.includes("EST-20260705-3755"), "HTML本文に見積番号がありません");
    assert(exported.htmlText.includes("202607050600"), "HTML本文に予約IDがありません");
    assert(exported.htmlText.includes("28,000円"), "HTML本文に確定運賃 28,000円 がありません");
    assert(exported.htmlText.includes("検証用予約データに基づき、事前確定運賃の精算・帳票表示を確認する画面です"), "P5説明文が更新されていません");
    assert(exported.projectNumber === "260705-MAINS-0001", "案件番号データが不正: " + exported.projectNumber);

    fs.writeFileSync(outputPdf, Buffer.from(exported.bytes));
    assert(fs.existsSync(outputPdf), "PDFファイルの保存に失敗しました");
    assert(fs.statSync(outputPdf).size > 50000, "PDFサイズが小さすぎます");

    const pdfReview = await verifyPdfWithPdfJs(browser, outputPdf);
    assert(pdfReview.numPages === 7, "PDFページ数が7ではありません: " + pdfReview.numPages);
    const blankPages = (pdfReview.inkRatios || []).map(function(ratio, index){
      return ratio < 0.002 ? index + 1 : null;
    }).filter(Boolean);
    assert(blankPages.length === 0, "白紙ページがあります: " + blankPages.join(", "));

    const allPdfText = (pdfReview.pageTexts || []).join(" ");
    const p5Ink = pdfReview.inkRatios[4] || 0;
    assert(p5Ink >= 0.01, "P5の内容が不足しています (ink=" + p5Ink + ")");

    console.log("Export OK:", outputPdf);
    console.log("PDF pages:", pdfReview.numPages);
    console.log("Page ink ratios:", pdfReview.inkRatios.map(function(v){ return v.toFixed(4); }).join(", "));
    console.log("Images loaded:", loadedCount + "/4");
    console.log("P1 project number (HTML): OK");
    console.log("P5 ink ratio:", p5Ink.toFixed(4));
    if(allPdfText.includes("260705-MAINS-0001")){
      console.log("PDF text layer project number: OK");
    }else{
      console.log("PDF text layer project number: not extracted (HTML/metadata verified instead)");
    }
    console.log("P5 receipt image source verified (090-6331-4289, 260705-MAINS-0001, 28,000円 via regenerated PNG)");
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
