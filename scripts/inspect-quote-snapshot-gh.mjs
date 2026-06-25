import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, "docs", "screenshots");
const baseUrl = String(process.env.ESTIMATE_BASE_URL || "https://infochibafukushi-dotcom.github.io/lp-site").replace(/\/$/, "");
const estimateUrl = baseUrl + "/estimate/index.html";

function resolveChromeExecutable(){
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  return candidates.find(function(candidate){
    return fs.existsSync(candidate);
  }) || null;
}

function pickSnapshotFields(snapshot){
  if(!snapshot){
    return null;
  }
  return {
    preFixedFareConfirmable: snapshot.preFixedFareConfirmable,
    preFixedFareScope: snapshot.preFixedFareScope,
    returnFareStatus: snapshot.returnFareStatus,
    selectedRouteId: snapshot.selectedRouteId,
    returnSelectedRouteId: snapshot.returnSelectedRouteId,
    totalDistanceMeters: snapshot.totalDistanceMeters,
    totalDurationSeconds: snapshot.totalDurationSeconds,
    returnPlanType: snapshot.returnPlanType,
    tripType: snapshot.tripType,
    outboundRoutePlan: snapshot.outboundRoutePlan ? {
      selectedRouteId: snapshot.outboundRoutePlan.selectedRouteId,
      routeCandidatesLength: Array.isArray(snapshot.outboundRoutePlan.routeCandidates)
        ? snapshot.outboundRoutePlan.routeCandidates.length
        : 0,
      preFixedFareConfirmable: snapshot.outboundRoutePlan.preFixedFareConfirmable,
      fallbackReason: snapshot.outboundRoutePlan.fallbackReason || null
    } : null,
    returnRoutePlan: snapshot.returnRoutePlan ? {
      selectedRouteId: snapshot.returnRoutePlan.selectedRouteId,
      routeCandidatesLength: Array.isArray(snapshot.returnRoutePlan.routeCandidates)
        ? snapshot.returnRoutePlan.routeCandidates.length
        : 0,
      preFixedFareConfirmable: snapshot.returnRoutePlan.preFixedFareConfirmable,
      fallbackReason: snapshot.returnRoutePlan.fallbackReason || null,
      waypointAddress: snapshot.returnRoutePlan.waypoint?.waypointAddress
        || snapshot.returnRoutePlan.waypoint?.waypointLabel
        || null
    } : null
  };
}

async function waitForEstimateReady(page){
  await page.waitForFunction(function(){
    const app = document.getElementById("estimateApp");
    const text = String(app?.textContent || "");
    return text.length > 0 && !text.includes("読み込み中") && !text.includes("設定を読み込んでいます");
  }, { timeout: 90000 });
}

async function clickChoice(page, name, value){
  await page.waitForSelector('input[name="' + name + '"][value="' + value + '"]', { timeout: 30000 });
  await page.click('input[name="' + name + '"][value="' + value + '"]');
  await new Promise(function(resolve){ setTimeout(resolve, 500); });
}

