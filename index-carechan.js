(function(){
  const FOOTER_HEIGHT_MOBILE = 90;
  const MOBILE_MQ = "(min-width: 769px)";

  let carechanData = null;
  let contactCtaUrls = null;
  let contactCtaUrlsLoading = false;
  let contactCtaUrlsFailed = false;
  let modalOpen = false;
  let modalView = "menu";
  let navStack = [];
  let answerPath = null;
  let bubbleRotationTimer = null;
  let lastBubbleText = null;

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function sanitizeUrl(value, fallback){
    fallback = fallback || "#";
    const raw = String(value ?? "").normalize("NFKC").trim();
    if(!raw) return fallback;
    const normalized = raw.replace(/[\u0000-\u001F\u007F\s]+/g, "");
    if(!normalized) return fallback;
    if(/^(javascript|data|vbscript):/i.test(normalized)) return fallback;
    return raw;
  }

  function trackCarechan(eventName, extra){
    const payload = Object.assign({ event: eventName, ts: Date.now() }, extra || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    if(typeof window.gtag === "function"){
      window.gtag("event", eventName, extra || {});
    }
  }

  function trackCtaClick(nodeId, href, label){
    trackCarechan("lp_cv_click", {
      cv_type: "carechan",
      question_id: nodeId || "",
      href: href || "",
      label: label || ""
    });
  }

  async function fetchCarechanJson(){
    const urls = ["./data/carechan.json", "data/carechan.json"];
    let lastError = null;
    let raw = null;
    for(const rawUrl of urls){
      try{
        const url = rawUrl + (rawUrl.includes("?") ? "&" : "?") + "_ts=" + Date.now();
        const res = await fetch(url, { cache: "no-store" });
        if(!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text();
        if(!text || !text.trim()) throw new Error("empty");
        raw = JSON.parse(text);
        break;
      }catch(error){
        lastError = error;
      }
    }
    if(!raw) throw lastError || new Error("carechan.json fetch failed");
    if(window.FareFaqSync && window.EstimateQuoteConfig?.API_BASE){
      try{
        const amounts = await window.FareFaqSync.loadFaqAmounts(window.EstimateQuoteConfig.API_BASE);
        return window.FareFaqSync.hydrateCarechanPricing(raw, amounts);
      }catch(error){
        console.warn("carechan fare sync skipped", error);
      }
    }
    return raw;
  }

  function normalizeCtas(ctas, prefix){
    const list = Array.isArray(ctas) ? ctas.map(function(c, cIdx){
      return {
        id: String(c?.id || ("cta-" + prefix + "-" + cIdx)),
        label: String(c?.label || ""),
        url: String(c?.url || "#"),
        order: Number(c?.order) || (cIdx + 1),
        visible: c?.visible !== false
      };
    }).filter(function(c){ return c.label; }) : [];
    list.sort(function(a, b){ return a.order - b.order; });
    return list;
  }

  function normalizeNode(raw, idx, prefix){
    const node = raw && typeof raw === "object" ? raw : {};
    const id = String(node.id || ("q-" + prefix + "-" + idx));
    const childrenRaw = Array.isArray(node.children) ? node.children : [];
    const children = childrenRaw.map(function(child, cIdx){
      return normalizeNode(child, cIdx, id);
    }).filter(function(child){ return child.title; });

    return {
      id: id,
      enabled: node.enabled !== false,
      order: Number(node.order) || (idx + 1),
      title: String(node.title || ""),
      menuPrompt: String(node.menuPrompt || ""),
      answer: String(node.answer || ""),
      ctaHeading: String(node.ctaHeading || ""),
      ctas: normalizeCtas(node.ctas, id),
      children: children
    };
  }

  function ensureCarechanShape(raw){
    const data = raw && typeof raw === "object" ? raw : {};
    const bubbles = data.speechBubbles && typeof data.speechBubbles === "object" ? data.speechBubbles : {};
    const items = Array.isArray(bubbles.items) ? bubbles.items.filter(Boolean) : ["質問してね♪"];
    const greeting = data.greeting && typeof data.greeting === "object" ? data.greeting : {};
    const pos = data.position && typeof data.position === "object" ? data.position : {};
    const mobile = pos.mobile && typeof pos.mobile === "object" ? pos.mobile : {};
    const desktop = pos.desktop && typeof pos.desktop === "object" ? pos.desktop : {};

    const questions = Array.isArray(data.questions)
      ? data.questions.map(function(q, idx){ return normalizeNode(q, idx, "root"); }).filter(function(q){ return q.title; })
      : [];
    questions.sort(function(a, b){ return a.order - b.order; });

    return {
      enabled: data.enabled === true,
      version: data.version || 1,
      character: {
        image: String(data.character?.image || "./assets/carechan/carechan-default.svg"),
        alt: String(data.character?.alt || "ケアちゃん"),
        imageVersion: Number(data.character?.imageVersion) || 0
      },
      speechBubbles: {
        mode: bubbles.mode === "fixed" ? "fixed" : "random",
        items: items.length ? items : ["質問してね♪"],
        fixedIndex: Math.max(0, Number(bubbles.fixedIndex) || 0)
      },
      greeting: {
        title: String(greeting.title || "こんにちは！"),
        subtitle: String(greeting.subtitle || "ケアちゃんです♪"),
        prompt: String(greeting.prompt || "何について知りたいですか？")
      },
      position: {
        mobile: {
          bottomOffsetFromFooter: Number(mobile.bottomOffsetFromFooter) || 60,
          right: Number(mobile.right) || 14
        },
        desktop: {
          bottom: Number(desktop.bottom) || 24,
          right: Number(desktop.right) || 24
        }
      },
      questions: questions
    };
  }

  function findNodeByIds(ids){
    if(!carechanData || !Array.isArray(ids) || !ids.length) return null;
    let nodes = carechanData.questions;
    let node = null;
    for(let i = 0; i < ids.length; i++){
      node = nodes.find(function(n){ return n.id === ids[i]; });
      if(!node) return null;
      nodes = node.children || [];
    }
    return node;
  }

  function hasSubmenu(node){
    return (node.children || []).some(function(c){ return c.enabled !== false && c.title; });
  }

  function getMenuContext(){
    if(!navStack.length){
      return {
        parent: null,
        nodes: carechanData.questions.filter(function(q){ return q.enabled !== false; }),
        prompt: "",
        showGreeting: true
      };
    }
    const parent = findNodeByIds(navStack);
    if(!parent){
      return { parent: null, nodes: [], prompt: "", showGreeting: true };
    }
    return {
      parent: parent,
      nodes: (parent.children || []).filter(function(c){ return c.enabled !== false; }),
      prompt: parent.menuPrompt || "何をしたいですか？",
      showGreeting: false
    };
  }

  function getBubbleItems(data){
    const items = data?.speechBubbles?.items;
    return items && items.length ? items : ["質問してね♪"];
  }

  function pickNextBubbleText(data, previousText){
    const bubbles = data.speechBubbles;
    const items = getBubbleItems(data);
    if(bubbles.mode === "fixed"){
      const idx = Math.min(bubbles.fixedIndex, items.length - 1);
      return items[idx];
    }
    if(items.length === 1) return items[0];
    if(items.length === 2 && previousText){
      return items[0] === previousText ? items[1] : items[0];
    }
    let next;
    let guard = 0;
    do {
      next = items[Math.floor(Math.random() * items.length)];
      guard++;
    } while(next === previousText && guard < 12);
    return next;
  }

  function stopCarechanBubbleRotation(){
    if(bubbleRotationTimer !== null){
      clearInterval(bubbleRotationTimer);
      bubbleRotationTimer = null;
    }
  }

  function renderCarechanBubbleMessage(text){
    const bubble = document.getElementById("carechanBubble");
    if(!bubble) return;
    bubble.textContent = String(text ?? "");
  }

  function startCarechanBubbleRotation(data){
    stopCarechanBubbleRotation();
    lastBubbleText = pickNextBubbleText(data, null);
    renderCarechanBubbleMessage(lastBubbleText);

    const items = getBubbleItems(data);
    if(data.speechBubbles.mode === "fixed" || items.length <= 1) return;

    bubbleRotationTimer = setInterval(function(){
      lastBubbleText = pickNextBubbleText(data, lastBubbleText);
      renderCarechanBubbleMessage(lastBubbleText);
    }, 3000);
  }

  function applyWidgetPosition(widget, data){
    const isPc = window.matchMedia && window.matchMedia(MOBILE_MQ).matches;
    if(isPc){
      widget.style.bottom = (data.position.desktop.bottom || 24) + "px";
      widget.style.right = (data.position.desktop.right || 24) + "px";
    }else{
      const offset = data.position.mobile.bottomOffsetFromFooter || 60;
      widget.style.bottom = (FOOTER_HEIGHT_MOBILE + offset) + "px";
      widget.style.right = (data.position.mobile.right || 14) + "px";
    }
  }

  function resolveImageUrl(url, imageVersion){
    const raw = String(url || "").trim();
    if(!raw) return "./assets/carechan/carechan-default.svg";
    let src;
    if(/^https?:\/\//i.test(raw) || raw.startsWith("data:")) src = raw;
    else if(raw.startsWith("./") || raw.startsWith("/")) src = raw;
    else src = "./" + raw.replace(/^\.\//, "");

    if(raw.startsWith("data:")) return src;
    const versionMatch = raw.match(/\/(\d{13})-/);
    const version = Number(imageVersion) || (versionMatch ? Number(versionMatch[1]) : 0);
    if(!version) return src;
    return src + (src.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(String(version));
  }

  function renderCharacterImage(data){
    const src = resolveImageUrl(data.character.image, data.character.imageVersion);
    return '<img src="' + escapeAttr(src) + '" alt="' + escapeAttr(data.character.alt) + '" width="64" height="74" decoding="async">';
  }

  function renderMenuButtons(nodes, pathPrefix){
    return nodes.map(function(node){
      const nextPath = pathPrefix.concat([node.id]);
      const pathAttr = escapeAttr(nextPath.join("/"));
      return (
        '<button type="button" class="carechan-question-btn" data-node-path="' + pathAttr + '">' +
          '<span>' + escapeHtml(node.title) + '</span>' +
          '<span aria-hidden="true">›</span>' +
        '</button>'
      );
    }).join("");
  }

  function renderMenuView(){
    const ctx = getMenuContext();
    const g = carechanData.greeting;
    let html = "";

    if(ctx.showGreeting){
      html += (
        '<div class="carechan-greeting">' +
          '<p class="carechan-greeting-title">' + escapeHtml(g.title) + '</p>' +
          '<p class="carechan-greeting-sub">' + escapeHtml(g.subtitle) + '</p>' +
          '<p class="carechan-greeting-prompt">' + escapeHtml(g.prompt) + '</p>' +
        '</div>'
      );
    }else if(ctx.prompt){
      html += '<p class="carechan-submenu-prompt">' + escapeHtml(ctx.prompt) + '</p>';
    }

    html += '<div class="carechan-question-list">' + renderMenuButtons(ctx.nodes, navStack) + '</div>';
    return html;
  }

  function renderAnswerView(node){
    if(window.CarechanCtaDefaults && contactCtaUrls){
      window.CarechanCtaDefaults.ensureNodeAnswerCtas(node, contactCtaUrls);
    }
    const ctas = (node.ctas || []).filter(function(c){ return c.visible !== false && c.label; });
    const ctaHeadingHtml = node.ctaHeading
      ? '<p class="carechan-cta-heading">' + escapeHtml(node.ctaHeading) + '</p>'
      : "";
    const ctaHtml = ctas.length ? (
      '<div class="carechan-cta-block">' +
        ctaHeadingHtml +
        '<div class="carechan-cta-list">' +
          ctas.map(function(c){
            const href = sanitizeUrl(c.url, "#");
            const external = /^(https?:|tel:|mailto:)/i.test(href);
            const extra = external ? ' target="_blank" rel="noopener noreferrer"' : "";
            return (
              '<a class="carechan-cta-link" href="' + escapeAttr(href) + '"' + extra +
              ' data-carechan-cta="1" data-node-id="' + escapeAttr(node.id) + '"' +
              ' data-label="' + escapeAttr(c.label) + '">' +
              escapeHtml(c.label) +
              '</a>'
            );
          }).join("") +
        '</div>' +
      '</div>'
    ) : "";
    const answerHtml = node.answer
      ? '<div class="carechan-answer-text">' + escapeHtml(node.answer) + '</div>'
      : '<div class="carechan-answer-text carechan-answer-empty">回答は準備中です。</div>';
    return (
      '<h3 class="carechan-answer-title">' + escapeHtml(node.title) + '</h3>' +
      answerHtml +
      ctaHtml
    );
  }

  function updateModalHeader(){
    const headTitle = document.getElementById("carechanModalTitle");
    const backBtn = document.getElementById("carechanModalBack");
    if(!headTitle || !backBtn) return;

    if(modalView === "answer"){
      const node = findNodeByIds(answerPath || []);
      headTitle.textContent = node ? node.title : "回答";
      backBtn.classList.remove("is-hidden");
      return;
    }

    if(navStack.length){
      const parent = findNodeByIds(navStack);
      headTitle.textContent = parent ? parent.title : "メニュー";
      backBtn.classList.remove("is-hidden");
      return;
    }

    headTitle.textContent = "ケアちゃん FAQ";
    backBtn.classList.add("is-hidden");
  }

  function renderModalBody(){
    const body = document.getElementById("carechanModalBody");
    if(!body) return;

    if(modalView === "answer"){
      if(!contactCtaUrls && !contactCtaUrlsFailed && !contactCtaUrlsLoading && window.CarechanCtaDefaults){
        ensureContactCtaUrls().then(function(){
          if(modalOpen && modalView === "answer") renderModalBody();
        });
      }
      const node = findNodeByIds(answerPath || []);
      body.innerHTML = node ? renderAnswerView(node) : '<p>項目が見つかりません。</p>';
      if(node){
        trackCarechan("carechan_question_view", { question_id: node.id });
      }
    }else{
      body.innerHTML = renderMenuView();
    }
    updateModalHeader();
  }

  async function ensureContactCtaUrls(){
    if(contactCtaUrls || contactCtaUrlsFailed) return contactCtaUrls;
    if(!window.CarechanCtaDefaults || !carechanData) return null;
    if(contactCtaUrlsLoading) return null;
    contactCtaUrlsLoading = true;
    try{
      contactCtaUrls = await window.CarechanCtaDefaults.fetchConfigUrls();
      window.CarechanCtaDefaults.applyDefaultCtasToQuestions(carechanData.questions, contactCtaUrls);
    }catch(error){
      contactCtaUrlsFailed = true;
      contactCtaUrls = null;
      try{ console.warn("[carechan] contact CTA hydrate failed", error); }catch(e){}
    }finally{
      contactCtaUrlsLoading = false;
    }
    return contactCtaUrls;
  }

  function openModal(){
    const overlay = document.getElementById("carechanOverlay");
    if(!overlay) return;
    modalOpen = true;
    modalView = "menu";
    navStack = [];
    answerPath = null;
    overlay.classList.remove("is-hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    renderModalBody();
    trackCarechan("carechan_open", {});
    document.getElementById("carechanModalClose")?.focus();
  }

  function closeModal(){
    const overlay = document.getElementById("carechanOverlay");
    if(!overlay) return;
    modalOpen = false;
    modalView = "menu";
    navStack = [];
    answerPath = null;
    overlay.classList.add("is-hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function goBackOneLevel(){
    if(modalView === "answer"){
      modalView = "menu";
      answerPath = null;
    }else if(navStack.length){
      navStack = navStack.slice(0, -1);
    }
    renderModalBody();
  }

  function handleMenuClick(pathStr){
    const ids = String(pathStr || "").split("/").filter(Boolean);
    if(!ids.length) return;
    const node = findNodeByIds(ids);
    if(!node) return;

    if(hasSubmenu(node)){
      navStack = ids;
      modalView = "menu";
      answerPath = null;
    }else{
      answerPath = ids;
      modalView = "answer";
    }
    renderModalBody();
  }

  function bindModalEvents(){
    const overlay = document.getElementById("carechanOverlay");
    if(!overlay) return;

    overlay.addEventListener("click", function(event){
      if(event.target === overlay) closeModal();
    });

    document.getElementById("carechanModalClose")?.addEventListener("click", closeModal);
    document.getElementById("carechanModalBack")?.addEventListener("click", goBackOneLevel);

    overlay.addEventListener("click", function(event){
      const menuBtn = event.target.closest("[data-node-path].carechan-question-btn");
      if(menuBtn){
        handleMenuClick(menuBtn.getAttribute("data-node-path"));
        return;
      }
      const cta = event.target.closest("[data-carechan-cta]");
      if(cta){
        trackCtaClick(
          cta.getAttribute("data-node-id"),
          cta.getAttribute("href"),
          cta.getAttribute("data-label")
        );
      }
    });

    document.addEventListener("keydown", function(event){
      if(!modalOpen) return;
      if(event.key === "Escape") closeModal();
    });
  }

  function renderWidget(data){
    const root = document.getElementById("carechanRoot");
    if(!root) return;

    if(!data.enabled){
      stopCarechanBubbleRotation();
      root.innerHTML = "";
      root.setAttribute("aria-hidden", "true");
      return;
    }

    root.innerHTML =
      '<div class="carechan-widget" id="carechanWidget">' +
        '<div class="carechan-bubble-wrap">' +
          '<div class="carechan-bubble" id="carechanBubble"></div>' +
        '</div>' +
        '<button type="button" class="carechan-trigger" id="carechanTrigger" aria-label="ケアちゃん FAQ を開く">' +
          renderCharacterImage(data) +
        '</button>' +
      '</div>' +
      '<div class="carechan-overlay is-hidden" id="carechanOverlay" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="carechanModalTitle">' +
        '<div class="carechan-modal">' +
          '<div class="carechan-modal-head">' +
            '<div class="carechan-modal-head-left">' +
              '<button type="button" class="carechan-modal-back is-hidden" id="carechanModalBack" aria-label="戻る">←</button>' +
              '<h2 id="carechanModalTitle">ケアちゃん FAQ</h2>' +
            '</div>' +
            '<button type="button" class="carechan-modal-close" id="carechanModalClose" aria-label="閉じる">×</button>' +
          '</div>' +
          '<div class="carechan-modal-body" id="carechanModalBody"></div>' +
        '</div>' +
      '</div>';

    root.setAttribute("aria-hidden", "false");
    const widget = document.getElementById("carechanWidget");
    if(widget) applyWidgetPosition(widget, data);
    document.getElementById("carechanTrigger")?.addEventListener("click", openModal);
    bindModalEvents();
    startCarechanBubbleRotation(data);
  }

  function bindResponsivePosition(){
    if(!window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_MQ);
    const handler = function(){
      const widget = document.getElementById("carechanWidget");
      if(widget && carechanData) applyWidgetPosition(widget, carechanData);
    };
    if(typeof mq.addEventListener === "function"){
      mq.addEventListener("change", handler);
    }else if(typeof mq.addListener === "function"){
      mq.addListener(handler);
    }
  }

  async function init(){
    try{
      carechanData = ensureCarechanShape(await fetchCarechanJson());
      await ensureContactCtaUrls();
      renderWidget(carechanData);
      bindResponsivePosition();
    }catch(error){
      try{ console.error("[carechan]", error); }catch(e){}
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
