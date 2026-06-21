(function(global){
  const A4 = {
    widthMm: 210,
    heightMm: 297,
    marginMm: 8
  };

  function mmToPx(mm){
    return mm * 96 / 25.4;
  }

  const CONTENT_WIDTH_PX = mmToPx(A4.widthMm - A4.marginMm * 2);
  const CONTENT_HEIGHT_PX = mmToPx(A4.heightMm - A4.marginMm * 2);

  function formatYen(amount){
    const n = Number(amount) || 0;
    return "¥" + n.toLocaleString("ja-JP");
  }

  function formatDateTime(iso){
    const d = iso ? new Date(iso) : new Date();
    if(Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getDefaultLayout(){
    return {
      baseFont: 11,
      titleFont: 20,
      sectionFont: 13,
      metaFont: 10,
      totalLabelFont: 12,
      totalFont: 26,
      disclaimerFont: 9,
      cellPadV: 4,
      cellPadH: 6,
      sectionGap: 10,
      lineHeight: 1.45,
      disclaimerLineHeight: 1.5,
      totalBoxPad: 12
    };
  }

  function scaleLayout(layout, factor){
    const next = {};
    Object.keys(layout).forEach(function(key){
      next[key] = Math.max(6, Math.round(layout[key] * factor * 10) / 10);
    });
    return next;
  }

  function buildPdfElement(data, layout){
    layout = layout || getDefaultLayout();
    const el = document.createElement("div");
    el.className = "estimate-pdf-source";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
      "box-sizing:border-box",
      "width:" + CONTENT_WIDTH_PX + "px",
      "height:" + CONTENT_HEIGHT_PX + "px",
      "padding:0",
      "font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif",
      "color:#222",
      "background:#fff",
      "overflow:hidden"
    ].join(";");

    const usageRows = (data.usageSummary || []).map(function(line){
      return (
        "<tr>" +
        "<td style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;border-bottom:1px solid #eee;color:#666;width:38%;\">" +
        escapeHtml(line.label) +
        "</td>" +
        "<td style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;border-bottom:1px solid #eee;font-weight:600;\">" +
        escapeHtml(line.value) +
        "</td>" +
        "</tr>"
      );
    }).join("");

    const breakdownRows = (data.breakdownRows || []).map(function(row){
      return (
        "<tr>" +
        "<td style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;border-bottom:1px solid #eee;\">" +
        escapeHtml(row.label) +
        "</td>" +
        "<td style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;border-bottom:1px solid #eee;text-align:right;\">" +
        escapeHtml(formatYen(row.amount)) +
        "</td>" +
        "</tr>"
      );
    }).join("");

    const bodyFont = layout.baseFont + "px";
    const tableStyle =
      "width:100%;border-collapse:collapse;margin-bottom:" + layout.sectionGap + "px;font-size:" + bodyFont + ";line-height:" + layout.lineHeight + ";";

    el.innerHTML =
      "<div style=\"display:flex;flex-direction:column;box-sizing:border-box;width:100%;height:100%;\">" +
        "<div style=\"flex:0 0 auto;\">" +
          "<h1 style=\"margin:0 0 6px;font-size:" + layout.titleFont + "px;line-height:1.25;\">概算見積書</h1>" +
          "<p style=\"margin:0 0 " + layout.sectionGap + "px;font-size:" + layout.metaFont + "px;color:#666;line-height:" + layout.lineHeight + ";\">" +
            escapeHtml(data.pageTitle || "概算見積シミュレーター") +
          "</p>" +
          "<table style=\"width:100%;border-collapse:collapse;margin-bottom:" + layout.sectionGap + "px;font-size:" + layout.metaFont + "px;line-height:" + layout.lineHeight + ";\">" +
            "<tr><td style=\"padding:" + layout.cellPadV + "px 0;color:#666;width:28%;\">見積番号</td><td style=\"padding:" + layout.cellPadV + "px 0;font-weight:700;\">" + escapeHtml(data.estimateNumber || "") + "</td></tr>" +
            "<tr><td style=\"padding:" + layout.cellPadV + "px 0;color:#666;\">見積日時</td><td style=\"padding:" + layout.cellPadV + "px 0;\">" + escapeHtml(formatDateTime(data.createdAt)) + "</td></tr>" +
          "</table>" +
          "<h2 style=\"margin:0 0 4px;font-size:" + layout.sectionFont + "px;color:#9a6b16;line-height:1.3;\">ご利用内容</h2>" +
          "<table style=\"" + tableStyle + "\">" + (usageRows || "<tr><td colspan=\"2\" style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;\">—</td></tr>") + "</table>" +
          "<h2 style=\"margin:0 0 4px;font-size:" + layout.sectionFont + "px;color:#9a6b16;line-height:1.3;\">料金内訳</h2>" +
          "<table style=\"" + tableStyle + "\">" + (breakdownRows || "<tr><td colspan=\"2\" style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;\">—</td></tr>") + "</table>" +
          "<div style=\"margin:0 0 " + layout.sectionGap + "px;padding:" + layout.totalBoxPad + "px;border:2px solid #e87f00;border-radius:8px;text-align:center;\">" +
            "<div style=\"font-size:" + layout.totalLabelFont + "px;color:#666;margin-bottom:4px;line-height:1.3;\">概算合計</div>" +
            "<div style=\"font-size:" + layout.totalFont + "px;font-weight:800;color:#c62828;line-height:1.2;\">" + escapeHtml(formatYen(data.total)) + "</div>" +
          "</div>" +
        "</div>" +
        "<div style=\"flex:1 1 auto;display:flex;flex-direction:column;justify-content:flex-end;min-height:0;\">" +
          "<h2 style=\"margin:0 0 4px;font-size:" + layout.sectionFont + "px;color:#666;line-height:1.3;\">注意事項</h2>" +
          "<div style=\"font-size:" + layout.disclaimerFont + "px;line-height:" + layout.disclaimerLineHeight + ";color:#555;white-space:pre-line;\">" +
            escapeHtml(data.disclaimer || "") +
          "</div>" +
        "</div>" +
      "</div>";
    return el;
  }

  function measureLayout(data){
    const container = document.createElement("div");
    container.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "width:" + CONTENT_WIDTH_PX + "px",
      "z-index:-1",
      "opacity:0",
      "pointer-events:none",
      "overflow:visible"
    ].join(";");
    document.body.appendChild(container);

    let layout = getDefaultLayout();
    try{
      for(let i = 0; i < 24; i++){
        const probe = buildPdfElement(data, layout);
        container.appendChild(probe);
        const fits = probe.scrollHeight <= CONTENT_HEIGHT_PX && probe.offsetHeight <= CONTENT_HEIGHT_PX;
        container.removeChild(probe);
        if(fits) return layout;
        layout = scaleLayout(layout, 0.92);
      }
      return layout;
    }finally{
      container.remove();
    }
  }

  function waitForNextFrame(){
    return new Promise(function(resolve){
      requestAnimationFrame(function(){
        requestAnimationFrame(resolve);
      });
    });
  }

  async function savePdf(data){
    if(typeof html2pdf === "undefined"){
      throw new Error("PDF ライブラリが読み込まれていません。");
    }

    const layout = measureLayout(data);
    const element = buildPdfElement(data, layout);
    const container = document.createElement("div");
    container.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "width:" + CONTENT_WIDTH_PX + "px",
      "z-index:-1",
      "opacity:0",
      "pointer-events:none",
      "overflow:visible"
    ].join(";");
    container.appendChild(element);
    document.body.appendChild(container);

    await waitForNextFrame();

    const filename = (data.estimateNumber || "estimate") + ".pdf";
    try{
      await html2pdf().set({
        margin: A4.marginMm,
        filename: filename,
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: "#ffffff",
          width: CONTENT_WIDTH_PX,
          height: CONTENT_HEIGHT_PX
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      }).from(element).save();
    }finally{
      container.remove();
    }
  }

  global.EstimatePdf = {
    savePdf: savePdf,
    formatDateTime: formatDateTime,
    CONTENT_HEIGHT_PX: CONTENT_HEIGHT_PX,
    CONTENT_WIDTH_PX: CONTENT_WIDTH_PX
  };
})(typeof window !== "undefined" ? window : globalThis);
