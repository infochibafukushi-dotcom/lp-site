(function(global){
  const CONTACT_CTA_HEADING = "ご相談・ご予約はこちら";
  const CONTACT_CTA_SPEC = [
    { key: "line", label: "LINE相談" },
    { key: "reservation", label: "見積・予約・空き確認" },
    { key: "phone", label: "電話予約・質問" }
  ];

  const NODE_CTA_HEADINGS = {};
  const NODE_CTA_SPECS = {
    "reserve-booking": [
      { key: "reservation", label: "ネット予約はこちら" },
      { key: "line", label: "LINE相談はこちら" }
    ],
    "reserve-hours": [
      { key: "reservation", label: "ネット予約はこちら" },
      { key: "phone", label: "電話する" },
      { key: "line", label: "LINE相談はこちら" }
    ],
    "cancel-same-day": [
      { key: "phone", label: "電話する" },
      { key: "line", label: "LINE相談はこちら" }
    ],
    "cancel-future": [
      { key: "phone", label: "電話する" },
      { key: "line", label: "LINE相談はこちら" },
      { key: "contact", label: "お問い合わせはこちら" }
    ]
  };

  const ALL_TEMPLATE_CTAS = [
    { key: "phone", label: "電話する" },
    { key: "line", label: "LINE相談はこちら" },
    { key: "reservation", label: "ネット予約はこちら" },
    { key: "contact", label: "お問い合わせはこちら" }
  ];

  function isAnswerLeaf(node){
    if(!node) return false;
    const hasAnswer = Boolean(String(node.answer || "").trim());
    const children = Array.isArray(node.children) ? node.children : [];
    const hasEnabledChild = children.some(function(child){
      return child && child.enabled !== false && child.title;
    });
    return hasAnswer && !hasEnabledChild;
  }

  function getCtaSpecsForNode(node){
    if(!node) return null;
    if(NODE_CTA_SPECS[node.id]) return NODE_CTA_SPECS[node.id];
    if(isAnswerLeaf(node)) return CONTACT_CTA_SPEC;
    return null;
  }

  function getCtaHeadingForNode(node, specs){
    if(NODE_CTA_HEADINGS[node.id]) return NODE_CTA_HEADINGS[node.id];
    if(specs === CONTACT_CTA_SPEC) return CONTACT_CTA_HEADING;
    return "";
  }

  function parseConfigUrls(config){
    const footer = Array.isArray(config?.footer) ? config.footer : [];
    const buttons = Array.isArray(config?.buttons) ? config.buttons : [];
    return {
      phone: String(footer[0]?.link || "").trim(),
      line: String(footer[1]?.link || "").trim(),
      reservation: String(footer[2]?.link || "").trim(),
      contact: String(buttons[0]?.link || "").trim()
    };
  }

  async function fetchConfigUrls(){
    const paths = ["./data/config.json", "data/config.json", "../data/config.json"];
    let lastError = null;
    for(const rawPath of paths){
      try{
        const url = rawPath + (rawPath.includes("?") ? "&" : "?") + "_ts=" + Date.now();
        const res = await fetch(url, { cache: "no-store" });
        if(!res.ok) throw new Error("HTTP " + res.status);
        return parseConfigUrls(await res.json());
      }catch(error){
        lastError = error;
      }
    }
    throw lastError || new Error("config.json 読込失敗");
  }

  function ctaExists(ctas, label, url){
    return (ctas || []).some(function(c){
      return c && (c.label === label || c.url === url);
    });
  }

  function pushCtaIfNew(ctas, label, url, key){
    if(!url || !label) return 0;
    if(ctaExists(ctas, label, url)) return 0;
    ctas.push({
      id: "cta-" + key + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      label: label,
      url: url,
      order: ctas.length + 1,
      visible: true
    });
    return 1;
  }

  function applySpecsToNode(node, urls, specs){
    if(!node || !specs || !specs.length) return 0;
    if(!Array.isArray(node.ctas)) node.ctas = [];
    let added = 0;
    specs.forEach(function(spec){
      const url = urls[spec.key] || "";
      added += pushCtaIfNew(node.ctas, spec.label, url, spec.key);
    });
    node.ctas.forEach(function(c, idx){ c.order = idx + 1; });
    return added;
  }

  function ensureNodeAnswerCtas(node, urls){
    if(!node || !urls) return 0;
    const specs = getCtaSpecsForNode(node);
    if(!specs) return 0;
    const added = applySpecsToNode(node, urls, specs);
    const heading = getCtaHeadingForNode(node, specs);
    if(heading) node.ctaHeading = heading;
    return added;
  }

  function walkQuestions(questions, visitor){
    if(!Array.isArray(questions)) return 0;
    let total = 0;
    questions.forEach(function(node){
      total += visitor(node);
      if(Array.isArray(node.children) && node.children.length){
        total += walkQuestions(node.children, visitor);
      }
    });
    return total;
  }

  function applyDefaultCtasToQuestions(questions, urls){
    return walkQuestions(questions, function(node){
      return ensureNodeAnswerCtas(node, urls);
    });
  }

  function applyManualCtasToNode(node, urls){
    if(!node) return 0;
    if(!Array.isArray(node.ctas)) node.ctas = [];
    let added = 0;
    ALL_TEMPLATE_CTAS.forEach(function(spec){
      const url = urls[spec.key] || "";
      added += pushCtaIfNew(node.ctas, spec.label, url, spec.key);
    });
    node.ctas.forEach(function(c, idx){ c.order = idx + 1; });
    return added;
  }

  global.CarechanCtaDefaults = {
    CONTACT_CTA_SPEC: CONTACT_CTA_SPEC,
    CONTACT_CTA_HEADING: CONTACT_CTA_HEADING,
    NODE_CTA_SPECS: NODE_CTA_SPECS,
    fetchConfigUrls: fetchConfigUrls,
    ensureNodeAnswerCtas: ensureNodeAnswerCtas,
    applyDefaultCtasToQuestions: applyDefaultCtasToQuestions,
    applyManualCtasToNode: applyManualCtasToNode
  };
})(typeof window !== "undefined" ? window : globalThis);
