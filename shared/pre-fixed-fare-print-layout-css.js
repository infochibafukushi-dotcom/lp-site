(function(global){
  const HTML2PDF_MARGIN_MM = [16, 14, 20, 14];
  const PUPPETEER_PDF_MARGIN = {
    top: "16mm",
    right: "14mm",
    bottom: "20mm",
    left: "14mm"
  };
  const MIN_FONT_PT = 8.5;

  function getCorePrintCss(scope){
    const s = String(scope || "").trim();
    if(!s){
      throw new Error("印刷用CSSのスコープ指定が必要です。");
    }
    return (
      s + ", " + s + " *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;background:transparent;color:#111827;}" +
      s + "{display:block;width:720px;background:#ffffff;color:#111827;line-height:1.55;font-size:11pt;margin:0;padding:0;}" +
      s + " h1{font-size:18pt;line-height:1.35;margin:0 0 8mm;color:#111827;break-after:avoid;page-break-after:avoid;}" +
      s + " h2{font-size:16pt;line-height:1.35;margin:0 0 5mm;color:#111827;break-after:avoid;page-break-after:avoid;}" +
      s + " h3{font-size:13pt;line-height:1.4;margin:0 0 3mm;color:#111827;break-after:avoid;page-break-after:avoid;}" +
      s + " h4{font-size:13pt;line-height:1.4;margin:0 0 3mm;color:#111827;break-after:avoid;page-break-after:avoid;}" +
      s + " p," + s + " li{font-size:11pt;line-height:1.55;color:#111827;}" +
      s + " p{margin:0 0 4mm;}" +
      s + " ul," + s + " ol{margin:0 0 4mm 5mm;padding:0;}" +
      s + " li{margin:0 0 2mm;}" +
      s + " table{width:100%;border-collapse:collapse;font-size:9.5pt;line-height:1.45;page-break-inside:auto;background:#ffffff;}" +
      s + " th{font-size:10pt;font-weight:700;background:#f6f6f6;}" +
      s + " td," + s + " th{border:1px solid #d9d9d9;padding:2.5mm 2mm;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:anywhere;background:#ffffff;}" +
      s + " tr{break-inside:avoid;page-break-inside:avoid;}" +
      s + " .table-wrap{break-inside:avoid;page-break-inside:avoid;margin-bottom:6mm;}" +
      s + " .section-block," + s + " .subsection-block," + s + " .small-section," + s + " .note-box," + s + " .evidence-card," + s + " .capture-card," + s + " .screenshot-block{break-inside:avoid;page-break-inside:avoid;margin-bottom:6mm;}" +
      s + " .section-title-with-body{break-inside:avoid;page-break-inside:avoid;}" +
      s + " .note," + s + " .caption," + s + " .annotation," + s + " .footer-note," + s + " .verification-note{font-size:9pt;line-height:1.45;}" +
      s + " .footer," + s + " .page-number{position:static;margin-top:8mm;font-size:9pt;text-align:center;}" +
      s + " img{max-width:100%;height:auto;object-fit:contain;}" +
      s + " .capture-card img," + s + " .capture-image{display:block;max-width:100%;max-height:190mm;margin:3mm auto;object-fit:contain;object-position:top center;}" +
      s + " .capture-image-wrap{display:flex;justify-content:center;margin:3mm 0;break-inside:avoid;page-break-inside:avoid;}" +
      s + " .subtitle{font-size:11pt;line-height:1.55;margin:0 0 4mm;color:#334155;}" +
      s + " .meta-line{font-size:9pt;line-height:1.45;color:#64748b;margin:0 0 4mm;}"
    );
  }

  function getPrintPageStyles(){
    return (
      "@page{size:A4 portrait;margin:16mm 14mm 20mm 14mm;}" +
      "html,body{width:100%;margin:0;padding:0;background:#ffffff;}" +
      "body{font-family:'Yu Gothic','Meiryo',sans-serif;font-size:11pt;line-height:1.55;color:#111827;}" +
      "main.print-page{width:100%;max-width:none;margin:0;padding:0;box-sizing:border-box;display:block;}" +
      "main.print-page,main.print-page *{box-sizing:border-box;}" +
      "main.print-page *{max-width:100%;overflow-wrap:break-word;word-break:normal;}" +
      "main.print-page h1{font-size:18pt;line-height:1.35;margin:0 0 8mm;color:#1b3a6b;break-after:avoid;page-break-after:avoid;}" +
      "main.print-page h2{font-size:16pt;line-height:1.35;margin:0 0 5mm;color:#1b3a6b;break-after:avoid;page-break-after:avoid;}" +
      "main.print-page h3{font-size:13pt;line-height:1.4;margin:0 0 3mm;color:#1b3a6b;break-after:avoid;page-break-after:avoid;}" +
      "main.print-page p,main.print-page li{font-size:11pt;line-height:1.55;}" +
      "main.print-page .subtitle{font-size:11pt;margin:0 0 4mm;color:#334155;font-weight:700;}" +
      "main.print-page .meta{font-size:9pt;margin:0 0 4mm;color:#64748b;}" +
      "main.print-page .section-title{margin:4mm 0 3mm;padding-bottom:1mm;border-bottom:1.5pt solid #1b3a6b;break-after:avoid;page-break-after:avoid;}" +
      "main.print-page table{width:100%;border-collapse:collapse;font-size:9.5pt;line-height:1.45;page-break-inside:auto;}" +
      "main.print-page th{font-size:10pt;font-weight:700;}" +
      "main.print-page td,main.print-page th{padding:2.5mm 2mm;vertical-align:top;border:1px solid #cbd5e1;}" +
      "main.print-page tr{break-inside:avoid;page-break-inside:avoid;}" +
      "main.print-page .note,main.print-page .compatibility,main.print-page .qa-block{break-inside:avoid;page-break-inside:avoid;margin-bottom:6mm;}" +
      "main.print-page .note{width:100%;margin:4mm 0;padding:4mm;background:#fff7ed;border-left:4px solid #c46a00;}" +
      "main.print-page .compatibility{width:100%;margin:4mm 0;padding:4mm;background:#eefaf3;border-left:4px solid #16885a;}" +
      "main.print-page .compatibility ul{margin:2mm 0 0;padding-left:5mm;}" +
      "main.print-page .compatibility li{margin:0 0 1.5mm;}" +
      "main.print-page .qa-block{width:100%;border:1px solid #cbd5e1;}" +
      "main.print-page .qa-question{width:100%;background:#eaf3fb;color:#16365c;font-weight:700;padding:3mm;font-size:10.5pt;}" +
      "main.print-page .qa-answer{width:100%;background:#ffffff;padding:3mm;font-size:10.5pt;}" +
      "main.print-page .qa-label{font-weight:700;color:#1b3a6b;}" +
      "@media print{html,body,main.print-page{width:100% !important;max-width:none !important;margin:0 !important;padding:0 !important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}"
    );
  }

  function getWordPrintCss(){
    return [
      "@page { size: A4 portrait; margin: 16mm 14mm 20mm 14mm; }",
      "body { font-family: 'Yu Gothic', 'Meiryo', 'MS PGothic', sans-serif; font-size: 11pt; line-height: 1.55; color: #111827; margin: 0; }",
      ".word-document { max-width: 18cm; margin: 0 auto; }",
      ".word-section { margin: 0 0 6mm; break-inside: avoid; page-break-inside: avoid; }",
      ".word-page-break { page-break-before: always; break-before: page; }",
      "h1.doc-title { font-size: 18pt; text-align: center; margin: 0 0 8mm; break-after: avoid; page-break-after: avoid; }",
      "h2.section-title { font-size: 16pt; margin: 0 0 5mm; border-bottom: 1px solid #333; padding-bottom: 2mm; break-after: avoid; page-break-after: avoid; }",
      "h3.subsection-title { font-size: 13pt; margin: 0 0 3mm; break-after: avoid; page-break-after: avoid; }",
      "p { margin: 0 0 4mm; font-size: 11pt; line-height: 1.55; }",
      "ul { margin: 0 0 4mm 5mm; padding: 0; }",
      "li { margin: 0 0 2mm; font-size: 11pt; line-height: 1.55; }",
      "table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; page-break-inside: auto; font-size: 9.5pt; line-height: 1.45; }",
      "th { font-size: 10pt; font-weight: 700; background: #f2f2f2; }",
      "td, th { border: 1px solid #999; padding: 2.5mm 2mm; vertical-align: top; word-wrap: break-word; }",
      "tr { break-inside: avoid; page-break-inside: avoid; }",
      ".table-wrap { break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }",
      ".subsection-block, .small-section, .section-block, .note-box, .evidence-card, .capture-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }",
      ".check-col { width: 28pt; text-align: center; font-size: 14pt; }",
      ".notice-box { border: 1px solid #ccc; background: #fafafa; padding: 4mm; margin: 0 0 6mm; font-size: 9pt; break-inside: avoid; page-break-inside: avoid; }",
      ".capture-image-wrap { display: flex; justify-content: center; margin: 3mm 0; break-inside: avoid; page-break-inside: avoid; }",
      ".capture-image { display: block; max-width: 100%; max-height: 190mm; margin: 3mm auto; object-fit: contain; object-position: top center; }",
      ".meta-line { font-size: 9pt; color: #64748b; margin-bottom: 4mm; }",
      ".footer-note, .caption, .annotation { font-size: 9pt; line-height: 1.45; color: #555; margin-top: 3mm; }",
      "a { color: #0645ad; word-break: break-all; }"
    ].join("\n");
  }

  global.PreFixedFarePrintLayoutCss = {
    MIN_FONT_PT: MIN_FONT_PT,
    HTML2PDF_MARGIN_MM: HTML2PDF_MARGIN_MM,
    PUPPETEER_PDF_MARGIN: PUPPETEER_PDF_MARGIN,
    getCorePrintCss: getCorePrintCss,
    getPrintPageStyles: getPrintPageStyles,
    getWordPrintCss: getWordPrintCss
  };
})(typeof window !== "undefined" ? window : globalThis);
