(function(global){
  const IMAGE_BASE = "./assets/evidence/pre-fixed-fare-20260705/";
  const PDF_FILENAME = "pre-fixed-fare-screen-evidence.pdf";
  const VERIFICATION_NOTE =
    "本ページの画面画像は、申請者本人による検証用予約データを使用した操作証跡です。実在の第三者利用者の個人情報は含まれていません。";

  const CASE_INFO = {
    estimateNo: "EST-20260705-3755",
    reservationId: "202607050600",
    confirmedFare: "28,000円",
    estimatedAt: "2026/07/05 03:39",
    consentedAt: "2026/07/05 03:40",
    origin: "中央区出洲港8-3-2",
    destination: "成田空港第二ターミナル",
    projectNumber: "260705-MAINS-0001"
  };

  const SCREENS = [
    {
      pageId: "route-selection",
      pageTitle: "利用者の走行予定ルート選択画面",
      imageFile: "01_route_selection_EST-20260705-3755.png",
      proofText:
        "2以上の走行予定ルートを提示し、旅客が1つのルートを選択できる画面です。各ルートの距離、所要時間、運賃目安、有料道路利用の有無を確認できます。"
    },
    {
      pageId: "consent-confirm",
      pageTitle: "旅客同意確認画面",
      imageFile: "02_consent_confirm_EST-20260705-3755.png",
      proofText:
        "選択されたルート、事前確定運賃額、注意事項を確認したうえで、旅客同意を取得する画面です。同意内容は見積番号・予約IDと紐づけて保存します。"
    },
    {
      pageId: "confirmed-route",
      pageTitle: "ドライバー用確定ルート確認画面",
      imageFile: "03_confirmed_route_202607050600.png",
      proofText:
        "乗務員が、旅客同意済みの確定ルート及び事前確定運賃額を運行前又は運行中に確認できる画面です。外部ナビの再計算とは別に、同意済みルートを正本として確認できます。"
    },
    {
      pageId: "receipt-detail",
      pageTitle: "領収書・レシート明細画面",
      imageFile: "04_receipt_detail_202607050600.png",
      proofText:
        "事前確定運賃、支払方法、精算額、領収書発行内容を確認できる画面です。精算内容を旅客に明細として交付できることを示します。"
    }
  ];

  function buildReportData(options){
    options = options || {};
    const createdAt = options.createdAt || new Date().toLocaleDateString("ja-JP");
    const screens = SCREENS.map(function(screen){
      return {
        pageId: screen.pageId,
        pageTitle: screen.pageTitle,
        imageFile: screen.imageFile,
        imageSrc: IMAGE_BASE + screen.imageFile,
        proofText: screen.proofText
      };
    });

    return {
      title: "事前確定運賃システム 実画面証跡資料",
      pdfFilename: PDF_FILENAME,
      verificationNote: VERIFICATION_NOTE,
      meta: {
        createdAt: createdAt,
        createdBy: "管理画面",
        documentType: "画面証跡資料（検証用予約データ）"
      },
      caseInfo: Object.assign({}, CASE_INFO),
      screens: screens
    };
  }

  global.PreFixedFareScreenEvidenceData = {
    IMAGE_BASE: IMAGE_BASE,
    PDF_FILENAME: PDF_FILENAME,
    VERIFICATION_NOTE: VERIFICATION_NOTE,
    CASE_INFO: CASE_INFO,
    SCREENS: SCREENS,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
