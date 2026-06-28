(function(global){
  const SYSTEM_NAME = "LP見積・予約連携システム";
  const FILL_IN_PLACEHOLDER = "申請書本体・認可運賃表に基づき記入";

  const KANTO_UNCHIN_PAGE = "https://wwwtb.mlit.go.jp/kanto/jidou_koutu/tabi2/taxi_jigyoukaisi/unchin.html";

  const OFFICIAL_LINKS = [
    {
      label: "関東運輸局 タクシー関係申請手続き（運賃関係）",
      url: KANTO_UNCHIN_PAGE,
      note: "管内の運賃関係申請様式・公示資料の掲載ページ。"
    },
    {
      label: "事前確定運賃認可申請様式（Word）",
      url: KANTO_UNCHIN_PAGE,
      note: "正式提出用の申請様式は本ページから最新のWordファイルをダウンロードして使用する。本システムは公式様式を再現・改変しない。"
    },
    {
      label: "事前確定運賃に関する認可申請の取扱い",
      url: "https://www.mlit.go.jp/jidosha/content/001617012.pdf",
      note: "国土交通省の認可申請手続・添付資料等の取扱い（PDF）。"
    },
    {
      label: "事前確定運賃算定に用いる係数",
      url: KANTO_UNCHIN_PAGE,
      note: "関東運輸局公示の平準化係数は運賃関係ページの公示資料から確認する。"
    }
  ];

  function todayJst(){
    return new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function valueOrUnset(value){
    const text = String(value || "").trim();
    return text || "未設定";
  }

  function detectBusinessName(config, estimateConfig){
    return valueOrUnset(
      estimateConfig?.pdfFooter?.businessName
      || config?.businessName
      || config?.companyName
      || config?.shopName
    );
  }

  function detectOperatingArea(estimateConfig){
    const zones = Array.isArray(estimateConfig?.trafficZones?.items)
      ? estimateConfig.trafficZones.items
      : [];
    if(!zones.length){
      return "未設定";
    }
    return zones
      .slice()
      .sort(function(a, b){ return (a.order || 0) - (b.order || 0); })
      .map(function(zone){ return String(zone?.label || "").trim(); })
      .filter(Boolean)
      .join(" / ") || "未設定";
  }

  function coefficientSummary(estimateConfig){
    const zones = Array.isArray(estimateConfig?.trafficZones?.items)
      ? estimateConfig.trafficZones.items
      : [];
    if(!zones.length){
      return "関東運輸局公示済み平準化係数（申請書に基づき記入）";
    }
    return zones
      .slice()
      .sort(function(a, b){ return (a.order || 0) - (b.order || 0); })
      .map(function(zone){
        const label = String(zone?.label || "").trim();
        const coef = Number(zone?.coefficient);
        return label + (Number.isFinite(coef) ? "：" + coef.toFixed(2) : "");
      })
      .filter(Boolean)
      .join(" / ");
  }

  function serviceFeeRows(){
    return [
      ["乗車地から降車地までの運賃", FILL_IN_PLACEHOLDER, "含める", "事前確定運賃として表示", "事前確定運賃の本体"],
      ["迎車料金", FILL_IN_PLACEHOLDER, "原則別枠", "別行表示", "事前確定運賃とは区分"],
      ["予約料金", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "事前確定運賃とは区分"],
      ["介助料", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "介護タクシーサービス料金"],
      ["待機料", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "実待機に応じて精算"],
      ["付き添い料", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "実対応に応じて精算"],
      ["有料道路代", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "実費・別料金"],
      ["駐車場代", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "実費・別料金"],
      ["福祉タクシー券", FILL_IN_PLACEHOLDER, "精算側", "精算時表示", "運賃算定ではなく精算時充当"],
      ["障害者割引", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "適用時は割引前後を表示"],
      ["深夜早朝割増", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "適用時は明細上で区分"],
      ["キャンセル料", FILL_IN_PLACEHOLDER, "別枠", "別行表示", "キャンセルポリシーに基づく"]
    ];
  }

  function distanceFareFields(){
    return [
      ["事業者名", ""],
      ["営業区域", ""],
      ["適用交通圏", ""],
      ["運賃種別", "距離制運賃"],
      ["初乗運賃", FILL_IN_PLACEHOLDER],
      ["初乗距離", FILL_IN_PLACEHOLDER],
      ["加算運賃", FILL_IN_PLACEHOLDER],
      ["加算距離", FILL_IN_PLACEHOLDER],
      ["時間距離併用制の有無", FILL_IN_PLACEHOLDER],
      ["時間距離併用運賃", FILL_IN_PLACEHOLDER],
      ["深夜早朝割増", FILL_IN_PLACEHOLDER],
      ["障害者割引", FILL_IN_PLACEHOLDER],
      ["端数処理", FILL_IN_PLACEHOLDER],
      ["適用開始予定日", FILL_IN_PLACEHOLDER],
      ["備考", ""]
    ];
  }

  function applicationHelperFields(meta){
    return [
      ["事業者名", meta.businessName],
      ["営業区域", meta.operatingArea],
      ["適用する事前確定運賃の対象", "介護タクシー（福祉輸送限定）における事前確定運賃"],
      ["使用システム名", SYSTEM_NAME],
      ["使用する電子地図API", "Google Routes API"],
      ["算定式", "事前確定運賃 ＝ 距離制運賃 × 平準化係数（1円単位四捨五入）"],
      ["平準化係数", meta.coefficientSummary],
      ["距離制運賃表の別紙番号", "別紙1"],
      ["各種料金表の別紙番号", "別紙2"],
      ["利用者同意の取得方法", "見積結果画面の注意事項提示・同意チェック・consentAt / snapshotHash 保存"],
      ["走行予定ルートまたは主要経由地点の提示方法", "LP見積でルート候補表示・選択・quoteSnapshot 保存"],
      ["運転者への同一ルートまたは主要経由地点の提示方法", "メーターアプリ予約詳細で迎車地・降車地・ルートID等を表示（地図描画は運用開始前確認）"],
      ["旅客都合変更時の途中終了運用", "事前確定運賃M運行中のみ途中終了操作・当初同意済み運賃額を収受・通常メーター新規運行導線"],
      ["保存証跡", "quoteSnapshot / snapshotHash / caseRecords / meter_fixed_fare_runs / completion_status 等"],
      ["添付資料一覧", "統合説明資料、本別紙セット、E2E確認記録、申請予定または認可後の距離制運賃表"]
    ];
  }

  function deviceChecklistSections(){
    return [
      {
        title: "A. LP見積画面",
        items: [
          "走行予定ルートまたは主要経由地点が表示される",
          "事前確定運賃額が表示される",
          "迎車料金・予約料金・介助料等が別行表示される",
          "有料道路代は実費・別料金として表示される",
          "旅客都合変更時の注意事項が表示される",
          "同意して予約へ進む導線が表示される",
          "候補1件時は事前確定運賃として断定せず確認対応になる"
        ]
      },
      {
        title: "B. 予約システム・管理画面",
        items: [
          "予約詳細に事前確定運賃情報が表示される",
          "quoteSnapshot が保存されている",
          "snapshotHash が保存されている",
          "通常完了と旅客都合途中終了が区別できる",
          "旅客都合途中終了の予約詳細パネルが表示される"
        ]
      },
      {
        title: "C. メーターアプリ",
        items: [
          "事前確定M予約を読み込める",
          "予約情報・運賃情報が表示される",
          "同一ルートまたは主要経由地点を確認できる",
          "snapshotHashVerified が確認できる",
          "confirmedFareMatchesSnapshot が確認できる",
          "start-fixed-fare が実行できる",
          "complete-fixed-fare が実行できる",
          "領収書に「事前確定運賃」と表示される",
          "旅客都合変更で途中終了できる",
          "途中終了後に通常メーター新規運行導線が表示される",
          "事前確定運賃M以外の通常メーターモードの基本動作に影響がない"
        ]
      },
      {
        title: "D. 証跡保存",
        items: [
          "caseRecords に保存される",
          "meter_fixed_fare_runs に保存される",
          "completion_status が保存される",
          "completion_reason が保存される",
          "pre_fixed_fare_exception_json が保存される",
          "E2E確認結果を資料に記録した"
        ]
      }
    ];
  }

  function screenshotScreens(){
    return [
      { name: "LP見積入力画面", purpose: "出発地・目的地・利用条件の入力", note: "" },
      { name: "ルート候補表示画面", purpose: "複数ルート候補と選択UI", note: "" },
      { name: "事前確定運賃額表示画面", purpose: "確定運賃・明細区分の表示", note: "" },
      { name: "同意確認画面", purpose: "注意事項・同意チェック", note: "" },
      { name: "予約完了画面", purpose: "見積番号・予約導線", note: "" },
      { name: "管理画面予約詳細", purpose: "事前確定運賃・snapshot 表示", note: "" },
      { name: "メーターアプリ予約詳細", purpose: "予約情報・検証結果", note: "" },
      { name: "メーターアプリ運行開始前", purpose: "運行開始前の予約・運賃確認", note: "" },
      { name: "事前確定M運行中", purpose: "運行中画面", note: "" },
      { name: "精算前画面", purpose: "精算前の運賃表示", note: "" },
      { name: "領収書表示", purpose: "「事前確定運賃」表記", note: "" },
      { name: "旅客都合途中終了確認ダイアログ", purpose: "途中終了操作の確認", note: "" },
      { name: "旅客都合途中終了後の予約詳細", purpose: "completed_with_passenger_change 表示", note: "" },
      { name: "通常メーター新規運行開始導線", purpose: "精算後の通常メーター導線", note: "" }
    ];
  }

  const DOCUMENTS = {
    applicationHelper: {
      id: "application-helper",
      title: "事前確定運賃 認可申請様式リンク・記入補助シート",
      wordFilename: "pre-fixed-fare-application-helper.html",
      pdfFilename: "pre-fixed-fare-application-helper.pdf"
    },
    distanceFareTable: {
      id: "distance-fare-table",
      title: "別紙1　距離制運賃表",
      wordFilename: "pre-fixed-fare-distance-fare-table.html",
      pdfFilename: "pre-fixed-fare-distance-fare-table.pdf"
    },
    serviceFeeTable: {
      id: "service-fee-table",
      title: "別紙2　各種料金表",
      wordFilename: "pre-fixed-fare-service-fee-table.html",
      pdfFilename: "pre-fixed-fare-service-fee-table.pdf"
    },
    deviceChecklist: {
      id: "device-checklist",
      title: "別紙3　実機目視確認チェックリスト",
      wordFilename: "pre-fixed-fare-device-checklist.html",
      pdfFilename: "pre-fixed-fare-device-checklist.pdf"
    },
    screenshotSheet: {
      id: "screenshot-sheet",
      title: "別紙4　画面スクリーンショット台紙",
      wordFilename: "pre-fixed-fare-screenshot-sheet.html",
      pdfFilename: "pre-fixed-fare-screenshot-sheet.pdf"
    },
    fullSet: {
      id: "submission-appendix-set",
      title: "事前確定運賃 提出用別紙セット",
      wordFilename: "pre-fixed-fare-submission-appendix-set.html",
      pdfFilename: "pre-fixed-fare-submission-appendix-set.pdf"
    }
  };

  function buildMeta(options){
    const config = options?.config || {};
    const estimateConfig = options?.estimateConfig || {};
    return {
      businessName: detectBusinessName(config, estimateConfig),
      operatingArea: detectOperatingArea(estimateConfig),
      coefficientSummary: coefficientSummary(estimateConfig),
      createdAt: todayJst(),
      createdBy: "LP管理画面",
      systemName: SYSTEM_NAME
    };
  }

  function buildDocumentPayload(documentId, options){
    const meta = buildMeta(options);
    const doc = Object.values(DOCUMENTS).find(function(item){
      return item.id === documentId;
    });
    if(!doc){
      throw new Error("不明な別紙資料ID: " + documentId);
    }

    const base = {
      documentId: doc.id,
      title: doc.title,
      wordFilename: doc.wordFilename,
      pdfFilename: doc.pdfFilename,
      meta: meta
    };

    if(documentId === "application-helper"){
      return Object.assign(base, {
        intro: [
          "正式な申請様式は、関東運輸局の「事前確定運賃認可申請様式（Word）」を使用する。",
          "本シートは、公式様式へ転記するための記入補助資料である。",
          "最終的な様式の記入・押印・添付書類確認は申請担当者が行う。"
        ],
        officialLinks: OFFICIAL_LINKS,
        helperFields: applicationHelperFields(meta),
        notice: "本シートは公式申請様式ではありません。正式提出時は、関東運輸局が公表する最新の認可申請様式を使用してください。"
      });
    }

    if(documentId === "distance-fare-table"){
      return Object.assign(base, {
        intro: [
          "本別紙は、事前確定運賃の算定元となる距離制運賃表を示すものである。",
          "実際の申請時には、申請予定または認可後の距離制運賃表に基づき、初乗運賃・加算運賃・時間距離併用運賃等を記入する。"
        ],
        fields: distanceFareFields().map(function(row){
          if(row[0] === "事業者名"){
            return [row[0], meta.businessName];
          }
          if(row[0] === "営業区域"){
            return [row[0], meta.operatingArea];
          }
          if(row[0] === "適用交通圏"){
            return [row[0], meta.operatingArea];
          }
          return row;
        })
      });
    }

    if(documentId === "service-fee-table"){
      return Object.assign(base, {
        intro: [
          "迎車料金、予約料金、介助料、待機料、有料道路代等は、事前確定運賃とは区分し、見積明細および領収書明細上も別行で表示する。",
          "事前確定運賃は、原則として乗車地から降車地までの運賃部分を対象とする。"
        ],
        feeRows: serviceFeeRows()
      });
    }

    if(documentId === "device-checklist"){
      return Object.assign(base, {
        intro: [
          "運用開始前に、人が実画面を確認した証跡として使用する。",
          "□ は未確認、■ は確認済み。印刷後に手書きチェックも可能。"
        ],
        sections: deviceChecklistSections(),
        signatureFields: ["確認日", "確認者", "確認端末", "備考"]
      });
    }

    if(documentId === "screenshot-sheet"){
      return Object.assign(base, {
        intro: [
          "運輸局への説明時に、画面の見た目を紙で説明するための台紙である。",
          "各欄にスクリーンショットを貼付し、画面名・確認内容・備考を記入する。"
        ],
        screens: screenshotScreens()
      });
    }

    if(documentId === "submission-appendix-set"){
      return Object.assign(base, {
        intro: [
          "事前確定運賃認可の事前相談・提出時に、統合説明資料へ添付しやすい別紙・確認資料の一式である。",
          "各別紙はWord上で改ページ・余白・表を手動調整して使用する。"
        ],
        parts: [
          "application-helper",
          "distance-fare-table",
          "service-fee-table",
          "device-checklist",
          "screenshot-sheet"
        ]
      });
    }

    throw new Error("別紙資料の組み立てに失敗しました: " + documentId);
  }

  global.PreFixedFareSubmissionAppendixData = {
    DOCUMENTS: DOCUMENTS,
    FILL_IN_PLACEHOLDER: FILL_IN_PLACEHOLDER,
    buildMeta: buildMeta,
    buildDocumentPayload: buildDocumentPayload
  };
})(typeof window !== "undefined" ? window : globalThis);
