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

  function buildAnchor(url, text, escapeAttr, escapeHtml){
    const href = String(url || "#").trim() || "#";
    const isExternal =
      /^https?:\/\//i.test(href) ||
      /^mailto:/i.test(href) ||
      /^tel:/i.test(href);

    const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";

    return `<a class="section-bottom-link" href="${escapeAttr(href)}"${extra}>${escapeHtml(text)}</a>`;
  }

  function render(section, escapeAttr, escapeHtml){
    const links = normalizeLinks(section);
    if(links.length === 0){
      return "";
    }

    const alignClass = getAlignClass(section);

    return `
      <div class="section-bottom-links ${escapeAttr(alignClass)}">
        ${links.map((link) => buildAnchor(link.url, link.text, escapeAttr, escapeHtml)).join("")}
      </div>
    `;
  }

  window.SectionBottomButtons = {
    render: render
  };
})();
