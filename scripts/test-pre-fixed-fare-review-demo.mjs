import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const STORAGE_KEY = "preFixedFareReviewReservations";

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

function loadModule(relativePath){
  const code = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    URLSearchParams,
    localStorage: createMemoryStorage()
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: relativePath });
  return sandbox;
}

function createMemoryStorage(){
  const store = new Map();
  return {
    getItem(key){
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value){
      store.set(key, String(value));
    },
    removeItem(key){
      store.delete(key);
    },
    clear(){
      store.clear();
    }
  };
}

function runModuleTests(){
  const demoSandbox = loadModule("shared/pre-fixed-fare-review-demo.js");
  const demo = demoSandbox.PreFixedFareReviewDemo;
  assert(demo, "PreFixedFareReviewDemo module missing");
  assert(demo.isReviewDemoMode("?scenario=pre-fixed-fare-demo"), "scenario param should enable demo mode");
  assert(!demo.isReviewDemoMode("?scenario=other"), "other scenario should not enable demo mode");
  demoSandbox.window.location = { search: "?scenario=pre-fixed-fare-demo" };
  assert(demo.shouldSkipProductionIntegrations(), "production integrations should be skipped in demo mode");
  assert(demo.CALENDAR_SLOTS.length === 4, "expected 4 demo calendar slots");
  assert(demo.CALENDAR_SLOTS[0].label === "令和8年9月1日 10:00", "first slot label mismatch");

  const record = demo.buildReservationRecord({
    slotId: "slot-20260901-1000",
    origin: "千葉市中央区中央港1-1",
    destination: "千葉大学医学部附属病院",
    result: { total: 9700, quoteSnapshot: { fixedFareTotal: 7800 } }
  });
  assert(record.reservationId === "PF-REVIEW-001", "reservation id mismatch: " + record.reservationId);
  assert(record.customerName === "審査用デモ", "customer name mismatch");
  assert(record.totalLabel === "9,700円", "total label mismatch: " + record.totalLabel);
  assert(record.productionIntegration === "none", "productionIntegration should be none");

  demo.saveReservation(record);
  const saved = demo.listReservations();
  assert(saved.length === 1, "expected one saved demo reservation");
  assert(saved[0].storageScope === STORAGE_KEY, "storage scope mismatch");

  const panelHtml = demo.renderReservationPanel({
    result: { total: 9700, quoteSnapshot: { fixedFareTotal: 7800 } },
    origin: record.origin,
    destination: record.destination,
    ui: { savedRecord: record }
  });
  assert(panelHtml.includes("審査用デモ予約を保存しました"), "completion title missing");
  assert(panelHtml.includes("PF-REVIEW-001"), "completion reservation id missing");
  assert(panelHtml.includes("7,800円"), "completion fare missing");

  const registerSandbox = loadModule("shared/pre-fixed-fare-review-demo.js");
  registerSandbox.window.location = { search: "?scenario=pre-fixed-fare-demo" };
  vm.runInNewContext(fs.readFileSync(path.join(rootDir, "shared/estimate-quote-register.js"), "utf8"), registerSandbox, {
    filename: "estimate-quote-register.js"
  });
  registerSandbox.window = registerSandbox;
  return registerSandbox.EstimateQuoteRegister.registerQuoteFromHandoff({
    estimateNo: "TEST-001",
    quoteSnapshot: { fixedFareTotal: 7800 },
    total: 9700
  }).then(function(result){
    assert(result.ok === true, "registerQuoteFromHandoff should return ok");
    assert(result.skipped === true, "registerQuoteFromHandoff should be skipped");
    assert(result.reason === "review_demo_mode", "skip reason mismatch: " + result.reason);
  });
}

