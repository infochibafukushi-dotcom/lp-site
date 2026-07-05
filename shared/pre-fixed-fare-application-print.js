(function(global){
  const DOCUMENT_TITLE = "一般乗用旅客自動車運送事業の運賃及び料金（事前確定運賃）設定認可申請書";
  const DEFAULT_COMPANY_NAME = "株式会社 千葉福祉サポート";
  const DEFAULT_DISPATCH_APP_NAME = "LP見積・予約連携システム";
  const DEFAULT_OPERATING_AREA = "千葉交通圏";
  const DEFAULT_ADDRESS = "千葉県千葉市中央区出洲港8-3-2";

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function todayIsoDate(){
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function formatReiwaDate(isoDate){
    const text = String(isoDate || "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if(!match){
      return { eraYear: "", month: "", day: "", display: "令和　　年　　月　　日" };
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const eraYear = year - 2018;
    return {
      eraYear: String(eraYear),
      month: String(month),
      day: String(day),
      display: "令和　" + eraYear + "　年　" + month + "　月　" + day + "　日"
    };
  }

  function detectContact(config){
    const phone = String(config?.pcTopPhone?.number || "").trim();
    if(phone) return phone;
    const link = String(config?.pcTopPhone?.link || "").replace(/^tel:/i, "").trim();
    if(link && /^\d{10,11}$/.test(link)){
      return link.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    }
    return "";
  }

  function detectCompanyName(config, estimateConfig){
    return String(
      config?.companyName
      || estimateConfig?.pdfFooter?.businessName
      || config?.businessName
      || ""
    ).trim() || DEFAULT_COMPANY_NAME;
  }

  function formatRepresentativeStampLine(representativeName){
    const name = String(representativeName || "").trim();
    if(!name){
      return "代表者氏名：　　　　　　　　　　　　　　　　印";
    }
    return "代表者氏名：" + name + "　　　　　　　　　　　　印";
  }

  function buildDefaults(options){
    options = options || {};
    const config = options.config || {};
    const estimateConfig = options.estimateConfig || {};
    return {
      applicationDate: todayIsoDate(),
      applicantAddress: DEFAULT_ADDRESS,
      applicantName: detectCompanyName(config, estimateConfig),
      representativeName: String(config?.representativeName || "").trim(),
      contact: detectContact(config),
      operatingArea: DEFAULT_OPERATING_AREA,
      dispatchAppName: DEFAULT_DISPATCH_APP_NAME
    };
  }

  function normalizeFormData(raw, options){
    const defaults = buildDefaults(options);
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      applicationDate: String(source.applicationDate || defaults.applicationDate).trim() || defaults.applicationDate,
      applicantAddress: String(source.applicantAddress || defaults.applicantAddress).trim() || defaults.applicantAddress,
      applicantName: String(source.applicantName || defaults.applicantName).trim() || defaults.applicantName,
      representativeName: String(source.representativeName || defaults.representativeName).trim(),
      contact: String(source.contact || defaults.contact).trim() || defaults.contact,
      operatingArea: String(source.operatingArea || defaults.operatingArea).trim() || DEFAULT_OPERATING_AREA,
      dispatchAppName: String(source.dispatchAppName || defaults.dispatchAppName).trim() || DEFAULT_DISPATCH_APP_NAME
    };
  }

  function buildPrintStyles(){
    const base = global.PreFixedFarePrintLayoutCss
      ? global.PreFixedFarePrintLayoutCss.getBasePageRules()
      : "@page{size:A4 portrait;margin:8mm;}html,body{margin:0;padding:0;width:auto;box-sizing:border-box;}";
    return (
      base +
      "html,body{background:#ffffff;color:#000000;}" +
      "body{font-family:'Yu Gothic','Meiryo',serif;font-size:10.5pt;line-height:1.5;}" +
      "main.print-page{width:auto;max-width:none;margin:0;padding:0;box-sizing:border-box;}" +
      "main.print-page,main.print-page *{box-sizing:border-box;}" +
      ".date-line{text-align:right;margin:0 0 5mm;font-size:10.5pt;}" +
      ".addressee{margin:0 0 6mm;font-size:10.5pt;}" +
      ".applicant-block{margin:0 0 6mm;margin-left:auto;width:68%;text-align:left;}" +
      ".applicant-block p{margin:0 0 1.5mm;font-size:10.5pt;}" +
      ".doc-title{text-align:center;font-size:15pt;font-weight:700;margin:0 0 5mm;line-height:1.4;}" +
      ".lead{margin:0 0 5mm;text-indent:1em;font-size:10.5pt;}" +
      ".ki{text-align:center;font-weight:700;font-size:12pt;margin:4mm 0 3mm;}" +
      ".section{margin:0 0 3mm;}" +
      ".section-title{font-weight:700;font-size:12pt;margin:0 0 1.5mm;}" +
      ".section-body{margin:0;padding-left:1.2em;font-size:10.5pt;}" +
      ".section-body p{margin:0 0 1.5mm;}" +
      ".representative-stamp-line{letter-spacing:0.02em;}" +
      ".attachments{margin-top:4mm;}" +
      ".attachments-title{font-weight:700;font-size:12pt;margin:0 0 1.5mm;}" +
      ".attachments ul{margin:0;padding-left:1.4em;font-size:10pt;}" +
      ".attachments li{margin:0 0 1mm;}" +
      "@media print{" +
      "html,body,main.print-page{width:auto !important;max-width:none !important;}" +
      "body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
      "}" +
      "@media screen{" +
      "body{padding:8mm;max-width:210mm;margin:0 auto;}" +
      "}"
    );
  }

  function buildReportHtml(formData){
    const data = normalizeFormData(formData);
    const reiwa = formatReiwaDate(data.applicationDate);
    const operatingArea = data.operatingArea || DEFAULT_OPERATING_AREA;

    return (
      "<main class='print-page'>" +
        "<p class='date-line'>" + escapeHtml(reiwa.display) + "</p>" +
        "<p class='addressee'>関東運輸局長　殿</p>" +
        "<div class='applicant-block'>" +
          "<p>" + escapeHtml(data.applicantAddress) + "</p>" +
          "<p>" + escapeHtml(data.applicantName) + "</p>" +
          "<p>" + escapeHtml(data.representativeName) + "</p>" +
          "<p>" + escapeHtml(data.contact) + "</p>" +
        "</div>" +
        "<h1 class='doc-title'>" + escapeHtml(DOCUMENT_TITLE) + "</h1>" +
        "<p class='lead'>この度、一般乗用旅客自動車運送事業の運賃及び料金を、下記のとおり設定したいので、道路運送法第9条の3及び同法施行規則第10条の3の規定により申請いたします。</p>" +
        "<p class='ki'>記</p>" +
        "<section class='section'>" +
          "<p class='section-title'>1. 申請者の氏名又は名称及び住所並びに法人にあっては、その代表者の氏名</p>" +
          "<div class='section-body'>" +
            "<p>住所：" + escapeHtml(data.applicantAddress) + "</p>" +
            "<p>氏名又は名称：" + escapeHtml(data.applicantName) + "</p>" +
            "<p class='representative-stamp-line'>" + escapeHtml(formatRepresentativeStampLine(data.representativeName)) + "</p>" +
            "<p>連絡先：" + escapeHtml(data.contact) + "</p>" +
          "</div>" +
        "</section>" +
        "<section class='section'>" +
          "<p class='section-title'>2. 設定しようとする運賃及び料金を適用する営業区域</p>" +
          "<div class='section-body'><p>" + escapeHtml(operatingArea) + "</p></div>" +
        "</section>" +
        "<section class='section'>" +
          "<p class='section-title'>3. 設定しようとする運賃及び料金の種類、額及び適用方法</p>" +
          "<div class='section-body'>" +
            "<p>・平成14年1月17日付け関東運輸局長公示「一般乗用旅客自動車運送事業の運賃及び料金に関する制度について」1.（1）ニの事前確定運賃を設定する。</p>" +
            "<p>・運賃額は、平成31年4月26日付け関東運輸局長公示「一般乗用旅客自動車運送事業の事前確定運賃に関する認可申請の取扱いについて」（以下「事前確定運賃公示」という。）3.（2）により関東運輸局長が令和7年7月18日付けで公示した千葉交通圏の係数を用いて、事前確定運賃公示1.（1）の方法により算定する額とする。</p>" +
            "<p>・適用方法は、事前確定運賃公示1.（2）のとおりとする。</p>" +
          "</div>" +
        "</section>" +
        "<section class='attachments'>" +
          "<p class='attachments-title'>添付書類等</p>" +
          "<ul>" +
            "<li>使用する配車アプリ（名称：" + escapeHtml(data.dispatchAppName) + "）</li>" +
            "<li>事前確定運賃公示2.（3）①に規定する配車アプリの概要を示した資料</li>" +
          "</ul>" +
        "</section>" +
      "</main>"
    );
  }

  function buildPrintDocument(formData, options){
    options = options || {};
    const data = normalizeFormData(formData, options);
    const autoPrint = Boolean(options.autoPrint);
    const printScript = autoPrint
      ? "<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},300);});<\/script>"
      : "";
    return (
      "<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'>" +
      "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>" + escapeHtml(DOCUMENT_TITLE) + "</title>" +
      "<style>" + buildPrintStyles() + "</style>" +
      "</head><body>" +
      buildReportHtml(data) +
      printScript +
      "</body></html>"
    );
  }

  function openDocument(formData, options){
    options = options || {};
    const html = buildPrintDocument(formData, options);
    const printWindow = global.open("", "_blank");
    if(!printWindow){
      throw new Error("印刷用ページを開けませんでした。ポップアップを許可してください。");
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return normalizeFormData(formData, options);
  }

  function openPreviewPage(formData, options){
    return openDocument(formData, Object.assign({}, options, { autoPrint: false }));
  }

  function openPrintPage(formData, options){
    return openDocument(formData, Object.assign({}, options, { autoPrint: true }));
  }

  global.PreFixedFareApplicationPrint = {
    DOCUMENT_TITLE: DOCUMENT_TITLE,
    DEFAULT_OPERATING_AREA: DEFAULT_OPERATING_AREA,
    buildDefaults: buildDefaults,
    normalizeFormData: normalizeFormData,
    formatReiwaDate: formatReiwaDate,
    buildReportHtml: buildReportHtml,
    buildPrintDocument: buildPrintDocument,
    openPreviewPage: openPreviewPage,
    openPrintPage: openPrintPage
  };
})(typeof window !== "undefined" ? window : globalThis);
