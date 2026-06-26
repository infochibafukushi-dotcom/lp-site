(function(global){
  const REPORT_TITLE = "事前確定運賃M 運用・監査説明資料";

  function todayJst(){
    return new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function buildReportData(){
    return {
      title: REPORT_TITLE,
      meta: {
        subtitle: "運輸局提出用 運用・監査説明資料",
        targetSystem: "介護タクシーLP／見積シミュレーター／メーターアプリ（care-taxi-meter）",
        purpose: "事前確定運賃Mの本番運用フロー、データ保存、整合性確認、監査証跡を説明する",
        targetUrl: "https://infochibafukushi-dotcom.github.io/lp-site/estimate/",
        meterAppUrl: "https://infochibafukushi-dotcom.github.io/care-taxi-meter/",
        positioning: "運輸局への提出用説明資料（本資料は認可の可否を断定するものではない）",
        createdAt: todayJst(),
        createdBy: "LP管理画面"
      },
      overviewNote: "本資料は、LP見積からメーターアプリによる事前確定運賃M運行・精算・完了までの一連の本番運用を、運用・監査の観点から説明するものです。",
      overviewPoints: [
        "事前確定運賃M（以下「事前確定M」）は、LP見積時に確定した運賃をメーターアプリでそのまま運行・精算する方式です。",
        "見積・同意・snapshotHash・reservation-v4保存から、メーター読取・運行・精算・領収書・完了までを一貫して証跡化します。",
        "本番構成は GitHub Pages（LP・メーター）→ Cloudflare Worker driver-proxy → reservation-v4 / Firebase / caseRecords です。",
        "本番E2E確認（予約ID 209906021400）により、一連のフローが正常に動作することを確認済みです。"
      ],
      endToEndFlow: [
        "利用者がLP見積シミュレーターで走行予定ルート候補を選択し、見積額を確認する",
        "利用者が事前確定運賃への同意を行う（同意スナップショットを保存）",
        "見積内容・snapshotHash・確定運賃を reservation-v4 に保存する",
        "メーターアプリ（GitHub Pages 本番）が driver-proxy 経由で reservation-v4 から予約を読取する",
        "ドライバーが start-fixed-fare を実行し、事前確定M運行を開始する",
        "fixed CasePage で事前確定M運行を実施する",
        "運行完了後、fixed精算を実行し caseRecords に保存する",
        "領収書に「事前確定運賃 ○○円」と表示する",
        "complete-fixed-fare を実行し、予約詳細に「事前確定M 完了」を記録する"
      ],
      productionArchitecture: {
        intro: [
          "本番環境は、フロントエンド（GitHub Pages）とバックエンドAPI（driver-proxy / reservation-v4 / Firebase）を分離した構成です。",
          "メーターアプリはブラウザから driver-proxy を経由して予約データ・運行APIにアクセスします。"
        ],
        components: [
          { component: "LP見積（GitHub Pages）", role: "見積算定・同意・reservation-v4保存", path: "lp-site/estimate/" },
          { component: "メーターアプリ（GitHub Pages）", role: "予約読取・運行・精算・領収書", path: "care-taxi-meter/" },
          { component: "driver-proxy（Cloudflare Worker）", role: "METER_DRIVER_TOKEN保持・driver API中継", path: "Worker環境変数" },
          { component: "reservation-v4", role: "予約・見積・同意スナップショット保存", path: "API" },
          { component: "Firebase", role: "認証・データ永続化基盤", path: "Firebase" },
          { component: "caseRecords", role: "運行・精算記録の永続保存", path: "Firebase等" }
        ],
        flowDiagram: [
          "GitHub Pages（メーター）→ driver-proxy → reservation-v4（予約読取）",
          "GitHub Pages（メーター）→ driver-proxy → start-fixed-fare / complete-fixed-fare",
          "メーターアプリ → caseRecords（精算・運行記録保存）",
          "LP見積 → reservation-v4（見積・同意・snapshotHash保存）"
        ]
      },
      tokenSecurity: {
        intro: [
          "METER_DRIVER_TOKEN は driver API への認証に使用する秘密トークンです。",
          "本設計では、トークンをフロントエンド・GitHub リポジトリ・ビルド成果物（dist）に含めない方針としています。"
        ],
        designPoints: [
          "METER_DRIVER_TOKEN は Cloudflare Worker（driver-proxy）の環境変数にのみ保持する",
          "メーターアプリ（GitHub Pages）は driver-proxy の公開URLのみを参照し、トークンは送信しない",
          "GitHub Pages の公開リポジトリ・dist ビルド成果物にトークン文字列が含まれないことを確認済み",
          "driver-proxy は現時点では「トークン非露出プロキシ」として機能する"
        ],
        caveats: [
          "driver-proxyは現時点では「トークン非露出プロキシ」です。ブラウザからの正当なアクセスを中継します。",
          "CORS設定だけでは、curl等による直接アクセスを完全には防げません。",
          "次フェーズで Firebase ID Token 検証を driver-proxy に追加予定です。"
        ]
      },
      integrityChecks: {
        intro: [
          "事前確定Mでは、見積時点の内容とメーター読取時点の予約データが一致していることを、複数の検証項目で確認します。"
        ],
        checks: [
          {
            name: "snapshotHashVerified",
            description: "同意スナップショットのハッシュ値が、保存時点の見積内容と一致することを検証する"
          },
          {
            name: "confirmedFareMatchesSnapshot",
            description: "reservation-v4 に保存された確定運賃が、見積スナップショットの運賃と一致することを検証する"
          },
          {
            name: "同意スナップショット",
            description: "利用者の事前確定運賃への同意内容（日時・運賃・ルート情報等）をスナップショットとして保存し、後から照合可能にする"
          }
        ],
        verificationFlow: [
          "メーターアプリが予約詳細を読取する際、snapshotHash を再計算して保存値と照合する",
          "confirmedFareMatchesSnapshot により確定運賃の一致を確認する",
          "不一致の場合は運行開始前にエラー表示し、不正な運賃での運行を防止する",
          "本番E2E（予約ID 209906021400）で snapshotHashVerified / confirmedFareMatchesSnapshot / 同意スナップショット すべて OK を確認済み"
        ]
      },
      caseRecordsFields: [
        { field: "reservationId", description: "予約ID" },
        { field: "estimateNo", description: "見積番号" },
        { field: "confirmedFare", description: "確定運賃（円）" },
        { field: "fareMode", description: "運賃モード（pre_fixed_fare / fixed 等）" },
        { field: "snapshotHash", description: "同意スナップショットのハッシュ値" },
        { field: "routeSnapshot", description: "走行予定ルート・距離・時間のスナップショット" },
        { field: "consentSnapshot", description: "利用者同意内容のスナップショット" },
        { field: "startAt", description: "運行開始日時" },
        { field: "completeAt", description: "運行完了日時" },
        { field: "settlementAmount", description: "精算金額" },
        { field: "receiptLabel", description: "領収書表示ラベル（例：事前確定運賃 12,000円）" },
        { field: "meterStatus", description: "メーター状態（開始・完了等）" }
      ],
      meterFixedFareRuns: {
        intro: [
          "meter_fixed_fare_runs は、事前確定M運行の開始・完了を記録するテーブル（コレクション）です。",
          "start-fixed-fare / complete-fixed-fare API 呼び出しごとにレコードが作成・更新されます。"
        ],
        startRecord: [
          { field: "reservationId", description: "対象予約ID" },
          { field: "action", description: "start-fixed-fare" },
          { field: "confirmedFare", description: "開始時点の確定運賃" },
          { field: "startedAt", description: "運行開始日時" },
          { field: "driverId", description: "ドライバー識別子" }
        ],
        completeRecord: [
          { field: "reservationId", description: "対象予約ID" },
          { field: "action", description: "complete-fixed-fare" },
          { field: "settlementAmount", description: "精算金額" },
          { field: "completedAt", description: "運行完了日時" },
          { field: "caseRecordId", description: "紐付く caseRecords ID" }
        ],
        notes: [
          "start-fixed-fare 実行時に運行開始レコードを作成する",
          "complete-fixed-fare 実行時に運行完了レコードを更新し、予約詳細に「事前確定M 完了」を反映する",
          "本番E2E（予約ID 209906021400）で start-fixed-fare OK / complete-fixed-fare OK を確認済み"
        ]
      },
      receiptDisplay: {
        intro: [
          "事前確定M運行の精算完了後、領収書には確定運賃を「事前確定運賃」ラベル付きで表示します。",
          "これにより、通常メーター運賃と事前確定運賃を利用者・監査者が区別できます。"
        ],
        rules: [
          "領収書の運賃欄に「事前確定運賃 ○○円」と表示する（○○は確定運賃の金額）",
          "金額は見積時に確定した運賃と一致させる（confirmedFareMatchesSnapshot 検証済み）",
          "領収書表示ラベルは caseRecords.receiptLabel にも保存する",
          "本番E2E（予約ID 209906021400）で領収書「事前確定運賃 12,000円」表示 OK を確認済み"
        ],
        example: "事前確定運賃 12,000円"
      },
      e2eEvidence: {
        reservationId: "209906021400",
        datetime: "2099-06-02 14:00",
        userName: "スモークジロウ",
        estimateNo: "EST-PROD-SMOKE-1782485792",
        confirmedFare: "12,000円",
        checks: [
          { item: "予約一覧表示", result: "OK" },
          { item: "予約詳細表示", result: "OK" },
          { item: "snapshotHashVerified", result: "OK" },
          { item: "confirmedFareMatchesSnapshot", result: "OK" },
          { item: "同意スナップショット", result: "OK" },
          { item: "start-fixed-fare", result: "OK" },
          { item: "fixed運行", result: "OK" },
          { item: "精算保存", result: "OK" },
          { item: "caseRecords保存", result: "OK" },
          { item: "領収書「事前確定運賃 12,000円」表示", result: "OK" },
          { item: "complete-fixed-fare", result: "OK" },
          { item: "予約詳細「事前確定M 完了」", result: "OK" }
        ]
      },
      futurePlans: [
        "Firebase ID Token 検証を driver-proxy に追加し、curl等の直接アクセスをより厳密に制限する",
        "利用明細書PDFの fixed 専用表示対応（現時点では次期対応）",
        "本番E2E証跡の定期更新（新規予約IDでの再確認）"
      ],
      footerNote: "本資料は運輸局提出用の運用・監査説明資料です。最終的な申請書類への転記・体裁調整は、申請担当者が行ってください。"
    };
  }

  global.PreFixedFareOperationsSummaryData = {
    REPORT_TITLE: REPORT_TITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
