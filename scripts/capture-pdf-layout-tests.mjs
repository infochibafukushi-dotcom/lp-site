import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "screenshots", "pdf-layout");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

function startServer(){
  return new Promise(function(resolve){
    const server = http.createServer(function(req, res){
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(rootDir, safePath === path.sep ? "index.html" : safePath);
      if(!filePath.startsWith(rootDir)){
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.readFile(filePath, function(err, data){
        if(err){
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", function(){
      resolve({ server, port: server.address().port });
    });
  });
}

async function fetchRoutePlanInBrowser(page, port, config){
  const apiKey = String(config?.googleMaps?.apiKey || "").trim();
  if(!apiKey){
    return null;
  }
  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-layout-test.html", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  return page.evaluate(async function(apiKey){
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline"
      },
      body: JSON.stringify({
        origin: { address: "千葉市中央区" },
        destination: { address: "千葉大学医学部附属病院" },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        routeModifiers: { avoidTolls: true, avoidHighways: true, avoidFerries: false },
        languageCode: "ja",
        units: "METRIC"
      })
    });
    const data = await response.json();
    if(!response.ok || !Array.isArray(data.routes) || !data.routes.length){
      throw new Error(data?.error?.message || "ルート取得失敗");
    }
    const route = data.routes[0];
    const durationSeconds = Number(String(route.duration || "0s").replace(/s$/, "")) || 0;
    return {
      provider: "google_routes",
      roadType: "general",
      selectedRouteId: "route_0",
      encodedPolyline: String(route?.polyline?.encodedPolyline || ""),
      distanceMeters: Number(route.distanceMeters) || 0,
      durationSeconds: durationSeconds,
      routes: [{
        routeId: "route_0",
        encodedPolyline: String(route?.polyline?.encodedPolyline || ""),
        distanceMeters: Number(route.distanceMeters) || 0,
        durationSeconds: durationSeconds
      }],
      pickup: { address: "千葉市中央区" },
      destination: { address: "千葉大学医学部附属病院" }
    };
  }, apiKey);
}

async function fetchRoutePlan(config, page, port){
  if(page && port){
    try{
      return await fetchRoutePlanInBrowser(page, port, config);
    }catch(error){
      console.warn("Browser route fetch failed:", error.message);
    }
  }
  return getFallbackRoutePlan();
}

