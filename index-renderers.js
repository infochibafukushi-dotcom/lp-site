(function(){
  function buildImageAttrs(priority = "lazy"){
    if(priority === "high"){
      return 'loading="eager" fetchpriority="high" decoding="async"';
    }
    return 'loading="lazy" fetchpriority="low" decoding="async"';
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

  function renderNormal(section){
    const imageAttrs = buildImageAttrs(section?.__imagePriority);
    const imageHtml = section.image
      ? `<img class="normal-image" src="${window.IndexUtils.escapeAttr(section.image)}" alt="${window.IndexUtils.escapeAttr(section.title || "")}" ${imageAttrs}>`
      : "";
    const linkedImage = window.IndexUtils.wrapLink(section.link || "#", imageHtml, "");

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section align-${window.IndexUtils.escapeAttr(section.alignY || "middle")}" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          <div class="normal-image-wrap">${linkedImage}</div>
          <p class="section-text text-${window.IndexUtils.escapeAttr(section.textSize || "medium")} text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}">${window.IndexUtils.escapeHtml(section.text || "")}</p>
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }

  function renderSlider(section, idx){
    const imageAttrs = buildImageAttrs(section?.__imagePriority);
    const images = Array.isArray(section.images) ? section.images : [];
    const slides = images.length
      ? images.map((src, imageIndex) => {
          const attrs = imageIndex === 0 ? imageAttrs : buildImageAttrs("lazy");
          const image = `<img src="${window.IndexUtils.escapeAttr(src)}" alt="${window.IndexUtils.escapeAttr(section.title || "")}" ${attrs}>`;
          return `<div class="slider-slide">${window.IndexUtils.wrapLink(section.link || "#", image, "")}</div>`;
        }).join("")
      : `<div class="slider-empty">画像がまだありません</div>`;

    const dots = images.length > 1
      ? `<div class="slider-dots" id="slider-dots-${idx}"></div>`
      : "";

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section align-${window.IndexUtils.escapeAttr(section.alignY || "middle")}" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#f8f9fa")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          <div class="slider-shell" data-slider-index="${idx}">
            <div class="slider-window">
              <div class="slider-track" id="slider-track-${idx}">
                ${slides}
              </div>
            </div>
            ${dots}
          </div>
          <p class="section-text text-${window.IndexUtils.escapeAttr(section.textSize || "medium")} text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}">${window.IndexUtils.escapeHtml(section.text || "")}</p>
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }

  function renderCardItems(items, textSize, textAlign){
    if(!Array.isArray(items) || items.length === 0){
      return `<div class="card-item">カードデータがありません</div>`;
    }

    return items.map((item) => {
      const title = item?.title || "";
      const text = item?.text || "";
      const image = item?.image || "";
      const link = item?.link || "#";

      const inner = `
        ${image ? `<img src="${window.IndexUtils.escapeAttr(image)}" alt="${window.IndexUtils.escapeAttr(title)}" ${buildImageAttrs("lazy")}>` : ""}
        ${title ? `<h3 class="card-item-title text-${window.IndexUtils.escapeAttr(textAlign || "left")}">${window.IndexUtils.escapeHtml(title)}</h3>` : ""}
        ${text ? `<div class="section-text text-${window.IndexUtils.escapeAttr(textSize || "medium")} text-${window.IndexUtils.escapeAttr(textAlign || "left")}">${window.IndexUtils.escapeHtml(text)}</div>` : ""}
      `;

      return `<div class="card-item">${window.IndexUtils.wrapLink(link, inner, "card-link")}</div>`;
    }).join("");
  }

  function renderCard4(section){
    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          <div class="card-grid-4">
            ${renderCardItems(section.items || [], section.textSize || "medium", section.textAlign || "left")}
          </div>
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }

  function renderCard3(section){
    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          <div class="card-grid-3">
            ${renderCardItems(section.items || [], section.textSize || "medium", section.textAlign || "left")}
          </div>
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }

  function renderCard2(section){
    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          <div class="card-grid-2">
            ${renderCardItems(section.items || [], section.textSize || "medium", section.textAlign || "left")}
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
          `<img src="${window.IndexUtils.escapeAttr(section.image)}" alt="${window.IndexUtils.escapeAttr(section.title || "")}" ${buildImageAttrs(section?.__imagePriority)}>`,
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
      const t = nl2brSafe(it && it.title ? it.title : "");
      const tx = nl2brSafe(it && it.text ? it.text : "");

      return `
        <div class="accordion-item" style="margin:0 0 14px 0; background:#eef1f3; border-radius:10px; overflow:hidden; border:1px solid #e0e5e9;">
          <button
            type="button"
            class="accordion-header"
            data-acc-index="${i}"
            aria-expanded="false"
            style="width:100%; border:none; background:#eef1f3; padding:18px 20px; display:flex; align-items:center; justify-content:space-between; gap:14px; cursor:pointer; text-align:left;"
            onclick="(function(btn){var body=btn.nextElementSibling;var icon=btn.querySelector('.accordion-icon');var isOpen=btn.getAttribute('aria-expanded')==='true';if(isOpen){body.hidden=true;body.style.display='none';btn.setAttribute('aria-expanded','false');if(icon){icon.textContent='＋';}}else{body.hidden=false;body.style.display='block';btn.setAttribute('aria-expanded','true');if(icon){icon.textContent='×';}}})(this)">
            <span style="display:flex; align-items:flex-start; gap:14px; min-width:0; flex:1;">
              <span style="flex:0 0 auto; font-size:18px; line-height:1; font-weight:700; color:#1f2a44;">Q</span>
              <span class="accordion-title" style="min-width:0; font-size:clamp(18px,2.4vw,22px); line-height:1.45; font-weight:700; color:#0b8da6; white-space:normal; word-break:break-word;">${t}</span>
            </span>
            <span class="accordion-icon" style="flex:0 0 auto; font-size:34px; line-height:1; color:#0b8da6; font-weight:400;">＋</span>
          </button>
          <div class="accordion-body" hidden style="display:none; padding:0 16px 16px 16px; background:#eef1f3;">
            <div style="background:#ffffff; padding:16px 18px; border-radius:0; border:none;">
              <div style="display:flex; align-items:flex-start; gap:14px;">
                <div style="flex:0 0 auto; font-size:18px; line-height:1; font-weight:700; color:#1f2a44; padding-top:2px;">A</div>
                <div class="section-text text-${window.IndexUtils.escapeAttr(section.textSize || "medium")} text-${window.IndexUtils.escapeAttr(section.textAlign || "left")}" style="margin:0; white-space:normal; word-break:break-word; line-height:1.9;">
                  ${tx}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#ffffff")}">
        <div class="section-inner">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}" style="margin-bottom:22px;">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
          <div class="accordion-list">
            ${rows}
          </div>
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }


  function renderMenuList(section){
    const groups = Array.isArray(section.menuGroups) ? section.menuGroups : [];
    const bottomCard = section.menuBottomCard || { visible:false, title:'', text:'', buttonText:'', buttonUrl:'#' };

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
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
                    <div style="min-width:0;flex:1 1 auto;">
                      <div style="font-size:clamp(18px, 1.8vw, 20px);font-weight:700;line-height:1.5;color:#2d2a26;">${window.IndexUtils.escapeHtml(item.name || '')}</div>
                      ${item.description ? `<div style="margin-top:6px;font-size:13px;line-height:1.8;color:#555;white-space:pre-line;word-break:break-word;">${window.IndexUtils.escapeHtml(item.description || '')}</div>` : ''}
                    </div>
                    <div style="flex:0 0 auto;font-size:clamp(20px, 2.2vw, 24px);font-weight:800;line-height:1.2;color:#9a6b16;white-space:nowrap;padding-left:12px;letter-spacing:0.01em;">${window.IndexUtils.escapeHtml(item.price || '')}</div>
                  </div>
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
        ${bottomCard.text ? `<div style="margin-top:8px;font-size:14px;line-height:1.9;color:#5f5b55;white-space:pre-line;word-break:break-word;">${window.IndexUtils.escapeHtml(bottomCard.text || '')}</div>` : ''}
      </div>
    ` : '';

    return `
      <section${window.IndexUtils.getSectionAnchorAttr(section)} class="section" style="background:${window.IndexUtils.escapeAttr(section.bgColor || "#f7f5f0")};padding-left:20px;padding-right:20px;">
        <div class="section-inner" style="max-width:720px;">
          <h2 class="section-title text-${window.IndexUtils.escapeAttr(section.titleAlign || "left")}">${window.IndexUtils.escapeHtml(section.title || "")}</h2>
        </div>
        <div class="section-inner" style="max-width:720px;padding-top:8px;">
          ${cardsHtml}
          ${bottomCardHtml}
          ${renderSectionBottomLinks(section)}
        </div>
      </section>
    `;
  }

  function renderSection(section, idx){
    section = window.IndexUtils.ensureSectionShape(section, idx);
    section.__imagePriority = idx === 0 ? "high" : "lazy";

    if(!section || section.enabled === false){
      return "";
    }

    switch(section.type){
      case "normal":
        return renderNormal(section);
      case "slider":
        return renderSlider(section, idx);
      case "card4":
        return renderCard4(section);
      case "card3":
        return renderCard3(section);
      case "card2":
        return renderCard2(section);
      case "card1-right":
        return renderMedia(section, false);
      case "card1-left":
        return renderMedia(section, true);
      case "accordion":
        return renderAccordion(section);
      case "menu-list":
        return renderMenuList(section);
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
