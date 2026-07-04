(function(global){
  const SYSTEM_NAME = "LP見積・予約連携システム";
  const FILL_IN_PLACEHOLDER = "申請書本体・認可運賃表に基づき記入";
  const DEFAULT_COMPANY_NAME = "株式会社 千葉福祉サポート";
  const DEFAULT_TRADE_NAME = "ちばケアタクシー";
  const OPERATING_AREA_FILL = "申請書本体に記載の営業区域に合わせて記入";
  const TRAFFIC_ZONE_FILL = "申請書本体に記載の営業区域に対応する交通圏を記入";
  const COEFFICIENT_FILL = "申請対象交通圏について、関東運輸局公示の係数を転記";

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

  function detectCompanyName(config){
    const text = String(config?.companyName || "").trim();
    return text || DEFAULT_COMPANY_NAME;
  }

  function detectTradeName(config, estimateConfig){
    return String(
      estimateConfig?.pdfFooter?.businessName
      || config?.businessName
      || config?.shopName
      || ""
    ).trim() || DEFAULT_TRADE_NAME;
  }

  function buildCoefficientReferenceRows(estimateConfig){
    const zones = Array.isArray(estimateConfig?.trafficZones?.items)
      ? estimateConfig.trafficZones.items
      : [];
    if(!zones.length){
      return [];
    }
    return zones
      .slice()
      .sort(function(a, b){ return (a.order || 0) - (b.order || 0); })
      .map(function(zone){
        const label = String(zone?.label || "").trim();
        const coef = Number(zone?.coefficient);
        return [
          label || "（名称未設定）",
          Number.isFinite(coef) ? coef.toFixed(2) : "関東運輸局公示を確認"
        ];
      })
      .filter(function(row){ return row[0]; });
  }

  function formatEstimateYen(amount){
    const value = Number(amount);
    if(!Number.isFinite(value)){
      return "";
    }
    return value.toLocaleString("ja-JP") + "円";
  }

  function findPreFixedTimeAdjustment(estimateConfig){
    const components = Array.isArray(estimateConfig?.fareComponents?.pre_fixed_fare)
      ? estimateConfig.fareComponents.pre_fixed_fare
      : [];
    return components.find(function(component){
      return String(component?.key || "") === "timeAdjustment";
    }) || null;
  }

  function buildEstimateFareItemRows(estimateConfig){
    const config = estimateConfig || {};
    const basic = config.basicFees || {};
    const waitingFees = config.waitingFees || {};
    const timeAdjustment = findPreFixedTimeAdjustment(config);
    const timeParams = timeAdjustment?.params || {};
    const rows = [];

    rows.push([
      "事前確定運賃本体",
      "距離制運賃×平準化係数（1円単位四捨五入）",
      "含める",
      "事前確定運賃として表示",
      "乗車地から降車地までの走行予定ルートに基づく運賃本体（data/estimate-config.json distancePricing・trafficZones、estimate/estimate-calc.js computeFixedFareBreakdown）",
      "見積「事前確定運賃」セクション（fixedFareBreakdown・adjustedDistanceFareAmount）"
    ]);

    if(basic.pickupFee){
      rows.push([
        "迎車料",
        formatEstimateYen(basic.pickupFee.amount) + "/回",
        "含めない（別枠）",
        "別行表示",
        "data/estimate-config.json basicFees.pickupFee（固定料金）",
        "fixedFareBreakdown・見積明細に表示（estimate/estimate-calc.js）"
      ]);
    }

    rows.push([
      "予約料",
      "設定なし",
      "—",
      "—",
      "LP見積設定（data/estimate-config.json）に予約料項目なし",
      "LP見積では未使用"
    ]);

    if(basic.specialVehicleFee){
      rows.push([
        "特殊車両使用料",
        formatEstimateYen(basic.specialVehicleFee.amount) + "/回",
        "含めない（別枠）",
        "別行表示（介助・サービス料金）",
        "data/estimate-config.json basicFees.specialVehicleFee",
        "serviceFees・見積「介助・サービス料金」セクション（estimate/estimate-calc.js）"
      ]);
    }

    const assistanceItems = Array.isArray(config.categories?.assistance?.items)
      ? config.categories.assistance.items
      : [];
    assistanceItems.forEach(function(item){
      if(item?.visible === false){
        return;
      }
      const amountLabel = formatEstimateYen(item.amount) + "/回";
      rows.push([
        item.label || item.id || "介助料",
        amountLabel,
        "含めない（別枠）",
        Number(item.amount) > 0 ? "別行表示（介助・サービス料金）" : "金額0のため通常非表示",
        "data/estimate-config.json categories.assistance." + String(item.id || ""),
        "介助内容選択時にserviceFees（assistanceFee）へ反映"
      ]);
    });

    const stairItems = Array.isArray(config.categories?.stairAssist?.items)
      ? config.categories.stairAssist.items
      : [];
    stairItems.forEach(function(item){
      if(item?.visible === false || String(item.id || "") === "stair-none"){
        return;
      }
      rows.push([
        "階段介助（" + String(item.label || item.id || "") + "）",
        formatEstimateYen(item.amount) + "/回",
        "含めない（別枠）",
        Number(item.amount) > 0 ? "別行表示（介助・サービス料金）" : "金額0のため通常非表示",
        "data/estimate-config.json categories.stairAssist." + String(item.id || ""),
        "階段介助選択時にserviceFees（stairFee）へ反映"
      ]);
    });

    const mobilityItems = Array.isArray(config.categories?.mobility?.items)
      ? config.categories.mobility.items
      : [];
    mobilityItems.forEach(function(item){
      if(item?.visible === false || !Number(item.amount)){
        return;
      }
      rows.push([
        String(item.label || item.id || "移動方法加算") + "（移動方法）",
        formatEstimateYen(item.amount) + "/回",
        "含めない（別枠）",
        "別行表示（介助・サービス料金）",
        "data/estimate-config.json categories.mobility." + String(item.id || ""),
        "移動方法選択時にserviceFees（wheelchairFee）へ反映"
      ]);
    });

    if(waitingFees.waiting30min){
      rows.push([
        waitingFees.waiting30min.label || "待機料",
        formatEstimateYen(waitingFees.waiting30min.amount) + "/30分",
        "含めない（別枠）",
        "別行表示（介助・サービス料金）",
        "data/estimate-config.json waitingFees.waiting30min（往復＋待機選択時）",
        "roundTripAddon選択時にwaitingFeeへ反映"
      ]);
    }

    if(waitingFees.escort30min){
      rows.push([
        waitingFees.escort30min.label || "付き添い料",
        formatEstimateYen(waitingFees.escort30min.amount) + "/30分",
        "含めない（別枠）",
        "別行表示（介助・サービス料金）",
        "data/estimate-config.json waitingFees.escort30min（往復＋付き添い選択時）",
        "roundTripAddon選択時にescortFeeへ反映"
      ]);
    }

    if(timeAdjustment){
      const baseMinutes = Number(timeParams.baseMinutes) || 0;
      const blockMinutes = Number(timeParams.perBlockMinutes) || 0;
      const blockAmount = Number(timeParams.perBlockAmount) || 0;
      rows.push([
        timeAdjustment.label || "予定時間加算（概算）",
        formatEstimateYen(blockAmount) + "/" + blockMinutes + "分（" + baseMinutes + "分以内0円）",
        "含めない（別枠）",
        "別行表示",
        "data/estimate-config.json fareComponents.pre_fixed_fare.timeAdjustment",
        "fixedFareBreakdown（timeAdjustment）へ反映"
      ]);
    }

    rows.push([
      "有料道路代",
      "実費",
      "含めない（別枠）",
      "実費・別途費用",
      "roadType=toll時にexpenses（tollRoadExpense）へ追加。金額は見積で算定しない（page.tollRoadNote）",
      "見積「実費・別途費用」セクション（estimate/estimate-calc.js）"
    ]);

    rows.push([
      "駐車場代",
      "実費",
      "含めない（別枠）",
      "注意書きのみ",
      "固定金額設定なし",
      "見積注意書きのみ（estimate/estimate-main.js）"
    ]);

    rows.push([
      "障害者割引",
      "精算時確定",
      "精算側",
      "精算時表示",
      "見積には反映しない（data/estimate-config.json page.disclaimer）",
      "LP見積では未使用（精算時に記録）"
    ]);

    rows.push([
      "福祉タクシー券",
      "精算時充当",
      "精算側",
      "精算時表示",
      "運賃算定に含めない（data/estimate-config.json page.disclaimer）",
      "LP見積では未使用（精算時充当）"
    ]);

    rows.push([
      "キャンセル料",
      "設定なし",
      "—",
      "—",
      "LP見積設定・計算ロジックに未実装",
      "LP見積では未使用"
    ]);

    return rows;
  }

  function distanceFareFields(meta){
    const fc = global.FareConstants || {};
    const fareLabel = fc.FARE_LABEL_WITH_NOTICE || "令和8年2月13日付け 関自旅二第4314号 千葉地区 大型車B運賃";
    return [
      ["事業者名", meta.companyName],
      ["屋号", meta.tradeName],
      ["営業区域", meta.operatingArea],
      ["適用交通圏", meta.trafficZone],
      ["運賃種別", fareLabel],
      ["初乗運賃", (fc.INITIAL_FARE_YEN || 520) + "円"],
      ["初乗距離", (fc.INITIAL_DISTANCE_KM || 1.06) + "km"],
      ["加算運賃", (fc.ADDITIONAL_FARE_YEN || 100) + "円"],
      ["加算距離", (fc.ADDITIONAL_DISTANCE_M || 212) + "m"],
      ["時間距離併用制の有無", "有"],
      ["時間距離併用運賃", "1分20秒ごとに " + (fc.TIME_DISTANCE_FARE_YEN || 100) + "円"],
      ["時間制運賃", (fc.CHARTER_UNIT_MINUTES || 30) + "分ごとに " + (fc.CHARTER_UNIT_FARE_YEN || 4180) + "円"],
      ["深夜早朝割増", FILL_IN_PLACEHOLDER],
      ["障害者割引", FILL_IN_PLACEHOLDER],
      ["端数処理", FILL_IN_PLACEHOLDER],
      ["適用開始予定日", FILL_IN_PLACEHOLDER],
      ["備考", ""]
    ];
  }

  function applicationHelperFields(meta){
    return [
      ["事業者名", meta.companyName],
      ["屋号", meta.tradeName],
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

  function screenCaptureEvidenceScreens(){
    return [
      {
        name: "利用者の走行予定ルート選択画面",
        imageFile: "01_route_selection_EST-20260705-3755.png",
        purpose: "2以上の走行予定ルート候補を提示し、旅客が1つのルートを選択できる画面です。",
        note: "見積番号 EST-20260705-3755"
      },
      {
        name: "旅客同意確認画面",
        imageFile: "02_consent_confirm_EST-20260705-3755.png",
        purpose: "選択ルート・事前確定運賃額・注意事項を確認し、旅客同意を取得する画面です。",
        note: ""
      },
      {
        name: "ドライバー用確定ルート確認画面",
        imageFile: "03_confirmed_route_202607050600.png",
        purpose: "乗務員が旅客同意済みの確定ルート及び事前確定運賃額を確認する画面です。",
        note: "予約ID 202607050600"
      },
      {
        name: "領収書・レシート明細画面",
        imageFile: "04_receipt_detail_202607050600.png",
        purpose: "検証用予約データに基づき、事前確定運賃の精算・帳票表示を確認する画面です。",
        note: "案件番号 260705-MAINS-0001"
      }
    ];
  }

  const SCREEN_CAPTURE_VERIFICATION_NOTE =
    "本ページの画面画像は、申請者本人による検証用予約データを使用した操作証跡です。実在の第三者利用者の個人情報は含まれていません。";

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
    screenCaptureEvidence: {
      id: "screen-capture-evidence",
      title: "別紙4　画面キャプチャ貼付資料",
      wordFilename: "pre-fixed-fare-screen-capture-evidence.html",
      pdfFilename: "pre-fixed-fare-screen-capture-evidence.pdf"
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
      companyName: detectCompanyName(config),
      tradeName: detectTradeName(config, estimateConfig),
      operatingArea: OPERATING_AREA_FILL,
      trafficZone: TRAFFIC_ZONE_FILL,
      coefficientSummary: COEFFICIENT_FILL,
      coefficientReferenceRows: buildCoefficientReferenceRows(estimateConfig),
      createdAt: todayJst(),
      createdBy: "管理画面",
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
        coefficientReferenceRows: meta.coefficientReferenceRows,
        notice: "本シートは公式申請様式ではありません。正式提出時は、関東運輸局が公表する最新の認可申請様式を使用してください。"
      });
    }

    if(documentId === "distance-fare-table"){
      return Object.assign(base, {
        intro: [
          "本別紙は、事前確定運賃の算定元となる距離制運賃表を示すものである。",
          "実際の申請時には、申請予定または認可後の距離制運賃表に基づき、初乗運賃・加算運賃・時間距離併用運賃等を記入する。"
        ],
        fields: distanceFareFields(meta),
        coefficientReferenceRows: meta.coefficientReferenceRows
      });
    }

    if(documentId === "service-fee-table"){
      const estimateConfig = options?.estimateConfig || {};
      const updatedAt = String(estimateConfig.updatedAt || "").trim();
      return Object.assign(base, {
        intro: [
          "本表は、事前確定運賃とは別に収受又は精算する各種料金・付帯サービス料金・実費・割引等を整理したものである。",
          "事前確定運賃は、原則として乗車地から降車地までの走行予定ルートに基づく運賃本体を対象とする。",
          "迎車料、予約料、介助料、待機料、付き添い料、有料道路代、駐車場代等は、事前確定運賃とは区分し、見積明細及び領収書明細に別行で表示する。"
        ],
        feeRows: buildEstimateFareItemRows(estimateConfig),
        sourceNote: "金額は data/estimate-config.json および estimate/estimate-calc.js の設定・計算ロジックに基づく"
          + (updatedAt ? "（設定更新: " + updatedAt + "）" : "") + "。"
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

    if(documentId === "screen-capture-evidence"){
      return Object.assign(base, {
        intro: [
          "運輸局への説明時に、画面の見た目を紙で説明するための貼付資料である。",
          "検証用予約データに基づく実画面を掲載する。"
        ],
        verificationNote: SCREEN_CAPTURE_VERIFICATION_NOTE,
        screens: screenCaptureEvidenceScreens()
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
      const defaultParts = [
        "application-helper",
        "distance-fare-table",
        "service-fee-table",
        "device-checklist",
        "screen-capture-evidence"
      ];
      const parts = Array.isArray(options?.appendixParts) && options.appendixParts.length
        ? options.appendixParts
        : defaultParts;
      return Object.assign(base, {
        intro: [
          "事前確定運賃認可の事前相談・提出時に、統合説明資料へ添付しやすい別紙・確認資料の一式である。",
          "各別紙はWord上で改ページ・余白・表を手動調整して使用する。"
        ],
        parts: parts
      });
    }

    throw new Error("別紙資料の組み立てに失敗しました: " + documentId);
  }

  global.PreFixedFareSubmissionAppendixData = {
    DOCUMENTS: DOCUMENTS,
    FILL_IN_PLACEHOLDER: FILL_IN_PLACEHOLDER,
    DEFAULT_COMPANY_NAME: DEFAULT_COMPANY_NAME,
    DEFAULT_TRADE_NAME: DEFAULT_TRADE_NAME,
    OPERATING_AREA_FILL: OPERATING_AREA_FILL,
    TRAFFIC_ZONE_FILL: TRAFFIC_ZONE_FILL,
    COEFFICIENT_FILL: COEFFICIENT_FILL,
    buildMeta: buildMeta,
    buildDocumentPayload: buildDocumentPayload,
    buildEstimateFareItemRows: buildEstimateFareItemRows
  };
})(typeof window !== "undefined" ? window : globalThis);
