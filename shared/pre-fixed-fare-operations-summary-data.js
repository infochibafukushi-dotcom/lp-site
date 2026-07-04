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
        createdBy: "管理画面"
      },
      overviewNote: "本資料は、LP見積からメーターアプリによる事前確定運賃M運行・精算・完了までの一連の本番運用を、運用・監査の観点から説明するものです。",
      overviewPoints: [
        "事前確定運賃M（以下「事前確定M」）は、LP見積時に確定した運賃をメーターアプリでそのまま運行・精算する方式です。",
        "見積・同意・snapshotHash・reservation-v4保存から、メーター読取・運行・精算・領収書・完了までを一貫して証跡化します。",
        "運行開始後に旅客都合でルート変更・立ち寄り追加等が発生した場合は、事前確定M運送を途中終了し、以後は通常メーター等の別運送として新規開始します。",
        "本番構成は GitHub Pages（LP・メーター）→ Cloudflare Worker driver-proxy → reservation-v4 / Firebase / caseRecords です。",
        "本番相当環境E2E確認（予約ID 209906021400：通常完了、209906041030：旅客都合途中終了）により、一連のフローが正常に動作することを確認済みです。"
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
          "本番相当環境は、フロントエンド（GitHub Pages）とバックエンドAPI（driver-proxy / reservation-v4 / Firebase）を分離した構成です。",
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
          "事前確定Mでは、見積時点の内容とメーター読取時点の予約データが一致していることを、複数の検証項目で確認します。",
          "スナップショットハッシュは、改ざん防止そのものではなく、同意時点データとの整合性確認・不一致検知のための仕組みとして位置づけます。"
        ],
        checks: [
          {
            name: "snapshotHashVerified",
            description: "同意スナップショットのハッシュ値が、保存時点の見積内容と一致することを照合する"
          },
          {
            name: "confirmedFareMatchesSnapshot",
            description: "reservation-v4 に保存された確定運賃が、見積スナップショットの運賃と一致することを照合する"
          },
          {
            name: "同意スナップショット",
            description: "利用者の事前確定運賃への同意内容（日時・運賃・ルート情報等）をスナップショットとして保存し、後から照合可能にする"
          }
        ],
        verificationFlow: [
          "メーターアプリが予約詳細を読取する際、snapshotHash を再計算して保存値と照合する",
          "confirmedFareMatchesSnapshot により確定運賃の一致を確認する",
          "不一致の場合は運行開始前にエラー表示し、管理者確認の対象とする",
          "本番相当環境E2E（予約ID 209906021400）で snapshotHashVerified / confirmedFareMatchesSnapshot / 同意スナップショット すべて OK を確認済み"
        ],
        tamperProtectionNote:
          "現行運用では、スナップショットハッシュ照合、データベース権限制御、操作ログ保存により、予約時同意内容と運行・精算内容の整合性を確認できる体制を構築している。HMAC方式は将来的な外部API連携・複数事業者連携時の追加対策として検討する。"
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
          "本番相当環境E2E（予約ID 209906021400）で start-fixed-fare OK / complete-fixed-fare OK を確認済み"
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
          "本番相当環境E2E（予約ID 209906021400）で領収書「事前確定運賃 12,000円」表示 OK を確認済み"
        ],
        example: "事前確定運賃 12,000円"
      },
      e2eEvidence: {
        cases: [
          {
            label: "通常完了",
            reservationId: "209906021400",
            datetime: "2099-06-02 14:00",
            userName: "スモークジロウ",
            estimateNo: "EST-PROD-SMOKE-1782485792",
            confirmedFare: "12,000円",
            displayLabel: "事前確定M 完了"
          },
          {
            label: "旅客都合途中終了",
            reservationId: "209906041030",
            datetime: "2099-06-04 10:30",
            userName: "スモークジロウ",
            estimateNo: "EST-PROD-SMOKE-PASSENGER-CHANGE",
            confirmedFare: "12,000円",
            displayLabel: "事前確定M 旅客都合途中終了"
          }
        ],
        checks: [
          { item: "通常完了予約（209906021400）が「事前確定M 完了」と表示", result: "OK" },
          { item: "旅客都合途中終了予約（209906041030）が「事前確定M 旅客都合途中終了」と表示", result: "OK" },
          { item: "complete-fixed-fare API が completionStatus / completionReason / preFixedFareException を受信", result: "OK" },
          { item: "D1 に completion_status / completion_reason / pre_fixed_fare_exception_json を保存", result: "OK" },
          { item: "予約詳細APIで fixedFareCompletionStatus / fixedFareCompletionReason / preFixedFareException を返却", result: "OK" },
          { item: "通常完了予約への影響なし", result: "OK" },
          { item: "test:phase5 18/18 PASS", result: "OK" },
          { item: "snapshotHashVerified（209906021400）", result: "OK" },
          { item: "confirmedFareMatchesSnapshot（209906021400）", result: "OK" },
          { item: "start-fixed-fare / 精算 / 領収書「事前確定運賃 12,000円」（209906021400）", result: "OK" }
        ]
      },
      passengerChangeTermination: {
        basicOperation: {
          intro: [
            "事前確定運賃Mにおいて、運行開始後に旅客都合で走行ルート変更、予定外の立ち寄り追加、目的地変更、または当初選択した走行予定ルートから外れる変更が発生した場合は、その時点で事前確定運賃による運送を終了する。",
            "この場合、当初同意済みの事前確定運賃額を収受し、以後の運送は通常メーター等による別運送として新規に開始する。"
          ],
          triggers: [
            "走行ルート変更（旅客都合）",
            "予定外の立ち寄り追加",
            "目的地変更",
            "当初選択した走行予定ルートから外れる変更"
          ]
        },
        fareHandling: [
          "当初の事前確定運賃額は変更しない",
          "途中までの距離による割引・距離割りは行わない",
          "途中までの時間による再計算は行わない",
          "通常メーター分を同じ事前確定運賃記録に加算しない",
          "変更後の運送は別案件・別運行として記録する"
        ],
        meterAppFlow: [
          "事前確定運賃Mの運行中のみ「旅客都合変更で途中終了」ボタンを表示する",
          "GPSM / 時間M / OBDM では表示しない",
          "押下時に確認ダイアログを表示する",
          "確定後、精算前画面へ進む",
          "当初固定運賃額は変更しない",
          "決済端末等で当初同意済みの事前確定運賃額を収受する",
          "精算完了後、「通常メーターで新規運行を開始」ボタンを表示する",
          "ボタン押下で /case/start へ進み、通常メーター等の別案件を開始する"
        ],
        auditTrail: {
          caseRecords: [
            { field: "status", value: "completed_with_passenger_change" },
            { field: "fareMode", value: "pre_fixed_fare" },
            { field: "completionReason", value: "passenger_requested_route_change" },
            { field: "preFixedFareException", value: "例外情報オブジェクト" },
            { field: "reservationId", value: "対象予約ID" },
            { field: "confirmedFareYen", value: "当初確定運賃（円）" },
            { field: "snapshotHash", value: "同意スナップショットハッシュ" },
            { field: "監査ログ", value: "pre_fixed_fare_passenger_change" }
          ],
          reservationV4: [
            { field: "meter_fixed_fare_runs.status", value: "completed" },
            { field: "completion_status", value: "completed_with_passenger_change" },
            { field: "completion_reason", value: "passenger_requested_route_change" },
            { field: "pre_fixed_fare_exception_json", value: "JSON文字列" }
          ],
          normalCompletion: [
            { field: "completion_status", value: "completed" },
            { field: "completion_reason", value: "normal_completed" },
            { field: "pre_fixed_fare_exception_json", value: "null" }
          ]
        },
        completionComparison: {
          normal: {
            label: "通常完了",
            rows: [
              { field: "caseRecords.status", value: "completed" },
              { field: "fixedFareCompletionStatus", value: "completed" },
              { field: "fixedFareCompletionReason", value: "normal_completed" },
              { field: "preFixedFareException", value: "なし" },
              { field: "表示", value: "事前確定M 完了" }
            ]
          },
          passengerChange: {
            label: "旅客都合途中終了",
            rows: [
              { field: "caseRecords.status", value: "completed_with_passenger_change" },
              { field: "fixedFareCompletionStatus", value: "completed_with_passenger_change" },
              { field: "fixedFareCompletionReason", value: "passenger_requested_route_change" },
              { field: "preFixedFareException", value: "あり" },
              { field: "表示", value: "事前確定M 旅客都合途中終了" }
            ]
          }
        },
        adminDisplay: {
          passengerChangeItems: [
            "事前確定M 旅客都合途中終了",
            "事前確定運賃M：旅客都合によるルート変更・立ち寄り追加のため途中終了",
            "終了理由",
            "終了日時",
            "当初事前確定運賃",
            "fareMode: pre_fixed_fare",
            "以後の運送：通常メーター等の別運送として開始",
            "終了地点",
            "備考"
          ],
          normalNote: "通常完了では従来どおり「事前確定M 完了」と表示し、途中終了パネルは表示しない。"
        },
        preLaunchChecks: [
          "管理画面の目視確認は運用者ログイン後に確認予定",
          "案件詳細の実機目視確認は運用者ログイン後に確認予定",
          "GPSM / 時間M / OBDM の実機回帰確認は運用開始前確認項目として実施予定"
        ],
        verifiedNote: "コード・API・D1・予約詳細表示の動作は確認済み。上記は運用開始前の目視確認項目として整理する。"
      },
      futurePlans: [
        "Firebase ID Token 検証を driver-proxy に追加し、curl等の直接アクセスをより厳密に制限する",
        "利用明細書PDFの fixed 専用表示対応（現時点では次期対応）",
        "本番相当環境E2E証跡の定期更新（新規予約IDでの再確認）"
      ],
      e2eTestCases: global.PreFixedFareApprovalAppendixData
        ? global.PreFixedFareApprovalAppendixData.buildE2eTestCases()
        : {
          title: "本番相当環境E2Eテストケース表",
          note:
            "本表は、本番相当環境におけるスモークテスト・E2E確認の実施記録である。予約IDに2099年の日付を含むものは、本番相当環境での検証用データであり、本番運用データではない。",
          headers: ["ID", "テストシナリオ", "期待される挙動", "結果", "エビデンス"],
          rows: [
            ["TC-001", "通常の複数ルート選択・運行", "2以上のルートから旅客が選択し、同意した金額で運行完了", "合格", "予約ID: 209906021400"],
            ["TC-002", "ルート候補が1件のみ", "事前確定運賃として確定せず、通常見積又は通常メーターへ切替", "合格", "システムログ確認済"],
            ["TC-003", "旅客都合による途中降車", "事前確定運賃をその時点で終了し、以後は別運送又は通常メーター扱い", "合格", "予約ID: 2099041030"],
            ["TC-004", "事故・通行止めによる迂回", "旅客了承ログを保存し、原則として当初の事前確定運賃を維持", "合格", "迂回ログ: RQ-04"],
            ["TC-005", "障害者割引＋福祉タクシー券", "精算時に割引対象運賃・割引額を記録し、福祉券は支払充当として処理（見積同意時点では割引非反映）", "合格", "精算レシート: R-005"],
            ["TC-006", "スナップショット不一致検知", "保存データと再計算ハッシュが不一致の場合、管理者確認へ回す", "合格", "エラー検知ログ確認済"]
          ]
        },
      tamperProtection: global.PreFixedFareApprovalAppendixData
        ? global.PreFixedFareApprovalAppendixData.buildTamperProtection()
        : null,
      footerNote: "本資料は運輸局提出用の運用・監査説明資料です。最終的な申請書類への転記・体裁調整は、申請担当者が行ってください。"
    };
  }

  global.PreFixedFareOperationsSummaryData = {
    REPORT_TITLE: REPORT_TITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
