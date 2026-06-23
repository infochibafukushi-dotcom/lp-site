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
      sectionFont: 13.5,
      metaFont: 10.5,
      totalLabelFont: 12,
      totalFont: 26,
      resultNotesFont: 9,
      footerFont: 10.5,
      footerBusinessFont: 13,
      footerPhoneFont: 11.5,
      cellPadV: 4,
      cellPadH: 6,
      breakdownFont: 11,
      breakdownCellPadV: 4,
      breakdownLineHeight: 1.4,
      breakdownLabelPadRight: 12,
      breakdownTableWidth: 100,
      sectionGap: 6,
      lineHeight: 1.38,
      resultNotesLineHeight: 1.42,
      totalBlockPadV: 4,
      totalTopGap: 8,
      resultNotesGap: 4,
      footerGap: 4,
      footerQrSize: 46,
      qrRowGap: 24,
      qrLabelGap: 3,
      titleGap: 4,
      headingGap: 3,
      footerTopGap: 10,
      pagePadTop: 2,
      pagePadBottom: 0,
      fillPage: false
    };
  }

  function cloneLayout(layout){
    return Object.assign({}, layout);
  }

  function countBreakdownRows(data){
    if(Array.isArray(data.fareSections) && data.fareSections.length){
      return data.fareSections.reduce(function(total, section){
        const rows = Array.isArray(section?.rows) ? section.rows.length : 0;
        return total + Math.max(rows, 1);
      }, 0);
    }
    return (data.breakdownRows || []).filter(function(row){
      return (Number(row.amount) || 0) > 0 || String(row.label || "").trim();
    }).length;
  }

  function tuneLayoutForContent(data, layout){
    const next = cloneLayout(layout);
    const breakdownCount = countBreakdownRows(data);
    const usageCount = (data.usageSummary || []).length;
    const hasNotes = Boolean(String(data.resultNotes || "").trim());
    const hasFooter = !data.pdfFooter || data.pdfFooter.enabled !== false;

    next.breakdownTableWidth = 100;

    if(breakdownCount <= 3){
      next.breakdownFont = 12.5;
      next.breakdownCellPadV = 7;
      next.breakdownLineHeight = 1.5;
      next.sectionGap = 7;
      next.totalTopGap = 10;
      next.totalFont = 27;
    }else if(breakdownCount <= 5){
      next.breakdownFont = 11.5;
      next.breakdownCellPadV = 5;
      next.breakdownLineHeight = 1.42;
      next.totalFont = 26;
    }else if(breakdownCount <= 7){
      next.breakdownFont = 10.5;
      next.breakdownCellPadV = 3;
      next.breakdownLineHeight = 1.35;
      next.sectionGap = 5;
      next.totalFont = 24;
    }else{
      next.breakdownFont = 9.5;
      next.breakdownCellPadV = 2;
      next.breakdownLineHeight = 1.28;
      next.sectionGap = 4;
      next.baseFont = 10;
      next.sectionFont = 12.5;
      next.totalFont = 22;
      next.footerQrSize = 40;
    }

    if(usageCount >= 7){
      next.cellPadV = Math.max(2, next.cellPadV - 1);
      next.sectionGap = Math.max(4, next.sectionGap - 1);
    }

    if(hasNotes && breakdownCount >= 6){
      next.resultNotesFont = 8.5;
      next.resultNotesLineHeight = 1.35;
    }

    if(hasFooter && breakdownCount <= 4 && usageCount <= 6){
      next.footerQrSize = 48;
      next.footerBusinessFont = 14;
      next.fillPage = true;
    }

    return next;
  }

  function scaleLayout(layout, factor){
    const next = {};
    Object.keys(layout).forEach(function(key){
      if(key === "fillPage"){
        next[key] = layout[key];
        return;
      }
      let min = 6;
      if(key === "breakdownLabelPadRight"){
        min = 6;
      }else if(key === "breakdownTableWidth"){
        min = 88;
      }else if(key === "footerQrSize"){
        min = 36;
      }else if(key === "breakdownFont" || key === "baseFont"){
        min = 9;
      }
      next[key] = Math.max(min, Math.round(layout[key] * factor * 10) / 10);
    });
    return next;
  }

  function expandLayout(layout, factor){
    const next = {};
    Object.keys(layout).forEach(function(key){
      if(key === "fillPage"){
        next[key] = layout[key];
        return;
      }
      next[key] = Math.round(layout[key] * factor * 10) / 10;
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
      "<div style=\"flex:0 0 auto;text-align:center;\">" +
      "<img src=\"" + dataUrl + "\" alt=\"\" width=\"" + layout.footerQrSize + "\" height=\"" + layout.footerQrSize + "\" " +
      "style=\"display:block;margin:0 auto;\">" +
      (label
        ? "<div style=\"margin-top:" + layout.qrLabelGap + "px;font-size:8px;line-height:1.2;color:#666;\">" + escapeHtml(label) + "</div>"
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

    return (
      "<div style=\"display:flex;justify-content:center;align-items:flex-start;gap:" + layout.qrRowGap + "px;" +
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
        "<div style=\"font-weight:700;font-size:" + layout.footerBusinessFont + "px;line-height:1.3;letter-spacing:.02em;\">" +
        escapeHtml(businessName) +
        "</div>"
      );
    }
    if(phone){
      parts.push(
        "<div style=\"font-size:" + layout.footerPhoneFont + "px;line-height:1.3;font-weight:600;margin-top:2px;\">" +
        "TEL：" + escapeHtml(phone) +
        "</div>"
      );
    }

    const qrRowHtml = buildQrRowHtml(pdfFooter, layout, qrDataUrls);
    if(qrRowHtml){
      parts.push(qrRowHtml);
    }

    if(message){
      parts.push(
        "<div style=\"margin-top:" + (layout.footerGap + 1) + "px;font-size:" + Math.max(8.5, layout.footerFont - 1) + "px;line-height:1.35;color:#555;\">" +
        escapeHtml(message) +
        "</div>"
      );
    }

    if(!parts.length){
      return "";
    }

    return (
      footerRule(layout) +
      "<div style=\"font-size:" + layout.footerFont + "px;line-height:1.4;text-align:center;color:#333;\">" +
      parts.join("") +
      "</div>"
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

    const fareSections = Array.isArray(data.fareSections) ? data.fareSections : [];
    const breakdownRows = (data.breakdownRows || []).map(function(row){
      return (
        "<tr>" +
        "<td style=\"padding:" + layout.breakdownCellPadV + "px " + layout.breakdownLabelPadRight + "px " + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;\">" +
        escapeHtml(row.label) +
        "</td>" +
        "<td class=\"estimate-pdf-amount\" style=\"padding:" + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;text-align:left;white-space:nowrap;font-weight:600;\">" +
        escapeHtml(formatYen(row.amount)) +
        "</td>" +
        "</tr>"
      );
    }).join("");
    const fareSectionRows = fareSections.map(function(section){
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      const titleRow =
        "<tr>" +
          "<td colspan=\"2\" style=\"padding:" + (layout.breakdownCellPadV + 1) + "px 0 6px;font-weight:700;color:#9a6b16;\">" +
            escapeHtml(section?.title || "") +
          "</td>" +
        "</tr>";
      const contentRows = rows.length
        ? rows.map(function(row){
          if(row.note){
            return (
              "<tr>" +
                "<td style=\"padding:" + layout.breakdownCellPadV + "px " + layout.breakdownLabelPadRight + "px " + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;\">" +
                  escapeHtml(row.label) +
                "</td>" +
                "<td style=\"padding:" + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;text-align:left;line-height:1.45;\">" +
                  escapeHtml(row.note) +
                "</td>" +
              "</tr>"
            );
          }
          return (
            "<tr>" +
              "<td style=\"padding:" + layout.breakdownCellPadV + "px " + layout.breakdownLabelPadRight + "px " + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;\">" +
                escapeHtml(row.label) +
              "</td>" +
              "<td class=\"estimate-pdf-amount\" style=\"padding:" + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;text-align:left;white-space:nowrap;font-weight:600;\">" +
                escapeHtml(formatYen(row.amount)) +
              "</td>" +
            "</tr>"
          );
        }).join("")
        : (
          "<tr>" +
            "<td style=\"padding:" + layout.breakdownCellPadV + "px " + layout.breakdownLabelPadRight + "px " + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;color:#666;\">該当なし</td>" +
            "<td style=\"padding:" + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;color:#666;\">-</td>" +
          "</tr>"
        );
      return titleRow + contentRows;
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
    const breakdownFont = layout.breakdownFont + "px";
    const tableStyle =
      "width:100%;border-collapse:collapse;margin-bottom:" + layout.sectionGap + "px;font-size:" + bodyFont + ";line-height:" + layout.lineHeight + ";";
    const breakdownTableStyle =
      "width:" + layout.breakdownTableWidth + "%;border-collapse:collapse;margin-bottom:" + layout.totalTopGap + "px;font-size:" + breakdownFont +
      ";line-height:" + layout.breakdownLineHeight + ";table-layout:fixed;";

    const totalHtml =
      footerRule(layout) +
      "<div class=\"estimate-pdf-total\" style=\"text-align:center;padding:" + layout.totalBlockPadV + "px 0 " + (layout.totalBlockPadV + 1) + "px;\">" +
        "<div style=\"font-size:" + layout.totalLabelFont + "px;color:#666;line-height:1.2;margin-bottom:2px;letter-spacing:.04em;\">合計目安</div>" +
        "<div style=\"font-size:" + layout.totalFont + "px;font-weight:800;color:#c62828;line-height:1.1;letter-spacing:.01em;\">" + escapeHtml(formatYen(data.total)) + "～</div>" +
      "</div>" +
      footerRule(layout);

    const pageShellStyle = layout.fillPage
      ? "box-sizing:border-box;display:flex;flex-direction:column;min-height:" + CONTENT_HEIGHT_PX + "px;width:100%;padding-top:" + layout.pagePadTop + "px;padding-bottom:" + layout.pagePadBottom + "px;"
      : "box-sizing:border-box;width:100%;padding-top:" + layout.pagePadTop + "px;padding-bottom:" + layout.pagePadBottom + "px;";

    const mainContentHtml =
        "<h1 style=\"margin:0 0 " + layout.titleGap + "px;font-size:" + layout.titleFont + "px;line-height:1.18;letter-spacing:.02em;\">概算見積書</h1>" +
        "<p style=\"margin:0 0 " + layout.sectionGap + "px;font-size:" + layout.metaFont + "px;color:#666;line-height:" + layout.lineHeight + ";\">" +
          escapeHtml(data.pageTitle || "概算見積シミュレーター") +
        "</p>" +
        "<table style=\"width:100%;border-collapse:collapse;margin-bottom:" + layout.sectionGap + "px;font-size:" + layout.metaFont + "px;line-height:" + layout.lineHeight + ";\">" +
          "<tr><td style=\"padding:" + layout.cellPadV + "px 0;color:#666;width:26%;\">見積番号</td><td style=\"padding:" + layout.cellPadV + "px 0;font-weight:700;\">" + escapeHtml(data.estimateNumber || "") + "</td></tr>" +
          "<tr><td style=\"padding:" + layout.cellPadV + "px 0;color:#666;\">見積日時</td><td style=\"padding:" + layout.cellPadV + "px 0;\">" + escapeHtml(formatDateTime(data.createdAt)) + "</td></tr>" +
        "</table>" +
        "<h2 style=\"margin:0 0 " + layout.headingGap + "px;font-size:" + layout.sectionFont + "px;color:#9a6b16;line-height:1.22;\">ご利用内容</h2>" +
        "<table style=\"" + tableStyle + "\">" + (usageRows || "<tr><td colspan=\"2\" style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;\">—</td></tr>") + "</table>" +
        "<div class=\"estimate-pdf-breakdown-section\">" +
          "<h2 style=\"margin:0 0 " + layout.headingGap + "px;font-size:" + layout.sectionFont + "px;color:#9a6b16;line-height:1.22;\">料金内訳</h2>" +
          "<table class=\"estimate-pdf-breakdown\" style=\"" + breakdownTableStyle + "\">" +
            "<colgroup><col style=\"width:54%;\"><col style=\"width:46%;\"></colgroup>" +
            (fareSectionRows || breakdownRows || "<tr><td colspan=\"2\" style=\"padding:" + layout.breakdownCellPadV + "px " + layout.cellPadH + "px;\">—</td></tr>") +
          "</table>" +
        "</div>" +
        "<div class=\"estimate-pdf-total-section\">" + totalHtml + "</div>" +
        resultNotesHtml;

    const footerBlockHtml = footerHtml
      ? "<div class=\"estimate-pdf-footer-section\" style=\"" + (layout.fillPage ? "margin-top:auto;padding-top:" : "margin-top:") + layout.footerTopGap + "px;\">" + footerHtml + "</div>"
      : "";

    el.innerHTML =
      "<div style=\"" + pageShellStyle + "\">" +
        "<div style=\"flex:0 0 auto;\">" + mainContentHtml + "</div>" +
        footerBlockHtml +
      "</div>";
    return el;
  }

  function measureContentHeight(data, qrDataUrls){
    const container = document.createElement("div");
    container.style.cssText = buildHiddenCaptureContainerStyle();
    document.body.appendChild(container);

    let layout = tuneLayoutForContent(data, getDefaultLayout());
    let contentHeight = 0;
    try{
      for(let i = 0; i < 24; i++){
        const probe = buildPdfElement(data, layout, qrDataUrls);
        container.appendChild(probe);
        contentHeight = readElementContentHeight(probe);
        container.removeChild(probe);
        if(contentHeight > 0 && contentHeight <= CONTENT_HEIGHT_PX){
          break;
        }
        layout = scaleLayout(layout, 0.94);
      }

      if(contentHeight > 0 && contentHeight <= CONTENT_HEIGHT_PX * 0.78 && layout.fillPage){
        for(let j = 0; j < 10; j++){
          const expanded = expandLayout(layout, 1.03);
          const probe = buildPdfElement(data, expanded, qrDataUrls);
          container.appendChild(probe);
          const expandedHeight = readElementContentHeight(probe);
          container.removeChild(probe);
          if(expandedHeight > 0 && expandedHeight <= CONTENT_HEIGHT_PX){
            layout = expanded;
            contentHeight = expandedHeight;
          }else{
            break;
          }
        }
      }

      if(contentHeight <= 0 || contentHeight > CONTENT_HEIGHT_PX){
        const fallback = buildPdfElement(data, layout, qrDataUrls);
        container.appendChild(fallback);
        const measuredHeight = readElementContentHeight(fallback);
        contentHeight = measuredHeight > 0
          ? Math.min(measuredHeight, CONTENT_HEIGHT_PX)
          : CONTENT_HEIGHT_PX;
        container.removeChild(fallback);
      }

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

  async function buildPreviewElement(data){
    const tuned = tuneLayoutForContent(data, getDefaultLayout());
    const qrDataUrls = await resolveQrDataUrls(data.pdfFooter, tuned.footerQrSize);
    const measured = measureContentHeight(data, qrDataUrls);
    return buildPdfElement(data, measured.layout, qrDataUrls);
  }

  async function savePdf(data){
    if(typeof html2pdf === "undefined"){
      throw new Error("PDF ライブラリが読み込まれていません。");
    }

    console.log("PDF_DEBUG_4 PDF DOM生成");
    const tuned = tuneLayoutForContent(data, getDefaultLayout());
    const qrDataUrls = await resolveQrDataUrls(data.pdfFooter, tuned.footerQrSize);
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
          backgroundColor: "#ffffff"
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
    buildPreviewElement: buildPreviewElement,
    formatDateTime: formatDateTime,
    CONTENT_HEIGHT_PX: CONTENT_HEIGHT_PX,
    CONTENT_WIDTH_PX: CONTENT_WIDTH_PX
  };
})(typeof window !== "undefined" ? window : globalThis);
