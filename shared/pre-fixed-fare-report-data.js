(function(global){
  const REPORT_TITLE = "事前確定運賃システム概要書 兼 関東運輸局公示要件対応表";
  const REPORT_SYSTEM_NAME = "LP見積・予約連携システム";
  const REPORT_SYSTEM_VERSION = "lp-site pre-fixed-fare report v1";

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

  function numberOrDash(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "-";
  }

  function estimateVersionLabel(estimateConfig){
    const version = Number(estimateConfig?.version);
    if(Number.isFinite(version)){
      return "v" + version;
    }
    return "未設定";
  }

  function detectBusinessName(config, estimateConfig){
    return valueOrUnset(
      estimateConfig?.pdfFooter?.businessName
      || config?.businessName
      || config?.companyName
      || config?.shopName
    );
  }

  function detectTradeName(config, estimateConfig){
    return valueOrUnset(
      estimateConfig?.pdfFooter?.businessName
      || config?.serviceName
      || config?.brandName
    );
  }

  function detectArea(estimateConfig){
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

  function coefficientRows(){
    return [
      { area: "京葉交通圏", coefficient: 1.20, basis: "関東運輸局公示済み係数", appliedAt: "令和7年7月18日" },
      { area: "千葉交通圏", coefficient: 1.18, basis: "関東運輸局公示済み係数", appliedAt: "令和7年7月18日" },
      { area: "南房交通圏", coefficient: 1.13, basis: "関東運輸局公示済み係数", appliedAt: "令和7年7月18日" }
    ];
  }

  function implStatusRows(){
    return {
      multiRoute: [
        { item: "複数ルート取得", status: "未実装", basis: "estimate/estimate-distance-api.js（computeAlternativeRoutes:false）" },
        { item: "旅客によるルート選択", status: "未実装", basis: "estimate/estimate-main.js" },
        { item: "選択ルート保存", status: "未確認", basis: "shared/estimate-quote-register.js（API/DB側確認要）" },
        { item: "運転者への同一ルート表示", status: "未確認", basis: "reservation-v4 / driver画面（ワークスペース外）" }
      ],
      toll: [
        { item: "旅客の有料道路利用有無選択", status: "実装済み", basis: "estimate/estimate-main.js（roadType ラジオ）" },
        { item: "選択結果をルート算定へ反映", status: "実装済み", basis: "estimate/estimate-distance-api.js（routeModifiers）" },
        { item: "有料道路代の運賃区分管理", status: "実装済み", basis: "estimate/estimate-calc.js（expensesへ別枠）" },
        { item: "予約API/DBへの保存", status: "未確認", basis: "API/DB実装（ワークスペース外）" }
      ],
      mapRoute: [
        { item: "API名", status: "実装済み", basis: "Google Routes API（estimate/estimate-distance-api.js）" },
        { item: "保存項目", status: "実装済み", basis: "distanceMeters, durationSeconds, encodedPolyline, routeToken, tollInfo" },
        { item: "routePlan項目", status: "実装済み", basis: "estimate/estimate-main.js（provider, roadType, selectedRouteId, routes等）" },
        { item: "予約API/DB永続化", status: "未確認", basis: "shared/estimate-quote-register.js 経由、保存先はAPI/DB側要確認" }
      ],
      snapshot: {
        confirmed: [
          "見積時点の料金設定（quoteSnapshot.distancePricing / fareComponents）",
          "選択内容（usageSummary）",
          "ルート情報（routePlan）",
          "交通圏係数（selectedTrafficZoneId / trafficZoneCoefficient）",
          "計算結果（fixedFareBreakdown / fixedFareTotal）"
        ],
        unconfirmed: [
          "同意情報（同意日時、同意文面、同意文面バージョン）",
          "snapshotHash",
          "サーバー署名（HMAC等）",
          "status（active / consumed / expired / canceled）のDB管理"
        ]
      },
      requirements: [
        { requirement: "電子地図で推計走行距離を算定", policy: "Google Routes API等で距離・ルート取得", current: "実装済み", evidence: "routePlan" },
        { requirement: "距離制運賃×係数で算定", policy: "fareMode=pre_fixed_fareで係数適用", current: "実装済み", evidence: "estimate/estimate-calc.js" },
        { requirement: "2以上のルートから旅客が選択", policy: "複数ルートUIを用意", current: "未実装", evidence: "routes[]" },
        { requirement: "有料道路利用有無を選択", policy: "roadTypeを保存しルート算定へ反映", current: "実装済み", evidence: "roadType" },
        { requirement: "運賃額と割引前後を提示", policy: "表示UIとsnapshotに保存", current: "未確認", evidence: "fareBeforeDiscount" },
        { requirement: "注意事項を提示し同意取得", policy: "consentAt等を保存", current: "未確認", evidence: "consentAt" },
        { requirement: "各種料金は運賃と区分", policy: "serviceFees / expensesとして別表示", current: "実装済み", evidence: "serviceFees" }
      ]
    };
  }

  function buildReportData(options){
    const config = options?.config || {};
    const estimateConfig = options?.estimateConfig || {};
    const impl = implStatusRows();
    const trafficZones = Array.isArray(estimateConfig?.trafficZones?.items)
      ? estimateConfig.trafficZones.items
      : [];

    return {
      title: REPORT_TITLE,
      meta: {
        businessName: detectBusinessName(config, estimateConfig),
        tradeName: detectTradeName(config, estimateConfig),
        operatingArea: detectArea(estimateConfig),
        systemName: REPORT_SYSTEM_NAME,
        createdAt: todayJst(),
        systemVersion: REPORT_SYSTEM_VERSION,
        estimateConfigVersion: estimateVersionLabel(estimateConfig),
        createdBy: "LP管理画面"
      },
      purpose: [
        "本資料は、一般乗用旅客自動車運送事業の事前確定運賃について、関東運輸局の公示要件に対するシステム対応を説明するための資料である。",
        "利用者向け見積書ではなく、運輸局説明用のシステム概要書である。",
        "実装済み項目と未確認項目を分けて記載する。"
      ],
      notices: {
        basis: [
          "一般乗用旅客自動車運送事業の事前確定運賃に関する認可申請の取扱いについて",
          "公示日：平成31年4月26日",
          "改正：令和6年12月24日改正",
          "一般乗用旅客自動車運送事業の事前確定運賃算定に用いる係数について",
          "千葉県の係数適用日：令和7年7月18日"
        ],
        formulas: [
          "電子地図で推計走行距離を算定",
          "距離制運賃を基準にする",
          "時間距離併用制運賃は除く",
          "関東運輸局長が定めた係数を乗じる",
          "1円単位を四捨五入する",
          "割増・割引を適用する場合は割引前後を表示する",
          "各種料金は事前確定運賃とは区分して適用する"
        ],
        formulaText: "事前確定運賃 ＝ 距離制運賃 × 平準化係数（1円単位四捨五入）"
      },
      coefficientRows: coefficientRows(),
      coefficientPolicy: "本システムでは独自係数を用いず、関東運輸局が公示済みの平準化係数を使用する方針とする。",
      fareAndFeeRows: [
        { category: "乗車地から降車地までの運賃", include: "含める", handling: "事前確定運賃として固定" },
        { category: "迎車料金", include: "原則別枠", handling: "各種料金として区分" },
        { category: "予約料金", include: "別枠", handling: "各種料金として区分" },
        { category: "介助料", include: "別枠", handling: "介護タクシーサービス料金として区分" },
        { category: "待機料", include: "別枠", handling: "実待機時間に応じて精算" },
        { category: "付き添い料", include: "別枠", handling: "実対応内容に応じて精算" },
        { category: "有料道路代", include: "別枠", handling: "実費として区分" },
        { category: "福祉タクシー券", include: "決済・精算側", handling: "運賃算定ではなく精算時に充当" }
      ],
      mapAndRouteDesign: [
        "Google Routes API等の電子地図を使用して距離・時間・ルートを取得する設計",
        "出発地、目的地、距離、時間、polyline、候補ルートを保存する設計",
        "routePlanとして見積時点の情報を保持する設計",
        "地図情報が定期更新される電子地図を利用すること"
      ],
      mapAndRouteRows: impl.mapRoute,
      multiRouteRows: impl.multiRoute,
      tollRows: impl.toll,
      userNoticeItems: [
        "走行予定ルートまたは主要経由地点を提示する",
        "事前確定運賃額を提示する",
        "割引を適用する場合は割引前後の運賃額を提示する",
        "注意事項を提示する",
        "旅客の了承を得る",
        "同意日時、同意文面、同意文面バージョン、見積番号、snapshotHashを保存する"
      ],
      cautionBeforeConsent: [
        "旅客都合で走行予定ルートを変更する場合、事前確定運賃による運送をその時点で終了し、事前確定運賃額を収受すること",
        "新たに当該運送終了地点から距離制運賃または事前確定運賃により運送を開始すること",
        "道路状況によっては、事前確定運賃額が距離制運賃等より高くなる場合があること"
      ],
      snapshotConfirmed: impl.snapshot.confirmed,
      snapshotUnconfirmed: impl.snapshot.unconfirmed,
      stateManagement: {
        requiredStates: ["active", "consumed", "expired", "canceled"],
        requiredItems: [
          "見積番号の二重利用防止",
          "有効期限管理",
          "予約IDとの紐付け",
          "consumed日時"
        ],
        note: "現状確認できないものは API/DB側の追加確認が必要"
      },
      fixedAfterReservation: [
        "予約後はquoteSnapshotを単一ソースとして扱う",
        "予約側で再計算しない",
        "管理画面、メール、PDF再発行でも当時のsnapshot値を使う",
        "管理画面の料金設定を変更しても過去予約の金額は変わらない"
      ],
      requirementRows: impl.requirements,
      unimplementedOrUnconfirmed: [
        "複数ルート選択UI",
        "予約API/DBへの選択ルート保存",
        "利用者同意日時の保存",
        "同意文面バージョン保存",
        "snapshotHashのサーバー検証",
        "active / consumed / expired 状態管理",
        "予約側でのquoteSnapshot固定表示",
        "メール・管理画面・PDFの単一ソース化",
        "運転者画面への同一ルート表示"
      ],
      priorities: [
        "複数ルート選択UI",
        "有料道路利用有無選択の保存強化",
        "利用者同意日時・同意文面保存",
        "snapshotHash / HMAC署名検証",
        "active / consumed / expired 状態管理",
        "予約側quoteSnapshot固定表示",
        "メール・PDF・管理画面の単一ソース化",
        "運転者画面への同一ルート表示"
      ],
      appendices: {
        configuredTrafficZones: trafficZones.map(function(zone){
          return {
            label: String(zone?.label || ""),
            coefficient: numberOrDash(zone?.coefficient)
          };
        })
      }
    };
  }

  global.PreFixedFareReportData = {
    REPORT_TITLE: REPORT_TITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
