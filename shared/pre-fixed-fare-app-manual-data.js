(function(global){
  const PRE_FIXED_FARE_MANUAL_LINKS = {
    estimateReservation: "./estimate/?scenario=pre-fixed-fare-demo",
    operationManual: "./manual/pre-fixed-fare-operation.html"
  };

  const IMAGE_BASE = "./assets/manual/pre-fixed-fare/";
  const PDF_FILENAME = "pre-fixed-fare-app-operation-manual.pdf";
  const EXPECTED_PAGE_COUNT = 16;

  const COMPANY = {
    name: "株式会社 千葉福祉サポート",
    brand: "ちばケアタクシー"
  };

  const COVER = {
    titleLine1: "事前確定運賃",
    titleLine2: "予約・運行中アプリ操作マニュアル",
    subtitle: "かんたん見積から予約、運行、精算までの実践手順"
  };

  const QR_ITEMS = [
    {
      id: "estimateReservation",
      label: "QR①",
      title: "かんたん見積～予約実践",
      description: "利用者が乗車地・目的地を入力し、ルート・運賃を確認して予約する流れを確認します。",
      urlKey: "estimateReservation"
    },
    {
      id: "operationManual",
      label: "QR②",
      title: "運行中のメーター操作",
      description: "乗務員が予約確認、運行開始、運行中操作、精算、領収書保存を行う流れを確認します。",
      urlKey: "operationManual"
    }
  ];

  const PURPOSE = {
    paragraphs: [
      "本資料は、事前確定運賃の予約から運行、精算までのアプリ操作を説明するものです。",
      "利用者が乗車前に、乗車地・目的地・走行予定ルート・事前確定運賃額を確認し、同意したうえで予約できることを示します。",
      "また、乗務員が予約内容、走行予定ルート、確定運賃額を確認し、運行開始から精算・領収書保存まで一貫して操作できることを示します。"
    ],
    demoNote:
      "審査用QRから操作した予約データは、本番予約と区別して管理する想定です（デモ予約・審査用ログとして保存）。"
  };

  const OVERALL_FLOW = [
    "かんたん見積を開く",
    "乗車地・目的地を入力",
    "走行予定ルートを確認",
    "事前確定運賃額を確認",
    "注意事項を確認し、旅客が同意",
    "予約内容を保存",
    "管理画面で予約確認",
    "乗務員アプリで予約選択",
    "運行開始",
    "運行中のメーター操作",
    "必要に応じて待機・介助料金を記録",
    "到着後に精算",
    "領収書・PDFを保存"
  ];

  const RESERVATION_SAVE_TABLE = {
    headers: ["項目", "内容"],
    rows: [
      ["予約ID", "予約を識別する番号"],
      ["乗車地", "利用者が指定した出発地"],
      ["目的地", "利用者が指定した到着地"],
      ["走行予定ルート", "事前に提示したルート"],
      ["事前確定運賃額", "乗車前に確定した運賃"],
      ["同意日時", "利用者が同意した日時"],
      ["予約ステータス", "受付済み・確認済みなど"]
    ]
  };

  const ROUTE_CHANGE_TABLE = {
    headers: ["ケース", "アプリ操作", "収受方針"],
    rows: [
      ["渋滞", "通常運行継続", "事前確定運賃"],
      ["事故・通行止め", "同意を得て迂回", "事前確定運賃"],
      ["運転者判断の迂回", "同意を記録", "事前確定運賃"],
      ["旅客都合の目的地変更", "事前確定運賃を終了", "新たな運送として扱う"],
      ["大規模交通規制", "状況に応じて通常運賃等へ切替", "事前説明のうえ対応"]
    ]
  };

  const CHECKLIST_TABLE = {
    headers: ["確認項目", "対応画面"],
    rows: [
      ["乗車地・目的地を入力できる", "かんたん見積画面"],
      ["走行予定ルートを表示できる", "ルート確認画面"],
      ["事前確定運賃額を提示できる", "見積結果画面"],
      ["利用者が注意事項を確認できる", "同意画面"],
      ["利用者の同意を記録できる", "予約保存画面"],
      ["事業者が予約内容を確認できる", "管理画面"],
      ["乗務員がルート・運賃を確認できる", "乗務員アプリ"],
      ["運行開始から精算まで操作できる", "メーター画面"],
      ["ルート変更時の対応を説明できる", "例外処理画面"],
      ["領収書・PDFを保存できる", "精算後画面"]
    ]
  };

  const STEP_PAGES = [
    {
      pageId: "step-01",
      stepLabel: "STEP 1",
      title: "かんたん見積を開く",
      description: "利用者はLPまたはQRコードから、かんたん見積画面を開きます。",
      highlights: ["かんたん見積ボタン", "予約導線", "事前確定運賃の対象であることがわかる表示"],
      screenshot: {
        imageFile: "estimate-step-01.png",
        placeholderLabel: "かんたん見積：トップ画面",
        callouts: [
          { number: 1, text: "LPまたはQRからかんたん見積を開きます。" },
          { number: 2, text: "事前確定運賃対象である表示を確認します。" },
          { number: 3, text: "予約導線へ進みます。" }
        ]
      }
    },
    {
      pageId: "step-02",
      stepLabel: "STEP 2",
      title: "乗車地・目的地を入力",
      description: "利用者は乗車地と目的地を入力します。この情報をもとに走行予定ルートと事前確定運賃額を算定します。",
      highlights: ["乗車地入力欄", "目的地入力欄", "ルート検索ボタン"],
      screenshot: {
        imageFile: "estimate-step-02.png",
        placeholderLabel: "かんたん見積：乗車地・目的地入力画面",
        callouts: [
          { number: 1, text: "乗車地を入力します。" },
          { number: 2, text: "目的地を入力します。" },
          { number: 3, text: "「ルートを確認する」を押します。" }
        ]
      }
    },
    {
      pageId: "step-03",
      stepLabel: "STEP 3",
      title: "走行予定ルートと運賃を確認",
      description: "入力された乗車地・目的地をもとに、走行予定ルートと事前確定運賃額を表示します。複数ルートがある場合は、利用者が比較できるようにします。",
      highlights: ["地図", "Aルート", "Bルート", "事前確定運賃額", "距離", "所要時間目安"],
      screenshot: {
        imageFile: "estimate-step-03.png",
        placeholderLabel: "かんたん見積：ルート・運賃確認画面",
        callouts: [
          { number: 1, text: "地図上で走行予定ルートを確認します。" },
          { number: 2, text: "Aルート・Bルート等を比較します。" },
          { number: 3, text: "事前確定運賃額・距離・所要時間を確認します。" }
        ]
      }
    },
    {
      pageId: "step-04",
      stepLabel: "STEP 4",
      title: "注意事項を確認し、同意する",
      description: "利用者は、走行予定ルート、事前確定運賃額、ルート変更時の取扱いを確認し、同意したうえで予約に進みます。",
      highlights: ["注意事項", "同意チェック", "予約へ進むボタン"],
      screenshot: {
        imageFile: "estimate-step-04.png",
        placeholderLabel: "かんたん見積：同意確認画面",
        callouts: [
          { number: 1, text: "注意事項を確認します。" },
          { number: 2, text: "同意チェックを入れます。" },
          { number: 3, text: "「予約へ進む」を押します。" }
        ]
      }
    }
  ];

  const CONTENT_PAGES = [
    {
      pageId: "reservation-save",
      title: "予約内容の保存",
      description: "同意後、予約内容を保存します。保存される情報には、乗車地、目的地、走行予定ルート、事前確定運賃額、同意日時を含めます。",
      table: RESERVATION_SAVE_TABLE,
      screenshot: {
        imageFile: "reservation-save.png",
        placeholderLabel: "予約保存：予約内容確認画面",
        callouts: [
          { number: 1, text: "保存される予約内容を確認します。" },
          { number: 2, text: "走行予定ルート・事前確定運賃額を確認します。" },
          { number: 3, text: "同意日時が記録されることを確認します。" }
        ]
      }
    },
    {
      pageId: "admin-confirm",
      title: "管理画面で予約確認",
      description: "事業者は管理画面で、事前確定運賃予約の内容を確認します。予約内容、走行予定ルート、確定運賃額、利用者同意の有無を確認できます。",
      highlights: ["予約一覧", "予約詳細", "事前確定運賃フラグ", "走行予定ルート", "確定運賃額", "同意済み表示"],
      screenshot: {
        imageFile: "admin-confirm.png",
        placeholderLabel: "管理画面：事前確定運賃予約詳細",
        callouts: [
          { number: 1, text: "予約一覧から対象予約を選びます。" },
          { number: 2, text: "走行予定ルート・確定運賃額を確認します。" },
          { number: 3, text: "同意済み表示・事前確定運賃フラグを確認します。" }
        ]
      }
    },
    {
      pageId: "driver-select",
      title: "乗務員アプリで予約選択",
      description: "乗務員はアプリで予約を選択し、乗車地、目的地、走行予定ルート、事前確定運賃額を確認します。",
      highlights: ["予約一覧", "予約詳細", "運行開始ボタン", "事前確定運賃対象表示"],
      screenshot: {
        imageFile: "driver-select.png",
        placeholderLabel: "乗務員アプリ：予約選択画面",
        callouts: [
          { number: 1, text: "予約一覧から対象予約を選びます。" },
          { number: 2, text: "走行予定ルート・事前確定運賃額を確認します。" },
          { number: 3, text: "運行開始ボタンへ進みます。" }
        ]
      }
    },
    {
      pageId: "operation-start",
      title: "運行開始",
      description: "乗務員は予約内容を確認したうえで運行を開始します。運行開始後も、事前確定運賃額と走行予定ルートを確認できるようにします。",
      highlights: ["運行開始ボタン", "確定運賃額", "走行予定ルート", "運行ステータス"],
      screenshot: {
        imageFile: "operation-start.png",
        placeholderLabel: "乗務員アプリ：運行開始画面",
        callouts: [
          { number: 1, text: "確定運賃額を確認します。" },
          { number: 2, text: "走行予定ルートを確認します。" },
          { number: 3, text: "「運行開始」を押します。" }
        ]
      }
    },
    {
      pageId: "meter-operation",
      title: "運行中のメーター操作",
      description: "運行中は、走行、待機、介助などの状態を記録できます。事前確定運賃の運行では、乗車前に確定した運賃額を基準として精算します。",
      highlights: ["走行中", "待機", "介助", "精算へ進む", "確定運賃額表示"],
      screenshot: {
        imageFile: "meter-operation.png",
        placeholderLabel: "乗務員アプリ：運行中メーター画面",
        callouts: [
          { number: 1, text: "走行中・待機・介助の状態を記録します。" },
          { number: 2, text: "確定運賃額表示を確認します。" },
          { number: 3, text: "到着後「精算へ進む」を押します。" }
        ]
      }
    },
    {
      pageId: "route-change",
      title: "ルート変更・迂回時の対応",
      description:
        "事故、通行止め、交通規制など外的要因によりルート変更が必要な場合は、旅客の同意を得たうえで迂回します。この場合、収受する運賃は原則として事前確定運賃額とします。\n\n旅客都合により目的地変更や大幅な経路変更が発生した場合は、事前確定運賃による運送を一度終了し、必要に応じて新たな運送として扱います。",
      table: ROUTE_CHANGE_TABLE,
      screenshot: {
        imageFile: "route-change.png",
        placeholderLabel: "例外処理：ルート変更・迂回時の操作画面",
        callouts: [
          { number: 1, text: "ルート変更の理由を確認します。" },
          { number: 2, text: "旅客同意を記録します。" },
          { number: 3, text: "収受方針に沿って操作を継続します。" }
        ]
      }
    },
    {
      pageId: "settlement",
      title: "到着・精算",
      description: "目的地到着後、精算画面で事前確定運賃額を確認します。運賃、介助料金、待機料金、その他料金を区分して表示します。",
      highlights: ["確定運賃額", "介助料金", "待機料金", "障害者割引", "合計金額", "精算確定ボタン"],
      screenshot: {
        imageFile: "settlement.png",
        placeholderLabel: "乗務員アプリ：精算画面",
        callouts: [
          { number: 1, text: "確定運賃額・各種料金を確認します。" },
          { number: 2, text: "割引・合計金額を確認します。" },
          { number: 3, text: "「精算確定」を押します。" }
        ]
      }
    },
    {
      pageId: "receipt-pdf",
      title: "領収書・PDF保存",
      description: "精算後、領収書またはレシートPDFを保存できます。必要に応じて印刷・再発行できるようにします。",
      highlights: ["領収書PDF保存", "レシートPDF保存", "印刷ボタン", "再発行導線"],
      screenshot: {
        imageFile: "receipt-pdf.png",
        placeholderLabel: "精算後：領収書・PDF保存画面",
        callouts: [
          { number: 1, text: "領収書PDFまたはレシートPDFを保存します。" },
          { number: 2, text: "必要に応じて印刷します。" },
          { number: 3, text: "再発行導線から再出力できます。" }
        ]
      }
    }
  ];

  function resolveManualUrl(urlKey){
    const key = String(urlKey || "").trim();
    const relative = PRE_FIXED_FARE_MANUAL_LINKS[key] || "";
    if(!relative){
      return "";
    }
    if(typeof window !== "undefined" && window.location && window.location.href){
      try{
        return new URL(relative, window.location.href).href;
      }catch(error){
        return relative;
      }
    }
    return relative;
  }

  function buildScreenshotEntry(screenshot){
    if(!screenshot){
      return null;
    }
    return {
      imageFile: screenshot.imageFile || "",
      imageSrc: IMAGE_BASE + (screenshot.imageFile || ""),
      placeholderLabel: screenshot.placeholderLabel || "",
      placeholderOnly: screenshot.placeholderOnly !== false,
      callouts: Array.isArray(screenshot.callouts) ? screenshot.callouts.slice() : []
    };
  }

  function buildReportData(options){
    options = options || {};
    const createdAt = options.createdAt || new Date().toLocaleDateString("ja-JP");
    const steps = STEP_PAGES.map(function(page){
      return Object.assign({}, page, {
        screenshot: buildScreenshotEntry(page.screenshot)
      });
    });
    const contentPages = CONTENT_PAGES.map(function(page){
      return Object.assign({}, page, {
        screenshot: buildScreenshotEntry(page.screenshot)
      });
    });

    return {
      title: COVER.titleLine1 + " " + COVER.titleLine2,
      pdfFilename: PDF_FILENAME,
      expectedPageCount: EXPECTED_PAGE_COUNT,
      links: Object.assign({}, PRE_FIXED_FARE_MANUAL_LINKS),
      meta: {
        createdAt: createdAt,
        createdBy: "管理画面",
        documentType: "予約・運行中アプリ操作マニュアル（認可説明用）"
      },
      cover: Object.assign({}, COVER, { company: Object.assign({}, COMPANY) }),
      qrItems: QR_ITEMS.map(function(item){
        return Object.assign({}, item, {
          url: PRE_FIXED_FARE_MANUAL_LINKS[item.urlKey] || ""
        });
      }),
      purpose: Object.assign({}, PURPOSE),
      overallFlow: OVERALL_FLOW.slice(),
      steps: steps,
      contentPages: contentPages,
      checklistTable: Object.assign({}, CHECKLIST_TABLE, {
        rows: CHECKLIST_TABLE.rows.map(function(row){ return row.slice(); })
      })
    };
  }

  global.PreFixedFareAppManualData = {
    PRE_FIXED_FARE_MANUAL_LINKS: PRE_FIXED_FARE_MANUAL_LINKS,
    IMAGE_BASE: IMAGE_BASE,
    PDF_FILENAME: PDF_FILENAME,
    EXPECTED_PAGE_COUNT: EXPECTED_PAGE_COUNT,
    buildReportData: buildReportData,
    resolveManualUrl: resolveManualUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
