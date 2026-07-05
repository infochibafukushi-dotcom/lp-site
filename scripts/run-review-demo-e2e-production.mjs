import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const STORAGE_KEY = "preFixedFareReviewReservations";
const USE_PRODUCTION = process.env.REVIEW_DEMO_E2E_BASE === "production";
const LOCAL_BASE = "file:///" + rootDir.replace(/\\/g, "/");
const ESTIMATE_URL = USE_PRODUCTION
  ? "https://infochibafukushi-dotcom.github.io/lp-site/estimate/?scenario=pre-fixed-fare-demo"
  : LOCAL_BASE + "/estimate/index.html?scenario=pre-fixed-fare-demo";
const ADMIN_URL = USE_PRODUCTION
  ? "https://infochibafukushi-dotcom.github.io/lp-site/admin.html"
  : LOCAL_BASE + "/admin.html";

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

async function selectChoice(page, labelText){
  const clicked = await page.evaluate(function(text){
    const labels = Array.from(document.querySelectorAll("label.estimate-choice-card"));
    const label = labels.find(function(node){
      return (node.textContent || "").includes(text);
    });
    if(!label){
      return false;
    }
    const input = label.querySelector("input");
    if(input){
      input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    label.click();
    return true;
  }, labelText);
  assert(clicked, "choice not found: " + labelText);
}

async function waitForActiveStepTitle(page, titleFragment){
  await page.waitForFunction(function(fragment){
    const active = document.querySelector(".estimate-step--active .estimate-step-title");
    return active && (active.textContent || "").includes(fragment);
  }, { timeout: 60000 }, titleFragment);
}

async function runEstimateFlow(page){
  await page.goto(ESTIMATE_URL, { waitUntil: "networkidle2", timeout: 180000 });
  await page.waitForSelector(".estimate-review-demo-banner", { timeout: 60000 });
  const bannerText = await page.$eval(".estimate-review-demo-banner", function(el){ return el.textContent.trim(); });
  assert(bannerText.includes("審査用デモモード"), "demo banner missing");

  const homeHidden = await page.evaluate(function(){
    return !document.querySelector(".estimate-top-bar-home");
  });
  assert(homeHidden, "home link should be hidden in demo mode");

  await page.evaluate(function(){
    localStorage.removeItem("preFixedFareReviewReservations");
  });

  await waitForActiveStepTitle(page, "移動方法");
  await selectChoice(page, "無料車いす");
  await waitForActiveStepTitle(page, "介助内容");
  await selectChoice(page, "乗降介助");
  await waitForActiveStepTitle(page, "階段介助");
  await selectChoice(page, "階段介助なし");
  await waitForActiveStepTitle(page, "送迎方法");
  await selectChoice(page, "片道");

  await page.waitForSelector("#originAddressInput", { timeout: 60000 });
  await page.click("#originAddressInput", { clickCount: 3 });
  await page.type("#originAddressInput", "千葉市中央区中央港1-1", { delay: 15 });
  await page.click("#destinationAddressInput", { clickCount: 3 });
  await page.type("#destinationAddressInput", "千葉大学医学部附属病院", { delay: 15 });
  await page.click("#calculateDistanceBtn");

  await page.waitForFunction(function(){
    return Boolean(document.querySelector(".estimate-route-card-list--ab .estimate-route-card"));
  }, { timeout: 180000 });

  const routeClicked = await page.evaluate(function(){
    const button = document.querySelector(".estimate-route-card-list--ab .estimate-route-select-btn");
    if(!button){
      return false;
    }
    button.click();
    return true;
  });
  assert(routeClicked, "route select button not found");

  await page.waitForSelector("#reviewDemoReservation", { timeout: 180000 });
  await page.waitForFunction(function(){
    const consent = document.querySelector("[data-review-demo-consent]");
    return Boolean(consent);
  }, { timeout: 60000 });
  await page.evaluate(function(){
    const consent = document.querySelector("[data-review-demo-consent]");
    if(!consent){
      throw new Error("consent checkbox missing");
    }
    consent.checked = true;
    consent.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(function(){
    const saveBtn = document.querySelector("[data-review-demo-save]");
    return Boolean(saveBtn) && saveBtn.disabled === false;
  }, { timeout: 60000 });
  await clickSelector(page, "[data-review-demo-save]");

  await page.waitForFunction(function(storageKey){
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) && parsed.length === 1 && parsed[0].reservationId === "PF-REVIEW-001";
  }, { timeout: 60000 }, STORAGE_KEY);

  const saved = await page.evaluate(function(storageKey){
    return JSON.parse(localStorage.getItem(storageKey) || "[]")[0];
  }, STORAGE_KEY);
  assert(saved.reservationId === "PF-REVIEW-001", "reservation id mismatch");
  assert(saved.scenario === "pre-fixed-fare-demo", "scenario mismatch");

  await page.waitForFunction(function(){
    return (document.body.innerText || "").includes("審査用デモ予約を保存しました");
  }, { timeout: 60000 });

  return saved;
}

async function clickSelector(page, selector){
  await page.waitForSelector(selector, { timeout: 60000 });
  const clicked = await page.evaluate(function(sel){
    const el = document.querySelector(sel);
    if(!el){
      return false;
    }
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.click();
    return true;
  }, selector);
  assert(clicked, "click target missing: " + selector);
}

async function verifyAdmin(page){
  await page.goto(ADMIN_URL, { waitUntil: "networkidle2", timeout: 180000 });
  await page.waitForSelector("#preFixedFareReviewDemoList", { timeout: 60000 });
  await clickSelector(page, "#preFixedFareReviewDemoRefreshBtn");
  await page.waitForFunction(function(){
    const list = document.getElementById("preFixedFareReviewDemoList");
    return list && (list.textContent || "").includes("PF-REVIEW-001");
  }, { timeout: 60000 });

  await clickSelector(page, "#preFixedFareReviewDemoDeleteBtn");
  await clickSelector(page, "#preFixedFareReviewDemoRefreshBtn");
  await page.waitForFunction(function(storageKey){
    const raw = localStorage.getItem(storageKey);
    return !raw || JSON.parse(raw).length === 0;
  }, { timeout: 30000 }, STORAGE_KEY);

  const listAfterDelete = await page.evaluate(function(){
    return document.getElementById("preFixedFareReviewDemoList")?.textContent || "";
  });
  assert(listAfterDelete.includes("保存された審査用デモ予約はありません"), "deleted reservation still visible");

  await page.goto(ESTIMATE_URL, { waitUntil: "networkidle2", timeout: 180000 });
  await page.waitForSelector("#reviewDemoReservation", { timeout: 180000 }).catch(function(){ return null; });
  const secondSave = await page.evaluate(function(storageKey){
    if(!window.PreFixedFareReviewDemo){
      throw new Error("PreFixedFareReviewDemo missing");
    }
    const first = window.PreFixedFareReviewDemo.buildReservationRecord({
      slotId: "slot-20260901-1000",
      origin: "千葉市中央区中央港1-1",
      destination: "千葉大学医学部附属病院",
      result: { total: 9700, quoteSnapshot: { fixedFareTotal: 7800, serviceFees: [{ label: "介助料金", amount: 1100 }, { label: "待機料金", amount: 800 }] } }
    });
    window.PreFixedFareReviewDemo.saveReservation(first);
    const second = window.PreFixedFareReviewDemo.buildReservationRecord({
      slotId: "slot-20260902-1400",
      origin: "上書き乗車地",
      destination: "上書き目的地",
      result: { total: 8800, quoteSnapshot: { fixedFareTotal: 7800, serviceFees: [{ label: "介助料金", amount: 1000 }] } }
    });
    window.PreFixedFareReviewDemo.saveReservation(second);
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  }, STORAGE_KEY);
  assert(secondSave.length === 1, "overwrite should keep single reservation");
  assert(secondSave[0].reservationId === "PF-REVIEW-001", "reservation id should remain PF-REVIEW-001");
  assert(secondSave[0].origin === "上書き乗車地", "reservation should be overwritten");

  await page.goto(ADMIN_URL, { waitUntil: "networkidle2", timeout: 180000 });
  await clickSelector(page, "#preFixedFareReviewDemoRefreshBtn");
  await page.waitForFunction(function(){
    const list = document.getElementById("preFixedFareReviewDemoList");
    return list && (list.textContent || "").includes("上書き乗車地");
  }, { timeout: 60000 });
}

async function main(){
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
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    const saved = await runEstimateFlow(page);
    await verifyAdmin(page);
    console.log("PASS review demo E2E (" + (USE_PRODUCTION ? "production" : "local") + ")");
    console.log(JSON.stringify({
      reservationId: saved.reservationId,
      totalLabel: saved.totalLabel,
      origin: saved.origin,
      destination: saved.destination
    }, null, 2));
  }finally{
    await browser.close();
  }
}

main().catch(function(error){
  console.error(error);
  process.exitCode = 1;
});
