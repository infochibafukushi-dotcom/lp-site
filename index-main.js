(function(){
  let clickCount = 0;
  let sitePassword = "95123";

  function bindLogoTrigger(){
    const trigger = document.getElementById("logoTrigger");
    if(!trigger) return;

    trigger.onclick = function(){
      clickCount++;
      if(clickCount >= 5){
        document.getElementById("adminPanel").style.display = "block";
        clickCount = 0;
      }
    };
  }

  function login(){
    const input = document.getElementById("pass").value;
    if(input === sitePassword){
      alert("管理画面ログイン成功");
      location.href = "./admin.html";
    }else{
      alert("パスワード違います");
    }
  }

  async function loadConfig(){
    const res = await fetch("./data/config.json?" + Date.now());
    let config = await res.json();
    config = window.IndexUtils.ensureConfigShape(config);

    const logoTextEl = document.getElementById("logoTextView");
    const logoImgEl = document.getElementById("logoImg");

    logoTextEl.innerText = config.logo || "";
    if(config.logoImage){
      logoImgEl.src = config.logoImage;
      logoImgEl.style.display = "block";
    }else{
      logoImgEl.src = "";
      logoImgEl.style.display = "none";
    }

    document.documentElement.style.setProperty("--header-bg", config.headerBgColor);
    document.documentElement.style.setProperty("--footer-bg", config.footerBgColor);

    window.IndexUtils.applyTopButton(document.getElementById("btn1"), config.buttons[0], "ボタン1");
    window.IndexUtils.applyTopButton(document.getElementById("btn2"), config.buttons[1], "ボタン2");
    window.IndexUtils.applyTopButton(document.getElementById("btn3"), config.buttons[2], "ボタン3");

    window.IndexUtils.applyFooterButton(
      document.getElementById("f1"),
      document.getElementById("f1img"),
      document.getElementById("f1text"),
      config.footer[0],
      "電話"
    );
    window.IndexUtils.applyFooterButton(
      document.getElementById("f2"),
      document.getElementById("f2img"),
      document.getElementById("f2text"),
      config.footer[1],
      "LINE"
    );
    window.IndexUtils.applyFooterButton(
      document.getElementById("f3"),
      document.getElementById("f3img"),
      document.getElementById("f3text"),
      config.footer[2],
      "予約"
    );

    sitePassword = config.password || "95123";
  }

  async function loadSections(){
    const container = document.getElementById("sectionsContainer");

    try{
      const res = await fetch("./data/sections.json?" + Date.now());
      let sections = await res.json();

      if(!Array.isArray(sections) || sections.length === 0){
        container.innerHTML = '<div class="empty-box">セクションがまだありません。</div>';
        return;
      }

      sections = sections.map((section, idx) => window.IndexUtils.ensureSectionShape(section, idx));
      sections = window.IndexUtils.ensureUniqueSectionIds(sections);

      container.innerHTML = sections.map((section, idx) => window.IndexRenderers.renderSection(section, idx)).join("");
      window.IndexSlider.initSliders();

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
    bindLogoTrigger();
    bindHashScroll();
    await loadConfig();
    await loadSections();
  }

  window.login = login;

  init();
})();
