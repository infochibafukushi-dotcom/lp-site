(function(){
  let clickCount = 0;
  let sitePassword = "95123";

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

  function isDesktopView(){
    return window.matchMedia("(min-width: 769px)").matches;
  }

  function applyResponsiveMenuConfig(config){
    const topButtons = isDesktopView() ? (config.buttonsPc || config.buttons) : config.buttons;
    const footerButtons = isDesktopView() ? (config.footerPc || config.footer) : config.footer;

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
  }

  function bindResponsiveMenuReload(){
    let lastDesktopState = isDesktopView();

    window.addEventListener("resize", () => {
      const nextDesktopState = isDesktopView();
      if(nextDesktopState === lastDesktopState){
        return;
      }
      lastDesktopState = nextDesktopState;

      if(window.__lpConfigCache){
        applyResponsiveMenuConfig(window.__lpConfigCache);
      }
    });
  }

  async function loadConfig(){
    const configRaw = await fetchJsonWithFallback([
      "./data/config.json",
      "data/config.json",
      "./config.json",
      "config.json"
    ]);

    const config = window.IndexUtils.ensureConfigShape(configRaw || {});
    window.__lpConfigCache = config;

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

    applyResponsiveMenuConfig(config);

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
      bindHashScroll();
      bindResponsiveMenuReload();
      await loadConfig();
      await loadSections();
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
