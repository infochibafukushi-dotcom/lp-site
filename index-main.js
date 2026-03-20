(function(){
  let clickCount = 0;
  let sitePassword = "95123";

  const POPUP_SESSION_KEY = 'lpPopupShown';
  let currentPopupSettings = { patterns: [] };

  function ensurePopupSettingsShape(config){
    const current = config && config.popupSettings && typeof config.popupSettings === 'object' ? config.popupSettings : {};
    const patterns = Array.isArray(current.patterns) ? current.patterns.slice(0, 3) : [];
    while(patterns.length < 3){
      patterns.push({});
    }
    return {
      patterns: patterns.map((pattern) => ({
        use: pattern?.use === true,
        visible: pattern?.visible === true,
        title: String(pattern?.title || ''),
        text: String(pattern?.text || ''),
        button1Visible: pattern?.button1Visible === true,
        button1Text: String(pattern?.button1Text || ''),
        button1Url: String(pattern?.button1Url || '#') || '#',
        button2Visible: pattern?.button2Visible === true,
        button2Text: String(pattern?.button2Text || ''),
        button2Url: String(pattern?.button2Url || '#') || '#'
      }))
    };
  }

  function getActivePopupPattern(){
    const settings = currentPopupSettings || { patterns: [] };
    const patterns = Array.isArray(settings.patterns) ? settings.patterns : [];
    return patterns.find((pattern) => pattern.use === true && pattern.visible === true) || null;
  }

  function ensurePopupStyles(){
    if(document.getElementById('lpPopupStyle')) return;
    const style = document.createElement('style');
    style.id = 'lpPopupStyle';
    style.textContent = `
      .lp-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;}
      .lp-popup-card{position:relative;background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.22);width:90%;max-width:90%;padding:18px 18px 16px;z-index:9999;}
      .lp-popup-close{position:absolute;top:10px;right:12px;border:none;background:transparent;color:#666;font-size:28px;line-height:1;padding:4px 8px;cursor:pointer;}
      .lp-popup-title{margin:0 34px 12px 0;color:#d92d20;font-weight:800;font-size:24px;line-height:1.45;white-space:normal;word-break:break-word;}
      .lp-popup-text{margin:0;color:#222;font-size:15px;line-height:1.8;white-space:pre-line;word-break:break-word;}
      .lp-popup-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;}
      .lp-popup-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border-radius:999px;background:#1f2937;color:#fff;text-decoration:none;font-weight:700;font-size:14px;}
      .lp-popup-btn.secondary{background:#2563eb;}
      @media (min-width: 768px){ .lp-popup-card{width:520px;max-width:520px;padding:22px 22px 18px;} .lp-popup-title{font-size:30px;} .lp-popup-text{font-size:16px;} }
    `;
    document.head.appendChild(style);
  }

  function closePopup(){
    const overlay = document.getElementById('lpPopupOverlay');
    if(overlay) overlay.remove();
    try{ sessionStorage.setItem(POPUP_SESSION_KEY, '1'); }catch(e){}
  }

  function showPopupIfNeeded(){
    let alreadyShown = false;
    try{ alreadyShown = sessionStorage.getItem(POPUP_SESSION_KEY) === '1'; }catch(e){}
    if(alreadyShown) return;
    const pattern = getActivePopupPattern();
    if(!pattern) return;
    ensurePopupStyles();
    const existing = document.getElementById('lpPopupOverlay');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'lpPopupOverlay';
    overlay.className = 'lp-popup-overlay';
    const actions = [];
    if(pattern.button1Visible && pattern.button1Text){
      actions.push(`<a class="lp-popup-btn" href="${escapeAttr(pattern.button1Url || '#')}">${escapeHtml(pattern.button1Text || '')}</a>`);
    }
    if(pattern.button2Visible && pattern.button2Text){
      actions.push(`<a class="lp-popup-btn secondary" href="${escapeAttr(pattern.button2Url || '#')}">${escapeHtml(pattern.button2Text || '')}</a>`);
    }
    overlay.innerHTML = `
      <div class="lp-popup-card" role="dialog" aria-modal="true" aria-label="お知らせ">
        <button type="button" class="lp-popup-close" aria-label="閉じる">×</button>
        <h2 class="lp-popup-title">${escapeHtml(pattern.title || '').replace(/
/g, '<br>')}</h2>
        <div class="lp-popup-text">${escapeHtml(pattern.text || '')}</div>
        ${actions.length ? `<div class="lp-popup-actions">${actions.join('')}</div>` : ''}
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(event){
      if(event.target === overlay) closePopup();
    });
    const closeBtn = overlay.querySelector('.lp-popup-close');
    if(closeBtn) closeBtn.addEventListener('click', closePopup);
  }

  function bindLogoTrigger(){
    const trigger = document.getElementById("logoTrigger");
    if(!trigger) return;

    trigger.onclick = function(){
      clickCount++;
      if(clickCount >= 5){
        const adminPanel = document.getElementById("adminPanel");
        if(adminPanel){
          adminPanel.style.display = "block";
        }
        clickCount = 0;
      }
    };
  }

  function login(){
    const passEl = document.getElementById("pass");
    const input = passEl ? passEl.value : "";
    if(input === sitePassword){
      alert("管理画面ログイン成功");
      location.href = "./admin.html";
    }else{
      alert("パスワード違います");
    }
  }

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
    currentPopupSettings = ensurePopupSettingsShape(config);

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
      const link = String(pcTopPhone.link || "").trim() || (number ? ("tel:" + number.replace(/[^0-9+]/g, "")) : "#");
      if(isPc && pcTopPhone.enabled === true && (label || number)){
        pcPhoneInline.innerHTML = `<a href="${link}">${label}${label && number ? " " : ""}${number}</a>`;
        pcPhoneInline.classList.remove("hidden");
      }else{
        pcPhoneInline.innerHTML = "";
        pcPhoneInline.classList.add("hidden");
      }
    }

    sitePassword = config.password || "95123";
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


  function escapeHtml(text){
    return String(text ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;');
  }

  function escapeAttr(text){
    return escapeHtml(text).replaceAll('\"','&quot;');
  }

  async function init(){
    try{
      bindLogoTrigger();
      bindResponsiveReload();
      bindHashScroll();
      await loadConfig();
      await loadSections();
      showPopupIfNeeded();
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
