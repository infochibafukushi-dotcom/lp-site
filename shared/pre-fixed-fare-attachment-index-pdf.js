(function(global){
  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildTable(headers, rows, colWidths){
    const colgroup = (colWidths || []).map(function(width){
      return "<col style='width:" + escapeHtml(width) + ";'>";
    }).join("");
    const th = headers.map(function(item){
      return "<th>" + escapeHtml(item) + "</th>";
    }).join("");
    const body = (rows || []).map(function(row){
      return "<tr>" + row.map(function(cell){
        return "<td>" + escapeHtml(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return (
      "<div class='table-wrap table-section no-split-table'>" +
      "<table>" + (colgroup ? "<colgroup>" + colgroup + "</colgroup>" : "") +
      "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table></div>"
    );
  }

  function buildReportHtml(data){
    return (
      "<div class='pre-fixed-fare-attachment-index report-page'>" +
      "<h1 class='doc-title'>" + escapeHtml(data.title || "") + "</h1>" +
      buildTable(
        ["資料番号", "資料名", "主な確認内容", "掲載ページ", "備考"],
        data.rows || [],
        ["12%", "22%", "34%", "14%", "18%"]
      ) +
      "<p class='doc-note'>※掲載ページは一式提出候補PDF（final-candidate）のページ番号です。再出力時に実ページへ更新されます。</p>" +
      "</div>"
    );
  }

  function getCss(){
    if(!global.PreFixedFarePrintLayoutCss){
      throw new Error("印刷用レイアウトCSSモジュールが読み込まれていません。");
    }
    const scope = ".pre-fixed-fare-attachment-index";
    return (
      global.PreFixedFarePrintLayoutCss.getCorePrintCss(scope) +
      scope + " .doc-title{font-size:18pt;font-weight:700;text-align:center;margin:0 0 5mm;}" +
      scope + " .doc-note{font-size:8.5pt;color:#64748b;margin:4mm 0 0;}" +
      scope + " th{text-align:center;}" +
      scope + " td:nth-child(1), " + scope + " td:nth-child(4){text-align:center;}"
    );
  }

  function buildPrintDocument(data){
    return (
      "<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'>" +
      "<style>" + getCss() + "</style></head><body>" +
      buildReportHtml(data) +
      "</body></html>"
    );
  }

  global.PreFixedFareAttachmentIndexPdf = {
    buildReportHtml: buildReportHtml,
    buildPrintDocument: buildPrintDocument,
    getCss: getCss
  };
})(typeof window !== "undefined" ? window : globalThis);
