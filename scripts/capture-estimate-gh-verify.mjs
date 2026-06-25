import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, "docs", "screenshots");
const baseUrl = String(process.env.ESTIMATE_BASE_URL || "https://infochibafukushi-dotcom.github.io/lp-site").replace(/\/$/, "");
const estimateUrl = baseUrl + "/estimate/index.html";

function resolveChromeExecutable(){
  if(process.env.PUPPETEER_EXECUTABLE_PATH){
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  return candidates.find(function(candidate){
    return fs.existsSync(candidate);
  }) || null;
}

async function waitForEstimateReady(page){
  await page.waitForFunction(function(){
    const app = document.getElementById("estimateApp");
    if(!app){
      return false;
    }
    const text = String(app.textContent || "");
    return text.length > 0 && !text.includes("読み込み中") && !text.includes("設定を読み込んでいます");
  }, { timeout: 90000 });
}

async function clickChoice(page, name, value){
  await page.waitForSelector('input[name="' + name + '"][value="' + value + '"]', { timeout: 30000 });
  await page.click('input[name="' + name + '"][value="' + value + '"]');
  await new Promise(function(resolve){ setTimeout(resolve, 500); });
}

async function clickFirstChoice(page, name){
  await page.waitForSelector('input[name="' + name + '"]', { timeout: 30000 });
  const value = await page.$eval('input[name="' + name + '"]', function(el){ return el.value; });
  await clickChoice(page, name, value);
}

async function collectMetrics(page){
  return page.evaluate(function(){
    const cards = Array.from(document.querySelectorAll(".estimate-route-card--compact, .estimate-route-card"));
    const cardTexts = cards.map(function(card){
      return String(card.textContent || "").replace(/\s+/g, " ").trim();
    });
    return {
      candidateCardCount: cards.length,
      step6CompactCards: document.querySelectorAll(".estimate-route-card--compact").length,
      hasLegendStop: Boolean(document.querySelector(".estimate-route-map-legend-swatch--stop")),
      hasLegendReturn: Boolean(document.querySelector(".estimate-route-map-legend-swatch--return")),
      hasLegendOutbound: Boolean(document.querySelector(".estimate-route-map-legend-swatch--outbound")),
      hasWaypointMarker: Boolean(document.querySelector(".estimate-route-map-legend-marker--waypoint")),
      hasRoadRadios: Boolean(document.querySelector('input[name="roadType"]')),
      hasResult: Boolean(document.querySelector(".estimate-result")),
      hasActiveStep6: Boolean(document.querySelector('[data-step-id="distance"].estimate-step--active')),
      routeFeedback: String(document.getElementById("routeCalcFeedback")?.textContent || "").trim(),
      cardTexts: cardTexts
    };
  });
}

async function waitForStep6RouteReady(page){
  await page.waitForFunction(function(){
    const activeStep6 = document.querySelector('[data-step-id="distance"].estimate-step--active');
    const hasCards = document.querySelectorAll(".estimate-route-card").length > 0;
    const hasMap = Boolean(document.querySelector(".estimate-route-map-legend, .estimate-route-map .gm-style"));
    const hasError = String(document.getElementById("routeCalcFeedback")?.textContent || "").trim().length > 0;
    return Boolean(activeStep6) && (hasCards || hasMap || hasError);
  }, { timeout: 180000 });
  await page.waitForSelector(".estimate-route-map .gm-style, .estimate-route-map-legend", { timeout: 180000 });
  await new Promise(function(resolve){ setTimeout(resolve, 4000); });
}

async function runEstimateFlow(page){
  await page.goto(estimateUrl, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForEstimateReady(page);

  await clickChoice(page, "mobilityChoice", "stretcher");
  await clickFirstChoice(page, "stairChoice");
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
  await waitForStep6RouteReady(page);
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

  await runEstimateFlow(page);

  let metrics = await collectMetrics(page);
  const step6 = await page.$('[data-step-id="distance"]');
  if(step6){
    await step6.screenshot({ path: path.join(outputDir, "gh-estimate-step6-candidates.png") });
  }
  const mapWrap = await page.$(".estimate-route-preview--inline .estimate-route-map-wrap, .estimate-route-preview .estimate-route-map-wrap");
  if(mapWrap){
    await mapWrap.screenshot({ path: path.join(outputDir, "gh-estimate-step6-route-map.png") });
  }

  const selectBtn = await page.$('.estimate-route-select-btn:not([disabled])');
  if(selectBtn){
    await selectBtn.click();
    await page.waitForSelector(".estimate-result", { timeout: 30000 });
    await new Promise(function(resolve){ setTimeout(resolve, 4000); });
  }else{
    const ackBtn = await page.$("[data-distance-route-acknowledge]");
    if(ackBtn){
      await ackBtn.click();
      await page.waitForSelector(".estimate-result", { timeout: 30000 });
      await new Promise(function(resolve){ setTimeout(resolve, 4000); });
    }
  }

  metrics.afterSelection = await collectMetrics(page);
  await page.screenshot({ path: path.join(outputDir, "gh-estimate-result-after-selection.png"), fullPage: true });
  const resultMapWrap = await page.$(".estimate-result .estimate-route-map-wrap");
  if(resultMapWrap){
    await resultMapWrap.screenshot({ path: path.join(outputDir, "gh-estimate-result-route-map.png") });
  }

  await browser.close();

  console.log(JSON.stringify({
    baseUrl: baseUrl,
    beforeSelection: metrics,
    afterSelection: metrics.afterSelection,
    screenshots: [
      "docs/screenshots/gh-estimate-step6-candidates.png",
      "docs/screenshots/gh-estimate-step6-route-map.png",
      "docs/screenshots/gh-estimate-result-after-selection.png",
      "docs/screenshots/gh-estimate-result-route-map.png"
    ]
  }, null, 2));
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
