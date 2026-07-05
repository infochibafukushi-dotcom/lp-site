(function(global){
  const TITLE = "事前確定運賃 認可審査確認ポイント一覧";
  const INTRO =
    "本資料は、ちばケアタクシー 事前確定運賃システムについて、認可審査時に確認される主要項目と、その確認資料の掲載箇所を整理したものである。";

  const CHECKPOINTS = [
    {
      no: 1,
      point: "申請様式",
      content: "一般乗用旅客自動車運送事業の運賃及び料金（事前確定運賃）設定認可申請書として、申請者、営業区域、運賃及び料金の種類・額・適用方法を記載している。",
      document: "申請書",
      status: "記載済み"
    },
    {
      no: 2,
      point: "算定式",
      content: "電子地図で推計した走行予定ルートの距離に基づく距離制運賃へ、関東運輸局公示の平準化係数を乗じて算定する。",
      document: "システム概要、公示要件対応表、別紙1",
      status: "記載済み"
    },
    {
      no: 3,
      point: "時間距離併用制運賃の除外",
      content: "事前確定運賃の算定では、時間距離併用制運賃を用いず、距離制運賃を基準にする。",
      document: "算定式と運賃算定根拠",
      status: "記載済み"
    },
    {
      no: 4,
      point: "平準化係数",
      content: "千葉交通圏の平準化係数を使用する。",
      document: "平準化係数表",
      status: "記載済み"
    },
    {
      no: 5,
      point: "2以上の走行予定ルート提示",
      content: "電子地図により2以上の走行予定ルートを提示し、旅客が1つを選択できる。",
      document: "実画面証跡資料「利用者の走行予定ルート選択画面」",
      status: "画面証跡あり"
    },
    {
      no: 6,
      point: "有料道路利用有無の選択",
      content: "有料道路利用の有無をルート候補・明細上で確認でき、実費は別枠で扱う。",
      document: "画面証跡、運賃と各種料金の区分、別紙2",
      status: "記載済み"
    },
    {
      no: 7,
      point: "旅客同意",
      content: "事前確定運賃額、選択ルート、注意事項を表示し、旅客の同意を取得・保存する。",
      document: "実画面証跡資料「旅客同意確認画面」",
      status: "画面証跡あり"
    },
    {
      no: 8,
      point: "運転者への同一ルート提示",
      content: "乗務員が旅客同意済みの確定ルート及び事前確定運賃額を確認できる。",
      document: "実画面証跡資料「ドライバー用確定ルート確認画面」",
      status: "画面証跡あり"
    },
    {
      no: 9,
      point: "領収書・明細表示",
      content: "精算時に「事前確定運賃」として表示し、旅客へ明細を交付できる。",
      document: "実画面証跡資料「領収書・レシート明細画面」",
      status: "画面証跡あり"
    },
    {
      no: 10,
      point: "各種料金との区分",
      content: "迎車料、介助料、待機料、付き添い料、有料道路代、駐車場代等は、事前確定運賃とは区分して表示・精算する。",
      document: "運賃と各種料金の区分、別紙2 各種料金表",
      status: "記載済み"
    },
    {
      no: 11,
      point: "旅客都合ルート変更時の扱い",
      content: "旅客都合で走行予定ルートを変更する場合、事前確定運賃による運送を終了し、以後は別運送として扱う。",
      document: "旅客都合変更時の途中終了運用、Q&A",
      status: "記載済み"
    },
    {
      no: 12,
      point: "事故・通行止め等の迂回",
      content: "外的要因による迂回は旅客都合変更と区別し、記録を残して運用する。",
      document: "Q&A、運用・監査説明資料",
      status: "記載済み"
    },
    {
      no: 13,
      point: "候補1件時の扱い",
      content: "実質的に異なるルート候補が1件のみの場合は、事前確定運賃として断定せず、確認対応又は通常メーター扱いにする。",
      document: "判定ロジック、Q&A",
      status: "記載済み"
    },
    {
      no: 14,
      point: "監査証跡・保存",
      content: "見積、選択ルート、同意、運行、精算、領収書情報を保存し、監査時に確認できる。",
      document: "quoteSnapshot・証跡保存、運用・監査説明資料",
      status: "記載済み"
    },
    {
      no: 15,
      point: "整合性確認・改ざん検知",
      content: "同意時点のデータと運行・精算時点のデータをsnapshotHash等で照合する。",
      document: "snapshotHash、改ざん防止及びスナップショットハッシュの取扱い",
      status: "記載済み"
    },
    {
      no: 16,
      point: "運用開始前確認",
      content: "運用開始前に画面表示、精算、割引、福祉タクシー券、乗務員操作を最終確認する。",
      document: "運用開始前確認項目",
      status: "確認予定"
    }
  ];

  function buildReportData(){
    return {
      title: TITLE,
      intro: INTRO,
      checkpoints: CHECKPOINTS,
      meta: {
        createdAt: new Date().toISOString().slice(0, 10),
        createdBy: "管理画面",
        documentType: "認可審査時の確認資料として整理する提出候補版"
      }
    };
  }

  global.PreFixedFareReviewChecklistData = {
    TITLE: TITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
