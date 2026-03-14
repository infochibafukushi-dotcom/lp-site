(function(){
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

  function renderNormal(section){
    const imageHtml = section.image
      ? `<img class="normal-image" src="${window.IndexUtils.escapeAttr(section.image)}" alt="${window.IndexUtils.escapeAttr(section.title || "")}">`
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
    const images = Array.isArray(section.images) ? section.images : [];
    const slides = images.length
      ? images.map((src) => {
          const image = `<img src="${window.IndexUtils.escapeAttr(src)}" alt="${window.IndexUtils.escapeAttr(section.title || "")}">`;
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
        ${image ? `<img src="${window.IndexUtils.escapeAttr(image)}" alt="${window.IndexUtils.escapeAttr(title)}">` : ""}
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
          `<img src="${window.IndexUtils.escapeAttr(section.image)}" alt="${window.IndexUtils.escapeAttr(section.title || "")}">`,
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

  function renderSection(section, idx){
    section = window.IndexUtils.ensureSectionShape(section, idx);

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
