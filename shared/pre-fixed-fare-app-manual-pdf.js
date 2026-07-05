(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-app-operation-manual.pdf";
  const EXPECTED_PAGE_COUNT = 16;
  const SCOPE = ".pre-fixed-fare-app-manual";

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escapeHtmlWithBreaks(text){
    return escapeHtml(text).replaceAll("\n", "<br>");
  }

  function buildTable(headers, rows, options){
    options = options || {};
    const className = String(options.className || "").trim();
    const colWidths = Array.isArray(options.colWidths) ? options.colWidths : [];
    const th = headers.map(function(item){
      return "<th>" + escapeHtml(item) + "</th>";
    }).join("");
    const colgroup = colWidths.length
      ? "<colgroup>" + colWidths.map(function(width){
        return "<col style='width:" + escapeHtml(width) + ";'>";
      }).join("") + "</colgroup>"
      : "";
    const body = (rows || []).map(function(row){
      const cells = row.map(function(cell){
        return "<td>" + escapeHtml(cell) + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("");
    return (
      "<div class='table-wrap'>" +
      "<table" + (className ? " class='" + escapeHtml(className) + "'" : "") + ">" +
      colgroup +
      "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table>" +
      "</div>"
    );
  }

  function manualPage(pageId, bodyHtml){
    return (
      "<section class='manual-page' data-page-id='" + escapeHtml(pageId) + "'>" +
      bodyHtml +
      "</section>"
    );
  }

  function buildHighlightList(items){
    const list = Array.isArray(items) ? items : [];
    if(!list.length){
      return "";
    }
    return (
      "<div class='highlight-box'>" +
      "<p class='highlight-title'>重点表示</p>" +
      "<ul class='highlight-list'>" +
      list.map(function(item){
        return "<li>" + escapeHtml(item) + "</li>";
      }).join("") +
      "</ul></div>"
    );
  }

  function buildCalloutList(callouts){
    const list = Array.isArray(callouts) ? callouts : [];
    if(!list.length){
      return "";
    }
    return (
      "<ol class='callout-list'>" +
      list.map(function(item){
        const num = Number(item.number) || 0;
        const circle = ["①", "②", "③", "④", "⑤"][num - 1] || String(num);
        return (
          "<li><span class='callout-marker'>" + escapeHtml(circle) + "</span>" +
          escapeHtml(item.text || "") +
          "</li>"
        );
      }).join("") +
      "</ol>"
    );
  }

  function buildMissingScreenshotBlock(screenshot){
    const label = screenshot?.placeholderLabel || screenshot?.imageFile || "スクリーンショット";
    return (
      "<div class='manual-shot manual-shot--placeholder'>" +
      "<p class='manual-shot-placeholder-label'>【スクリーンショット差し替え予定】</p>" +
      "<p class='manual-shot-placeholder-text'>" + escapeHtml(label) + "</p>" +
      (screenshot?.imageFile
        ? "<p class='manual-shot-placeholder-path'>" + escapeHtml(screenshot.imageFile) + "</p>"
        : "") +
      "</div>"
    );
  }

  function buildAnnotationOverlays(annotations){
    const list = Array.isArray(annotations) ? annotations : [];
    if(!list.length){
      return "";
    }
    return list.map(function(item){
      const no = Number(item.no) || 0;
      const circle = ["①", "②", "③", "④", "⑤"][no - 1] || String(no);
      return (
        "<div class='manual-annotation' style='" +
        "left:" + escapeHtml(String(item.x ?? 0)) + "%;" +
        "top:" + escapeHtml(String(item.y ?? 0)) + "%;" +
        "width:" + escapeHtml(String(item.w ?? 0)) + "%;" +
        "height:" + escapeHtml(String(item.h ?? 0)) + "%;" +
        "'>" +
        "<span class='manual-annotation-marker'>" + escapeHtml(circle) + "</span>" +
        (item.text ? "<span class='manual-annotation-label'>" + escapeHtml(item.text) + "</span>" : "") +
        "</div>"
      );
    }).join("");
  }

  function buildScreenshotBlock(screenshot, imageAvailable){
    if(!screenshot){
      return "";
    }
    const shotInner = imageAvailable
      ? (
        "<div class='manual-shot manual-shot--image manual-shot--annotated'>" +
        "<img src='" + escapeHtml(screenshot.imageSrc) + "' alt='" + escapeHtml(screenshot.placeholderLabel || "") + "' loading='eager'>" +
        buildAnnotationOverlays(screenshot.annotations) +
        "</div>"
      )
      : buildMissingScreenshotBlock(screenshot);

    return (
      "<div class='manual-shot-wrap'>" +
      shotInner +
      buildCalloutList(screenshot.callouts) +
      "</div>"
    );
  }

  function buildCoverPage(data, qrDataUrls){
    const cover = data.cover || {};
    const company = cover.company || {};
    const qrItems = Array.isArray(data.qrItems) ? data.qrItems : [];
    const qrBlocks = qrItems.map(function(item, index){
      const dataUrl = qrDataUrls[item.id] || "";
      const resolvedUrl = global.PreFixedFareAppManualData
        ? global.PreFixedFareAppManualData.resolveManualUrl(item.urlKey)
        : (item.url || "");
      return (
        "<div class='cover-qr-item'>" +
        "<p class='cover-qr-label'>" + escapeHtml(item.label || ("QR" + (index + 1))) + "</p>" +
        "<p class='cover-qr-title'>" + escapeHtml(item.title || "") + "</p>" +
        (dataUrl
          ? "<img class='cover-qr-image' src='" + escapeHtml(dataUrl) + "' alt='" + escapeHtml(item.title || "") + "'>"
          : "<div class='cover-qr-image cover-qr-image--missing'>QR生成不可</div>") +
        "<p class='cover-qr-url'>" + escapeHtml(resolvedUrl) + "</p>" +
        "<p class='cover-qr-desc'>" + escapeHtml(item.description || "") + "</p>" +
        "</div>"
      );
    }).join("");

    return manualPage("cover", (
      "<div class='cover-header'>" +
      "<h1 class='cover-title-main'>" + escapeHtml(cover.titleLine1 || "") + "</h1>" +
      "<h2 class='cover-title-sub'>" + escapeHtml(cover.titleLine2 || "") + "</h2>" +
      "<p class='cover-subtitle'>" + escapeHtml(cover.subtitle || "") + "</p>" +
      "<p class='cover-company'>" + escapeHtml(company.name || "") + "<br>" + escapeHtml(company.brand || "") + "</p>" +
      "</div>" +
      "<div class='cover-qr-grid'>" + qrBlocks + "</div>" +
      buildTable(
        ["項目", "内容"],
        [
          ["作成日", data.meta?.createdAt || ""],
          ["作成元", data.meta?.createdBy || ""],
          ["資料区分", data.meta?.documentType || ""]
        ],
        { className: "table-meta", colWidths: ["28%", "72%"] }
      )
    ));
  }

  function buildPurposePage(data){
    const purpose = data.purpose || {};
    const paragraphs = Array.isArray(purpose.paragraphs) ? purpose.paragraphs : [];
    return manualPage("purpose", (
      "<h2 class='page-title'>本資料の目的</h2>" +
      paragraphs.map(function(text){
        return "<p>" + escapeHtml(text) + "</p>";
      }).join("") +
      "<p class='verification-note'>" + escapeHtml(purpose.demoNote || "") + "</p>"
    ));
  }

  function buildFlowPage(data){
    const flow = Array.isArray(data.overallFlow) ? data.overallFlow : [];
    const cards = flow.map(function(text, index){
      return (
        "<div class='flow-card'>" +
        "<span class='flow-card-no'>" + escapeHtml(String(index + 1)) + "</span>" +
        "<span class='flow-card-text'>" + escapeHtml(text) + "</span>" +
        "</div>"
      );
    }).join("");

    return manualPage("overall-flow", (
      "<h2 class='page-title'>全体フロー</h2>" +
      "<p class='page-lead'>かんたん見積から予約、運行、精算までの一連の操作手順です。</p>" +
      "<div class='flow-grid'>" + cards + "</div>"
    ));
  }

  function buildStepPage(step, imageAvailability){
    const screenshot = step.screenshot || null;
    const imageAvailable = screenshot ? !!imageAvailability[screenshot.imageSrc] : false;
    return manualPage(step.pageId || "step", (
      "<p class='step-label'>" + escapeHtml(step.stepLabel || "") + "</p>" +
      "<h2 class='page-title'>" + escapeHtml(step.title || "") + "</h2>" +
      "<p>" + escapeHtml(step.description || "") + "</p>" +
      buildHighlightList(step.highlights) +
      buildScreenshotBlock(screenshot, imageAvailable)
    ));
  }

  function buildContentPage(page, imageAvailability){
    const screenshot = page.screenshot || null;
    const imageAvailable = screenshot ? !!imageAvailability[screenshot.imageSrc] : false;
    const tableHtml = page.table
      ? buildTable(page.table.headers || [], page.table.rows || [], {
        className: "table-content",
        colWidths: page.table.colWidths || ["28%", "72%"]
      })
      : "";
    return manualPage(page.pageId || "content", (
      "<h2 class='page-title'>" + escapeHtml(page.title || "") + "</h2>" +
      "<p>" + escapeHtmlWithBreaks(page.description || "") + "</p>" +
      buildHighlightList(page.highlights) +
      tableHtml +
      buildScreenshotBlock(screenshot, imageAvailable)
    ));
  }

  function buildChecklistPage(data){
    const table = data.checklistTable || {};
    return manualPage("checklist", (
      "<h2 class='page-title'>認可説明チェックリスト</h2>" +
      "<p class='page-lead'>事前確定運賃の認可説明に必要な確認ポイントと対応画面の一覧です。</p>" +
      buildTable(
        table.headers || ["確認項目", "対応画面"],
        table.rows || [],
        { className: "table-checklist", colWidths: ["62%", "38%"] }
      )
    ));
  }

  function collectScreenshots(data){
    const list = [];
    (data.steps || []).forEach(function(step){
      if(step.screenshot && step.screenshot.imageSrc){
        list.push(step.screenshot);
      }
    });
    (data.contentPages || []).forEach(function(page){
      if(page.screenshot && page.screenshot.imageSrc){
        list.push(page.screenshot);
      }
    });
    return list;
  }

  function buildReportHtml(data, options){
    options = options || {};
    const imageAvailability = options.imageAvailability || {};
    const qrDataUrls = options.qrDataUrls || {};
    const pages = [
      buildCoverPage(data, qrDataUrls),
      buildPurposePage(data),
      buildFlowPage(data)
    ];
    (data.steps || []).forEach(function(step){
      pages.push(buildStepPage(step, imageAvailability));
    });
    (data.contentPages || []).forEach(function(page){
      pages.push(buildContentPage(page, imageAvailability));
    });
    pages.push(buildChecklistPage(data));

    return (
      "<div class='pre-fixed-fare-app-manual'>" +
      pages.join("") +
      "</div>"
    );
  }

  function probeImage(src){
    return new Promise(function(resolve){
      const img = new Image();
      img.onload = function(){ resolve(true); };
      img.onerror = function(){ resolve(false); };
      img.src = String(src || "") + "?" + Date.now();
    });
  }

  async function probeImages(screenshots){
    const availability = {};
    const list = Array.isArray(screenshots) ? screenshots : [];
    await Promise.all(list.map(async function(screen){
      if(screen.placeholderOnly){
        availability[screen.imageSrc] = false;
        return;
      }
      availability[screen.imageSrc] = await probeImage(screen.imageSrc);
    }));
    return availability;
  }

  async function buildQrDataUrls(data){
    const qrItems = Array.isArray(data.qrItems) ? data.qrItems : [];
    const result = {};
    await Promise.all(qrItems.map(async function(item){
      const url = global.PreFixedFareAppManualData
        ? global.PreFixedFareAppManualData.resolveManualUrl(item.urlKey)
        : (item.url || "");
      if(global.EstimateQr && typeof global.EstimateQr.toDataUrl === "function"){
        result[item.id] = await global.EstimateQr.toDataUrl(url, 120);
      }else{
        result[item.id] = "";
      }
    }));
    return result;
  }

  function waitForImagesToLoad(container){
    const images = Array.from(container.querySelectorAll(".manual-shot img, .cover-qr-image"));
    if(!images.length){
      return Promise.resolve();
    }
    return Promise.all(images.map(function(img){
      if(img.complete && img.naturalWidth > 0){
        return Promise.resolve();
      }
      return new Promise(function(resolve){
        img.addEventListener("load", function(){ resolve(); }, { once: true });
        img.addEventListener("error", function(){ resolve(); }, { once: true });
      });
    }));
  }

  function getManualCss(){
    const base = global.PreFixedFarePrintLayoutCss
      ? global.PreFixedFarePrintLayoutCss.getBasePageRules()
      : "@page{size:A4 portrait;margin:8mm;}";
    const core = global.PreFixedFarePrintLayoutCss
      ? global.PreFixedFarePrintLayoutCss.getCorePrintCss(SCOPE)
      : "";
    return (
      base +
      core +
      SCOPE + " .manual-page{width:auto;min-height:auto;padding:0;box-sizing:border-box;}" +
      SCOPE + " .manual-page + .manual-page{page-break-before:always;break-before:page;}" +
      SCOPE + " .cover-header{text-align:center;margin:0 0 6mm;}" +
      SCOPE + " .cover-title-main{font-size:20pt;font-weight:700;margin:0 0 2mm;color:#1b3a6b;}" +
      SCOPE + " .cover-title-sub{font-size:16pt;font-weight:700;margin:0 0 4mm;color:#1b3a6b;line-height:1.35;}" +
      SCOPE + " .cover-subtitle{font-size:11pt;font-weight:700;margin:0 0 4mm;color:#334155;}" +
      SCOPE + " .cover-company{font-size:10.5pt;margin:0 0 6mm;color:#111827;}" +
      SCOPE + " .cover-qr-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:0 0 5mm;}" +
      SCOPE + " .cover-qr-item{border:1px solid #cbd5e1;padding:3mm;text-align:center;background:#f8fafc;}" +
      SCOPE + " .cover-qr-label{font-size:9pt;font-weight:700;margin:0 0 1mm;color:#1b3a6b;}" +
      SCOPE + " .cover-qr-title{font-size:10pt;font-weight:700;margin:0 0 2mm;color:#111827;}" +
      SCOPE + " .cover-qr-image{display:block;width:28mm;height:28mm;margin:0 auto 2mm;object-fit:contain;}" +
      SCOPE + " .cover-qr-image--missing{display:flex;align-items:center;justify-content:center;border:1px dashed #94a3b8;font-size:8pt;color:#64748b;background:#fff;}" +
      SCOPE + " .cover-qr-url{font-size:7.5pt;color:#64748b;margin:0 0 2mm;word-break:break-all;}" +
      SCOPE + " .cover-qr-desc{font-size:8.5pt;line-height:1.45;margin:0;color:#334155;text-align:left;}" +
      SCOPE + " .page-title{font-size:16pt;font-weight:700;margin:0 0 4mm;color:#1b3a6b;border-bottom:2px solid #1b3a6b;padding-bottom:2mm;}" +
      SCOPE + " .page-lead{margin:0 0 4mm;color:#334155;}" +
      SCOPE + " .step-label{font-size:10pt;font-weight:700;color:#c41e3a;margin:0 0 2mm;}" +
      SCOPE + " .highlight-box{margin:4mm 0;padding:3mm;background:#fff7ed;border-left:4px solid #c46a00;}" +
      SCOPE + " .highlight-title{font-size:9pt;font-weight:700;margin:0 0 2mm;color:#9a3412;}" +
      SCOPE + " .highlight-list{margin:0;padding-left:5mm;}" +
      SCOPE + " .highlight-list li{margin:0 0 1mm;font-size:9.5pt;}" +
      SCOPE + " .flow-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin-top:2mm;}" +
      SCOPE + " .flow-card{display:flex;align-items:flex-start;gap:2mm;border:1px solid #dbeafe;background:#f8fbff;padding:2.5mm;min-height:12mm;}" +
      SCOPE + " .flow-card-no{display:inline-flex;align-items:center;justify-content:center;width:6mm;height:6mm;border-radius:50%;background:#1b3a6b;color:#fff;font-size:8.5pt;font-weight:700;flex:0 0 auto;}" +
      SCOPE + " .flow-card-text{font-size:9pt;line-height:1.45;color:#111827;}" +
      SCOPE + " .manual-shot-wrap{margin-top:4mm;}" +
      SCOPE + " .manual-shot{margin:0 0 3mm;}" +
      SCOPE + " .manual-shot--image{border:2px solid #cbd5e1;padding:2mm;background:#fff;}" +
      SCOPE + " .manual-shot--annotated{position:relative;}" +
      SCOPE + " .manual-shot--image img{display:block;width:100%;max-height:95mm;object-fit:contain;object-position:top center;}" +
      SCOPE + " .manual-annotation{position:absolute;box-sizing:border-box;border:2px solid #dc2626;background:rgba(220,38,38,.04);pointer-events:none;}" +
      SCOPE + " .manual-annotation-marker{position:absolute;top:-3.2mm;left:-1mm;background:#fff;color:#dc2626;font-size:10pt;font-weight:800;line-height:1;padding:0 1mm;}" +
      SCOPE + " .manual-annotation-label{position:absolute;left:0;bottom:-4.5mm;max-width:120%;background:#fff;color:#b91c1c;font-size:7.5pt;font-weight:700;line-height:1.2;padding:0 1mm;white-space:nowrap;}" +
      SCOPE + " .manual-shot--placeholder{border:2px dashed #dc2626;background:#fef2f2;min-height:55mm;padding:6mm;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;}" +
      SCOPE + " .manual-shot-placeholder-label{font-size:11pt;font-weight:700;color:#b91c1c;margin:0 0 2mm;}" +
      SCOPE + " .manual-shot-placeholder-text{font-size:10pt;color:#111827;margin:0 0 2mm;}" +
      SCOPE + " .manual-shot-placeholder-path{font-size:8pt;color:#64748b;margin:0;word-break:break-all;}" +
      SCOPE + " .callout-list{margin:0;padding:0;list-style:none;}" +
      SCOPE + " .callout-list li{display:flex;align-items:flex-start;gap:2mm;margin:0 0 2mm;font-size:9.5pt;line-height:1.45;}" +
      SCOPE + " .callout-marker{display:inline-flex;align-items:center;justify-content:center;min-width:5mm;color:#dc2626;font-weight:700;flex:0 0 auto;}" +
      SCOPE + " .verification-note{margin:4mm 0 0;padding:4mm;background:#eef5fb;border-left:4px solid #2f6fad;font-size:8.5pt;line-height:1.45;}" +
      SCOPE + " .table-checklist td:first-child{font-weight:600;}"
    );
  }

  function ensureHtml2Pdf(){
    if(typeof html2pdf !== "undefined"){
      return Promise.resolve();
    }
    return new Promise(function(resolve, reject){
      const existing = document.querySelector("script[data-pre-fixed-fare-app-manual-pdf='1']");
      if(existing){
        existing.addEventListener("load", function(){ resolve(); }, { once: true });
        existing.addEventListener("error", function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); }, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = HTML2PDF_CDN;
      script.async = true;
      script.setAttribute("data-pre-fixed-fare-app-manual-pdf", "1");
      script.onload = function(){ resolve(); };
      script.onerror = function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); };
      document.head.appendChild(script);
    });
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const screenshots = collectScreenshots(reportData);
    const [imageAvailability, qrDataUrls] = await Promise.all([
      probeImages(screenshots),
      buildQrDataUrls(reportData)
    ]);
    const reportHtml = buildReportHtml(reportData, { imageAvailability: imageAvailability, qrDataUrls: qrDataUrls });
    if(!String(reportHtml || "").trim()){
      throw new Error("生成対象HTMLが空です。");
    }

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "auto";
    container.style.background = "#ffffff";
    container.innerHTML = "<style>" + getManualCss() + "</style>" + reportHtml;
    document.body.appendChild(container);

    const reportElement = container.querySelector(SCOPE.trim());
    const pageElements = reportElement.querySelectorAll(".manual-page");
    const pageCount = pageElements.length;
    if(pageCount !== EXPECTED_PAGE_COUNT){
      console.warn("[PreFixedFareAppManualPdf] unexpected page count:", pageCount, "expected:", EXPECTED_PAGE_COUNT);
    }

    try{
      await waitForImagesToLoad(reportElement);
      await html2pdf().set({
        margin: [0, 0, 0, 0],
        filename: reportData.pdfFilename || PDF_FILENAME,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: {
          mode: ["css", "legacy"],
          before: [".manual-page + .manual-page"],
          after: [],
          avoid: [".manual-page"]
        }
      }).from(reportElement).save();
    }finally{
      container.remove();
    }

    return {
      pageCount: pageCount,
      imageAvailability: imageAvailability,
      pageIds: Array.from(pageElements).map(function(el){ return el.getAttribute("data-page-id"); })
    };
  }

  async function generatePreFixedFareAppManualPdf(options){
    if(!global.PreFixedFareAppManualData){
      throw new Error("予約・運行中アプリ操作マニュアルPDFデータモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareAppManualData.buildReportData(options || {});
    if(!reportData || typeof reportData !== "object"){
      throw new Error("pre-fixed-fare-app-manual-data の組み立てに失敗しました");
    }
    if(!String(reportData.title || "").trim()){
      throw new Error("pre-fixed-fare-app-manual-data の組み立てに失敗しました");
    }
    return savePdf(reportData);
  }

  global.PreFixedFareAppManualPdf = {
    PDF_FILENAME: PDF_FILENAME,
    EXPECTED_PAGE_COUNT: EXPECTED_PAGE_COUNT,
    buildReportHtml: buildReportHtml,
    getManualCss: getManualCss,
    probeImages: probeImages,
    savePdf: savePdf,
    generatePreFixedFareAppManualPdf: generatePreFixedFareAppManualPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
