import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(rootDir, "docs", "screenshots");
const baseUrl = String(process.env.ESTIMATE_BASE_URL || "https://infochibafukushi-dotcom.github.io/lp-site").replace(/\/$/, "");
const estimateUrl = baseUrl + "/estimate/";

async function waitForEstimateReady(page){
  await page.waitForFunction(function(){
    const app = document.getElementById("estimateApp");
    if(!app){
      return false;
    }
    const text = String(app.textContent || "");
    return text.length > 0 && !text.includes("読み込み中");
  }, { timeout: 60000 });
}

async function clickChoice(page, name, value){
  await page.waitForSelector('input[name="' + name + '"][value="' + value + '"]', { timeout: 15000 });
  await page.click('input[name="' + name + '"][value="' + value + '"]');
  await new Promise(function(resolve){ setTimeout(resolve, 400); });
}

async function waitForRouteReady(page){
  await page.waitForFunction(function(){
    const btn = document.getElementById("calculateDistanceBtn");
    return btn && !btn.disabled && String(btn.textContent || "").includes("ルートを計算");
  }, { timeout: 120000 });
  await page.waitForSelector(".estimate-route-map-legend, .estimate-route-map .gm-style", {
    timeout: 120000
  });
  await new Promise(function(resolve){ setTimeout(resolve, 2500); });
}

async function runEstimateFlow(page){
  await page.goto(estimateUrl, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForEstimateReady(page);

  await clickChoice(page, "mobilityChoice", "free-wheelchair");
  await clickChoice(page, "assistanceChoice", "watch-assist");
  await clickChoice(page, "stairChoice", "stair-none");
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
  await waitForRouteReady(page);
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 2000 });

  await runEstimateFlow(page);

  let metrics = await page.evaluate(function(){
    return {
      candidateCardCount: document.querySelectorAll(".estimate-route-card").length,
      hasLegendStop: Boolean(document.querySelector(".estimate-route-map-legend-swatch--stop")),
      hasRoadRadios: Boolean(document.querySelector('input[name="roadType"]')),
      hasResult: Boolean(document.querySelector(".estimate-result"))
    };
  });

  await page.screenshot({ path: path.join(outputDir, "gh-estimate-result-stop-route.png"), fullPage: true });

  const selectBtn = await page.$('.estimate-route-select-btn:not([disabled])');
  if(selectBtn){
    await selectBtn.click();
    await new Promise(function(resolve){ setTimeout(resolve, 2500); });
  }

  const editDistance = await page.$('[data-edit-step="distance"]');
  if(editDistance){
    await editDistance.click();
    await new Promise(function(resolve){ setTimeout(resolve, 600); });
    await page.click("#calculateDistanceBtn");
    await waitForRouteReady(page);
    const distanceStep = await page.$('[data-step-id="distance"]');
    if(distanceStep){
      await distanceStep.screenshot({ path: path.join(outputDir, "gh-estimate-step6-stop-route.png") });
    }
    metrics = await page.evaluate(function(){
      return {
        candidateCardCount: document.querySelectorAll(".estimate-route-card").length,
        hasLegendStop: Boolean(document.querySelector(".estimate-route-map-legend-swatch--stop")),
        hasRoadRadios: Boolean(document.querySelector('input[name="roadType"]')),
        hasResult: Boolean(document.querySelector(".estimate-result")),
        step6CompactCards: document.querySelectorAll(".estimate-route-card--compact").length
      };
    });
  }

  await browser.close();

  console.log(JSON.stringify(Object.assign({ baseUrl: baseUrl }, metrics, {
    screenshots: [
      "docs/screenshots/gh-estimate-step6-stop-route.png",
      "docs/screenshots/gh-estimate-result-stop-route.png"
    ]
  }), null, 2));
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
