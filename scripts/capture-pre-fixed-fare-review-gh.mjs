import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, "docs", "screenshots", "pre-fixed-fare-review");
const baseUrl = "https://infochibafukushi-dotcom.github.io/lp-site";
const estimateUrl = baseUrl + "/estimate/index.html?review=" + Date.now();

const EXPECTED = {
  singleCandidateNotice: "ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。",
  outboundStatus: "往路：確認対応",
  returnStatus: "復路：確認対応",
  stopoverNote: "復路は立ち寄り地点を含む指定ルートで算定しています。候補が1件のみのため確認対応となります。",
  baselineDistanceMeters: 7082,
  baselineDurationSeconds: 1487
};

const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

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

async function waitForEstimateReady(page){
  for(let attempt = 0; attempt < 24; attempt++){
    const status = await page.evaluate(function(){
      return {
        ready: Boolean(document.querySelector('input[name="mobilityChoice"]')),
        appText: String(document.getElementById("estimateApp")?.textContent || "").slice(0, 80)
      };
    });
    if(status.ready){
      return;
    }
    if(attempt === 0 || attempt % 4 === 0){
      console.log("waiting for estimate app...", status.appText.replace(/\s+/g, " "));
    }
    await new Promise(function(resolve){ setTimeout(resolve, 5000); });
  }
  throw new Error("estimate app did not finish loading mobility choices");
}

async function clickChoice(page, name, value){
  await page.waitForSelector('input[name="' + name + '"][value="' + value + '"]', { timeout: 30000 });
  await page.click('input[name="' + name + '"][value="' + value + '"]');
  await new Promise(function(resolve){ setTimeout(resolve, 500); });
}

async function runFlow(page){
  page.on("pageerror", function(error){
    console.error("PAGE ERROR:", error.message);
  });
  await page.goto(estimateUrl, { waitUntil: "networkidle2", timeout: 120000 });
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
  await new Promise(function(resolve){ setTimeout(resolve, 4000); });
}

async function advanceToResult(page){
  const selectBtn = await page.$('.estimate-route-select-btn[data-select-route-leg="outbound"]:not([disabled])');
  if(selectBtn){
    await selectBtn.click();
    await new Promise(function(resolve){ setTimeout(resolve, 1500); });
  }
  const returnSelectBtn = await page.$('.estimate-route-select-btn[data-select-route-leg="return"]:not([disabled])');
  if(returnSelectBtn){
    await returnSelectBtn.click();
    await new Promise(function(resolve){ setTimeout(resolve, 1500); });
  }
  const ackBtn = await page.$("[data-distance-route-acknowledge]");
  if(ackBtn){
    await ackBtn.click();
  }
  await page.waitForSelector(".estimate-result", { timeout: 120000 });
  await new Promise(function(resolve){ setTimeout(resolve, 5000); });
}

function pickSnapshotFields(snapshot){
  if(!snapshot){
    return null;
  }
  return {
    preFixedFareConfirmable: snapshot.preFixedFareConfirmable,
    preFixedFareScope: snapshot.preFixedFareScope,
    returnFareStatus: snapshot.returnFareStatus,
    returnPlanType: snapshot.returnPlanType,
    tripType: snapshot.tripType,
    totalDistanceMeters: snapshot.totalDistanceMeters,
    totalDurationSeconds: snapshot.totalDurationSeconds,
    total: snapshot.fixedFareTotal,
    outboundRoutePlan: snapshot.outboundRoutePlan ? {
      preFixedFareConfirmable: snapshot.outboundRoutePlan.preFixedFareConfirmable,
      fallbackReason: snapshot.outboundRoutePlan.fallbackReason || null,
      routeCandidatesLength: Array.isArray(snapshot.outboundRoutePlan.routeCandidates)
        ? snapshot.outboundRoutePlan.routeCandidates.length
        : 0
    } : null,
    returnRoutePlan: snapshot.returnRoutePlan ? {
      preFixedFareConfirmable: snapshot.returnRoutePlan.preFixedFareConfirmable,
      fallbackReason: snapshot.returnRoutePlan.fallbackReason || null,
      routeCandidatesLength: Array.isArray(snapshot.returnRoutePlan.routeCandidates)
        ? snapshot.returnRoutePlan.routeCandidates.length
        : 0,
      waypointAddress: snapshot.returnRoutePlan.waypoint?.waypointAddress
        || snapshot.returnRoutePlan.waypoint?.waypointLabel
        || null
    } : null
  };
}

