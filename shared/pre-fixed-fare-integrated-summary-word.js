(function(global){
  const WORD_FILENAME = "pre-fixed-fare-integrated-summary-word.html";

  const PAGE_BREAK_BLOCK_IDS = new Set([
    "p02-toc",
    "p03-ch1-part1",
    "p06-ch2-part1",
    "p08-ch3-part1",
    "p11-ch4-part1",
    "p13-ch5"
  ]);

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getWordDocumentCss(){
    return [
      "@page { size: A4; margin: 2cm; }",
      "body { font-family: 'Yu Gothic', 'Meiryo', 'MS PGothic', sans-serif; font-size: 11pt; line-height: 1.45; color: #111111; margin: 0; padding: 0; }",
      ".word-document { max-width: 18cm; margin: 0 auto; }",
      ".word-block { margin: 0 0 12pt; }",
      ".word-page-break { page-break-before: always; break-before: page; }",
      "h1.cover-title { font-size: 20pt; text-align: center; margin: 36pt 0 12pt; font-weight: 700; }",
      ".cover-subtitle { font-size: 12pt; text-align: center; color: #444444; margin: 0 0 24pt; }",
      "h2.toc-heading { font-size: 14pt; margin: 0 0 10pt; border-bottom: 1px solid #cccccc; padding-bottom: 4pt; }",
      "h2.chapter-title { font-size: 14pt; margin: 0 0 6pt; border-bottom: 2px solid #333333; padding-bottom: 4pt; page-break-after: avoid; }",
      "h2.chapter-title--continued { font-size: 13pt; border-bottom: 1px solid #666666; }",
      "h3.chapter-supplement { font-size: 12pt; margin: 0 0 8pt; color: #333333; font-weight: 600; }",
      ".chapter-positioning { font-size: 10pt; color: #444444; margin: 0 0 10pt; }",
      "h3.section-title { font-size: 11.5pt; margin: 10pt 0 6pt; font-weight: 700; page-break-after: avoid; }",
      "h4 { font-size: 11pt; margin: 8pt 0 4pt; font-weight: 700; color: #333333; }",
      "p { margin: 0 0 6pt; }",
      "ul, ol { margin: 0 0 8pt 18pt; padding: 0; }",
      "li { margin: 0 0 3pt; }",
      "table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; table-layout: fixed; }",
      "th, td { border: 1px solid #999999; padding: 4pt 5pt; vertical-align: top; word-wrap: break-word; font-size: 10pt; }",
      "th { background: #f2f2f2; font-weight: 700; }",
      "tr { page-break-inside: avoid; break-inside: avoid; }",
      ".subsection-block { margin: 0 0 10pt; }",
      ".footer-note, .e2e-reservation-note, .meter-mode-note, .prelaunch-swap-note { font-size: 10pt; color: #444444; margin-top: 6pt; }",
      ".word-edit-note { font-size: 9pt; color: #666666; border: 1px solid #dddddd; background: #fafafa; padding: 8pt; margin: 0 0 12pt; }"
    ].join("\n");
  }

  function buildWordBodyHtml(reportData){
    if(!global.PreFixedFareIntegratedSummaryPdf || typeof global.PreFixedFareIntegratedSummaryPdf.buildPagePlan !== "function"){
      throw new Error("統合説明資料PDFモジュールが読み込まれていません。");
    }
    const pages = global.PreFixedFareIntegratedSummaryPdf.buildPagePlan(reportData);
    if(!Array.isArray(pages) || pages.length < 1){
      throw new Error("統合説明資料のページ構成が空です。");
    }
    return pages.map(function(page){
      const breakClass = PAGE_BREAK_BLOCK_IDS.has(page.id) ? " word-page-break" : "";
      return (
        "<div class='word-block" + breakClass + "' data-page-id='" + escapeHtml(page.id) + "'>" +
        page.html +
        "</div>"
      );
    }).join("\n");
  }

  function buildWordDocumentHtml(reportData){
    const title = escapeHtml(reportData?.title || "事前確定運賃システム 統合説明資料");
    const bodyHtml = buildWordBodyHtml(reportData);
    return (
      "<!DOCTYPE html>\n" +
      "<html xmlns:v='urn:schemas-microsoft-com:vml' xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>\n" +
      "<head>\n" +
      "<meta http-equiv='Content-Type' content='text/html; charset=utf-8'>\n" +
      "<meta name='ProgId' content='Word.Document'>\n" +
      "<meta name='Generator' content='lp-site pre-fixed-fare-integrated-summary-word'>\n" +
      "<title>" + title + "</title>\n" +
      "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->\n" +
      "<style type='text/css'>\n" + getWordDocumentCss() + "\n</style>\n" +
      "</head>\n" +
      "<body>\n" +
      "<div class='word-document'>\n" +
      "<p class='word-edit-note'>本ファイルは運輸局提出前の手動調整用です。改ページ・表分割・余白は Microsoft Word 上で編集してください。内容は④統合説明資料PDFと同一です。</p>\n" +
      bodyHtml +
      "</div>\n" +
      "</body>\n</html>"
    );
  }

  function downloadWordHtml(reportData){
    const html = buildWordDocumentHtml(reportData);
    if(!String(html || "").trim()){
      throw new Error("Word編集用HTMLの生成に失敗しました。");
    }
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = WORD_FILENAME;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { filename: WORD_FILENAME, htmlLength: html.length };
  }

  async function generatePreFixedFareIntegratedSummaryWord(options){
    if(!global.PreFixedFareIntegratedSummaryData){
      throw new Error("統合説明資料データモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareIntegratedSummaryData.buildReportData(options || {});
    if(!reportData || !String(reportData.title || "").trim()){
      throw new Error("統合説明資料データの組み立てに失敗しました。");
    }
    return downloadWordHtml(reportData);
  }

  global.PreFixedFareIntegratedSummaryWord = {
    WORD_FILENAME: WORD_FILENAME,
    buildWordBodyHtml: buildWordBodyHtml,
    buildWordDocumentHtml: buildWordDocumentHtml,
    downloadWordHtml: downloadWordHtml,
    generatePreFixedFareIntegratedSummaryWord: generatePreFixedFareIntegratedSummaryWord
  };
})(typeof window !== "undefined" ? window : globalThis);