async function runFlow(page){
  await page.goto(estimateUrl, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForEstimateReady(page);
  await clickChoice(page, "mobilityChoice", "stretcher");
  await page.waitForSelector('input[name="stairChoice"]', { timeout: 30000 });
  const stairValue = await page.$eval('input[name="stairChoice"]', function(el){ return el.value; });
  await clickChoice(page, "stairChoice", stairValue);
  await clickChoice(page, "tripChoice", "round-trip");
  await clickChoice(page, "addonChoice", "addon-waiting");
  await page.waitForSelector("#originAddressInput", { timeout: 15000 });
  await page.$eval("#originAddressInput", function(el){ el.value = ""; });
  await page.$eval("#destinationAddressInput", function(el){ el.value = ""; });
  await page.type("#originAddressInput", "千葉市中央区富士見2-1-1", { delay: 15 });
  await page.type("#destinationAddressInput", "千葉大学医学部附属病院", { delay: 15 });
  await clickChoice(page, "returnPlanType", "return_with_stop");
  await page.waitForSelector("#returnStopAddressInput", { timeout: 10000 });
  await page.type("#returnStopAddressInput", "イオン千葉みなと", { delay: 15 });
  await page.click("#calculateDistanceBtn");
  await page.waitForSelector(".estimate-route-card", { timeout: 180000 });
  await page.waitForSelector(".estimate-route-map .gm-style, .estimate-route-map-legend", { timeout: 180000 });
  await new Promise(function(resolve){ setTimeout(resolve, 3000); });
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  const launchOptions = { headless: true };
  const chromeExecutable = resolveChromeExecutable();
  if(chromeExecutable){
    launchOptions.executablePath = chromeExecutable;
  }
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 2200 });

  await runFlow(page);

  const step6Snapshot = await page.evaluate(function(){
    const handoffRaw = sessionStorage.getItem("lp_estimate_handoff");
    const handoff = handoffRaw ? JSON.parse(handoffRaw) : null;
    return {
      handoffExists: Boolean(handoff),
      roundTripStatusText: Array.from(document.querySelectorAll(".estimate-round-trip-status p")).map(function(el){
        return String(el.textContent || "").trim();
      }),
      singleCandidateNotice: String(document.querySelector(".estimate-prefixed-fare-single-candidate-notice")?.textContent || "").trim(),
      stopoverNote: String(document.querySelector(".estimate-prefixed-fare-stopover-note")?.textContent || "").trim(),
      returnPlanNote: String(document.querySelector(".estimate-return-plan-note")?.textContent || "").trim(),
      step6Warnings: Array.from(document.querySelectorAll(".estimate-route-selection-warning")).map(function(el){
        return String(el.textContent || "").trim();
      })
    };
  });

  const selectBtn = await page.$('.estimate-route-select-btn[data-select-route-leg="outbound"]:not([disabled])');
  if(selectBtn){
    await selectBtn.click();
  }else{
    const ackBtn = await page.$("[data-distance-route-acknowledge]");
    if(ackBtn){
      await ackBtn.click();
    }
  }
  await page.waitForSelector(".estimate-result", { timeout: 60000 });
  await new Promise(function(resolve){ setTimeout(resolve, 5000); });

  const resultData = await page.evaluate(async function(){
    const handoffRaw = sessionStorage.getItem("lp_estimate_handoff");
    const handoff = handoffRaw ? JSON.parse(handoffRaw) : null;
    const quoteSnapshot = handoff?.quoteSnapshot || null;
    let pdfSnapshot = null;
    let pdfVisibleText = "";
    let pdfBuildError = "";
    if(window.EstimatePdf && typeof window.EstimatePdf.buildPreviewElement === "function" && handoff){
      try{
        const element = await window.EstimatePdf.buildPreviewElement({
          estimateNumber: handoff.estimateNumber || "TEST",
          createdAt: handoff.createdAt || new Date().toISOString(),
          usageSummary: handoff.usageSummary || [],
          quoteSnapshot: handoff.quoteSnapshot || null,
          fareSections: [],
          breakdownRows: [],
          total: handoff.total || 0,
          resultNotes: "",
          pdfFooter: { enabled: false },
          pageTitle: "かんたん料金確認",
          breakdown: handoff.breakdown || {},
          routePlan: handoff.routePlan || null,
          returnPlanType: handoff.selections?.returnPlanType || handoff.quoteSnapshot?.returnPlanType || handoff.routePlan?.returnPlanType || null,
          googleMaps: { enabled: false }
        });
        const meta = element?.querySelector(".estimate-quote-snapshot-meta");
        if(meta){
          pdfSnapshot = JSON.parse(meta.textContent || "{}");
        }
        pdfVisibleText = String(element?.textContent || "").replace(/\s+/g, " ").trim();
      }catch(error){
        pdfBuildError = String(error?.message || error);
        pdfVisibleText = "PDF_BUILD_ERROR:" + pdfBuildError;
      }
    }else{
      pdfBuildError = !handoff
        ? "handoff_missing"
        : (!window.EstimatePdf ? "EstimatePdf_missing" : "buildPreviewElement_missing");
    }
    const statusFromHandoff = (function(){
      if(!window.PreFixedFareStatus || !handoff?.routePlan){
        return [];
      }
      return window.PreFixedFareStatus.buildStatusMessages(handoff.routePlan, {
        returnPlanType: handoff.selections?.returnPlanType || handoff.quoteSnapshot?.returnPlanType || null,
        outboundRoutePlan: handoff.quoteSnapshot?.outboundRoutePlan || handoff.routePlan?.outboundRoutePlan || null,
        returnRoutePlan: handoff.quoteSnapshot?.returnRoutePlan || handoff.routePlan?.returnRoutePlan || null
      }).map(function(message){ return message.text; });
    })();
    return {
      handoffExists: Boolean(handoff),
      quoteSnapshot: quoteSnapshot,
      pdfQuoteSnapshot: pdfSnapshot,
      pdfBuildError: pdfBuildError,
      statusFromHandoff: statusFromHandoff,
      pdfVisibleText: pdfVisibleText.slice(0, 4000),
      roundTripStatusText: Array.from(document.querySelectorAll(".estimate-round-trip-status p")).map(function(el){
        return String(el.textContent || "").trim();
      }),
      singleCandidateNotice: String(document.querySelector(".estimate-prefixed-fare-single-candidate-notice")?.textContent || "").trim(),
      stopoverNote: String(document.querySelector(".estimate-prefixed-fare-stopover-note")?.textContent || "").trim(),
      resultNotes: String(document.querySelector(".estimate-result-notes")?.textContent || "").trim(),
      reservationUrl: String(document.querySelector(".estimate-cta-primary")?.getAttribute("href") || ""),
      fareConfirmReview: (function(){
        const href = String(document.querySelector(".estimate-cta-primary")?.getAttribute("href") || "");
        return /fareConfirm=review/.test(href) ? href : window.location.href;
      })()
    };
  });

  await page.screenshot({
    path: path.join(outputDir, "gh-quote-snapshot-result.png"),
    fullPage: true
  });

  await browser.close();

  const report = {
    baseUrl: baseUrl,
    step6: step6Snapshot,
    result: {
      ui: {
        roundTripStatusText: resultData.roundTripStatusText,
        singleCandidateNotice: resultData.singleCandidateNotice,
        stopoverNote: resultData.stopoverNote,
        resultNotes: resultData.resultNotes,
        reservationUrl: resultData.reservationUrl
      },
      quoteSnapshot: pickSnapshotFields(resultData.quoteSnapshot),
      pdfQuoteSnapshot: pickSnapshotFields(resultData.pdfQuoteSnapshot),
      pdfBuildError: resultData.pdfBuildError || "",
      statusFromHandoff: resultData.statusFromHandoff || [],
      pdfTextIncludes: {
        returnDistance: /復路/.test(resultData.pdfVisibleText),
        reviewRequired: /確認対応/.test(resultData.pdfVisibleText),
        stopover: /立ち寄り/.test(resultData.pdfVisibleText),
        singleCandidateNotice: /ルート候補が1件のみ/.test(resultData.pdfVisibleText),
        stopoverRouteExplanation: /目的地.*立ち寄り先.*出発地/.test(resultData.pdfVisibleText)
      },
      fareConfirmReview: /fareConfirm=review/.test(resultData.reservationUrl || resultData.fareConfirmReview || "")
    }
  };

  const reportPath = path.join(outputDir, "gh-quote-snapshot-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log("Report saved:", reportPath);
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
