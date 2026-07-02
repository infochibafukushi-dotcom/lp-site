(function(){

  function normalizeLinks(section){
    if(!Array.isArray(section?.links)){
      return [];
    }

    return section.links
      .slice(0, 3)
      .map((link) => ({
        text: String(link?.text || "").trim(),
        url: String(link?.url || "#").trim() || "#",
        visible: link?.visible === true
      }))
      .filter((link) => link.visible && link.text);
  }

  function getAlignClass(section){
    const align = String(section?.textAlign || "left").trim().toLowerCase();
    if(align === "center") return "center";
    if(align === "right") return "right";
    return "left";
  }

  function getCountClass(links){
    const count = Array.isArray(links) ? links.length : 0;
    if(count <= 1) return "count-1";
    if(count === 2) return "count-2";
    return "count-3";
  }

  const CONFIG_FOOTER_CTA_LABELS = [
    { key: "phone", text: "電話する" },
    { key: "line", text: "LINE相談" },
    { key: "reservation", text: "ネット予約" }
  ];

  function getFooterButtons(config){
    if(!config || typeof config !== "object"){
      return [];
    }
    const isPc = window.matchMedia ? window.matchMedia("(min-width: 769px)").matches : window.innerWidth >= 769;
    const footer = isPc ? (config.footerPc || config.footer) : config.footer;
    return Array.isArray(footer) ? footer : [];
  }

  function getConfigFooterCtaLinks(config){
    const footer = getFooterButtons(config);
    return CONFIG_FOOTER_CTA_LABELS.map(function(item, index){
      const url = String(footer[index]?.link || "").trim();
      if(!url){
        return null;
      }
      return {
        key: item.key,
        text: item.text,
        url: url
      };
    }).filter(Boolean);
  }

  function buildAnchor(url, text, escapeAttr, escapeHtml, extraAttrs){
    const href = String(url || "#").trim() || "#";
    const label = String(text || "").trim();

    const isExternal =
      /^https?:\/\//i.test(href) ||
      /^mailto:/i.test(href) ||
      /^tel:/i.test(href);

    const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
    const attrs = extraAttrs ? " " + extraAttrs : "";
    const pulseClass = (window.IndexUtils && typeof window.IndexUtils.isEstimatePulseText === "function" && window.IndexUtils.isEstimatePulseText(label))
      ? " estimate-pulse-button"
      : "";
    const availabilityClass = label === "予約空き確認" ? " topbtn-availability" : "";
    const phoneClass = (window.IndexUtils && typeof window.IndexUtils.isPhoneCtaText === "function" && window.IndexUtils.isPhoneCtaText(label, href))
      ? " is-phone-cta"
      : "";
    const className = `section-bottom-link${pulseClass}${availabilityClass}${phoneClass}`;

    return `<a class="${className}" href="${escapeAttr(href)}"${extra}${attrs}>${escapeHtml(label)}</a>`;
  }

  function render(section, escapeAttr, escapeHtml){

    const links = normalizeLinks(section);
    if(links.length === 0){
      return "";
    }

    const alignClass = getAlignClass(section);
    const countClass = getCountClass(links);

    return `
      <div class="section-bottom-links ${escapeAttr(alignClass)} ${escapeAttr(countClass)}">
        ${links.map((link) => buildAnchor(link.url, link.text, escapeAttr, escapeHtml)).join("")}
      </div>
    `;
  }

  function renderConfigFooterCtas(section, config, escapeAttr, escapeHtml){
    const block = section?.configFooterCtas;
    if(!block || block.visible !== true){
      return "";
    }

    const links = getConfigFooterCtaLinks(config);
    if(links.length === 0){
      return "";
    }

    const alignClass = getAlignClass(section);
    const countClass = getCountClass(links);
    const text = String(block.text || "").trim();
    const textAlign = String(section?.textAlign || "left").trim().toLowerCase();
    const textHtml = text
      ? `<p class="section-consult-note text-${escapeAttr(textAlign)}">${escapeHtml(text)}</p>`
      : "";

    return `
      <div class="section-config-footer-ctas" data-config-footer-ctas="1">
        ${textHtml}
        <div class="section-bottom-links ${escapeAttr(alignClass)} ${escapeAttr(countClass)}">
          ${links.map(function(link){
            return buildAnchor(
              link.url,
              link.text,
              escapeAttr,
              escapeHtml,
              `data-config-cta="${escapeAttr(link.key)}"`
            );
          }).join("")}
        </div>
      </div>
    `;
  }

  function hydrateConfigFooterCtas(config){
    const links = getConfigFooterCtaLinks(config);
    if(links.length === 0){
      return;
    }

    links.forEach(function(link){
      document.querySelectorAll(`[data-config-cta="${link.key}"]`).forEach(function(anchor){
        anchor.href = link.url;
        anchor.textContent = link.text;
      });
    });
  }

  window.SectionBottomButtons = {
    render: render,
    renderConfigFooterCtas: renderConfigFooterCtas,
    hydrateConfigFooterCtas: hydrateConfigFooterCtas
  };

})();