function buildChecks(result){
  const ui = result.ui;
  const snap = result.quoteSnapshotSummary;
  const pdfText = result.pdfVisibleText || "";
  const checks = {
    uiSingleCandidateNotice: ui.singleCandidateNotice === EXPECTED.singleCandidateNotice,
    uiOutboundStatus: ui.roundTripStatusText.includes(EXPECTED.outboundStatus),
    uiReturnStatus: ui.roundTripStatusText.includes(EXPECTED.returnStatus),
    uiStopoverNote: ui.stopoverNote === EXPECTED.stopoverNote,
    mapLegendOutbound: ui.mapLegend.includes("往路"),
    mapLegendStop: ui.mapLegend.includes("立ち寄り"),
    mapLegendReturn: ui.mapLegend.includes("復路"),
    mapMarkerOrigin: ui.mapLegend.includes("発"),
    mapMarkerDestination: ui.mapLegend.includes("着"),
    mapMarkerWaypoint: ui.mapLegend.includes("寄"),
    pdfOutboundStatus: pdfText.includes("往路：確認対応"),
    pdfReturnStatus: pdfText.includes("復路：確認対応"),
    pdfSingleCandidateNotice: pdfText.includes("ルート候補が1件のみ"),
    pdfStopoverNote: /立ち寄り地点を含む指定ルート/.test(pdfText),
    snapshotPreFixedFareConfirmable: snap?.preFixedFareConfirmable === false,
    snapshotOutboundConfirmable: snap?.outboundRoutePlan?.preFixedFareConfirmable === false,
    snapshotReturnConfirmable: snap?.returnRoutePlan?.preFixedFareConfirmable === false,
    snapshotOutboundFallback: snap?.outboundRoutePlan?.fallbackReason === "only_one_distinct_route",
    snapshotReturnFallback: snap?.returnRoutePlan?.fallbackReason === "only_one_distinct_route",
    snapshotOutboundCandidates: snap?.outboundRoutePlan?.routeCandidatesLength === 1,
    snapshotReturnCandidates: snap?.returnRoutePlan?.routeCandidatesLength === 1,
    snapshotReturnPlanType: snap?.returnPlanType === "return_with_stop",
    reservationFareConfirmReview: /fareConfirm=review/.test(result.reservationUrl || ""),
    distanceWithinBaseline: Math.abs(Number(snap?.totalDistanceMeters || 0) - EXPECTED.baselineDistanceMeters) <= 500,
    durationWithinBaseline: Math.abs(Number(snap?.totalDurationSeconds || 0) - EXPECTED.baselineDurationSeconds) <= 300
  };
  checks.allPassed = Object.keys(checks).every(function(key){
    return key === "allPassed" || checks[key] === true;
  });
  return checks;
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  const chromeExecutable = resolveChromeExecutable();
  if(!chromeExecutable){
    throw new Error("Chrome executable not found for Puppeteer review capture.");
  }
  const launchOptions = {
    headless: true,
    executablePath: chromeExecutable
  };
  console.log("Using browser:", chromeExecutable);
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 2400 });

  await runFlow(page);
  await advanceToResult(page);

  const screenshotPath = path.join(outputDir, "gh-result-review.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const resultData = await page.evaluate(async function(){
    const handoffRaw = sessionStorage.getItem("lp_estimate_handoff");
    const handoff = handoffRaw ? JSON.parse(handoffRaw) : null;
    const quoteSnapshot = handoff?.quoteSnapshot || null;
    const legendEl = document.querySelector(".estimate-route-map-legend");
    const ui = {
      roundTripStatusText: Array.from(document.querySelectorAll(".estimate-round-trip-status p")).map(function(el){
        return String(el.textContent || "").trim();
      }),
      singleCandidateNotice: String(document.querySelector(".estimate-prefixed-fare-single-candidate-notice")?.textContent || "").trim(),
      stopoverNote: String(document.querySelector(".estimate-prefixed-fare-stopover-note")?.textContent || "").trim(),
      mapLegend: String(legendEl?.textContent || "").replace(/\s+/g, " "),
      totalLabel: String(document.querySelector(".estimate-result-total")?.textContent || "").trim()
    };
    const reservationUrl = String(document.querySelector(".estimate-cta-primary")?.getAttribute("href") || "");
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
        pdfVisibleText = String(element?.textContent || "").replace(/\s+/g, " ").trim();
        const wrap = document.createElement("div");
        wrap.id = "pdf-review-capture-root";
        wrap.appendChild(element);
        document.body.innerHTML = "";
        document.body.appendChild(wrap);
      }catch(error){
        pdfBuildError = String(error?.message || error);
      }
    }else{
      pdfBuildError = !handoff ? "handoff_missing" : "EstimatePdf_unavailable";
    }
    return {
      handoff: handoff,
      quoteSnapshot: quoteSnapshot,
      pdfBuildError: pdfBuildError,
      pdfVisibleText: pdfVisibleText,
      ui: ui,
      reservationUrl: reservationUrl
    };
  });

  const pdfPath = path.join(outputDir, "gh-result-review.pdf");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" }
  });

  const snapshotPath = path.join(outputDir, "gh-quote-snapshot-review.json");
  fs.writeFileSync(snapshotPath, JSON.stringify(resultData.quoteSnapshot || null, null, 2) + "\n", "utf8");

  const reservationLog = [
    "verifiedAt: " + new Date().toISOString(),
    "baseUrl: " + baseUrl,
    "reservationUrl: " + (resultData.reservationUrl || ""),
    "fareConfirm=review: " + (/fareConfirm=review/.test(resultData.reservationUrl || "") ? "yes" : "no")
  ].join("\n") + "\n";
  fs.writeFileSync(path.join(outputDir, "gh-reservation-url-review.txt"), reservationLog, "utf8");

  const summary = {
    verifiedAt: new Date().toISOString(),
    baseUrl: baseUrl,
    commitNote: "de32f23 review",
    ui: resultData.ui,
    quoteSnapshotSummary: pickSnapshotFields(resultData.quoteSnapshot),
    handoffTotal: resultData.handoff?.total ?? null,
    pdfBuildError: resultData.pdfBuildError || "",
    reservationUrl: resultData.reservationUrl || "",
    checks: buildChecks({
      ui: resultData.ui,
      quoteSnapshotSummary: pickSnapshotFields(resultData.quoteSnapshot),
      pdfVisibleText: resultData.pdfVisibleText || "",
      reservationUrl: resultData.reservationUrl || ""
    })
  };

  const reportPath = path.join(outputDir, "gh-review-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  await browser.close();

  console.log(JSON.stringify(summary, null, 2));
  console.log("Artifacts saved to:", outputDir);
  if(!summary.checks.allPassed){
    process.exit(1);
  }
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
