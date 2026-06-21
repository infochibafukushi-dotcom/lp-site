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
      resultNotesFont: 9,
      footerFont: 10,
      cellPadV: 4,
      cellPadH: 6,
      sectionGap: 10,
      lineHeight: 1.45,
      resultNotesLineHeight: 1.55,
      totalBoxPad: 12,
      resultNotesGap: 8,
      footerGap: 8,
      footerQrSize: 56
    };
  }

  function scaleLayout(layout, factor){
    const next = {};
    Object.keys(layout).forEach(function(key){
      next[key] = Math.max(6, Math.round(layout[key] * factor * 10) / 10);
    });
    return next;
  }

  function footerRule(layout){
    return (
      "<div style=\"text-align:center;color:#bbb;font-size:9px;letter-spacing:1px;" +
      "margin:" + layout.footerGap + "px 0;line-height:1;\">────────────────</div>"
    );
  }

  function buildQrItemHtml(dataUrl, label, layout){
    if(!dataUrl){
      return "";
    }
    return (
      "<div style=\"flex:1 1 0;min-width:0;max-width:140px;text-align:center;\">" +
      "<img src=\"" + dataUrl + "\" alt=\"\" width=\"" + layout.footerQrSize + "\" height=\"" + layout.footerQrSize + "\" " +
      "style=\"display:block;margin:0 auto;\">" +
      (label
        ? "<div style=\"margin-top:4px;font-size:" + Math.max(8, layout.footerFont - 1) + "px;line-height:1.35;\">" + escapeHtml(label) + "</div>"
        : "") +
      "</div>"
    );
  }

  function buildQrRowHtml(pdfFooter, layout, qrDataUrls){
    qrDataUrls = qrDataUrls || {};
    const homepageUrl = String(pdfFooter.homepageUrl || "").trim();
    const lineUrl = String(pdfFooter.lineUrl || "").trim();
    const homepageLabel = String(pdfFooter.homepageQrLabel || "ホームページはこちら").trim();
    const lineLabel = String(pdfFooter.lineQrLabel || "LINEで相談").trim();
    const items = [];

    if(homepageUrl && qrDataUrls.homepage){
      items.push(buildQrItemHtml(qrDataUrls.homepage, homepageLabel, layout));
    }
    if(lineUrl && qrDataUrls.line){
      items.push(buildQrItemHtml(qrDataUrls.line, lineLabel, layout));
    }
    if(!items.length){
      return "";
    }

    const justifyContent = items.length === 2 ? "space-around" : "center";
    return (
      "<div style=\"display:flex;justify-content:" + justifyContent + ";align-items:flex-start;gap:20px;" +
      "margin-top:" + layout.footerGap + "px;\">" +
      items.join("") +
      "</div>"
    );
  }

  function buildPdfFooterHtml(pdfFooter, layout, qrDataUrls){
    if(!pdfFooter || pdfFooter.enabled === false){
      return "";
    }

    const businessName = String(pdfFooter.businessName || "").trim();
    const phone = String(pdfFooter.phone || "").trim();
    const message = String(pdfFooter.message || "").trim();
    const parts = [];

    if(businessName){
      parts.push(
        "<div style=\"font-weight:700;font-size:" + (layout.footerFont + 1) + "px;\">" +
        escapeHtml(businessName) +
        "</div>"
      );
    }
    if(phone){
      parts.push("<div>TEL：" + escapeHtml(phone) + "</div>");
    }

    const qrRowHtml = buildQrRowHtml(pdfFooter, layout, qrDataUrls);
    if(qrRowHtml){
      parts.push(qrRowHtml);
    }

    if(message){
      parts.push(
        "<div style=\"margin-top:" + layout.footerGap + "px;\">" + escapeHtml(message) + "</div>"
      );
    }

    if(!parts.length){
      return "";
    }

    return (
      footerRule(layout) +
      "<div style=\"font-size:" + layout.footerFont + "px;line-height:1.55;text-align:center;color:#333;\">" +
      parts.join("") +
      "</div>" +
      footerRule(layout)
    );
  }

  function emptyQrDataUrls(){
    return { homepage: "", line: "" };
  }

  function buildHiddenCaptureContainerStyle(){
    return [
      "position:fixed",
      "left:-9999px",
      "top:0",
      "width:" + CONTENT_WIDTH_PX + "px",
      "pointer-events:none",
      "overflow:visible"
    ].join(";");
  }

  function readElementContentHeight(element){
    if(!element){
      return 0;
    }
    return Math.max(
      element.scrollHeight || 0,
      element.offsetHeight || 0,
      element.clientHeight || 0,
      element.getBoundingClientRect().height || 0
    );
  }

  function resolveFinalContentHeight(element, measuredContentHeight){
    const scrollHeight = element ? element.scrollHeight : 0;
    const offsetHeight = element ? element.offsetHeight : 0;
    const clientHeight = element ? element.clientHeight : 0;
    const rectHeight = element ? element.getBoundingClientRect().height : 0;
    let finalContentHeight = Number(measuredContentHeight) > 0
      ? Number(measuredContentHeight)
      : readElementContentHeight(element);

    if(finalContentHeight <= 0){
      finalContentHeight = readElementContentHeight(element);
    }
    if(finalContentHeight > 0){
      finalContentHeight = Math.min(finalContentHeight, CONTENT_HEIGHT_PX);
    }
    if(finalContentHeight <= 0){
      finalContentHeight = CONTENT_HEIGHT_PX;
    }

    console.log("PDF_DEBUG_HEIGHT", {
      scrollHeight: scrollHeight,
      offsetHeight: offsetHeight,
      clientHeight: clientHeight,
      rectHeight: rectHeight,
      measuredContentHeight: measuredContentHeight,
      finalContentHeight: finalContentHeight
    });

    return finalContentHeight;
  }

  function buildPdfElement(data, layout, qrDataUrls){
    layout = layout || getDefaultLayout();
    qrDataUrls = qrDataUrls || emptyQrDataUrls();
    const el = document.createElement("div");
    el.className = "estimate-pdf-source";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
      "box-sizing:border-box",
      "width:" + CONTENT_WIDTH_PX + "px",
      "padding:0",
      "font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif",
      "color:#222",
      "background:#fff"
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

    const resultNotes = String(data.resultNotes || "").trim();
    const resultNotesHtml = resultNotes
      ? (
        "<div style=\"margin:" + layout.resultNotesGap + "px 0 " + layout.footerGap + "px;font-size:" + layout.resultNotesFont + "px;" +
        "line-height:" + layout.resultNotesLineHeight + ";color:#555;white-space:pre-line;\">" +
        escapeHtml(resultNotes) +
        "</div>"
      )
      : "";

    const footerHtml = buildPdfFooterHtml(data.pdfFooter, layout, qrDataUrls);

    const bodyFont = layout.baseFont + "px";
    const tableStyle =
      "width:100%;border-collapse:collapse;margin-bottom:" + layout.sectionGap + "px;font-size:" + bodyFont + ";line-height:" + layout.lineHeight + ";";

    el.innerHTML =
      "<div style=\"box-sizing:border-box;width:100%;\">" +
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
        "<div style=\"margin:0;padding:" + layout.totalBoxPad + "px;border:2px solid #e87f00;border-radius:8px;text-align:center;\">" +
          "<div style=\"font-size:" + layout.totalLabelFont + "px;color:#666;margin-bottom:4px;line-height:1.3;\">概算合計</div>" +
          "<div style=\"font-size:" + layout.totalFont + "px;font-weight:800;color:#c62828;line-height:1.2;\">" + escapeHtml(formatYen(data.total)) + "～</div>" +
        "</div>" +
        resultNotesHtml +
        footerHtml +
      "</div>";
    return el;
  }

  function measureContentHeight(data, qrDataUrls){
    const container = document.createElement("div");
    container.style.cssText = buildHiddenCaptureContainerStyle();
    document.body.appendChild(container);

    let layout = getDefaultLayout();
    try{
      for(let i = 0; i < 24; i++){
        const probe = buildPdfElement(data, layout, qrDataUrls);
        container.appendChild(probe);
        const contentHeight = readElementContentHeight(probe);
        container.removeChild(probe);
        if(contentHeight > 0 && contentHeight <= CONTENT_HEIGHT_PX){
          return { layout: layout, contentHeight: contentHeight };
        }
        layout = scaleLayout(layout, 0.92);
      }
      const fallback = buildPdfElement(data, layout, qrDataUrls);
      container.appendChild(fallback);
      const measuredHeight = readElementContentHeight(fallback);
      const contentHeight = measuredHeight > 0
        ? Math.min(measuredHeight, CONTENT_HEIGHT_PX)
        : CONTENT_HEIGHT_PX;
      container.removeChild(fallback);
      return { layout: layout, contentHeight: contentHeight };
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

  async function resolveQrDataUrls(pdfFooter, renderSize){
    const empty = emptyQrDataUrls();
    if(!pdfFooter || pdfFooter.enabled === false){
      return empty;
    }
    if(!global.EstimateQr || typeof global.EstimateQr.toDataUrl !== "function"){
      return empty;
    }

    const homepageUrl = String(pdfFooter.homepageUrl || "").trim();
    const lineUrl = String(pdfFooter.lineUrl || "").trim();
    const generateSize = Number(renderSize) > 0 ? Number(renderSize) * 2 : 112;

    const [homepage, line] = await Promise.all([
      homepageUrl ? global.EstimateQr.toDataUrl(homepageUrl, generateSize) : "",
      lineUrl ? global.EstimateQr.toDataUrl(lineUrl, generateSize) : ""
    ]);

    return {
      homepage: homepage || "",
      line: line || ""
    };
  }

  async function savePdf(data){
    if(typeof html2pdf === "undefined"){
      throw new Error("PDF ライブラリが読み込まれていません。");
    }

    console.log("PDF_DEBUG_4 PDF DOM生成");
    const defaultLayout = getDefaultLayout();
    const qrDataUrls = await resolveQrDataUrls(data.pdfFooter, defaultLayout.footerQrSize);
    const measured = measureContentHeight(data, qrDataUrls);
    const layout = measured.layout;
    const element = buildPdfElement(data, layout, qrDataUrls);
    const container = document.createElement("div");
    container.style.cssText = buildHiddenCaptureContainerStyle();
    container.appendChild(element);
    document.body.appendChild(container);

    await waitForNextFrame();

    const contentHeight = resolveFinalContentHeight(element, measured.contentHeight);
    const filename = (data.estimateNumber || "estimate") + ".pdf";
    try{
      console.log("PDF_DEBUG_5 html2canvas開始");
      const worker = html2pdf().set({
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
          height: contentHeight
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      }).from(element);
      console.log("PDF_DEBUG_6 PDF保存開始");
      await worker.save();
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
