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
        { item: "複数ルート取得", status: "LP側実装済み", basis: "estimate/estimate-distance-api.js（4系統候補生成＋重複排除）" },
        { item: "旅客によるルート選択", status: "2件以上取得時は実装済み", basis: "estimate/estimate-main.js（preFixedFareConfirmable=true時のみ選択UI）" },
        { item: "ルート候補生成", status: "LP側実装済み", basis: "おすすめ・距離優先・幹線道路・有料道路利用の4系統（shared/pre-fixed-fare-route-waypoints.js）" },
        { item: "選択ルート保存", status: "実装済み", basis: "estimate/estimate-calc.js quoteSnapshot（routeCandidates / selectedRoute*）→ shared/estimate-quote-register.js registerQuoteFromHandoff() → reservation-v4/worker.js registerQuote() → D1 quotes" },
        { item: "候補1件時の扱い", status: "通常見積または確認対応", basis: "estimate/estimate-main.js（警告表示・予約URLにfareConfirm=review）" },
        { item: "往復時の往路・復路別算定", status: "LP側実装済み", basis: "estimate/estimate-main.js, estimate/estimate-distance-api.js（片道×2を廃止）" },
        { item: "往復・帰り未定時の復路扱い", status: "復路は確認対応", basis: "estimate/estimate-calc.js（preFixedFareScope=outbound_only）" },
        { item: "予約API/DB保存", status: "実装済み", basis: "reservation-v4/worker.js registerQuote(), handleCreateReservation(), createReservationFixedFare(), insertQuoteConsent() → D1 quotes / reservations / quote_consents" },
        { item: "運転者への同一ルート表示", status: "実装済み", basis: "care-taxi-meter/src/pages/ReservationDetailPage.tsx, CasePage.tsx, components/case/PreFixedFareConfirmedRouteDialog.tsx, services/preFixedFareRoute.ts" }
      ],
      toll: [
        { item: "旅客の有料道路利用有無選択", status: "実装済み", basis: "estimate/estimate-main.js（roadType ラジオ）" },
        { item: "選択結果をルート算定へ反映", status: "実装済み", basis: "estimate/estimate-distance-api.js（routeModifiers）" },
        { item: "有料道路代の運賃区分管理", status: "実装済み", basis: "estimate/estimate-calc.js（expensesへ別枠）" },
        { item: "予約API/DBへの保存", status: "実装済み", basis: "reservation-v4/worker.js registerQuote(), createReservationFixedFare() → D1 quotes.use_toll / reservations.use_toll" }
      ],
      mapRoute: [
        { item: "API名", status: "実装済み", basis: "Google Routes API（estimate/estimate-distance-api.js）" },
        { item: "保存項目", status: "実装済み", basis: "distanceMeters, durationSeconds, encodedPolyline, routeToken, tollInfo" },
        { item: "routePlan項目", status: "実装済み", basis: "estimate/estimate-main.js（provider, roadType, selectedRouteId, routes等）" },
        { item: "予約API/DB永続化", status: "実装済み", basis: "shared/estimate-quote-register.js → reservation-v4/worker.js registerQuote(), createReservationFixedFare() → D1 quotes / reservations" },
        { item: "snapshotHash生成・保存・照合", status: "実装済み", basis: "reservation-v4/snapshot-hash.js hashSnapshot(), driver-reservations.js buildReservationIntegrity(), startFixedFareRun()" },
        { item: "メーター運行開始・完了", status: "実装済み", basis: "reservation-v4/driver-reservations.js startFixedFareRun(), completeFixedFareRun(), care-taxi-meter/src/services/reservationApi.ts → D1 meter_fixed_fare_runs, Firestore caseRecords" }
      ],
      snapshot: {
        confirmed: [
          "見積時点の料金設定（quoteSnapshot.distancePricing / fareComponents）",
          "選択内容（usageSummary）",
          "ルート情報（routePlan）",
          "交通圏係数（selectedTrafficZoneId / trafficZoneCoefficient）",
          "計算結果（fixedFareBreakdown / fixedFareTotal）",
          "同意情報（同意日時、同意文面、同意文面バージョン）— reservation-v4/estimate-consent.js, insertQuoteConsent() → D1 quote_consents / reservations.estimate_consent",
          "snapshotHash（SHA-256生成・保存・照合）— reservation-v4/snapshot-hash.js, driver-reservations.js buildReservationIntegrity()",
          "見積状態管理（active / consumed / 有効期限チェック）— quotes.status, expires_at, getQuoteRowForConsume()",
          "メーター運行開始・完了記録 — meter_fixed_fare_runs, Firestore caseRecords"
        ],
        unconfirmed: [
          "サーバー署名（HMAC等）— 将来対応",
          "監査提出用PDF/CSV一括出力 — 一部実装（予約CSV・管理画面閲覧あり）。監査提出用一括出力は運用開始前整備",
          "3年保存の自動制御 — 規程対応。システム制御は運用開始前整備"
        ]
      },
      requirements: [
        { requirement: "電子地図で推計走行距離を算定", policy: "Google Routes API等で距離・ルート取得", current: "実装済み", evidence: "routePlan" },
        { requirement: "距離制運賃×係数で算定", policy: "fareMode=pre_fixed_fareで係数適用", current: "実装済み", evidence: "estimate/estimate-calc.js" },
        { requirement: "2以上のルートから旅客が選択", policy: "4系統候補を生成し2件以上取得時のみ選択可", current: "本システムでは、電子地図APIにより、おすすめルート、取得候補内の距離短めルート、主要道路経由ルート、有料道路利用可ルートを生成し、実質的に異なる2件以上のルートが取得できた場合に、旅客が1つを選択して事前確定運賃を算定する。候補1件時は通常見積または確認対応とする。往復時は往路・復路を別算定し、それぞれで選択ルートを保存する。", evidence: "estimate/estimate-distance-api.js, shared/pre-fixed-fare-route-waypoints.js, estimate/estimate-main.js" },
        { requirement: "往復時の往路・復路別算定", policy: "片道距離×2を用いず往路・復路を個別にAPI算定", current: "実装済み", evidence: "routePlan.outboundRoutePlan / returnRoutePlan" },
        { requirement: "有料道路利用有無を選択", policy: "roadTypeを保存しルート算定へ反映", current: "実装済み", evidence: "roadType" },
        { requirement: "運賃額と割引前後を提示", policy: "見積・同意時点では割引適用前の運賃本体を提示し、障害者割引等は精算時に記録", current: "一部実装：見積・同意時点では割引適用前の運賃本体（事前確定運賃額）を提示。障害者割引等は精算時に割引対象運賃・割引額・精算後金額を記録。見積・予約時の割引前後表示と snapshot 保存は運用開始前又は将来の改善対象", evidence: "lp-site/data/estimate-config.json disclaimer、care-taxi-meter/services/fare.ts buildFixedFareBreakdown()、caseRecords" },
        { requirement: "注意事項を提示し同意取得", policy: "consentAt等を保存", current: "実装済み", evidence: "reservation-v4/estimate-consent.js, quote_consents.consent_at" },
        { requirement: "各種料金は運賃と区分", policy: "serviceFees / expensesとして別表示", current: "実装済み", evidence: "serviceFees" },
        { requirement: "snapshotHash生成・保存・照合", policy: "SHA-256で生成し運行開始時に検証", current: "実装済み", evidence: "reservation-v4/snapshot-hash.js, driver-reservations.js buildReservationIntegrity()" },
        { requirement: "メーター運行開始・完了", policy: "Driver APIで運行状態を記録", current: "実装済み", evidence: "driver-reservations.js startFixedFareRun()/completeFixedFareRun(), meter_fixed_fare_runs, caseRecords" }
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
        createdBy: "管理画面"
      },
      purpose: [
        "本資料は、一般乗用旅客自動車運送事業の事前確定運賃について、関東運輸局の公示要件に対するシステム対応を説明するための資料である。",
        "利用者向け見積書ではなく、運輸局説明用のシステム概要書である。",
        "実装済み項目と未整備項目を分けて記載する。"
      ],
      notices: {
        basis: [
          "一般乗用旅客自動車運送事業の事前確定運賃に関する認可申請の取扱いについて",
          "公示日：平成31年4月26日",
          "改正：令和6年12月24日改正",
          "一般乗用旅客自動車運送事業の事前確定運賃算定に用いる係数について",
          "千葉県の係数適用日：令和7年7月18日"
        ],
        fareBasisNote: "運賃算定根拠は、令和8年2月13日付け 関自旅二第4314号 千葉地区 大型車B運賃（距離制運賃表）に基づく。",
        formulas: [
          "電子地図で推計走行距離を算定",
          "距離制運賃を基準にする（申請予定または認可後の距離制運賃表に基づく）",
          "時間距離併用制運賃は除く",
          "関東運輸局長が定めた係数を乗じる",
          "1円の位を四捨五入し、10円単位とする",
          "割増・割引を適用する場合は、精算時に割引対象運賃・割引額・精算後金額を記録する（見積・同意時点での割引前後表示は運用開始前又は将来の改善対象）",
          "各種料金は事前確定運賃とは区分して適用する"
        ],
        formulaText: "事前確定運賃 ＝ 距離制運賃 × 平準化係数（1円の位を四捨五入し10円単位）"
        // 計算例: 8.5km・距離制4,120円 × 1.18 = 4,861.6円 → 4,860円 / 支払合計例 7,760円
      },
      coefficientRows: coefficientRows(),
      coefficientPolicy: "本システムでは独自係数を用いず、関東運輸局が公示済みの平準化係数を使用する方針とする。",
      fareAndFeeRows: [
        { category: "乗車地から降車地までの運賃", include: "含める", handling: "事前確定運賃として固定" },
        { category: "迎車料金", include: "原則別枠", handling: "事前確定運賃とは区分し、明細上も別行で表示" },
        { category: "予約料金", include: "別枠", handling: "事前確定運賃とは区分し、明細上も別行で表示" },
        { category: "介助料", include: "別枠", handling: "介護タクシーサービス料金として区分し、明細上も別行で表示" },
        { category: "待機料", include: "別枠", handling: "実待機時間に応じて精算し、明細上も別行で表示" },
        { category: "付き添い料", include: "別枠", handling: "実対応内容に応じて精算し、明細上も別行で表示" },
        { category: "有料道路代", include: "別枠", handling: "実費として区分し、明細上も別行で表示" },
        { category: "福祉タクシー券", include: "決済・精算側", handling: "運賃算定ではなく精算時に充当" }
      ],
      mapAndRouteDesign: [
        "Google Routes API等の電子地図を使用して距離・時間・ルートを取得する設計",
        "出発地、目的地、距離、時間、polyline、候補ルートを保存する設計",
        "routePlanとして見積時点の情報を保持する設計",
        "地図情報が定期更新される電子地図を利用すること",
        "往復送迎の場合、片道距離を単純に2倍せず、往路と復路を別々に電子地図APIで算定する",
        "立ち寄りがある場合は、復路に中間地点を設定して算定する",
        "帰りが未定の場合は、復路を事前確定運賃の対象外とし、確認対応とする"
      ],
      mapAndRouteRows: impl.mapRoute,
      multiRouteRows: impl.multiRoute,
      tollRows: impl.toll,
      userNoticeItems: [
        "走行予定ルートまたは主要経由地点を提示する",
        "事前確定運賃額（割引適用前の運賃本体）を提示する",
        "障害者割引・福祉タクシー券は見積額に反映せず、注意書きでその旨を表示する",
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
        note: "active / consumed / 有効期限チェックは実装済み（quotes.status, expires_at）。expired / canceled の自動遷移は運用開始前整備"
      },
      fixedAfterReservation: [
        "予約後はquoteSnapshotを単一ソースとして扱う",
        "予約側で再計算しない",
        "管理画面、メール、PDF再発行でも当時のsnapshot値を使う",
        "管理画面の料金設定を変更しても過去予約の金額は変わらない"
      ],
      requirementRows: impl.requirements,
      unimplementedOrUnconfirmed: [
        "監査提出用PDF/CSV一括出力（予約CSV・管理画面閲覧は一部実装済み。監査提出用一括出力は運用開始前整備）",
        "見積・予約時点での割引前後表示と snapshot 保存（精算時の割引記録は care-taxi-meter で一部対応済み）",
        "見積 expired / canceled 状態の自動遷移",
        "サーバー署名（HMAC等）— 将来対応",
        "3年保存の自動制御 — 規程対応。システム制御は運用開始前整備"
      ],
      priorities: [
        "監査提出用PDF/CSV一括出力の整備",
        "見積・予約時点での割引前後表示と snapshot 保存",
        "見積 expired / canceled 状態の自動遷移",
        "HMAC署名（将来対応）",
        "3年保存のシステム制御整備"
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
