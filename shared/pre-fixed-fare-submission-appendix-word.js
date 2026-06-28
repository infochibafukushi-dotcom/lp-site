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
    return "<table" + (className ? " class='" + escapeHtml(className) + "'" : "") + "><thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function buildKeyValueTable(rows){
    return buildTable(["項目", "内容"], rows, { className: "table-kv" });
  }

  function buildCheckboxRow(label){
    return "<tr><td class='check-col'>☐</td><td>" + escapeHtml(label) + "</td></tr>";
  }

  function getWordCss(){
    return [
      "@page { size: A4; margin: 2cm; }",
      "body { font-family: 'Yu Gothic', 'Meiryo', 'MS PGothic', sans-serif; font-size: 11pt; line-height: 1.45; color: #111; margin: 0; }",
      ".word-document { max-width: 18cm; margin: 0 auto; }",
      ".word-section { margin: 0 0 16pt; }",
      ".word-page-break { page-break-before: always; break-before: page; }",
      "h1.doc-title { font-size: 18pt; text-align: center; margin: 24pt 0 12pt; }",
      "h2.section-title { font-size: 14pt; margin: 14pt 0 8pt; border-bottom: 1px solid #333; padding-bottom: 4pt; }",
      "h3.subsection-title { font-size: 12pt; margin: 10pt 0 6pt; }",
      "p { margin: 0 0 6pt; }",
      "ul { margin: 0 0 8pt 18pt; padding: 0; }",
      "li { margin: 0 0 3pt; }",
      "table { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; }",
      "th, td { border: 1px solid #999; padding: 4pt 5pt; vertical-align: top; word-wrap: break-word; font-size: 10pt; }",
      "th { background: #f2f2f2; font-weight: 700; }",
      ".check-col { width: 28pt; text-align: center; font-size: 14pt; }",
      ".notice-box { border: 1px solid #ccc; background: #fafafa; padding: 8pt; margin: 8pt 0 12pt; font-size: 10pt; }",
      ".paste-box { border: 2px dashed #999; min-height: 140pt; margin: 6pt 0 10pt; background: #fcfcfc; }",
      ".meta-line { font-size: 10pt; color: #444; margin-bottom: 8pt; }",
      ".footer-note { font-size: 9pt; color: #555; margin-top: 10pt; }",
      "a { color: #0645ad; word-break: break-all; }"
    ].join("\n");
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
      "<div class='word-section'>" +
      "<h1 class='doc-title'>" + escapeHtml(payload.title) + "</h1>" +
      "<p class='meta-line'>作成日：" + escapeHtml(payload.meta?.createdAt || "") + "　事業者名：" + escapeHtml(payload.meta?.businessName || "") + "</p>" +
      buildList(payload.intro) +
      "<h2 class='section-title'>公式リンク欄</h2><ul>" + linksHtml + "</ul>" +
      "<h2 class='section-title'>記入補助項目</h2>" +
      buildKeyValueTable(payload.helperFields || []) +
      "<p class='footer-note'>" + escapeHtml(payload.notice || "") + "</p>" +
      "</div>"
    );
  }

  function renderDistanceFareTable(payload){
    return (
      "<div class='word-section'>" +
      "<h1 class='doc-title'>" + escapeHtml(payload.title) + "</h1>" +
      "<p class='meta-line'>事業者名：" + escapeHtml(payload.meta?.businessName || "") + "　営業区域：" + escapeHtml(payload.meta?.operatingArea || "") + "</p>" +
      buildList(payload.intro) +
      buildKeyValueTable(payload.fields || []) +
      "</div>"
    );
  }

  function renderServiceFeeTable(payload){
    return (
      "<div class='word-section'>" +
      "<h1 class='doc-title'>" + escapeHtml(payload.title) + "</h1>" +
      buildList(payload.intro) +
      buildTable(
        ["区分", "金額", "事前確定運賃に含めるか", "明細表示", "備考"],
        payload.feeRows || [],
        { className: "table-fees" }
      ) +
      "</div>"
    );
  }

  function renderDeviceChecklist(payload){
    const sectionsHtml = (payload.sections || []).map(function(section){
      const rows = (section.items || []).map(buildCheckboxRow).join("");
      return (
        "<h3 class='subsection-title'>" + escapeHtml(section.title) + "</h3>" +
        "<table class='table-checklist'><thead><tr><th>確認</th><th>項目</th></tr></thead><tbody>" + rows + "</tbody></table>"
      );
    }).join("");
    const signatureRows = (payload.signatureFields || []).map(function(label){
      return [label, ""];
    });
    return (
      "<div class='word-section'>" +
      "<h1 class='doc-title'>" + escapeHtml(payload.title) + "</h1>" +
      buildList(payload.intro) +
      sectionsHtml +
      "<h2 class='section-title'>署名欄</h2>" +
      buildKeyValueTable(signatureRows) +
      "</div>"
    );
  }

  function renderScreenshotSheet(payload){
    const screensHtml = (payload.screens || []).map(function(screen, index){
      return (
        "<div class='word-section'>" +
        "<h3 class='subsection-title'>" + escapeHtml(String(index + 1) + ". " + screen.name) + "</h3>" +
        "<p><strong>確認内容：</strong>" + escapeHtml(screen.purpose || "") + "</p>" +
        "<p><strong>備考：</strong>" + escapeHtml(screen.note || "") + "</p>" +
        "<div class='paste-box'>&nbsp;</div>" +
        "</div>"
      );
    }).join("");
    return (
      "<div class='word-section'>" +
      "<h1 class='doc-title'>" + escapeHtml(payload.title) + "</h1>" +
      buildList(payload.intro) +
      screensHtml +
      "</div>"
    );
  }

  function renderDocumentBody(payload){
    const id = payload.documentId;
    if(id === "application-helper") return renderApplicationHelper(payload);
    if(id === "distance-fare-table") return renderDistanceFareTable(payload);
    if(id === "service-fee-table") return renderServiceFeeTable(payload);
    if(id === "device-checklist") return renderDeviceChecklist(payload);
    if(id === "screenshot-sheet") return renderScreenshotSheet(payload);
    if(id === "submission-appendix-set"){
      const parts = (payload.parts || []).map(function(partId, index){
        const partPayload = global.PreFixedFareSubmissionAppendixData.buildDocumentPayload(
          partId,
          payload._options || {}
        );
        const breakClass = index > 0 ? " word-page-break" : "";
        return "<div class='word-section" + breakClass + "'>" + renderDocumentBody(partPayload) + "</div>";
      }).join("");
      return (
        "<h1 class='doc-title'>" + escapeHtml(payload.title) + "</h1>" +
        buildList(payload.intro) +
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
    const editNote = "本ファイルは提出前の手動調整用です。改ページ・表・余白は Microsoft Word 上で編集してください。正式申請様式は関東運輸局の公式Word様式を使用してください。";
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