async function runBrowserTests(){
  const executablePath = resolveChromeExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"]
  });
  const consoleErrors = [];

  try{
    const estimateUrl = "file:///" + path.join(rootDir, "estimate/index.html").replace(/\\/g, "/") + "?scenario=pre-fixed-fare-demo";
    const adminUrl = "file:///" + path.join(rootDir, "admin.html").replace(/\\/g, "/");
    const page = await browser.newPage();
    page.on("console", function(message){
      if(message.type() === "error"){
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", function(error){
      consoleErrors.push(String(error.message || error));
    });

    await page.goto(estimateUrl, { waitUntil: "networkidle0", timeout: 90000 });
    const estimateChecks = await page.evaluate(function(storageKey){
      const demo = window.PreFixedFareReviewDemo;
      const banner = document.querySelector(".estimate-review-demo-banner");
      const pageActive = document.body.classList.contains("estimate-review-demo-active");
      localStorage.removeItem(storageKey);
      const record = demo.buildReservationRecord({
        slotId: "slot-20260901-1000",
        origin: "千葉市中央区中央港1-1",
        destination: "千葉大学医学部附属病院",
        result: { total: 9700, quoteSnapshot: { fixedFareTotal: 7800, serviceFees: [
          { label: "介助料金", amount: 1100 },
          { label: "待機料金", amount: 800 }
        ] } }
      });
      demo.saveReservation(record);
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const reservationsStored = localStorage.getItem("reservations");
      return {
        hasModule: Boolean(demo),
        isDemoMode: demo.isReviewDemoMode(),
        bannerText: banner ? banner.textContent.trim() : "",
        pageActive: pageActive,
        reservationId: record.reservationId,
        storedCount: stored.length,
        storedScope: stored[0]?.storageScope || "",
        hasReservationsKey: reservationsStored !== null && reservationsStored !== "",
        registerSkippedPromise: window.EstimateQuoteRegister.registerQuoteFromHandoff({
          estimateNo: "BROWSER-001",
          quoteSnapshot: { fixedFareTotal: 7800 },
          total: 9700
        })
      };
    }, STORAGE_KEY);

    assert(estimateChecks.hasModule, "PreFixedFareReviewDemo not loaded on estimate page");
    assert(estimateChecks.isDemoMode, "estimate page should be in review demo mode");
    assert(
      estimateChecks.bannerText.includes("審査用デモモード"),
      "demo banner missing: " + estimateChecks.bannerText
    );
    assert(estimateChecks.pageActive, "estimate page should have review demo active class");
    assert(estimateChecks.storedCount === 1, "demo reservation not saved to localStorage");
    assert(estimateChecks.storedScope === STORAGE_KEY, "demo reservation storage scope mismatch");
    assert(!estimateChecks.hasReservationsKey, "demo save should not write production reservations key");

    const registerResult = await page.evaluate(async function(){
      return window.EstimateQuoteRegister.registerQuoteFromHandoff({
        estimateNo: "BROWSER-001",
        quoteSnapshot: { fixedFareTotal: 7800 },
        total: 9700
      });
    });
    assert(registerResult.skipped === true, "browser registerQuoteFromHandoff should skip in demo mode");

    await page.goto(adminUrl, { waitUntil: "networkidle0", timeout: 90000 });
    const adminChecks = await page.evaluate(function(storageKey){
      const listBox = document.getElementById("preFixedFareReviewDemoList");
      const refreshBtn = document.getElementById("preFixedFareReviewDemoRefreshBtn");
      const list = window.PreFixedFareReviewDemo?.listReservations?.() || [];
      return {
        hasListBox: Boolean(listBox),
        hasRefreshBtn: Boolean(refreshBtn),
        listHtml: listBox ? listBox.innerHTML : "",
        listCount: list.length
      };
    }, STORAGE_KEY);
    assert(adminChecks.hasListBox, "admin review demo list box missing");
    assert(adminChecks.hasRefreshBtn, "admin review demo refresh button missing");
    assert(adminChecks.listCount >= 1, "admin should read saved demo reservations");
    assert(adminChecks.listHtml.includes("PF-REVIEW-"), "admin list should show demo reservation id");

    const manualDataSandbox = loadModule("shared/pre-fixed-fare-app-manual-data.js");
    const qrUrl = manualDataSandbox.PreFixedFareAppManualData?.urls?.estimateReservation
      || manualDataSandbox.PreFixedFareAppManualData?.buildReportData?.()?.qrItems?.find?.(function(item){ return item.id === "qr-01"; })?.url
      || "";
    const manualDataCode = fs.readFileSync(path.join(rootDir, "shared/pre-fixed-fare-app-manual-data.js"), "utf8");
    assert(
      manualDataCode.includes("./estimate/?scenario=pre-fixed-fare-demo"),
      "manual QR① URL must remain ./estimate/?scenario=pre-fixed-fare-demo"
    );

    const normalPage = await browser.newPage();
    normalPage.on("console", function(message){
      if(message.type() === "error"){
        consoleErrors.push("[normal] " + message.text());
      }
    });
    normalPage.on("pageerror", function(error){
      consoleErrors.push("[normal] " + String(error.message || error));
    });
    const normalEstimateUrl = "file:///" + path.join(rootDir, "estimate/index.html").replace(/\\/g, "/");
    await normalPage.goto(normalEstimateUrl, { waitUntil: "networkidle0", timeout: 90000 });
    const normalChecks = await normalPage.evaluate(function(){
      return {
        isDemoMode: window.PreFixedFareReviewDemo?.isReviewDemoMode?.() === true,
        hasBanner: Boolean(document.querySelector(".estimate-review-demo-banner"))
      };
    });
    assert(!normalChecks.isDemoMode, "normal estimate page should not be in demo mode");
    assert(!normalChecks.hasBanner, "normal estimate page should not show demo banner");

    const filteredConsoleErrors = consoleErrors.filter(function(message){
      return !/Failed to load resource|net::ERR_FILE_NOT_FOUND|favicon/i.test(message);
    });
    assert(filteredConsoleErrors.length === 0, "console errors detected: " + filteredConsoleErrors.join(" | "));
  }finally{
    await browser.close();
  }
}

async function main(){
  await runModuleTests();
  await runBrowserTests();
  console.log("pre-fixed fare review demo tests passed");
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
