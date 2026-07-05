(function(global){
  const TITLE = "添付資料一覧・ページ対応表";

  function formatPageRange(start, end){
    const s = Number(start);
    const e = Number(end);
    if(!Number.isFinite(s) || s < 1){
      return "—";
    }
    if(!Number.isFinite(e) || e <= s){
      return "P" + s;
    }
    return "P" + s + "〜P" + e;
  }

  function buildRows(pageMap){
    const map = pageMap || {};
    function range(key){
      const entry = map[key] || {};
      return formatPageRange(entry.start, entry.end);
    }
    function screenSub(startPage, endPage){
      return formatPageRange(startPage, endPage);
    }

    const screen = map.screenEvidence || {};
    const screenStart = screen.start || 0;
    const screenPages = screen.pages || 7;

    return [
      ["資料1", "申請書", "申請者、営業区域、運賃及び料金の種類・額・適用方法", range("application"), ""],
      ["資料2", "審査確認ポイント一覧", "認可審査時の主要確認項目と掲載資料の対応", range("reviewChecklist"), ""],
      ["資料3", "実画面証跡資料", "ルート選択、旅客同意、ドライバー確認、領収書、各種料金確認", range("screenEvidence"), "表紙・案件情報含む"],
      ["資料4", "システム概要・公示要件対応表", "算定式、公示要件対応、ルート提示、同意、監査証跡の統合説明", range("integrated"), "統合説明資料"],
      ["資料5", "運用・監査説明資料", "運行フロー、旅客都合変更、E2E、保存・照合の運用説明", range("operations"), ""],
      ["資料6", "Q&A", "想定質問と回答、運輸局説明用の短答", range("qa"), ""],
      ["別紙1", "距離制運賃表", "初乗運賃、加算運賃、深夜早朝割増、障害者割引、端数処理、適用開始予定日", range("appendix1") || range("appendix"), "別紙セット内"],
      ["別紙2", "各種料金表", "迎車料、介助料、待機料、付き添い料、有料道路代、駐車場代等", range("appendix2") || range("appendix"), "別紙セット内"],
      [
        "補足資料",
        "乗務員端末における各種料金確認画面証跡",
        "事前確定運賃本体と各種料金の別行確認・精算",
        screenStart ? screenSub(screenStart + screenPages - 1, screenStart + screenPages - 1) : "—",
        "画面証跡資料P7"
      ],
      [
        "補足資料",
        "E2E確認結果・保存規程・改ざん検知説明",
        "本番相当環境E2E、データ保存規程、snapshotHash照合",
        range("integratedE2E") || range("integrated"),
        "統合説明資料第7〜8章、運用・監査説明資料"
      ]
    ];
  }

  function buildReportData(pageMap){
    return {
      title: TITLE,
      rows: buildRows(pageMap),
      meta: {
        createdAt: new Date().toISOString().slice(0, 10),
        createdBy: "管理画面",
        documentType: "一式提出候補版のページ対応表（再出力時に実ページへ更新）"
      }
    };
  }

  function computePageMap(parts){
    const map = {};
    let page = 1;
    (parts || []).forEach(function(part){
      const pages = Number(part.pages) || 0;
      if(pages < 1){
        return;
      }
      map[part.key] = {
        start: page,
        end: page + pages - 1,
        pages: pages
      };
      page += pages;
    });
    if(map.integrated){
      map.integratedE2E = {
        start: map.integrated.start,
        end: map.integrated.end,
        pages: map.integrated.pages
      };
    }
    return map;
  }

  global.PreFixedFareAttachmentIndexData = {
    TITLE: TITLE,
    buildReportData: buildReportData,
    buildRows: buildRows,
    computePageMap: computePageMap,
    formatPageRange: formatPageRange
  };
})(typeof window !== "undefined" ? window : globalThis);
