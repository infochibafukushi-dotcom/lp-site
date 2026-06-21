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
      footerQrSize: 72
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

  function buildPdfFooterHtml(pdfFooter, layout, qrDataUrl){
    if(!pdfFooter || pdfFooter.enabled === false){
      return "";
    }

    const businessName = String(pdfFooter.businessName || "").trim();
    const phone = String(pdfFooter.phone || "").trim();
    const homepageUrl = String(pdfFooter.homepageUrl || "").trim();
    const lineUrl = String(pdfFooter.lineUrl || "").trim();
    const message = String(pdfFooter.message || "").trim();
    const qrLabel = String(pdfFooter.qrCodeLabel || "").trim();
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
    if(homepageUrl && !qrDataUrl){
      parts.push("<div style=\"margin-top:4px;\">ホームページ</div>");
      parts.push("<div style=\"word-break:break-all;\">" + escapeHtml(homepageUrl) + "</div>");
    }
    if(lineUrl){
      parts.push("<div style=\"margin-top:4px;\">LINE相談</div>");
      parts.push("<div style=\"word-break:break-all;\">" + escapeHtml(lineUrl) + "</div>");
    }
    if(qrDataUrl){
      parts.push(
        "<div style=\"margin-top:" + layout.footerGap + "px;\">" +
        "<img src=\"" + qrDataUrl + "\" alt=\"\" width=\"" + layout.footerQrSize + "\" height=\"" + layout.footerQrSize + "\" " +
        "style=\"display:block;margin:0 auto;\">" +
        "</div>"
      );
      if(qrLabel){
        parts.push("<div style=\"margin-top:4px;\">" + escapeHtml(qrLabel) + "</div>");
      }
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

  function buildPdfElement(data, layout, qrDataUrl){
    layout = layout || getDefaultLayout();
    qrDataUrl = qrDataUrl || "";
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

    const footerHtml = buildPdfFooterHtml(data.pdfFooter, layout, qrDataUrl);

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

  function measureContentHeight(data, qrDataUrl){
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
        const probe = buildPdfElement(data, layout, qrDataUrl);
        container.appendChild(probe);
        const contentHeight = probe.scrollHeight;
        container.removeChild(probe);
        if(contentHeight <= CONTENT_HEIGHT_PX){
          return { layout: layout, contentHeight: contentHeight };
        }
        layout = scaleLayout(layout, 0.92);
      }
      const fallback = buildPdfElement(data, layout, qrDataUrl);
      container.appendChild(fallback);
      const contentHeight = Math.min(fallback.scrollHeight, CONTENT_HEIGHT_PX);
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

  async function resolveQrDataUrl(pdfFooter, size){
    if(!pdfFooter || pdfFooter.enabled === false){
      return "";
    }
    const qrUrl = String(pdfFooter.qrCodeUrl || "").trim();
    if(!qrUrl || !global.EstimateQr || typeof global.EstimateQr.toDataUrl !== "function"){
      return "";
    }
    return global.EstimateQr.toDataUrl(qrUrl, size);
  }

  async function savePdf(data){
    if(typeof html2pdf === "undefined"){
      throw new Error("PDF ライブラリが読み込まれていません。");
    }

    console.log("PDF_DEBUG_4 PDF DOM生成");
    const defaultLayout = getDefaultLayout();
    const qrDataUrl = await resolveQrDataUrl(data.pdfFooter, defaultLayout.footerQrSize * 2);
    const measured = measureContentHeight(data, qrDataUrl);
    const layout = measured.layout;
    const element = buildPdfElement(data, layout, qrDataUrl);
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

    const contentHeight = Math.max(1, Math.min(element.scrollHeight, CONTENT_HEIGHT_PX));
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
          height: contentHeight,
          windowWidth: CONTENT_WIDTH_PX,
          windowHeight: contentHeight
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
