(function(){
  function buildImageAttrs(priority = "lazy"){
    if(priority === "high"){
      return 'loading="eager" fetchpriority="high" decoding="async"';
    }
    return 'loading="lazy" fetchpriority="low" decoding="async"';
  }

  function resolveImageFit(fit, defaultFit = "cover"){
    return fit === "contain" || fit === "cover" ? fit : defaultFit;
  }

  function imageWrapClass(wrapClass, fit, defaultFit = "cover"){
    const resolved = resolveImageFit(fit, defaultFit);
    return `${wrapClass}${resolved === "contain" ? " is-contain" : ""}`;
  }

  function renderImageWrap(src, alt, attrs, options = {}){
    const {
      wrapClass = "card-image",
      defaultFit = "cover",
      fit
    } = options;

    if(!src){
      return "";
    }

    return `<div class="${imageWrapClass(wrapClass, fit, defaultFit)}"><img src="${window.IndexUtils.escapeAttr(src)}" alt="${window.IndexUtils.escapeAttr(alt || "")}" ${attrs}></div>`;
  }

  function renderSectionBottomLinks(section){
    if(window.SectionBottomButtons && typeof window.SectionBottomButtons.render === "function"){
      return window.SectionBottomButtons.render(
        section,
        window.IndexUtils.escapeAttr,
        window.IndexUtils.escapeHtml
      );
    }
    return "";
  }

  function nl2brSafe(text){
    return window.IndexUtils.escapeHtml(text || "").replace(/\r?\n/g, "<br>");
  }

  function renderSectionLeadText(section){
    const text = String(section?.text || "").trim();
    if(!text){
      return "";
    }

    return `<p class="section-text text-${window.IndexUtils.escapeAttr(section.textSize || "medium")} text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}">${window.IndexUtils.escapeHtml(text)}</p>`;
  }

  function menuListHasAnyPrice(groups){
    if(!Array.isArray(groups)){
      return false;
    }

    return groups.some((group) => {
      const items = Array.isArray(group.items) ? group.items.filter((item) => item && item.visible !== false) : [];
      return items.some((item) => String(item?.price || "").trim() !== "");
    });
  }

  function renderConfigFooterCtas(section, config){
    if(window.SectionBottomButtons && typeof window.SectionBottomButtons.renderConfigFooterCtas === "function"){
      return window.SectionBottomButtons.renderConfigFooterCtas(
        section,
        config,
        window.IndexUtils.escapeAttr,
        window.IndexUtils.escapeHtml
      );
    }
    return "";
  }

  function renderNormal(section, config){
    const imageAttrs = buildImageAttrs(section?.__imagePriority);
    const imageHtml = renderImageWrap(
      section.image,
      section.title || "",
      imageAttrs,
      {
        wrapClass: "section-card-image",
        defaultFit: "contain",
        fit: section.imageFit
      }
    );
    const linkedImage = window.IndexUtils.wrapLink(section.link || "#", imageHtml, "");

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section align-${window.IndexUtils.escapeAttr(section.alignY || "middle")}" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          <div class="normal-image-wrap">${linkedImage}</div>
          <p class="section-text text-${window.IndexUtils.escapeAttr(section.textSize || "medium")} text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}">${nl2brSafe(section.text || "")}</p>
          ${renderSectionBottomLinks(section)}
          ${renderConfigFooterCtas(section, config)}
        </div>
      </section>
    `;
  }

  function renderSliderSlideOverlay(slideItem, slideIndex){
    const title = String(slideItem?.title || "").trim();
    const text = String(slideItem?.text || "").trim();
    const ctaText = String(slideItem?.ctaText || "").trim();
    const ctaLink = String(slideItem?.link || "").trim();

    if(!title && !text && !ctaText){
      return "";
    }

    const headingTag = slideIndex === 0 ? "h1" : "h2";
    const ctaHtml = ctaText
      ? `<div class="slider-slide-cta-wrap">${window.IndexUtils.wrapLink(ctaLink || "#", `<span class="slider-slide-cta">${window.IndexUtils.escapeHtml(ctaText)}</span>`, "slider-slide-cta-link")}</div>`
      : "";

    return `
      <div class="slider-slide-overlay">
        <div class="slider-slide-overlay-inner">
          ${title ? `<${headingTag} class="slider-slide-title">${window.IndexUtils.escapeHtml(title)}</${headingTag}>` : ""}
          ${text ? `<p class="slider-slide-text">${window.IndexUtils.escapeHtml(text)}</p>` : ""}
          ${ctaHtml}
        </div>
      </div>
    `;
  }

  function renderSlider(section, idx){
    const imageAttrs = buildImageAttrs(section?.__imagePriority);
    const images = Array.isArray(section.images) ? section.images : [];
    const slideItems = Array.isArray(section.items) ? section.items : [];
    const hasSlideContent = slideItems.some((item) => {
      return String(item?.title || "").trim() || String(item?.text || "").trim() || String(item?.ctaText || "").trim();
    });
    const slideCount = Math.max(images.length, slideItems.length);
    const slides = slideCount > 0
      ? Array.from({ length: slideCount }, (_, imageIndex) => {
          const src = images[imageIndex] || "";
          const slideItem = slideItems[imageIndex] || {};
          const attrs = imageIndex === 0 ? imageAttrs : buildImageAttrs("lazy");
          const alt = String(slideItem.title || section.title || "").trim();
          const image = src
            ? `<div class="slider-image-wrap"><img src="${window.IndexUtils.escapeAttr(src)}" alt="${window.IndexUtils.escapeAttr(alt)}" ${attrs}></div>`
            : `<div class="slider-image-wrap slider-image-wrap--empty"></div>`;
          const overlay = hasSlideContent ? renderSliderSlideOverlay(slideItem, imageIndex) : "";
          return `<div class="slider-slide${hasSlideContent ? " has-overlay" : ""}">${image}${overlay}</div>`;
        }).join("")
      : `<div class="slider-empty">画像がまだありません</div>`;

    const dots = slideCount > 1
      ? `<div class="slider-dots" id="slider-dots-${idx}"></div>`
      : "";

    const sectionTitle = String(section.title || "").trim();
    const sectionText = String(section.text || "").trim();
    const showSectionTitle = !hasSlideContent && sectionTitle;
    const showSectionText = !hasSlideContent && sectionText;

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section align-${window.IndexUtils.escapeAttr(section.alignY || "middle")}${hasSlideContent ? " slider-has-slide-content" : ""}" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#f8f9fa")}">
        <div class="section-inner">
          ${showSectionTitle ? `<h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(sectionTitle)}</h2>` : ""}
          <div class="slider-shell" data-slider-index="${idx}">
            <div class="slider-window">
              <div class="slider-track" id="slider-track-${idx}">
                ${slides}
              </div>
            </div>
            ${dots}
          </div>
          ${showSectionText ? `<p class="section-text text-${window.IndexUtils.escapeAttr(section.textSize || "medium")} text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}">${window.IndexUtils.escapeHtml(sectionText)}</p>` : ""}
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }

  const BENEFIT_CARD_ICONS = ["♿", "🏥", "👨‍👩‍👧", "🧮", "💗", "📍", "🕒"];

  function renderCardItems(items, textSize, textAlign, options = {}){
    if(!Array.isArray(items) || items.length === 0){
      return `<div class="card-item">カードデータがありません</div>`;
    }

    const linkless = options.linkless === true;
    const useCardCta = options.useCardCta === true;

    return items.map((item) => {
      const title = item?.title || "";
      const text = item?.text || "";
      const image = item?.image || "";
      const link = item?.link || "#";
      const ctaText = String(item?.ctaText || "").trim();

      const ctaHtml = useCardCta && ctaText
        ? `<div class="card-item-cta-wrap">${window.IndexUtils.wrapLink(link, `<span class="card-item-cta">${window.IndexUtils.escapeHtml(ctaText)}</span>`, "card-item-cta-link")}</div>`
        : "";

      const inner = `
        ${renderImageWrap(image, title, buildImageAttrs("lazy"), { fit: item?.imageFit })}
        ${title ? `<h3 class="card-item-title text-${window.IndexUtils.escapeAttr(textAlign || "left")}">${window.IndexUtils.escapeHtml(title)}</h3>` : ""}
        ${text ? `<div class="section-text text-${window.IndexUtils.escapeAttr(textSize || "medium")} text-${window.IndexUtils.escapeAttr(textAlign || "left")}">${nl2brSafe(text)}</div>` : ""}
        ${ctaHtml}
      `;

      const content = (linkless || useCardCta) ? inner : window.IndexUtils.wrapLink(link, inner, "card-link");
      return `<div class="card-item">${content}</div>`;
    }).join("");
  }

  function renderBenefitCardItems(items, textSize, textAlign){
    if(!Array.isArray(items) || items.length === 0){
      return `<div class="card-item">カードデータがありません</div>`;
    }

    return items.map((item, index) => {
      const title = item?.title || "";
      const text = item?.text || "";
      const image = item?.image || "";
      const link = item?.link || "#";
      const num = index + 1;
      const icon = BENEFIT_CARD_ICONS[index] || "✓";

      const inner = `
        <div class="card-benefit-head">
          <span class="card-benefit-badge" aria-hidden="true">${num}</span>
          <span class="card-benefit-icon" aria-hidden="true">${icon}</span>
        </div>
        ${renderImageWrap(image, title, buildImageAttrs("lazy"), { fit: item?.imageFit })}
        ${title ? `<h3 class="card-item-title text-${window.IndexUtils.escapeAttr(textAlign || "left")}">${window.IndexUtils.escapeHtml(title)}</h3>` : ""}
        ${text ? `<div class="section-text text-${window.IndexUtils.escapeAttr(textSize || "medium")} text-${window.IndexUtils.escapeAttr(textAlign || "left")}">${window.IndexUtils.escapeHtml(text)}</div>` : ""}
      `;

      return `<div class="card-item card-benefit-item card-benefit-item--${num}">${window.IndexUtils.wrapLink(link, inner, "card-link card-benefit-link")}</div>`;
    }).join("");
  }

  function renderCard4(section){
    const isBenefitsSection = section?.sectionId === "seven-benefits-chibakea";
    const cardsHtml = isBenefitsSection
      ? renderBenefitCardItems(section.items || [], section.textSize || "medium", section.textAlign || "left")
      : renderCardItems(section.items || [], section.textSize || "medium", section.textAlign || "left");

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          ${renderSectionLeadText(section)}
          <div class="card-grid-4 ${window.IndexUtils.getMobileCardGridClass(section)}">
            ${cardsHtml}
          </div>
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }

  function renderCard3(section, config){
    const isPriceExamples = section?.sectionId === "price-examples";
    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          ${renderSectionLeadText(section)}
          <div class="card-grid-3 ${window.IndexUtils.getMobileCardGridClass(section)}">
            ${renderCardItems(section.items || [], section.textSize || "medium", section.textAlign || "left", { useCardCta: isPriceExamples })}
          </div>
          ${isPriceExamples && section.menuBottomCard?.visible ? `
            <p class="section-disclaimer text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}">${window.IndexUtils.escapeHtml(section.menuBottomCard.text || "")}</p>
          ` : ""}
          ${renderSectionBottomLinks(section)}
          ${renderConfigFooterCtas(section, config)}
        </div>
      </section>
    `;
  }

  function renderCard2(section){
    const isPaymentInfo = section?.sectionId === "payment-info-cards";
    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          ${renderSectionLeadText(section)}
          <div class="card-grid-2 ${window.IndexUtils.getMobileCardGridClass(section)}">
            ${renderCardItems(section.items || [], section.textSize || "medium", section.textAlign || "left", { linkless: isPaymentInfo })}
          </div>
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }

  function renderMedia(section, reverse = false){
    const image = section.image
      ? window.IndexUtils.wrapLink(
          section.link || "#",
          renderImageWrap(
            section.image,
            section.title || "",
            buildImageAttrs(section?.__imagePriority),
            {
              wrapClass: "card-media",
              fit: section.imageFit
            }
          ),
          ""
        )
      : "";

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section align-${window.IndexUtils.escapeAttr(section.alignY || "middle")}" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <div class="media-row ${reverse ? "reverse" : ""}">
            <div>
              <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
              <p class="section-text text-${window.IndexUtils.escapeAttr(section.textSize || "medium")} text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}">${window.IndexUtils.escapeHtml(section.text || "")}</p>
              ${renderSectionBottomLinks(section)}
            </div>
            <div>${image}</div>
          </div>
        </div>
      </section>
    `;
  }

  function renderAccordion(section){
    const items = Array.isArray(section.items) ? section.items : [];
    const rows = items.map((it, i) => {
      const question = it && it.title ? it.title : "";
      const answer = it && it.text ? it.text : "";
      const t = nl2brSafe(question);
      const tx = nl2brSafe(answer);
      const itemId = it && it.faqId ? ` id="${window.IndexUtils.escapeAttr("faq-item-" + it.faqId)}"` : "";

      return `
        <details class="accordion-item"${itemId} itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" style="margin:0 0 14px 0; background:#eef1f3; border-radius:10px; overflow:hidden; border:1px solid #e0e5e9;">
          <summary
            class="accordion-header"
            style="width:100%; background:#eef1f3; padding:18px 20px; display:flex; align-items:center; justify-content:space-between; gap:14px; cursor:pointer; text-align:left; list-style:none;">
            <span style="display:flex; align-items:flex-start; gap:14px; min-width:0; flex:1;">
              <span style="flex:0 0 auto; font-size:18px; line-height:1; font-weight:700; color:#1f2a44;">Q</span>
              <h3 class="accordion-title" itemprop="name" style="margin:0; min-width:0; font-size:clamp(18px,2.4vw,22px); line-height:1.45; font-weight:700; color:#0b8da6; white-space:normal; word-break:break-word;">${t}</h3>
            </span>
            <span class="accordion-icon accordion-icon-closed" aria-hidden="true" style="flex:0 0 auto; font-size:34px; line-height:1; color:#0b8da6; font-weight:400;">＋</span>
            <span class="accordion-icon accordion-icon-open" aria-hidden="true" style="flex:0 0 auto; font-size:34px; line-height:1; color:#0b8da6; font-weight:400;">×</span>
          </summary>
          <div class="accordion-body" style="padding:0 16px 16px 16px; background:#eef1f3;">
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer" style="background:#ffffff; padding:16px 18px; border-radius:0; border:none;">
              <div style="display:flex; align-items:flex-start; gap:14px;">
                <div style="flex:0 0 auto; font-size:18px; line-height:1; font-weight:700; color:#1f2a44; padding-top:2px;">A</div>
                <div class="section-text text-${window.IndexUtils.escapeAttr(section.textSize || "medium")} text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}" itemprop="text" style="margin:0; white-space:normal; word-break:break-word; line-height:1.9;">
                  ${tx}
                </div>
              </div>
            </div>
          </div>
        </details>
      `;
    }).join("");

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}" style="margin-bottom:22px;">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          <div class="accordion-list" itemscope itemtype="https://schema.org/FAQPage">
            ${rows}
          </div>
          ${renderSectionLeadText(section)}
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }


  function renderAreaTags(section){
    const groups = Array.isArray(section.menuGroups) ? section.menuGroups : [];
    const tags = [];
    groups.forEach((group) => {
      const items = Array.isArray(group.items) ? group.items.filter((item) => item && item.visible !== false) : [];
      items.forEach((item) => {
        const name = String(item.name || "").trim();
        if(name){
          tags.push(name);
        }
      });
    });

    if(tags.length === 0){
      return "";
    }

    return `
      <div class="area-tags" role="list">
        ${tags.map((tag) => `<span class="area-tag" role="listitem">${window.IndexUtils.escapeHtml(tag)}</span>`).join("")}
      </div>
    `;
  }

  function renderMenuList(section, config){
    const isAreaSection = section?.sectionId === "taiou-area";
    const isEstimateGuide = section?.sectionId === "kantan-mitsumori";
    const groups = Array.isArray(section.menuGroups) ? section.menuGroups : [];
    const bottomCard = section.menuBottomCard || { visible:false, title:'', text:'', buttonText:'', buttonUrl:'#' };
    const showPrices = menuListHasAnyPrice(groups);
    const leadHtml = renderSectionLeadText(section);

    const cardsHtml = groups.length ? groups.map((group, groupIndex) => {
      const items = Array.isArray(group.items) ? group.items.filter(item => item && item.visible !== false) : [];
      return `
        <div id="menu-list-cat-${groupIndex}" style="background:#ffffff;border:1px solid #e7dfd4;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);margin:0 0 18px 0;">
          <button
            type="button"
            aria-expanded="true"
            style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border:none;background:#ffffff;color:#2d2a26;text-align:left;cursor:pointer;"
            onclick="(function(btn){var body=btn.nextElementSibling;var icon=btn.querySelector('[data-menu-chevron]');var isOpen=btn.getAttribute('aria-expanded')==='true';if(isOpen){body.style.display='none';btn.setAttribute('aria-expanded','false');if(icon){icon.style.transform='rotate(-90deg)';}}else{body.style.display='block';btn.setAttribute('aria-expanded','true');if(icon){icon.style.transform='rotate(0deg)';}}})(this)"
          >
            <span style="font-size:22px;line-height:1.4;font-weight:700;color:#2d2a26;">${window.IndexUtils.escapeHtml(group.title || `カテゴリ${groupIndex + 1}`)}</span>
            <span data-menu-chevron style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;font-size:16px;color:#999;transition:transform .25s;">⌄</span>
          </button>
          <div style="display:block;border-top:1px solid #efe7dc;">
            <div style="padding:0 16px;">
              ${items.length ? items.map((item, itemIndex) => `
                <div style="padding:14px 0;${itemIndex < items.length - 1 ? 'border-bottom:1px solid #f3eee7;' : ''}">
                  ${showPrices ? `
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
                    <div style="min-width:0;flex:1 1 auto;">
                      <div style="font-size:clamp(18px, 1.8vw, 20px);font-weight:700;line-height:1.5;color:#2d2a26;">${window.IndexUtils.escapeHtml(item.name || '')}</div>
                      ${item.description ? `<div style="margin-top:6px;font-size:13px;line-height:1.8;color:#555;white-space:pre-line;word-break:break-word;">${window.IndexUtils.escapeHtml(item.description || '')}</div>` : ''}
                    </div>
                    <div style="flex:0 0 auto;font-size:clamp(20px, 2.2vw, 24px);font-weight:800;line-height:1.2;color:#9a6b16;white-space:nowrap;padding-left:12px;letter-spacing:0.01em;">${window.IndexUtils.escapeHtml(item.price || '')}</div>
                  </div>
                  ` : `
                  <div style="min-width:0;">
                    <div style="font-size:clamp(18px, 1.8vw, 20px);font-weight:700;line-height:1.5;color:#2d2a26;">${window.IndexUtils.escapeHtml(item.name || '')}</div>
                    ${item.description ? `<div style="margin-top:6px;font-size:13px;line-height:1.8;color:#555;white-space:pre-line;word-break:break-word;">${window.IndexUtils.escapeHtml(item.description || '')}</div>` : ''}
                  </div>
                  `}
                </div>
              `).join("") : `<div style="padding:16px 0;font-size:13px;color:#999;">メニューはまだありません</div>`}
            </div>
          </div>
        </div>
      `;
    }).join("") : `<div class="section-text" style="margin-top:0;">メニューはまだ登録されていません</div>`;

    const bottomCardHtml = bottomCard.visible ? `
      <div style="margin:6px 0 0 0;background:#ffffff;border:1px solid #e7dfd4;border-radius:16px;padding:18px 18px 20px 18px;box-shadow:0 2px 8px rgba(0,0,0,.03);">
        ${bottomCard.title ? `<div style="font-size:clamp(18px, 2vw, 22px);font-weight:800;line-height:1.45;color:#2d2a26;">${window.IndexUtils.escapeHtml(bottomCard.title || '')}</div>` : ''}
        ${bottomCard.text ? `<div class="section-disclaimer" style="margin-top:8px;font-size:14px;line-height:1.9;color:#5f5b55;white-space:pre-line;word-break:break-word;">${window.IndexUtils.escapeHtml(bottomCard.text || '')}</div>` : ''}
      </div>
    ` : '';

    const areaTagsHtml = isAreaSection ? renderAreaTags(section) : '';
    const estimateChecklistHtml = isEstimateGuide ? `
      <div class="estimate-checklist">
        ${groups.length ? groups.map((group) => {
          const items = Array.isArray(group.items) ? group.items.filter((item) => item && item.visible !== false) : [];
          return items.map((item) => `
            <div class="estimate-checklist-item">
              <span class="estimate-checklist-label">${window.IndexUtils.escapeHtml(item.name || '')}</span>
              <span class="estimate-checklist-example">${window.IndexUtils.escapeHtml(item.description || '')}</span>
            </div>
          `).join("");
        }).join("") : ''}
      </div>
    ` : '';

    const mainContentHtml = isAreaSection
      ? `${areaTagsHtml}${bottomCard.visible ? '' : ''}`
      : isEstimateGuide
        ? estimateChecklistHtml
        : cardsHtml;

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section${isAreaSection ? ' section-area-tags' : ''}${isEstimateGuide ? ' section-estimate-guide' : ''}" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#f7f5f0")};padding-left:20px;padding-right:20px;">
        <div class="section-inner" style="max-width:720px;">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          ${leadHtml}
        </div>
        <div class="section-inner" style="max-width:720px;padding-top:8px;">
          ${mainContentHtml}
          ${bottomCardHtml}
          ${renderSectionBottomLinks(section)}
          ${renderConfigFooterCtas(section, config)}
        </div>
      </section>
    `;
  }

  function renderSection(section, idx, config){
    section = window.IndexUtils.ensureSectionShape(section, idx);
    section.__imagePriority = idx === 0 ? "high" : "lazy";

    if(!section || section.enabled === false){
      return "";
    }

    switch(section.type){
      case "normal":
        return renderNormal(section, config);
      case "slider":
        return renderSlider(section, idx);
      case "card4":
        return renderCard4(section);
      case "card3":
        return renderCard3(section, config);
      case "card2":
        return renderCard2(section);
      case "card1-right":
        return renderMedia(section, false);
      case "card1-left":
        return renderMedia(section, true);
      case "accordion":
        return renderAccordion(section);
      case "menu-list":
        return renderMenuList(section, config);
      default:
        return `
          <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:#fff3cd">
            <div class="section-inner">
              <h2 class="section-title">未対応セクション</h2>
              <p class="section-text">type: ${window.IndexUtils.escapeHtml(section.type || "")}</p>
            </div>
          </section>
        `;
    }
  }

  window.IndexRenderers = {
    renderSection: renderSection
  };
})();
