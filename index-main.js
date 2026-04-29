(function(){
  let sitePassword = "95123";
  const POPUP_SESSION_KEY = "lp_popup_dismissed";

  function getActivePopupPattern(config){
    const popupSettings = window.IndexUtils.ensurePopupSettingsShape(config || {});
    const patterns = Array.isArray(popupSettings.patterns) ? popupSettings.patterns : [];
    return patterns.find((pattern) => pattern.use === true) || null;
  }

  function shouldShowPopup(config){
    try{
      if(sessionStorage.getItem(POPUP_SESSION_KEY) === "1") return false;
    }catch(error){}
    const active = getActivePopupPattern(config);
    return !!(active && active.visible === true && (active.title || active.text || active.button1?.visible === true || active.button2?.visible === true));
  }

  function closePopup(){
    const overlay = document.getElementById("sitePopupOverlay");
    if(overlay){
      overlay.remove();
    }
    try{
      sessionStorage.setItem(POPUP_SESSION_KEY, "1");
    }catch(error){}
  }

  function createPopupButton(data, fallbackText, className){
    if(!data || data.visible !== true) return "";
    const text = String(data.text || fallbackText || "").trim();
    const url = window.IndexUtils.sanitizeUrl(data.url, "#");
    if(!text) return "";
    return `<a href="${window.IndexUtils.escapeAttr(url)}" class="${window.IndexUtils.escapeAttr(className)}" data-popup-close="1">${window.IndexUtils.escapeHtml(text)}</a>`;
  }

  function renderPopup(config){
    if(!shouldShowPopup(config)) return;
    const pattern = getActivePopupPattern(config);
    if(!pattern) return;

    const existing = document.getElementById("sitePopupOverlay");
    if(existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "sitePopupOverlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:16px;";

    const buttons = [
      createPopupButton(pattern.button1, "ボタン1", "site-popup-btn primary"),
      createPopupButton(pattern.button2, "ボタン2", "site-popup-btn secondary")
    ].filter(Boolean).join("");

    overlay.innerHTML = `
      <div style="width:min(100%, 420px);background:#ffffff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,0.22);padding:18px 18px 16px;position:relative;">
        <button type="button" id="sitePopupClose" aria-label="閉じる" style="position:absolute;top:10px;right:10px;border:none;background:transparent;color:#666;font-size:28px;line-height:1;cursor:pointer;padding:4px 8px;">×</button>
        <div style="padding:6px 8px 4px;">
          <div style="font-size:22px;line-height:1.5;font-weight:700;color:#c62828;white-space:pre-line;word-break:break-word;">${window.IndexUtils.escapeHtml(pattern.title || "")}</div>
          <div style="margin-top:10px;font-size:15px;line-height:1.9;color:#222;white-space:pre-line;word-break:break-word;">${window.IndexUtils.escapeHtml(pattern.text || "")}</div>
          ${buttons ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">${buttons}</div>` : ""}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const style = document.createElement("style");
    style.id = "sitePopupStyle";
    style.textContent = `
      .site-popup-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;}
      .site-popup-btn.primary{background:#0d47a1;color:#fff;}
      .site-popup-btn.secondary{background:#f5f5f5;color:#222;border:1px solid #ddd;}
      @media (max-width: 768px){
        .site-popup-btn{flex:1 1 100%;}
      }
    `;
    const oldStyle = document.getElementById("sitePopupStyle");
    if(oldStyle) oldStyle.remove();
    document.head.appendChild(style);

    const closeBtn = document.getElementById("sitePopupClose");
    if(closeBtn){
      closeBtn.addEventListener("click", closePopup);
    }
    overlay.addEventListener("click", function(event){
      if(event.target === overlay){
        closePopup();
      }
    });
    overlay.querySelectorAll("[data-popup-close='1']").forEach((el) => {
      el.addEventListener("click", function(){
        closePopup();
      });
    });
  }

  function bindLogoTrigger(){}

  function login(){}

  async function fetchJsonWithFallback(urls){
    let lastError = null;

    for(const rawUrl of urls){
      try{
        const url = rawUrl + (rawUrl.includes("?") ? "&" : "?") + "_ts=" + Date.now();
        const res = await fetch(url, { cache: "no-store" });

        if(!res.ok){
          throw new Error("HTTP " + res.status + " " + res.statusText + " : " + rawUrl);
        }

        const text = await res.text();

        if(!text || !text.trim()){
          throw new Error("empty response : " + rawUrl);
        }

        return JSON.parse(text);
      }catch(error){
        lastError = error;
      }
    }

    throw lastError || new Error("JSON fetch failed");
  }

  async function loadConfig(){
    const configRaw = await fetchJsonWithFallback([
      "./data/config.json",
      "data/config.json",
      "./config.json",
      "config.json"
    ]);

    const config = window.IndexUtils.ensureConfigShape(configRaw || {});

    const logoTextEl = document.getElementById("logoTextView");
    const logoImgEl = document.getElementById("logoImg");

    if(logoTextEl){
      logoTextEl.innerText = config.logo || "";
    }

    if(logoImgEl){
      if(config.logoImage){
        logoImgEl.src = config.logoImage;
        logoImgEl.style.display = "block";
      }else{
        logoImgEl.src = "";
        logoImgEl.style.display = "none";
      }
    }

    document.documentElement.style.setProperty("--header-bg", config.headerBgColor || "#ffffff");
    document.documentElement.style.setProperty("--footer-bg", config.footerBgColor || "#ffffff");

    const isPc = window.matchMedia ? window.matchMedia("(min-width: 769px)").matches : window.innerWidth >= 769;
    const topButtons = isPc ? config.buttonsPc : config.buttons;
    const footerButtons = isPc ? config.footerPc : config.footer;

    window.IndexUtils.applyTopButton(document.getElementById("btn1"), topButtons[0], "ボタン1");
    window.IndexUtils.applyTopButton(document.getElementById("btn2"), topButtons[1], "ボタン2");
    window.IndexUtils.applyTopButton(document.getElementById("btn3"), topButtons[2], "ボタン3");

    window.IndexUtils.applyFooterButton(
      document.getElementById("f1"),
      document.getElementById("f1img"),
      document.getElementById("f1text"),
      footerButtons[0],
      "電話"
    );
    window.IndexUtils.applyFooterButton(
      document.getElementById("f2"),
      document.getElementById("f2img"),
      document.getElementById("f2text"),
      footerButtons[1],
      "LINE"
    );
    window.IndexUtils.applyFooterButton(
      document.getElementById("f3"),
      document.getElementById("f3img"),
      document.getElementById("f3text"),
      footerButtons[2],
      "予約"
    );

    const pcPhoneInline = document.getElementById("pcPhoneInline");
    if(pcPhoneInline){
      const pcTopPhone = config.pcTopPhone || {};
      const label = String(pcTopPhone.label || "").trim();
      const number = String(pcTopPhone.number || "").trim();
      const fallbackLink = number ? ("tel:" + number.replace(/[^0-9+]/g, "")) : "#";
      const link = window.IndexUtils.sanitizeUrl(pcTopPhone.link || fallbackLink, "#");
      if(isPc && pcTopPhone.enabled === true && (label || number)){
        pcPhoneInline.innerHTML = `<a href="${window.IndexUtils.escapeAttr(link)}">${window.IndexUtils.escapeHtml(label)}${label && number ? " " : ""}${window.IndexUtils.escapeHtml(number)}</a>`;
        pcPhoneInline.classList.remove("hidden");
      }else{
        pcPhoneInline.innerHTML = "";
        pcPhoneInline.classList.add("hidden");
      }
    }

    sitePassword = config.password || "95123";
    return config;
  }

  async function loadSections(){
    const container = document.getElementById("sectionsContainer");
    if(!container) return;

    try{
      let sections = await fetchJsonWithFallback([
        "./data/sections.json",
        "data/sections.json",
        "./sections.json",
        "sections.json"
      ]);

      if(!Array.isArray(sections) || sections.length === 0){
        container.innerHTML = '<div class="empty-box">セクションがまだありません。</div>';
        return;
      }

      sections = sections.map((section, idx) => window.IndexUtils.ensureSectionShape(section, idx));
      sections = window.IndexUtils.ensureUniqueSectionIds(sections);

      container.innerHTML = sections.map((section, idx) => window.IndexRenderers.renderSection(section, idx)).join("");

      if(window.IndexSlider && typeof window.IndexSlider.initSliders === "function"){
        window.IndexSlider.initSliders();
      }

      if(location.hash){
        const target = document.querySelector(location.hash);
        if(target){
          setTimeout(() => {
            target.scrollIntoView({ behavior:"smooth", block:"start" });
          }, 50);
        }
      }
    }catch(error){
      container.innerHTML = '<div class="empty-box">sections.json の読み込みに失敗しました。</div>';
      try{
        console.error(error);
      }catch(e){}
    }
  }

  function bindResponsiveReload(){
    if(!window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 769px)");
    const handler = function(){ loadConfig().catch(function(){}); };
    if(typeof mq.addEventListener === "function"){
      mq.addEventListener("change", handler);
    }else if(typeof mq.addListener === "function"){
      mq.addListener(handler);
    }
  }

  function bindHashScroll(){
    window.addEventListener("hashchange", () => {
      if(location.hash){
        const target = document.querySelector(location.hash);
        if(target){
          target.scrollIntoView({ behavior:"smooth", block:"start" });
        }
      }
    });
  }

  async function init(){
    try{
      bindLogoTrigger();
      bindResponsiveReload();
      bindHashScroll();
      const config = await loadConfig();
      await loadSections();
      renderPopup(config || {});
    }catch(error){
      const container = document.getElementById("sectionsContainer");
      if(container){
        container.innerHTML = '<div class="empty-box">初期化に失敗しました。</div>';
      }
      try{
        console.error(error);
      }catch(e){}
    }
  }

  window.login = login;

  init();
})();
