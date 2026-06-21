(function(global){
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

  function buildPdfElement(data){
    const el = document.createElement("div");
    el.className = "estimate-pdf-source";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
      "box-sizing:border-box",
      "width:720px",
      "min-height:200px",
      "padding:32px",
      "font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif",
      "color:#222",
      "background:#fff"
    ].join(";");

    const usageRows = (data.usageSummary || []).map(function(line){
      return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;width:38%;">${escapeHtml(line.label)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;">${escapeHtml(line.value)}</td></tr>`;
    }).join("");

    const breakdownRows = (data.breakdownRows || []).map(function(row){
      return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(row.label)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(formatYen(row.amount))}</td></tr>`;
    }).join("");

    el.innerHTML = `
      <h1 style="margin:0 0 8px;font-size:24px;">概算見積書</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#666;">${escapeHtml(data.pageTitle || "概算見積シミュレーター")}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:14px;">
        <tr><td style="padding:6px 0;color:#666;width:28%;">見積番号</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(data.estimateNumber || "")}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">見積日時</td><td style="padding:6px 0;">${escapeHtml(formatDateTime(data.createdAt))}</td></tr>
      </table>
      <h2 style="margin:0 0 8px;font-size:16px;color:#9a6b16;">ご利用内容</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:14px;">${usageRows || "<tr><td colspan=\"2\" style=\"padding:6px 8px;\">—</td></tr>"}</table>
      <h2 style="margin:0 0 8px;font-size:16px;color:#9a6b16;">料金内訳</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:14px;">${breakdownRows || "<tr><td colspan=\"2\" style=\"padding:6px 8px;\">—</td></tr>"}</table>
      <div style="margin:16px 0;padding:16px;border:2px solid #e87f00;border-radius:8px;text-align:center;">
        <div style="font-size:14px;color:#666;margin-bottom:4px;">概算合計</div>
        <div style="font-size:28px;font-weight:800;color:#c62828;">${escapeHtml(formatYen(data.total))}</div>
      </div>
      <h2 style="margin:0 0 8px;font-size:14px;color:#666;">注意事項</h2>
      <div style="font-size:12px;line-height:1.8;color:#555;white-space:pre-line;">${escapeHtml(data.disclaimer || "")}</div>
    `;
    return el;
  }

  function waitForNextFrame(){
    return new Promise(function(resolve){
      requestAnimationFrame(function(){
        requestAnimationFrame(resolve);
      });
    });
  }

  async function savePdf(data){
    if(typeof html2pdf === "undefined"){
      throw new Error("PDF ライブラリが読み込まれていません。");
    }

    const element = buildPdfElement(data);
    const container = document.createElement("div");
    container.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "width:720px",
      "z-index:-1",
      "opacity:0",
      "pointer-events:none",
      "overflow:visible"
    ].join(";");
    container.appendChild(element);
    document.body.appendChild(container);

    await waitForNextFrame();

    const filename = (data.estimateNumber || "estimate") + ".pdf";
    try{
      await html2pdf().set({
        margin: 10,
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: "#ffffff",
          width: element.scrollWidth,
          height: element.scrollHeight
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      }).from(element).save();
    }finally{
      container.remove();
    }
  }

  global.EstimatePdf = {
    savePdf: savePdf,
    formatDateTime: formatDateTime
  };
})(typeof window !== "undefined" ? window : globalThis);
