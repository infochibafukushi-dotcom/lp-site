(function(global){
  const HTML2PDF_MARGIN_MM = [8, 8, 8, 8];
  const PUPPETEER_PDF_MARGIN = {
    top: "8mm",
    right: "8mm",
    bottom: "8mm",
    left: "8mm"
  };
  const MIN_FONT_PT = 8.5;

  function getBasePageRules(){
    return (
      "@page{size:A4 portrait;margin:8mm;}" +
      "html,body{margin:0;padding:0;width:auto;box-sizing:border-box;background:#ffffff;color:#111827;}" +
      "*{box-sizing:border-box;}" +
      ".print-page,.pdf-page,.report-page{width:auto;min-height:auto;margin:0;padding:0;box-sizing:border-box;overflow:visible;}" +
      ".print-page:last-child,.pdf-page:last-child,.report-page:last-child{break-after:auto;page-break-after:auto;}" +
      "table{width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;}" +
      "td,th{word-break:break-word;overflow-wrap:anywhere;white-space:normal;}" +
      ".page-break-before{break-before:page;page-break-before:always;}" +
      ".no-split-table,.no-split-table table,.no-split-table tr{break-inside:avoid;page-break-inside:avoid;}" +
      ".chapter-start{break-before:page;page-break-before:always;}" +
      ".page-number-only{position:static;margin-top:6mm;font-size:9pt;text-align:center;color:#505050;}" +
      ".receipt-shot img,.screen-evidence-shot--receipt img{display:block;width:auto;max-width:90mm;max-height:210mm;margin:0 auto;object-fit:contain;}"
    );
  }

  function getCorePrintCss(scope){
    const s = String(scope || "").trim();
    if(!s){
      throw new Error("印刷用CSSのスコープ指定が必要です。");
    }
    return (
      getBasePageRules() +
      s + ", " + s + " *{font-family:'Yu Gothic','Meiryo',sans-serif;background:transparent;color:#111827;}" +
      s + "{display:block;width:auto;background:#ffffff;color:#111827;line-height:1.55;font-size:10.5pt;margin:0;padding:0;}" +
      s + " h1{font-size:18pt;font-weight:700;line-height:1.35;margin:0 0 6mm;color:#111827;}" +
      s + " h2{font-size:16pt;font-weight:700;line-height:1.35;margin:0 0 4mm;color:#111827;}" +
      s + " h3{font-size:12.5pt;font-weight:700;line-height:1.4;margin:0 0 3mm;color:#111827;}" +
      s + " h4{font-size:12.5pt;font-weight:700;line-height:1.4;margin:0 0 2mm;color:#111827;}" +
      s + " p," + s + " li{font-size:10.5pt;line-height:1.55;color:#111827;}" +
      s + " p{margin:0 0 3mm;}" +
      s + " ul," + s + " ol{margin:0 0 3mm 5mm;padding:0;}" +
      s + " li{margin:0 0 1.5mm;}" +
      s + " table{font-size:9pt;line-height:1.45;page-break-inside:auto;background:#ffffff;}" +
      s + " th{font-size:9.5pt;font-weight:700;background:#f6f6f6;}" +
      s + " td," + s + " th{border:1px solid #d9d9d9;padding:2mm;vertical-align:top;background:#ffffff;}" +
      s + " .table-wrap{margin-bottom:4mm;}" +
      s + " .note-box{margin:4mm 0;padding:4mm;background:#fff7ed;border-left:4px solid #c46a00;}" +
      s + " .note," + s + " .caption," + s + " .annotation," + s + " .footer-note," + s + " .verification-note{font-size:8.5pt;line-height:1.45;}" +
      s + " .subtitle{font-size:11pt;font-weight:700;line-height:1.55;margin:0 0 4mm;color:#334155;}" +
      s + " .meta-line{font-size:9pt;line-height:1.45;color:#64748b;margin:0 0 4mm;}" +
      s + " img{max-width:100%;height:auto;object-fit:contain;}"
    );
  }

  function getPrintPageStyles(){
    return (
      getBasePageRules() +
      "body{font-family:'Yu Gothic','Meiryo',sans-serif;font-size:10.5pt;line-height:1.55;color:#111827;}" +
      "main.print-page{width:auto;max-width:none;margin:0;padding:0;box-sizing:border-box;display:block;}" +
      "main.print-page,main.print-page *{box-sizing:border-box;}" +
      "main.print-page h1{font-size:18pt;font-weight:700;line-height:1.35;margin:0 0 6mm;color:#1b3a6b;}" +
      "main.print-page h2{font-size:16pt;font-weight:700;line-height:1.35;margin:0 0 4mm;color:#1b3a6b;}" +
      "main.print-page h3{font-size:12.5pt;font-weight:700;line-height:1.4;margin:0 0 3mm;color:#1b3a6b;}" +
      "main.print-page p,main.print-page li{font-size:10.5pt;line-height:1.55;}" +
      "main.print-page .subtitle{font-size:11pt;margin:0 0 4mm;color:#334155;font-weight:700;}" +
      "main.print-page .meta{font-size:9pt;margin:0 0 4mm;color:#64748b;}" +
      "main.print-page .section-title{margin:4mm 0 3mm;padding-bottom:1mm;border-bottom:1.5pt solid #1b3a6b;}" +
      "main.print-page table{font-size:9pt;line-height:1.45;}" +
      "main.print-page th{font-size:9.5pt;font-weight:700;}" +
      "main.print-page td,main.print-page th{padding:2mm;vertical-align:top;border:1px solid #cbd5e1;}" +
      "main.print-page .note{width:100%;margin:4mm 0;padding:4mm;background:#fff7ed;border-left:4px solid #c46a00;}" +
      "main.print-page .compatibility{width:100%;margin:4mm 0;padding:4mm;background:#eefaf3;border-left:4px solid #16885a;}" +
      "main.print-page .compatibility ul{margin:2mm 0 0;padding-left:5mm;}" +
      "main.print-page .compatibility li{margin:0 0 1.5mm;}" +
      "main.print-page .qa-block{width:100%;border:1px solid #cbd5e1;margin-bottom:4mm;}" +
      "main.print-page .qa-question{width:100%;background:#eaf3fb;color:#16365c;font-weight:700;padding:3mm;font-size:10pt;}" +
      "main.print-page .qa-answer{width:100%;background:#ffffff;padding:3mm;font-size:10pt;}" +
      "main.print-page .qa-label{font-weight:700;color:#1b3a6b;}" +
      "@media print{html,body,main.print-page{width:auto !important;max-width:none !important;margin:0 !important;padding:0 !important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}"
    );
  }

  function getWordPrintCss(){
    return [
      "@page { size: A4 portrait; margin: 8mm; }",
      "html, body { margin: 0; padding: 0; width: auto; box-sizing: border-box; }",
      "* { box-sizing: border-box; }",
      "body { font-family: 'Yu Gothic', 'Meiryo', 'MS PGothic', sans-serif; font-size: 10.5pt; line-height: 1.55; color: #111827; margin: 0; }",
      ".word-document { width: auto; margin: 0; padding: 0; }",
      ".word-section { margin: 0 0 4mm; }",
      ".page-break-before { break-before: page; page-break-before: always; }",
      ".no-split-table, .no-split-table table, .no-split-table tr { break-inside: avoid; page-break-inside: avoid; }",
      "h1.doc-title { font-size: 18pt; font-weight: 700; text-align: center; margin: 0 0 6mm; }",
      "h2.section-title { font-size: 16pt; font-weight: 700; margin: 0 0 4mm; border-bottom: 1px solid #333; padding-bottom: 2mm; }",
      "h3.subsection-title { font-size: 12.5pt; font-weight: 700; margin: 0 0 3mm; }",
      "p { margin: 0 0 3mm; font-size: 10.5pt; line-height: 1.55; }",
      "ul { margin: 0 0 3mm 5mm; padding: 0; }",
      "li { margin: 0 0 1.5mm; font-size: 10.5pt; line-height: 1.55; }",
      "table { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 4mm; font-size: 9pt; line-height: 1.45; }",
      "th { font-size: 9.5pt; font-weight: 700; background: #f2f2f2; }",
      "td, th { border: 1px solid #999; padding: 2mm; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal; }",
      ".check-col { width: 28pt; text-align: center; font-size: 14pt; }",
      ".notice-box { border: 1px solid #ccc; background: #fafafa; padding: 4mm; margin: 0 0 4mm; font-size: 8.5pt; }",
      ".meta-line { font-size: 9pt; color: #64748b; margin-bottom: 4mm; }",
      ".footer-note, .caption, .annotation { font-size: 8.5pt; line-height: 1.45; color: #555; margin-top: 3mm; }",
      "a { color: #0645ad; word-break: break-all; }"
    ].join("\n");
  }

  global.PreFixedFarePrintLayoutCss = {
    MIN_FONT_PT: MIN_FONT_PT,
    HTML2PDF_MARGIN_MM: HTML2PDF_MARGIN_MM,
    PUPPETEER_PDF_MARGIN: PUPPETEER_PDF_MARGIN,
    getBasePageRules: getBasePageRules,
    getCorePrintCss: getCorePrintCss,
    getPrintPageStyles: getPrintPageStyles,
    getWordPrintCss: getWordPrintCss
  };
})(typeof window !== "undefined" ? window : globalThis);
