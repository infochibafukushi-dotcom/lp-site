(function(global){
  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildList(items){
    const list = Array.isArray(items) ? items : [];
    if(!list.length) return "";
    return "<ul>" + list.map(function(item){
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("") + "</ul>";
  }

  function buildTable(headers, rows, options){
    options = options || {};
    const className = String(options.className || "").trim();
    const th = headers.map(function(item){
      return "<th>" + escapeHtml(item) + "</th>";
    }).join("");
    const body = (rows || []).map(function(row){
      const cells = row.map(function(cell){
        return "<td>" + escapeHtml(cell) + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("");
    return (
      "<div class='table-wrap table-section no-orphan-table'>" +
      "<table" + (className ? " class='" + escapeHtml(className) + "'" : "") + "><thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table>" +
      "</div>"
    );
  }

  function buildKeyValueTable(rows){
    return buildTable(["項目", "内容"], rows, { className: "table-kv" });
  }

  function buildCheckboxRow(label){
    return "<tr><td class='check-col'>☐</td><td>" + escapeHtml(label) + "</td></tr>";
  }

  function formatBusinessMetaLine(meta){
    return "事業者名：" + escapeHtml(meta?.companyName || "") + "　屋号：" + escapeHtml(meta?.tradeName || "");
  }

  function renderCoefficientReference(payload){
    const rows = payload.coefficientReferenceRows || payload.meta?.coefficientReferenceRows || [];
    if(!rows.length){
      return "";
    }
    return (
      "<section class='page-break-before table-section no-split-table no-orphan-table'>" +
      "<h3 class='subsection-title'>参考：千葉県内交通圏の平準化係数（申請欄への自動転記ではない）</h3>" +
      "<p class='footer-note'>以下はシステム設定値の参考一覧です。申請欄には、申請対象の交通圏に対応する関東運輸局公示の係数を転記してください。</p>" +
      buildTable(["交通圏", "参考係数"], rows, { className: "table-reference" }) +
      "</section>"
    );
  }

  function getWordCss(){
    if(global.PreFixedFarePrintLayoutCss){
      return global.PreFixedFarePrintLayoutCss.getWordPrintCss();
    }
    return "@page { size: A4 portrait; margin: 8mm; } body { font-size: 11pt; }";
  }

  function wrapWordDocument(title, bodyHtml, editNote){
    return (
      "<!DOCTYPE html>\n" +
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>\n" +
      "<head><meta http-equiv='Content-Type' content='text/html; charset=utf-8'>\n" +
      "<meta name='ProgId' content='Word.Document'>\n" +
      "<title>" + escapeHtml(title) + "</title>\n" +
      "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->\n" +
      "<style>" + getWordCss() + "</style></head>\n<body>\n<div class='word-document'>\n" +
      (editNote ? "<p class='notice-box'>" + escapeHtml(editNote) + "</p>" : "") +
      bodyHtml +
      "</div></body></html>"
    );
  }

  function renderApplicationHelper(payload){
    const linksHtml = (payload.officialLinks || []).map(function(link){
      return "<li><strong>" + escapeHtml(link.label) + "</strong><br><a href='" + escapeHtml(link.url) + "'>" + escapeHtml(link.url) + "</a><br>" + escapeHtml(link.note || "") + "</li>";
    }).join("");
    return (
      "<section class='appendix-section appendix-application-helper'>" +
      "<h2 class='appendix-title'>" + escapeHtml(payload.title) + "</h2>" +
      "<p class='meta-line'>作成日：" + escapeHtml(payload.meta?.createdAt || "") + "　" + formatBusinessMetaLine(payload.meta) + "</p>" +
      buildList(payload.intro) +
      "<h3 class='subsection-title'>公式リンク欄</h3><ul>" + linksHtml + "</ul>" +
      "<h3 class='subsection-title'>記入補助項目</h3>" +
      buildKeyValueTable(payload.helperFields || []) +
      renderCoefficientReference(payload) +
      "<p class='footer-note'>" + escapeHtml(payload.notice || "") + "</p>" +
      "</section>"
    );
  }

  function renderDistanceFareTable(payload){
    return (
      "<section class='appendix-section appendix-distance-fare'>" +
      "<h2 class='appendix-title'>" + escapeHtml(payload.title) + "</h2>" +
      "<p class='meta-line'>" + formatBusinessMetaLine(payload.meta) + "</p>" +
      buildList(payload.intro) +
      buildKeyValueTable(payload.fields || []) +
      "</section>"
    );
  }

  function renderServiceFeeTable(payload){
    return (
      "<section class='appendix-section appendix-service-fee'>" +
      "<h2 class='appendix-title'>" + escapeHtml(payload.title) + "</h2>" +
      buildList(payload.intro) +
      "<div class='table-section no-orphan-table'>" +
      buildTable(
        ["区分", "金額・単位", "事前確定運賃への含否", "明細表示", "説明", "LP見積での扱い"],
        payload.feeRows || [],
        { className: "table-fees table-fare-items" }
      ) +
      "</div>" +
      (payload.sourceNote ? "<p class='footer-note'>" + escapeHtml(payload.sourceNote) + "</p>" : "") +
      "</section>"
    );
  }

  function renderDeviceChecklist(payload){
    const sectionsHtml = (payload.sections || []).map(function(section){
      const rows = (section.items || []).map(buildCheckboxRow).join("");
      return (
        "<section class='table-section'>" +
        "<h3 class='subsection-title'>" + escapeHtml(section.title) + "</h3>" +
        "<table class='table-checklist'><thead><tr><th>確認</th><th>項目</th></tr></thead><tbody>" + rows + "</tbody></table>" +
        "</section>"
      );
    }).join("");
    const signatureRows = (payload.signatureFields || []).map(function(label){
      return [label, ""];
    });
    return (
      "<section class='appendix-section appendix-device-checklist'>" +
      "<h2 class='appendix-title'>" + escapeHtml(payload.title) + "</h2>" +
      buildList(payload.intro) +
      sectionsHtml +
      "<h3 class='subsection-title'>署名欄</h3>" +
      buildKeyValueTable(signatureRows) +
      "</section>"
    );
  }

  function renderScreenCaptureEvidence(payload){
    return (
      "<section class='appendix-section appendix-screen-reference'>" +
      "<h2 class='appendix-title'>" + escapeHtml(payload.title) + "</h2>" +
      buildList(payload.intro) +
      "<div class='note-box notice-box'>" +
      "<p>利用者のルート選択、旅客同意確認、乗務員用確定ルート確認、領収書・レシート明細画面については、別添「画面証跡資料」P2〜P5を参照。</p>" +
      (payload.verificationNote ? "<p>" + escapeHtml(payload.verificationNote) + "</p>" : "") +
      "</div>" +
      "</section>"
    );
  }

  function renderScreenshotSheet(payload){
    const screensHtml = (payload.screens || []).map(function(screen, index){
      return (
        "<section class='table-section'>" +
        "<h3 class='subsection-title'>" + escapeHtml(String(index + 1) + ". " + screen.name) + "</h3>" +
        "<p><strong>確認内容：</strong>" + escapeHtml(screen.purpose || "") + "</p>" +
        "<p><strong>備考：</strong>" + escapeHtml(screen.note || "") + "</p>" +
        "</section>"
      );
    }).join("");
    return (
      "<section class='page-break-before appendix-section'>" +
      "<h2 class='appendix-title'>" + escapeHtml(payload.title) + "</h2>" +
      buildList(payload.intro) +
      screensHtml +
      "</section>"
    );
  }

  function renderDocumentBody(payload){
    const id = payload.documentId;
    if(id === "application-helper") return renderApplicationHelper(payload);
    if(id === "distance-fare-table") return renderDistanceFareTable(payload);
    if(id === "service-fee-table") return renderServiceFeeTable(payload);
    if(id === "device-checklist") return renderDeviceChecklist(payload);
    if(id === "screen-capture-evidence") return renderScreenCaptureEvidence(payload);
    if(id === "screenshot-sheet") return renderScreenshotSheet(payload);
    if(id === "submission-appendix-set"){
      const parts = (payload.parts || []).map(function(partId){
        const partPayload = global.PreFixedFareSubmissionAppendixData.buildDocumentPayload(
          partId,
          payload._options || {}
        );
        return renderDocumentBody(partPayload);
      }).join("");
      return (
        "<section class='appendix-set-cover'>" +
        "<h1 class='doc-title'>" + escapeHtml(payload.title) + "</h1>" +
        "<p class='meta-line'>" + formatBusinessMetaLine(payload.meta) + "</p>" +
        buildList(payload.intro) +
        "</section>" +
        parts
      );
    }
    throw new Error("未対応の別紙資料: " + id);
  }

  function buildWordDocumentHtml(documentId, options){
    if(!global.PreFixedFareSubmissionAppendixData){
      throw new Error("別紙資料データモジュールが読み込まれていません。");
    }
    const payload = global.PreFixedFareSubmissionAppendixData.buildDocumentPayload(documentId, options || {});
    payload._options = options || {};
    const bodyHtml = renderDocumentBody(payload);
    const editNote = options?.finalSubmission
      ? null
      : "本ファイルは提出前の手動調整用です。改ページ・表・余白は Microsoft Word 上で編集してください。正式申請様式は関東運輸局の公式Word様式を使用してください。";
    return {
      html: wrapWordDocument(payload.title, bodyHtml, editNote),
      payload: payload
    };
  }

  function downloadWordHtml(documentId, options){
    const built = buildWordDocumentHtml(documentId, options);
    const blob = new Blob(["\ufeff", built.html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = built.payload.wordFilename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return {
      filename: built.payload.wordFilename,
      title: built.payload.title,
      htmlLength: built.html.length
    };
  }

  global.PreFixedFareSubmissionAppendixWord = {
    buildWordDocumentHtml: buildWordDocumentHtml,
    downloadWordHtml: downloadWordHtml,
    renderDocumentBody: renderDocumentBody
  };
})(typeof window !== "undefined" ? window : globalThis);
