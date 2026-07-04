(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const EXPECTED_PAGE_COUNT = 5;

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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
    return "<table" + (className ? " class='" + escapeHtml(className) + "'" : "") + ">" + colgroup + "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function pdfPage(pageId, bodyHtml, options){
    options = options || {};
    const breakClass = options.isLast ? "" : " pdf-page-break";
    return (
      "<div class='pdf-page" + breakClass + "' data-page-id='" + escapeHtml(pageId) + "'>" +
      "<div class='pdf-page-inner'>" + bodyHtml + "</div>" +
      "</div>"
    );
  }

  function buildMissingImageBlock(imageFile){
    return (
      "<div class='evidence-image-missing'>" +
      "<p class='evidence-image-missing-label'>画像ファイル未配置</p>" +
      "<p class='evidence-image-missing-path'>" + escapeHtml(imageFile || "") + "</p>" +
      "</div>"
    );
  }

  function buildImageBlock(screen, imageAvailable){
    if(!imageAvailable){
      return buildMissingImageBlock(screen.imageFile);
    }
    return (
      "<div class='evidence-image-wrap'>" +
      "<img class='evidence-image' src='" + escapeHtml(screen.imageSrc) + "' alt='" + escapeHtml(screen.pageTitle) + "' loading='eager'>" +
      "</div>"
    );
  }

  function buildCoverPage(data){
    const info = data.caseInfo || {};
    return pdfPage("cover", (
      "<h1 class='cover-title'>" + escapeHtml(data.title || "") + "</h1>" +
      buildTable(
        ["項目", "内容"],
        [
          ["見積番号", info.estimateNo || ""],
          ["予約ID", info.reservationId || ""],
          ["確定運賃", info.confirmedFare || ""],
          ["見積日時", info.estimatedAt || ""],
          ["同意日時", info.consentedAt || ""],
          ["出発地", info.origin || ""],
          ["目的地", info.destination || ""],
          ["案件番号", info.projectNumber || ""]
        ],
        { className: "table-case-meta", colWidths: ["28%", "72%"] }
      ) +
      buildTable(
        ["項目", "内容"],
        [
          ["作成日", data.meta?.createdAt || ""],
          ["作成元", data.meta?.createdBy || ""],
          ["資料区分", data.meta?.documentType || ""]
        ],
        { className: "table-meta", colWidths: ["28%", "72%"] }
      ) +
      "<p class='verification-note'>" + escapeHtml(data.verificationNote || "") + "</p>"
    ));
  }

  function buildScreenPage(screen, imageAvailable, options){
    options = options || {};
    return pdfPage(screen.pageId, (
      "<h2 class='screen-title'>" + escapeHtml(screen.pageTitle || "") + "</h2>" +
      buildImageBlock(screen, imageAvailable) +
      "<p class='proof-text'>" + escapeHtml(screen.proofText || "") + "</p>" +
      "<p class='verification-note verification-note--compact'>" + escapeHtml(options.verificationNote || "") + "</p>"
    ), { isLast: !!options.isLast });
  }

  function buildReportHtml(data, imageAvailabilityMap){
    const availability = imageAvailabilityMap || {};
    const screens = Array.isArray(data.screens) ? data.screens : [];
    const pages = [buildCoverPage(data)];
    screens.forEach(function(screen, index){
      pages.push(buildScreenPage(screen, !!availability[screen.imageSrc], {
        verificationNote: data.verificationNote,
        isLast: index === screens.length - 1
      }));
    });
    return (
      "<div class='pre-fixed-fare-screen-evidence'>" +
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

  async function probeImages(screens){
    const availability = {};
    const list = Array.isArray(screens) ? screens : [];
    await Promise.all(list.map(async function(screen){
      availability[screen.imageSrc] = await probeImage(screen.imageSrc);
    }));
    return availability;
  }

  function waitForImagesToLoad(container){
    const images = Array.from(container.querySelectorAll("img.evidence-image"));
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

  function getEvidenceCss(){
    return (
      ".pre-fixed-fare-screen-evidence,.pre-fixed-fare-screen-evidence *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;color:#111111;}" +
      ".pre-fixed-fare-screen-evidence{width:720px;background:#ffffff;line-height:1.45;font-size:10.5px;padding:0;margin:0;}" +
      ".pre-fixed-fare-screen-evidence .pdf-page{width:720px;height:1000px;max-height:1000px;overflow:hidden;page-break-inside:avoid;break-inside:avoid;margin:0;padding:0;position:relative;}" +
      ".pre-fixed-fare-screen-evidence .pdf-page-break{page-break-after:always !important;break-after:page !important;}" +
      ".pre-fixed-fare-screen-evidence .pdf-page-inner{height:980px;max-height:980px;display:flex;flex-direction:column;overflow:hidden;padding:4px 0 0;}" +
      ".pre-fixed-fare-screen-evidence h1.cover-title{font-size:20px;margin:0 0 12px;color:#1b3a6b;}" +
      ".pre-fixed-fare-screen-evidence h2.screen-title{font-size:14px;margin:0 0 8px;color:#1b3a6b;border-bottom:2px solid #1b3a6b;padding-bottom:4px;flex:0 0 auto;}" +
      ".pre-fixed-fare-screen-evidence table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 10px;flex:0 0 auto;}" +
      ".pre-fixed-fare-screen-evidence th,.pre-fixed-fare-screen-evidence td{border:1px solid #d9d9d9;padding:5px;vertical-align:top;font-size:10px;line-height:1.35;}" +
      ".pre-fixed-fare-screen-evidence th{background:#f6f6f6;font-weight:700;}" +
      ".pre-fixed-fare-screen-evidence .verification-note{margin:10px 0 0;padding:8px;background:#eef5fb;border-left:4px solid #2f6fad;font-size:9.5px;line-height:1.5;flex:0 0 auto;}" +
      ".pre-fixed-fare-screen-evidence .verification-note--compact{margin-top:8px;font-size:9px;}" +
      ".pre-fixed-fare-screen-evidence .evidence-image-wrap{flex:1 1 auto;display:flex;align-items:flex-start;justify-content:center;min-height:0;margin:0 0 8px;overflow:hidden;}" +
      ".pre-fixed-fare-screen-evidence .evidence-image{display:block;max-width:100%;width:100%;height:auto;max-height:760px;object-fit:contain;object-position:top center;}" +
      ".pre-fixed-fare-screen-evidence .evidence-image-missing{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed #94a3b8;background:#f8fafc;min-height:420px;margin:0 0 8px;padding:24px;text-align:center;}" +
      ".pre-fixed-fare-screen-evidence .evidence-image-missing-label{font-size:14px;font-weight:700;color:#475569;margin:0 0 8px;}" +
      ".pre-fixed-fare-screen-evidence .evidence-image-missing-path{font-size:9px;color:#64748b;margin:0;word-break:break-all;}" +
      ".pre-fixed-fare-screen-evidence .proof-text{margin:0;font-size:10px;line-height:1.5;color:#334155;flex:0 0 auto;}"
    );
  }

  function ensureHtml2Pdf(){
    if(typeof html2pdf !== "undefined"){
      return Promise.resolve();
    }
    return new Promise(function(resolve, reject){
      const existing = document.querySelector("script[data-pre-fixed-fare-screen-evidence-pdf='1']");
      if(existing){
        existing.addEventListener("load", function(){ resolve(); }, { once: true });
        existing.addEventListener("error", function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); }, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = HTML2PDF_CDN;
      script.async = true;
      script.setAttribute("data-pre-fixed-fare-screen-evidence-pdf", "1");
      script.onload = function(){ resolve(); };
      script.onerror = function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); };
      document.head.appendChild(script);
    });
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const imageAvailability = await probeImages(reportData.screens || []);
    const reportHtml = buildReportHtml(reportData, imageAvailability);
    if(!String(reportHtml || "").trim()){
      throw new Error("生成対象HTMLが空です。");
    }

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "720px";
    container.style.background = "#ffffff";
    container.innerHTML = "<style>" + getEvidenceCss() + "</style>" + reportHtml;
    document.body.appendChild(container);

    const reportElement = container.querySelector(".pre-fixed-fare-screen-evidence");
    const pageCount = reportElement.querySelectorAll(".pdf-page").length;
    if(pageCount !== EXPECTED_PAGE_COUNT){
      console.warn("[PreFixedFareScreenEvidencePdf] unexpected page count:", pageCount, "expected:", EXPECTED_PAGE_COUNT);
    }

    try{
      await waitForImagesToLoad(reportElement);
      await html2pdf().set({
        margin: [8, 8, 12, 8],
        filename: reportData.pdfFilename || global.PreFixedFareScreenEvidenceData?.PDF_FILENAME || "pre-fixed-fare-screen-evidence.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], after: [".pdf-page-break"] }
      }).from(reportElement).save();
    }finally{
      container.remove();
    }

    return {
      pageCount: pageCount,
      imageAvailability: imageAvailability
    };
  }

  async function generatePreFixedFareScreenEvidencePdf(options){
    if(!global.PreFixedFareScreenEvidenceData){
      throw new Error("画面証跡資料データモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareScreenEvidenceData.buildReportData(options || {});
    if(!reportData || typeof reportData !== "object"){
      throw new Error("pre-fixed-fare-screen-evidence-data の組み立てに失敗しました");
    }
    if(!String(reportData.title || "").trim()){
      throw new Error("pre-fixed-fare-screen-evidence-data の組み立てに失敗しました");
    }
    return savePdf(reportData);
  }

  global.PreFixedFareScreenEvidencePdf = {
    EXPECTED_PAGE_COUNT: EXPECTED_PAGE_COUNT,
    buildReportHtml: buildReportHtml,
    probeImages: probeImages,
    savePdf: savePdf,
    generatePreFixedFareScreenEvidencePdf: generatePreFixedFareScreenEvidencePdf
  };
})(typeof window !== "undefined" ? window : globalThis);