function encodePolyline(points){
  let lastLat = 0;
  let lastLng = 0;
  let result = "";
  points.forEach(function(point){
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    result += encodeSignedNumber(lat - lastLat);
    result += encodeSignedNumber(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  });
  return result;
}

function encodeSignedNumber(num){
  let sgnNum = num << 1;
  if(num < 0){
    sgnNum = ~sgnNum;
  }
  let encoded = "";
  while(sgnNum >= 0x20){
    encoded += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  encoded += String.fromCharCode(sgnNum + 63);
  return encoded;
}

function getFallbackRoutePlan(){
  const points = [
    { lat: 35.6074, lng: 140.1065 },
    { lat: 35.6120, lng: 140.1080 },
    { lat: 35.6196, lng: 140.1033 }
  ];
  const encodedPolyline = encodePolyline(points);
  return {
    provider: "google_routes",
    roadType: "general",
    selectedRouteId: "route_0",
    encodedPolyline: encodedPolyline,
    distanceMeters: 3300,
    durationSeconds: 480,
    routes: [{
      routeId: "route_0",
      encodedPolyline: encodedPolyline,
      distanceMeters: 3300,
      durationSeconds: 480
    }],
    pickup: { address: "千葉市中央区" },
    destination: { address: "千葉大学医学部附属病院" }
  };
}

function decodePolyline(encoded){
  const poly = String(encoded || "");
  if(!poly){
    return [];
  }
  let index = 0;
  const len = poly.length;
  let lat = 0;
  let lng = 0;
  const points = [];
  while(index < len){
    let shift = 0;
    let result = 0;
    let byte = 0;
    do{
      byte = poly.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    }while(byte >= 0x20);
    const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += deltaLat;
    shift = 0;
    result = 0;
    do{
      byte = poly.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    }while(byte >= 0x20);
    const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += deltaLng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

async function fetchRouteMapDataUrl(page, config, routePlan){
  const apiKey = String(config?.googleMaps?.apiKey || "").trim();
  const encodedPolyline = String(routePlan?.encodedPolyline || "").trim();
  if(!apiKey || !encodedPolyline){
    return "";
  }
  const path = decodePolyline(encodedPolyline);
  if(path.length < 2){
    return "";
  }
  const staticMapUrl = await page.evaluate(function(args){
    if(!window.EstimatePdf || typeof window.EstimatePdf.buildStaticMapUrl !== "function"){
      return "";
    }
    return window.EstimatePdf.buildStaticMapUrl(args);
  }, {
    apiKey: apiKey,
    encodedPolyline: encodedPolyline,
    startPoint: path[0],
    endPoint: path[path.length - 1],
    pathPoints: path,
    widthPx: 640,
    heightPx: 240,
    language: config?.googleMaps?.language || "ja",
    region: config?.googleMaps?.region || "JP"
  });
  if(!staticMapUrl){
    return "";
  }
  const response = await fetch(staticMapUrl);
  if(!response.ok){
    console.warn("Static map fetch failed:", response.status);
    return "";
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return "data:image/png;base64," + buffer.toString("base64");
}

function buildCaseData(config, routePlan, testCase, routeMapDataUrl){
  const pdfFooter = Object.assign({}, config.pdfFooter || {});
  if(!testCase.qr){
    pdfFooter.homepageUrl = "";
    pdfFooter.lineUrl = "";
  }

  const usageSummary = [
    { label: "移動方法", value: "自家用車椅子" },
    { label: "介助内容", value: "付き添い" },
    { label: "階段介助", value: "なし" },
    { label: "送迎方法", value: testCase.waiting ? "往復" : "片道" },
    { label: "運賃方式", value: testCase.fareMode === "time" ? "時間制運賃" : "距離制運賃" },
    { label: "片道距離", value: "3.3km" }
  ];
  if(testCase.waiting){
    usageSummary.splice(4, 0, { label: "待機・付き添い", value: "待機60分" });
  }

  const fareSections = testCase.fareMode === "time"
    ? [
      {
        title: "事前確定運賃",
        rows: [
          { label: "時間制運賃", amount: 6200 },
          { label: "迎車料金", amount: 800 }
        ]
      },
      {
        title: "介助・サービス料金",
        rows: testCase.waiting
          ? [
            { label: "介助料金", amount: 1100 },
            { label: "待機料金", amount: 800 },
            { label: "付き添い料金", amount: 1600 }
          ]
          : [{ label: "介助料金", amount: 1100 }]
      },
      {
        title: "実費・別途費用",
        rows: [{ label: "該当なし", note: "-" }]
      }
    ]
    : [
      {
        title: "事前確定運賃",
        rows: [
          { label: "基本運賃", amount: 730 },
          { label: "迎車料金", amount: 800 },
          { label: "距離運賃", amount: 3460 }
        ]
      },
      {
        title: "介助・サービス料金",
        rows: [{ label: "介助料金", amount: 1100 }]
      },
      { title: "実費・別途費用", rows: [{ label: "該当なし", note: "-" }] }
    ];

  const total = fareSections.reduce(function(sum, section){
    return sum + (section.rows || []).reduce(function(rowSum, row){
      return rowSum + (Number(row.amount) || 0);
    }, 0);
  }, 0);

  return {
    estimateNumber: "EST-TEST-" + testCase.id,
    createdAt: new Date().toISOString(),
    pageTitle: config.page?.title || "概算見積シミュレーター",
    usageSummary: usageSummary,
    fareSections: fareSections,
    breakdownRows: [],
    total: total,
    resultNotes: String(config.page?.resultNotes || "※表示料金は概算です。").trim(),
    pdfFooter: pdfFooter,
    routePlan: routePlan,
    googleMaps: config.googleMaps || {},
    routeMapDataUrl: routeMapDataUrl || ""
  };
}

function countPdfPages(buffer){
  const text = buffer.toString("latin1");
  const typePage = text.match(/\/Type\s*\/Page\b/g);
  if(typePage && typePage.length){
    return typePage.length;
  }
  const kids = text.match(/\/Kids\s*\[/g);
  return kids ? kids.length : 1;
}

async function waitForReady(page){
  await page.waitForSelector("[data-pdf-ready='1']", { timeout: 120000 });
  await page.waitForFunction(function(){
    const imgs = Array.from(document.querySelectorAll(".estimate-pdf-source img"));
    return imgs.every(function(img){
      if(img.closest(".estimate-pdf-route-map") && img.naturalWidth === 0){
        return img.complete;
      }
      return img.complete && img.naturalWidth > 0;
    });
  }, { timeout: 120000 });
  await new Promise(function(resolve){ setTimeout(resolve, 500); });
}

async function captureCase(browser, port, config, routePlan, routeMapDataUrl, testCase){
  const page = await browser.newPage();
  const mockData = buildCaseData(config, routePlan, testCase, routeMapDataUrl);
  await page.goto("http://127.0.0.1:" + port + "/estimate/pdf-layout-test.html", {
    waitUntil: "networkidle0",
    timeout: 120000
  });
  await page.evaluate(async function(data){
    window.__pdfTestData = data;
    await window.renderPdfTest();
  }, mockData);
  await waitForReady(page);

  const metrics = await page.evaluate(function(){
    const sheet = document.getElementById("a4Sheet");
    const source = document.querySelector(".estimate-pdf-source");
    const routeImg = document.querySelector(".estimate-pdf-route-map img");
    const contentLimit = window.EstimatePdf ? window.EstimatePdf.CONTENT_HEIGHT_PX : 0;
    return {
      sheetHeight: sheet ? sheet.scrollHeight : 0,
      contentHeight: source ? source.scrollHeight : 0,
      contentLimit: contentLimit,
      fitsSinglePage: source ? source.scrollHeight <= contentLimit : false,
      hasRouteMap: Boolean(routeImg),
      routeMapLoaded: routeImg ? routeImg.naturalWidth > 0 : false,
      routeMapHeight: routeImg ? routeImg.naturalHeight : 0,
      routeMapWidth: routeImg ? routeImg.naturalWidth : 0,
      routeMapSrc: routeImg ? String(routeImg.getAttribute("src") || "").slice(0, 40) : ""
    };
  });

  const screenshotPath = path.join(outputDir, testCase.id + ".png");
  const sheet = await page.$("#a4Sheet");
  if(!sheet){
    throw new Error("A4 sheet not found: " + testCase.id);
  }
  await sheet.screenshot({ path: screenshotPath, type: "png" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" }
  });
  const pdfPath = path.join(outputDir, testCase.id + ".pdf");
  fs.writeFileSync(pdfPath, pdfBuffer);
  const pageCount = countPdfPages(pdfBuffer);

  await page.close();
  return {
    id: testCase.id,
    screenshotPath: screenshotPath,
    pdfPath: pdfPath,
    pageCount: pageCount,
    metrics: metrics
  };
}

async function main(){
  fs.mkdirSync(outputDir, { recursive: true });
  const config = JSON.parse(fs.readFileSync(path.join(rootDir, "data/estimate-config.json"), "utf8"));
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: true });
  const bootstrapPage = await browser.newPage();
  const routePlan = await fetchRoutePlan(config, bootstrapPage, port);
  let routeMapDataUrl = "";
  if(routePlan?.encodedPolyline){
    routeMapDataUrl = await fetchRouteMapDataUrl(bootstrapPage, config, routePlan);
    if(routeMapDataUrl){
      console.log("Static map preloaded:", Math.round(routeMapDataUrl.length / 1024) + "KB data URL");
    }
  }
  await bootstrapPage.close();
  if(!routePlan?.encodedPolyline){
    throw new Error("routePlan を取得できませんでした");
  }

  const testCases = [
    { id: "01-qr-on-waiting-on-time", qr: true, waiting: true, fareMode: "time" },
    { id: "02-qr-off-waiting-off-time", qr: false, waiting: false, fareMode: "time" },
    { id: "03-qr-on-waiting-off-time", qr: true, waiting: false, fareMode: "time" },
    { id: "04-qr-on-waiting-on-distance", qr: true, waiting: true, fareMode: "distance" },
    { id: "05-qr-off-waiting-on-time", qr: false, waiting: true, fareMode: "time" }
  ];

  const results = [];
  try{
    for(const testCase of testCases){
      const result = await captureCase(browser, port, config, routePlan, routeMapDataUrl, testCase);
      results.push(result);
      console.log(
        result.id,
        "fits1page:", result.metrics.fitsSinglePage,
        "content:", result.metrics.contentHeight + "/" + result.metrics.contentLimit,
        "routeMap:", result.metrics.hasRouteMap,
        "routeLoaded:", result.metrics.routeMapLoaded
      );
    }
    fs.writeFileSync(path.join(outputDir, "layout-test-report.json"), JSON.stringify(results, null, 2));
    console.log("Saved to:", outputDir);
  }finally{
    await browser.close();
    await new Promise(function(resolve){ server.close(resolve); });
  }
}

main().catch(function(error){
  console.error(error);
  process.exit(1);
});
