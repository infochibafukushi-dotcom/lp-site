import puppeteer from "puppeteer";

const PRODUCTION = "https://infochibafukushi-dotcom.github.io/lp-site/";
const viewports = [1920, 1366, 1280];

const sections = [
  { id: "chiba-city-24h-365days-kaigo-taxi-chibakeatakushi", name: "ヒーロー" },
  { id: "reason-chiba-care-taxi", name: "選ばれる理由" },
  { id: "usage-scenes", name: "利用シーン" },
  { id: "vehicle-introduction-capacity", name: "車両紹介" },
  { id: "shii-price-menyu", name: "料金一覧" },
  { id: "goriyo-ryokin-no-meyasu-2", name: "片道送迎" },
  { id: "goriyo-ryokin-no-meyasu-kopi", name: "往復送迎" },
  { id: "service-heno-i", name: "代表挨拶" },
  { id: "tesuto", name: "Q&A" },
];

async function collect(page, sectionId) {
  return page.evaluate((sid) => {
    const section = document.getElementById(sid);
    if (!section) return { error: "section not found" };

    const inner = section.querySelector(".section-inner");
    const title = section.querySelector(".section-title");
    const medium = section.querySelector(".text-medium");
    const cardTitle = section.querySelector(".card-item-title");
    const cardItem = section.querySelector(".card-item");
    const normalImg = section.querySelector(".normal-image");
    const sliderImg = section.querySelector(".slider-slide img");
    const mediaRow = section.querySelector(".media-row");

    const cs = (el) => (el ? getComputedStyle(el) : null);

    return {
      sectionType: section.querySelector(".slider-shell")
        ? "slider"
        : section.querySelector(".card-grid-3")
          ? "card3"
          : section.querySelector(".card-grid-4")
            ? "card4"
            : section.querySelector(".normal-image-wrap")
              ? "normal"
              : section.querySelector("[id^='menu-list-cat-']")
                ? "menu-list"
                : section.querySelector(".media-row")
                  ? "card1"
                  : section.querySelector(".accordion-list")
                    ? "accordion"
                    : "other",
      innerMaxWidth: inner ? cs(inner).maxWidth : null,
      innerWidth: inner ? Math.round(inner.getBoundingClientRect().width) : null,
      sectionPadding: cs(section).padding,
      titleFontSize: title ? cs(title).fontSize : null,
      titleMarginBottom: title ? cs(title).marginBottom : null,
      textMediumFontSize: medium ? cs(medium).fontSize : null,
      cardTitleFontSize: cardTitle ? cs(cardTitle).fontSize : null,
      cardItemPadding: cardItem ? cs(cardItem).padding : null,
      cardGridGap: section.querySelector(".card-grid-3, .card-grid-4")
        ? cs(section.querySelector(".card-grid-3, .card-grid-4")).gap
        : null,
      normalImgMaxWidth: normalImg ? cs(normalImg).maxWidth : null,
      normalImgWidth: normalImg ? Math.round(normalImg.getBoundingClientRect().width) : null,
      sliderImgMaxWidth: sliderImg ? cs(sliderImg).maxWidth : null,
      sliderImgWidth: sliderImg ? Math.round(sliderImg.getBoundingClientRect().width) : null,
      sliderImgHeight: sliderImg ? cs(sliderImg).height : null,
      innerDisplay: inner ? cs(inner).display : null,
      innerFlexDirection: inner ? cs(inner).flexDirection : null,
      mediaRowGrid: mediaRow ? cs(mediaRow).gridTemplateColumns : null,
      mediaRowGap: mediaRow ? cs(mediaRow).gap : null,
      layoutNote:
        section.querySelector(".slider-shell") || section.querySelector(".normal-image-wrap")
          ? "縦積み（DOM順: title→image→text）"
          : section.querySelector(".media-row")
            ? "2カラム（media-row）"
            : null,
    };
  }, sectionId);
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.goto(PRODUCTION, { waitUntil: "networkidle0", timeout: 90000 });
await page.evaluate(() => {
  try {
    sessionStorage.setItem("lp_popup_dismissed", "1");
  } catch (e) {}
  document.getElementById("sitePopupOverlay")?.remove();
});
await page.waitForFunction(
  () => document.querySelectorAll("section.section").length >= 5,
  { timeout: 30000 }
);

const results = {};
for (const vp of viewports) {
  await page.setViewport({ width: vp, height: 900 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
  results[vp] = {};
  for (const s of sections) {
    results[vp][s.name] = await collect(page, s.id);
  }
}

// Global CSS rule presence
const cssInfo = await page.evaluate(() => {
  const sheets = [...document.styleSheets];
  let has1024 = false;
  let rules = [];
  for (const sheet of sheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        const text = rule.cssText || "";
        if (text.includes("min-width: 1024px")) has1024 = true;
        if (text.includes("font-size: 34px")) rules.push("section-title 34px");
        if (text.includes("max-width: 1500px")) rules.push("inner 1500px");
      }
    } catch (e) {}
  }
  return {
    styleSheetCount: sheets.length,
    has1024MediaQuery: has1024,
    matchedRules: [...new Set(rules)],
    viewportWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio,
  };
});

await browser.close();

console.log(JSON.stringify({ cssInfo, results }, null, 2));
