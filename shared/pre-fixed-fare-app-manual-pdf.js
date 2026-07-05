(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-app-operation-manual.pdf";
  const EXPECTED_PAGE_COUNT = 17;
  const PRINT_PAGE_RELATIVE_PATH = "./manual/pre-fixed-fare-app-operation-manual-print.html";
  const SCOPE = ".pre-fixed-fare-app-manual";

  function resolvePublicUrl(relativePath){
    const value = String(relativePath || "").trim();
    if(!value){
      return "";
    }
    if(/^data:|^https?:|^blob:/i.test(value)){
      return value;
    }
    if(typeof window !== "undefined" && window.location && window.location.href){
      try{
        return new URL(value, window.location.href).href;
      }catch(error){
        return value;
      }
    }
    return value;
  }

  function logPdfDebug(label, payload){
    const prefix = "[PreFixedFareAppManualPdf]";
    if(payload !== undefined){
      console.log(prefix, label, payload);
    }else{
      console.log(prefix, label);
    }
  }

  function absolutizeReportAssets(reportData){
    const data = reportData || {};
    function patchScreenshot(screenshot){
      if(!screenshot || !screenshot.imageSrc){
        return;
      }
      screenshot.imageSrc = resolvePublicUrl(screenshot.imageSrc);
    }
    (data.steps || []).forEach(function(step){
      patchScreenshot(step.screenshot);
    });
    (data.contentPages || []).forEach(function(page){
      patchScreenshot(page.screenshot);
    });
    return data;
  }

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

  function getScreenshotTypeClass(screenshot){
    return screenshot?.screenshotType === "desktop" ? "is-desktop" : "is-mobile";
  }

  function buildScreenshotBlock(screenshot, imageAvailable){
    if(!screenshot){
      return "";
    }
    const typeClass = getScreenshotTypeClass(screenshot);
    const shotInner = imageAvailable
      ? (
        "<div class='manual-screenshot-frame " + typeClass + "'>" +
        "<div class='manual-shot manual-shot--image manual-shot--annotated'>" +
        "<img class='manual-screenshot-img' src='" + escapeHtml(screenshot.imageSrc) + "' alt='" + escapeHtml(screenshot.placeholderLabel || "") + "' loading='eager'>" +
        buildAnnotationOverlays(screenshot.annotations) +
        "</div></div>"
      )
      : buildMissingScreenshotBlock(screenshot);

    return (
      "<div class='manual-screenshot-block manual-shot-wrap'>" +
      shotInner +
      buildCalloutList(screenshot.callouts) +
      "</div>"
    );
  }

  function buildCoverPage(data, qrDataUrls){
    const cover = data.cover || {};
    const company = cover.company || {};
    const docInfo = data.documentInfo || {};
    const qrItems = Array.isArray(data.qrItems) ? data.qrItems : [];
    const qrBlocks = qrItems.map(function(item, index){
      const dataUrl = qrDataUrls[item.id] || "";
      const captionLine1 = escapeHtml((item.label || ("QR" + (index + 1))) + "：" + (item.title || ""));
      const captionLine2 = escapeHtml(item.coverNote || item.description || "");
      return (
        "<div class='cover-qr-item'>" +
        "<p class='cover-qr-label'>" + escapeHtml(item.label || ("QR" + (index + 1))) + "</p>" +
        "<p class='cover-qr-title'>" + escapeHtml(item.title || "") + "</p>" +
        (dataUrl
          ? "<img class='cover-qr-image' src='" + escapeHtml(dataUrl) + "' alt='" + escapeHtml(item.title || "") + "'>"
          : "<div class='cover-qr-image cover-qr-image--missing'>QR生成不可</div>") +
        "<p class='cover-qr-caption'>" + captionLine1 + "<br>" + captionLine2 + "</p>" +
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
      "<p class='cover-qr-note'>" + escapeHtml(data.purpose?.qrReviewNote || "") + "</p>" +
      "<div class='cover-document-meta'>" +
      "<p><strong>作成日：</strong>" + escapeHtml(docInfo.createdDate || "") + "</p>" +
      "<p><strong>版数：</strong>" + escapeHtml(docInfo.edition || "") + "</p>" +
      "<p><strong>用途：</strong>" + escapeHtml(docInfo.usage || "") + "</p>" +
      "</div>"
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
      "<p class='verification-note'>" + escapeHtml(purpose.demoNote || "") + "</p>" +
      "<p class='verification-note verification-note--secondary'>" + escapeHtml(purpose.qrReviewNote || "") + "</p>"
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
        className: "table-content manual-table",
        colWidths: page.table.colWidths || ["28%", "72%"]
      })
      : "";
    const screenshotHtml = screenshot ? buildScreenshotBlock(screenshot, imageAvailable) : "";
    return manualPage(page.pageId || "content", (
      "<div class='manual-section'>" +
      "<h2 class='page-title'>" + escapeHtml(page.title || "") + "</h2>" +
      "<p>" + escapeHtmlWithBreaks(page.description || "") + "</p>" +
      buildHighlightList(page.highlights) +
      (tableHtml ? "<div class='manual-table-block'>" + tableHtml + "</div>" : "") +
      screenshotHtml +
      "</div>"
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
      const absoluteSrc = resolvePublicUrl(src);
      if(!absoluteSrc){
        resolve(false);
        return;
      }
      const img = new Image();
      img.onload = function(){ resolve(true); };
      img.onerror = function(){
        console.warn("[PreFixedFareAppManualPdf] screenshot probe failed:", absoluteSrc);
        resolve(false);
      };
      img.src = absoluteSrc + (absoluteSrc.includes("?") ? "&" : "?") + "_probe=" + Date.now();
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
        ? global.PreFixedFareAppManualData.resolveManualUrl(item.urlKey, data?.links)
        : (item.url || "");
      if(global.EstimateQr && typeof global.EstimateQr.toDataUrl === "function"){
        result[item.id] = await global.EstimateQr.toDataUrl(url, 150);
      }else{
        result[item.id] = "";
      }
    }));
    return result;
  }

  function waitForImagesToLoad(container){
    const images = Array.from(container.querySelectorAll("img"));
    if(!images.length){
      return Promise.resolve();
    }
    return Promise.all(images.map(function(img){
      if(img.complete && img.naturalWidth > 0){
        return Promise.resolve();
      }
      return new Promise(function(resolve){
        const timeoutId = setTimeout(function(){
          console.warn("[PreFixedFareAppManualPdf] image load timeout:", img.getAttribute("src") || "");
          resolve();
        }, 12000);
        img.addEventListener("load", function(){
          clearTimeout(timeoutId);
          resolve();
        }, { once: true });
        img.addEventListener("error", function(){
          clearTimeout(timeoutId);
          console.warn("[PreFixedFareAppManualPdf] image load failed:", img.getAttribute("src") || "");
          resolve();
        }, { once: true });
      });
    }));
  }

  function waitForLayout(){
    return new Promise(function(resolve){
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          setTimeout(resolve, 300);
        });
      });
    });
  }

  function backupElementStyles(element){
    if(!element){
      return null;
    }
    return {
      display: element.style.display,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      position: element.style.position,
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      maxWidth: element.style.maxWidth,
      zIndex: element.style.zIndex,
      background: element.style.background,
      pointerEvents: element.style.pointerEvents
    };
  }

  function restoreElementStyles(element, backup){
    if(!element || !backup){
      return;
    }
    Object.keys(backup).forEach(function(key){
      element.style[key] = backup[key];
    });
  }

  function applyExportVisibleStyles(element){
    if(!element){
      return;
    }
    element.style.display = "block";
    element.style.maxHeight = "none";
    element.style.overflow = "visible";
    element.style.position = "fixed";
    element.style.left = "0";
    element.style.top = "0";
    element.style.width = "210mm";
    element.style.maxWidth = "210mm";
    element.style.zIndex = "2147483647";
    element.style.background = "#ffffff";
    element.style.pointerEvents = "none";
  }

  function mountVisibleExportRoot(reportHtml){
    const existing = document.getElementById("preFixedFareAppManualExportRoot");
    if(existing){
      existing.remove();
    }
    const container = document.createElement("div");
    container.id = "preFixedFareAppManualExportRoot";
    container.setAttribute("data-pre-fixed-fare-app-manual-pdf-root", "1");
    applyExportVisibleStyles(container);
    container.innerHTML = "<style>" + getManualCss() + "</style>" + reportHtml;
    document.body.appendChild(container);
    const reportElement = container.querySelector(SCOPE.trim());
    if(reportElement){
      reportElement.style.width = "210mm";
      reportElement.style.maxWidth = "210mm";
      reportElement.style.background = "#ffffff";
    }
    return container;
  }

  async function renderVisibleReportTarget(reportHtml, options){
    options = options || {};
    const previewTarget = options.previewElement || document.getElementById("preFixedFareAppManualPreview");
    if(previewTarget){
      const styleBackup = backupElementStyles(previewTarget);
      applyExportVisibleStyles(previewTarget);
      previewTarget.innerHTML = "<style>" + getManualCss() + "</style>" + reportHtml;
      const reportElement = previewTarget.querySelector(SCOPE.trim());
      if(reportElement){
        reportElement.style.width = "210mm";
        reportElement.style.maxWidth = "210mm";
        reportElement.style.background = "#ffffff";
      }
      return {
        mountElement: previewTarget,
        reportElement: reportElement,
        cleanup: function(restorePreviewLayout){
          if(restorePreviewLayout !== false){
            restoreElementStyles(previewTarget, styleBackup);
            if(!styleBackup.display){
              previewTarget.style.display = "block";
            }
          }
        }
      };
    }

    const container = mountVisibleExportRoot(reportHtml);
    return {
      mountElement: container,
      reportElement: container.querySelector(SCOPE.trim()),
      cleanup: function(){
        container.remove();
      }
    };
  }

  async function exportReportElementToPdf(reportElement, mountElement, reportData, prepared){
    if(!reportElement){
      throw new Error("生成対象HTMLが空です。");
    }

    const pageElements = reportElement.querySelectorAll(".manual-page");
    const pageCount = pageElements.length;
    logPdfDebug("data pages:", pageCount);
    logPdfDebug("root exists:", !!reportElement);
    logPdfDebug("root html length:", reportElement.innerHTML.length);
    logPdfDebug("html2pdf exists:", typeof html2pdf !== "undefined");
    logPdfDebug("generator exists:", typeof generatePreFixedFareAppManualPdf === "function");

    if(pageCount !== EXPECTED_PAGE_COUNT){
      console.warn("[PreFixedFareAppManualPdf] unexpected page count:", pageCount, "expected:", EXPECTED_PAGE_COUNT);
    }

    await waitForImagesToLoad(mountElement || reportElement);
    await waitForLayout();

    await html2pdf().set({
      margin: [0, 0, 0, 0],
      filename: reportData.pdfFilename || PDF_FILENAME,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        logging: false
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        before: [".manual-page + .manual-page"],
        after: [],
        avoid: [".manual-table-block", ".manual-screenshot-block", ".table-wrap"]
      }
    }).from(reportElement).save();

    return {
      pageCount: pageCount,
      imageAvailability: prepared.imageAvailability,
      pageIds: Array.from(pageElements).map(function(el){ return el.getAttribute("data-page-id"); })
    };
  }

  async function buildPreparedReport(reportData){
    const preparedData = absolutizeReportAssets(Object.assign({}, reportData));
    const screenshots = collectScreenshots(preparedData);
    const [imageAvailability, qrDataUrls] = await Promise.all([
      probeImages(screenshots),
      buildQrDataUrls(preparedData)
    ]);
    const reportHtml = buildReportHtml(preparedData, {
      imageAvailability: imageAvailability,
      qrDataUrls: qrDataUrls
    });
    if(!String(reportHtml || "").trim()){
      throw new Error("生成対象HTMLが空です。");
    }
    return {
      reportHtml: reportHtml,
      imageAvailability: imageAvailability,
      qrDataUrls: qrDataUrls
    };
  }

  function getManualContentCss(scopePrefix){
    const s = String(scopePrefix || SCOPE).trim();
    return (
      s + " .cover-header{text-align:center;margin:0 0 6mm;}" +
      s + " .cover-title-main{font-size:20pt;font-weight:700;margin:0 0 2mm;color:#1b3a6b;}" +
      s + " .cover-title-sub{font-size:16pt;font-weight:700;margin:0 0 4mm;color:#1b3a6b;line-height:1.35;}" +
      s + " .cover-subtitle{font-size:11pt;font-weight:700;margin:0 0 4mm;color:#334155;}" +
      s + " .cover-company{font-size:10.5pt;margin:0 0 6mm;color:#111827;}" +
      s + " .cover-qr-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:0 0 5mm;}" +
      s + " .cover-qr-item{border:1px solid #cbd5e1;padding:3mm;text-align:center;background:#f8fafc;}" +
      s + " .cover-qr-label{font-size:9pt;font-weight:700;margin:0 0 1mm;color:#1b3a6b;}" +
      s + " .cover-qr-title{font-size:10pt;font-weight:700;margin:0 0 2mm;color:#111827;}" +
      s + " .cover-qr-image{display:block;width:34mm;height:34mm;margin:0 auto 2mm;object-fit:contain;}" +
      s + " .cover-qr-image--missing{display:flex;align-items:center;justify-content:center;width:34mm;height:34mm;border:1px dashed #94a3b8;font-size:8pt;color:#64748b;background:#fff;}" +
      s + " .cover-qr-caption{font-size:8.5pt;line-height:1.45;margin:0;color:#334155;text-align:center;}" +
      s + " .cover-qr-note{margin:0 0 4mm;padding:3mm;background:#fff7ed;border-left:4px solid #c46a00;font-size:8.5pt;line-height:1.45;color:#7c2d12;}" +
      s + " .cover-document-meta{margin-top:2mm;padding-top:3mm;border-top:1px solid #cbd5e1;font-size:9.5pt;line-height:1.55;color:#334155;}" +
      s + " .cover-document-meta p{margin:0 0 1.5mm;}" +
      s + " .page-title{font-size:16pt;font-weight:700;margin:0 0 4mm;color:#1b3a6b;border-bottom:2px solid #1b3a6b;padding-bottom:2mm;}" +
      s + " .page-lead{margin:0 0 4mm;color:#334155;}" +
      s + " .step-label{font-size:10pt;font-weight:700;color:#c41e3a;margin:0 0 2mm;}" +
      s + " .highlight-box{margin:4mm 0;padding:3mm;background:#fff7ed;border-left:4px solid #c46a00;}" +
      s + " .highlight-title{font-size:9pt;font-weight:700;margin:0 0 2mm;color:#9a3412;}" +
      s + " .highlight-list{margin:0;padding-left:5mm;}" +
      s + " .highlight-list li{margin:0 0 1mm;font-size:9.5pt;}" +
      s + " .flow-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin-top:2mm;}" +
      s + " .flow-card{display:flex;align-items:flex-start;gap:2mm;border:1px solid #dbeafe;background:#f8fbff;padding:2.5mm;min-height:12mm;}" +
      s + " .flow-card-no{display:inline-flex;align-items:center;justify-content:center;width:6mm;height:6mm;border-radius:50%;background:#1b3a6b;color:#fff;font-size:8.5pt;font-weight:700;flex:0 0 auto;}" +
      s + " .flow-card-text{font-size:9pt;line-height:1.45;color:#111827;}" +
      s + " .manual-screenshot-block{margin-top:4mm;}" +
      s + " .manual-shot-wrap{margin-top:4mm;}" +
      s + " .manual-shot{margin:0 0 3mm;}" +
      s + " .manual-shot--image{border:2px solid #cbd5e1;padding:2mm;background:#fff;}" +
      s + " .manual-shot--annotated{position:relative;display:block;width:100%;}" +
      s + " .manual-screenshot-frame{margin:0 auto;}" +
      s + " .manual-screenshot-frame.is-mobile{max-width:92mm;}" +
      s + " .manual-screenshot-frame.is-desktop{max-width:180mm;}" +
      s + " .manual-screenshot-img{display:block;width:100%;height:auto;max-height:150mm;object-fit:contain;object-position:top center;}" +
      s + "[data-page-id='route-change-operation'] .manual-screenshot-frame.is-mobile{max-width:96mm;}" +
      s + "[data-page-id='route-change-operation'] .manual-screenshot-img{max-height:132mm;}" +
      s + "[data-page-id='reservation-save'] .manual-screenshot-img{max-height:120mm;}" +
      s + " .manual-annotation{position:absolute;box-sizing:border-box;border:2px solid #dc2626;background:rgba(220,38,38,.04);pointer-events:none;}" +
      s + " .manual-annotation-marker{position:absolute;top:-3.2mm;left:-1mm;background:#fff;color:#dc2626;font-size:10pt;font-weight:800;line-height:1;padding:0 1mm;}" +
      s + " .manual-annotation-label{position:absolute;left:0;bottom:-4.5mm;max-width:120%;background:#fff;color:#b91c1c;font-size:7.5pt;font-weight:700;line-height:1.2;padding:0 1mm;white-space:nowrap;}" +
      s + " .manual-shot--placeholder{border:2px dashed #dc2626;background:#fef2f2;min-height:55mm;padding:6mm;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;}" +
      s + " .manual-shot-placeholder-label{font-size:11pt;font-weight:700;color:#b91c1c;margin:0 0 2mm;}" +
      s + " .manual-shot-placeholder-text{font-size:10pt;color:#111827;margin:0 0 2mm;}" +
      s + " .manual-shot-placeholder-path{font-size:8pt;color:#64748b;margin:0;word-break:break-all;}" +
      s + " .callout-list{margin:0;padding:0;list-style:none;}" +
      s + " .callout-list li{display:flex;align-items:flex-start;gap:2mm;margin:0 0 2mm;font-size:9.5pt;line-height:1.45;}" +
      s + " .callout-marker{display:inline-flex;align-items:center;justify-content:center;min-width:5mm;color:#dc2626;font-weight:700;flex:0 0 auto;}" +
      s + " .verification-note{margin:4mm 0 0;padding:4mm;background:#eef5fb;border-left:4px solid #2f6fad;font-size:8.5pt;line-height:1.45;}" +
      s + " .verification-note--secondary{background:#fff7ed;border-left-color:#c46a00;}" +
      s + " .table-wrap{margin-bottom:4mm;}" +
      s + " table{width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;font-size:9pt;line-height:1.45;}" +
      s + " th{font-size:9.5pt;font-weight:700;background:#f6f6f6;}" +
      s + " td,th{border:1px solid #d9d9d9;padding:2mm;vertical-align:top;background:#fff;word-break:break-word;overflow-wrap:anywhere;}" +
      s + " .table-checklist td:first-child{font-weight:600;}" +
      s + " p,li{font-size:10.5pt;line-height:1.55;color:#111;}" +
      s + " p{margin:0 0 3mm;}" +
      s + " img{max-width:100%;height:auto;}"
    );
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
      SCOPE + " .manual-page{width:auto;min-height:auto;padding:0;box-sizing:border-box;page-break-after:always;break-after:page;}" +
      SCOPE + " .manual-page + .manual-page{page-break-before:always;break-before:page;}" +
      SCOPE + " .manual-section,.manual-table-block,.manual-screenshot-block,.manual-annotation-list,.table-wrap,.callout-list{break-inside:avoid;page-break-inside:avoid;}" +
      SCOPE + " table,tr,td,th{break-inside:avoid;page-break-inside:avoid;}" +
      getManualContentCss(SCOPE) +
      SCOPE + " .table-wrap{break-inside:avoid;page-break-inside:avoid;}"
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

  async function savePdf(reportData, options){
    options = options || {};
    await ensureHtml2Pdf();
    const prepared = await buildPreparedReport(reportData);
    const visibleTarget = await renderVisibleReportTarget(prepared.reportHtml, options);
    const reportElement = visibleTarget.reportElement;
    const mountElement = visibleTarget.mountElement;

    if(!reportElement){
      visibleTarget.cleanup(false);
      throw new Error("生成対象HTMLが空です。");
    }

    try{
      return await exportReportElementToPdf(reportElement, mountElement, reportData, prepared);
    }finally{
      visibleTarget.cleanup(true);
    }
  }

  async function previewReportHtml(reportData, targetElement){
    const target = targetElement || null;
    if(!target){
      throw new Error("プレビュー表示先が見つかりません。");
    }
    const prepared = await buildPreparedReport(reportData);
    target.style.display = "block";
    target.style.maxHeight = "480px";
    target.style.overflow = "auto";
    target.style.position = "";
    target.style.left = "";
    target.style.top = "";
    target.style.width = "";
    target.style.maxWidth = "";
    target.style.zIndex = "";
    target.style.background = "#fff";
    target.innerHTML = "<style>" + getManualCss() + "</style>" + prepared.reportHtml;
    const root = target.querySelector(SCOPE.trim());
    if(root){
      root.style.width = "";
      root.style.maxWidth = "";
      await waitForImagesToLoad(target);
    }
    return {
      pageCount: root ? root.querySelectorAll(".manual-page").length : 0,
      htmlLength: root ? root.innerHTML.length : 0
    };
  }

  async function generatePreFixedFareAppManualPdf(options){
    options = options || {};
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
    return savePdf(reportData, {
      previewElement: options.previewElement || document.getElementById("preFixedFareAppManualPreview")
    });
  }

  function getPrintPageCss(){
    const pageScope = ".manual-page";
    return (
      "@page{size:A4 portrait;margin:8mm;}" +
      "html,body{margin:0;padding:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Yu Gothic','Meiryo',sans-serif;}" +
      "*{box-sizing:border-box;}" +
      ".print-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 16px;background:#1b3a6b;color:#fff;}" +
      ".print-toolbar-title{font-size:16px;font-weight:700;margin:0;flex:1 1 240px;}" +
      ".print-toolbar-actions{display:flex;flex-wrap:wrap;gap:8px;}" +
      ".print-toolbar-btn,.print-toolbar-link{display:inline-block;padding:10px 16px;border-radius:8px;border:none;background:#fff;color:#1b3a6b;font-size:14px;font-weight:700;text-decoration:none;cursor:pointer;}" +
      ".print-toolbar-link{background:#eef5ff;}" +
      ".print-status{padding:12px 16px;background:#fff7ed;color:#9a3412;font-size:13px;}" +
      ".print-status--error{background:#fef2f2;color:#b91c1c;}" +
      ".manual-print-root{display:block !important;visibility:visible !important;opacity:1 !important;background:#fff !important;}" +
      ".manual-page{display:block !important;visibility:visible !important;opacity:1 !important;width:194mm;min-height:281mm;padding:0;margin:0 auto;background:#fff !important;color:#111 !important;break-after:page;page-break-after:always;overflow:visible;}" +
      ".manual-page:last-child{break-after:auto;page-break-after:auto;}" +
      ".manual-page *{visibility:visible !important;opacity:1 !important;color:inherit;}" +
      ".manual-page table,.manual-page tr,.manual-page td,.manual-page th,.manual-page .manual-screenshot-block,.manual-page .manual-screenshot-frame,.manual-page .manual-screenshot-img,.manual-page .manual-annotation,.manual-page .cover-qr-image{break-inside:auto;page-break-inside:auto;}" +
      getManualContentCss(pageScope) +
      "@media screen{body{background:#eee;}.manual-page{margin:16px auto;padding:10mm;box-shadow:0 0 8px rgba(0,0,0,.15);}}" +
      "@media print{html,body{width:auto !important;height:auto !important;overflow:visible !important;background:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
      ".print-toolbar,.print-status{display:none !important;}" +
      ".manual-print-root{display:block !important;visibility:visible !important;opacity:1 !important;}" +
      ".manual-page{display:block !important;visibility:visible !important;opacity:1 !important;margin:0 !important;padding:0 !important;box-shadow:none !important;overflow:visible !important;min-height:0 !important;width:auto !important;max-width:none !important;}" +
      ".manual-page *{visibility:visible !important;opacity:1 !important;}" +
      ".manual-page table,.manual-page tr,.manual-page td,.manual-page th,.manual-page .manual-screenshot-block,.manual-page .manual-screenshot-frame,.manual-page .manual-screenshot-img,.manual-page .manual-annotation,.manual-page .table-wrap,.manual-page .manual-section,.manual-page .callout-list{break-inside:auto !important;page-break-inside:auto !important;break-before:auto !important;page-break-before:auto !important;}}"
    );
  }

  function logPrintDiagnostics(rootElement){
    const root = rootElement || (typeof document !== "undefined" ? document.getElementById("manualPrintRoot") : null);
    const firstPage = root ? root.querySelector(".manual-page") : (typeof document !== "undefined" ? document.querySelector(".manual-page") : null);
    const rootStyle = root && typeof getComputedStyle !== "undefined" ? getComputedStyle(root) : null;
    const pageStyle = firstPage && typeof getComputedStyle !== "undefined" ? getComputedStyle(firstPage) : null;
    logPdfDebug("page count", document.querySelectorAll(".manual-page").length);
    logPdfDebug("body text length", String(document.body?.innerText || "").length);
    if(rootStyle){
      logPdfDebug("root display", rootStyle.display);
      logPdfDebug("root visibility", rootStyle.visibility);
      logPdfDebug("root opacity", rootStyle.opacity);
    }
    if(firstPage){
      logPdfDebug("first page text", String(firstPage.innerText || "").slice(0, 100));
    }
    if(pageStyle){
      logPdfDebug("first page display", pageStyle.display);
      logPdfDebug("first page visibility", pageStyle.visibility);
      logPdfDebug("first page opacity", pageStyle.opacity);
    }
  }

  function mountPrintPages(rootElement, reportHtml){
    const parserHost = document.createElement("div");
    parserHost.innerHTML = reportHtml;
    const pageNodes = parserHost.querySelectorAll(".manual-page");
    rootElement.innerHTML = "";
    pageNodes.forEach(function(node){
      rootElement.appendChild(node);
    });
    return rootElement.querySelectorAll(".manual-page");
  }

  function getPrintPageDefaultOptions(){
    const meterUrl = global.PreFixedFareAppManualData
      ? global.PreFixedFareAppManualData.METER_REVIEW_DEMO_RESERVATIONS_URL
      : "https://infochibafukushi-dotcom.github.io/care-taxi-meter/review-demo/reservations?reviewDemo=1&scenario=pre-fixed-fare-demo";
    return {
      imageBase: "../assets/manual/pre-fixed-fare/",
      manualLinks: {
        estimateReservation: "../estimate/?scenario=pre-fixed-fare-demo",
        operationManual: meterUrl
      }
    };
  }

  function getPrintPageUrl(){
    const relative = PRINT_PAGE_RELATIVE_PATH;
    if(typeof window !== "undefined" && window.location && window.location.href){
      try{
        return new URL(relative, window.location.href).href;
      }catch(error){
        return relative;
      }
    }
    return relative;
  }

  function openPreFixedFareAppManualPrintPage(options){
    options = options || {};
    const url = getPrintPageUrl();
    const target = options.target || "_blank";
    const opened = window.open(url, target, "noopener,noreferrer");
    if(!opened){
      throw new Error("印刷用ページを開けませんでした。ポップアップブロックを解除してください。");
    }
    return url;
  }

  async function renderPrintPage(rootElement, options){
    options = Object.assign({}, getPrintPageDefaultOptions(), options || {});
    if(!rootElement){
      throw new Error("印刷用ページの表示先が見つかりません。");
    }
    if(!global.PreFixedFareAppManualData){
      throw new Error("予約・運行中アプリ操作マニュアルPDFデータモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareAppManualData.buildReportData({
      imageBase: options.imageBase,
      manualLinks: options.manualLinks
    });
    const prepared = await buildPreparedReport(reportData);
    const pages = mountPrintPages(rootElement, prepared.reportHtml);
    await waitForImagesToLoad(rootElement);
    await waitForLayout();
    if(typeof document !== "undefined" && document.body){
      document.body.setAttribute("data-print-ready", "1");
    }
    return {
      pageCount: pages.length,
      pageIds: Array.from(pages).map(function(el){ return el.getAttribute("data-page-id"); }),
      imageAvailability: prepared.imageAvailability
    };
  }

  global.generatePreFixedFareAppManualPdf = generatePreFixedFareAppManualPdf;
  global.openPreFixedFareAppManualPrintPage = openPreFixedFareAppManualPrintPage;

  global.PreFixedFareAppManualPdf = {
    PDF_FILENAME: PDF_FILENAME,
    EXPECTED_PAGE_COUNT: EXPECTED_PAGE_COUNT,
    PRINT_PAGE_RELATIVE_PATH: PRINT_PAGE_RELATIVE_PATH,
    buildReportHtml: buildReportHtml,
    buildPreparedReport: buildPreparedReport,
    renderVisibleReportTarget: renderVisibleReportTarget,
    exportReportElementToPdf: exportReportElementToPdf,
    getManualCss: getManualCss,
    getPrintPageCss: getPrintPageCss,
    getPrintPageUrl: getPrintPageUrl,
    getPrintPageDefaultOptions: getPrintPageDefaultOptions,
    logPrintDiagnostics: logPrintDiagnostics,
    waitForImagesToLoad: waitForImagesToLoad,
    openPreFixedFareAppManualPrintPage: openPreFixedFareAppManualPrintPage,
    renderPrintPage: renderPrintPage,
    probeImages: probeImages,
    previewReportHtml: previewReportHtml,
    savePdf: savePdf,
    generatePreFixedFareAppManualPdf: generatePreFixedFareAppManualPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
