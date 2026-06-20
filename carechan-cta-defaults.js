(function(global){
  const USAGE_ELIGIBILITY_CTA_SPEC = [
    { key: "line", label: "LINE相談" },
    { key: "reservation", label: "見積・予約・空き確認" },
    { key: "phone", label: "電話予約・質問" }
  ];

  const USAGE_ELIGIBILITY_NODE_IDS = [
    "usage-eligibility-alone",
    "usage-eligibility-no-family",
    "usage-eligibility-non-elderly",
    "usage-eligibility-care-insurance",
    "usage-eligibility-injury",
    "usage-eligibility-cane",
    "usage-eligibility-wheelchair",
    "usage-eligibility-mental",
    "usage-eligibility-pregnant",
    "usage-eligibility-dementia",
    "usage-eligibility-dialysis",
    "usage-eligibility-oxygen",
    "usage-eligibility-disability-cert",
    "usage-eligibility-hospital-escort",
    "usage-eligibility-shopping-grave"
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

  USAGE_ELIGIBILITY_NODE_IDS.forEach(function(nodeId){
    NODE_CTA_SPECS[nodeId] = USAGE_ELIGIBILITY_CTA_SPEC;
    NODE_CTA_HEADINGS[nodeId] = "ご相談・ご予約はこちら";
  });

  NODE_CTA_SPECS["q-area"] = USAGE_ELIGIBILITY_CTA_SPEC;
  NODE_CTA_HEADINGS["q-area"] = "ご相談・ご予約はこちら";

  NODE_CTA_SPECS["vehicle-overview"] = USAGE_ELIGIBILITY_CTA_SPEC;
  NODE_CTA_HEADINGS["vehicle-overview"] = "ご相談・ご予約はこちら";

  const ALL_TEMPLATE_CTAS = [
    { key: "phone", label: "電話する" },
    { key: "line", label: "LINE相談はこちら" },
    { key: "reservation", label: "ネット予約はこちら" },
    { key: "contact", label: "お問い合わせはこちら" }
  ];

  async function fetchConfigUrls(){
    const res = await fetch("./data/config.json?" + Date.now(), { cache: "no-store" });
    if(!res.ok) throw new Error("config.json 読込失敗");
    const config = await res.json();
    const footer = Array.isArray(config.footer) ? config.footer : [];
    const buttons = Array.isArray(config.buttons) ? config.buttons : [];
    return {
      phone: String(footer[0]?.link || "").trim(),
      line: String(footer[1]?.link || "").trim(),
      reservation: String(footer[2]?.link || "").trim(),
      contact: String(buttons[0]?.link || "").trim()
    };
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
      const specs = NODE_CTA_SPECS[node.id];
      let added = 0;
      if(specs) added = applySpecsToNode(node, urls, specs);
      if(NODE_CTA_HEADINGS[node.id]) node.ctaHeading = NODE_CTA_HEADINGS[node.id];
      return added;
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
    NODE_CTA_SPECS: NODE_CTA_SPECS,
    fetchConfigUrls: fetchConfigUrls,
    applyDefaultCtasToQuestions: applyDefaultCtasToQuestions,
    applyManualCtasToNode: applyManualCtasToNode
  };
})(typeof window !== "undefined" ? window : globalThis);
