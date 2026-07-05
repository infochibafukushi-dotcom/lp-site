(function(global){
  const REPORT_TITLE = "事前確定運賃システム 統合説明資料";

  function patchItemRow(rows, itemLabel, status, basis){
    return (rows || []).map(function(row){
      if(row.item !== itemLabel){
        return row;
      }
      return {
        item: row.item,
        status: status,
        basis: basis || row.basis
      };
    });
  }

  function patchRequirementRow(rows, requirement, current, evidence){
    return (rows || []).map(function(row){
      if(row.requirement !== requirement){
        return row;
      }
      return {
        requirement: row.requirement,
        policy: row.policy,
        current: current,
        evidence: evidence || row.evidence
      };
    });
  }

  function applyIntegratedRegulatoryOverrides(regulatory){
    const next = Object.assign({}, regulatory);

    next.purpose = [
      "本資料は、一般乗用旅客自動車運送事業の事前確定運賃について、関東運輸局の公示要件に対するシステム対応を説明するための統合説明資料である。",
      "コード・API・DB上で確認済みの項目と、提出前または運用開始前に運用者が行う最終目視確認項目を分けて記載する。"
    ];

    next.multiRouteRows = patchItemRow(
      patchItemRow(
        patchItemRow(
          regulatory.multiRouteRows,
          "選択ルート保存",
          "コード・API・DB上確認済み",
          "estimate/estimate-calc.js quoteSnapshot、shared/estimate-quote-register.js、reservation-v4 quotes / reservations 保存"
        ),
        "予約API/DB保存",
        "コード・API・DB上確認済み",
        "reservation-v4 registerQuote / createReservationFixedFare"
      ),
      "運転者への同一ルート表示",
      "主要経由地点・予約情報の読取確認済み",
      "reservation-v4 driver-proxy、care-taxi-meter 予約詳細（地図描画は運用開始前確認項目）"
    );

    next.tollRows = patchItemRow(
      regulatory.tollRows,
      "予約API/DBへの保存",
      "コード・API・DB上確認済み",
      "reservation-v4 registerQuote / reservations.quote_snapshot"
    );

    next.mapAndRouteRows = patchItemRow(
      regulatory.mapAndRouteRows,
      "予約API/DB永続化",
      "コード・API・DB上確認済み",
      "reservation-v4 quotes.route_plan / quote_snapshot"
    );

    next.requirementRows = patchRequirementRow(
      patchRequirementRow(
        regulatory.requirementRows,
        "運賃額と割引前後を提示",
        "一部実装：見積・同意時点では割引適用前の運賃本体を提示。障害者割引等は精算時に記録",
        "lp-site/data/estimate-config.json disclaimer、care-taxi-meter/services/fare.ts buildFixedFareBreakdown()、caseRecords"
      ),
      "注意事項を提示し同意取得",
      "同意導線・保存はコード・API・DB上確認済み",
      "estimate-defaults preFixedFareNotice、reservation-v4 estimate_consent / quote_consents、本番相当環境E2E確認"
    );

    next.snapshotConfirmed = (regulatory.snapshotConfirmed || []).concat([
      "選択ルート情報（selectedRoute / selectedRouteId / routeCandidates / routePlan）",
      "同意情報（同意日時、同意文面、同意文面バージョン）",
      "snapshotHash（見積登録時生成・予約・メーター読取時照合）",
      "見積状態管理（quotes.status: active / consumed / expired / canceled）"
    ]);

    next.snapshotUnconfirmedTitle = "今後の強化候補";
    next.snapshotUnconfirmed = [
      "サーバー署名（HMAC等）— 将来的な外部API連携・複数事業者連携時の追加対策として検討"
    ];
    next.tamperProtectionSummary = [
      "スナップショットハッシュは、改ざん防止そのものではなく、同意時点データとの整合性確認・不一致検知のための仕組みとして位置づける",
      "見積・同意時点のデータセットからSHA-256方式による一方向性のスナップショットハッシュを生成・保存する",
      "運行開始時・精算時・監査確認時に再計算ハッシュと保存ハッシュを照合し、不一致時は管理者確認の対象とする",
      "現行運用では、スナップショットハッシュ照合、データベース権限制御、操作ログ保存により整合性を確認できる体制を構築している"
    ];

    next.stateManagement = Object.assign({}, regulatory.stateManagement || {}, {
      note: "quotes テーブルで active / consumed / expired / canceled と有効期限を管理。最終目視確認は第10章に整理。"
    });

    return next;
  }

  function buildReportData(options){
    if(!global.PreFixedFareReportData || !global.PreFixedFareApprovalSummaryData || !global.PreFixedFareOperationsSummaryData){
      throw new Error("統合資料の元データモジュールが読み込まれていません");
    }

    const config = options?.config || {};
    const estimateConfig = options?.estimateConfig || {};
    const regulatory = applyIntegratedRegulatoryOverrides(
      global.PreFixedFareReportData.buildReportData({ config: config, estimateConfig: estimateConfig })
    );
    const approval = global.PreFixedFareApprovalSummaryData.buildReportData();
    const operations = global.PreFixedFareOperationsSummaryData.buildReportData();

    const businessName = String(regulatory.meta?.businessName || "").trim();
    const resolvedBusinessName = businessName && businessName !== "未設定"
      ? businessName
      : "ちばケアタクシー";

    return {
      title: REPORT_TITLE,
      meta: {
        subtitle: "関東運輸局提出・説明用",
        businessName: resolvedBusinessName,
        target: "介護タクシーLP / 見積シミュレーター / 予約システム / メーターアプリ",
        createdAt: regulatory.meta?.createdAt || operations.meta?.createdAt || "",
        createdBy: "管理画面",
        documentType: "運輸局への提出用説明資料案。最終的な申請書類への転記・体裁調整は申請担当者が行う。"
      },
      toc: [
        { chapter: 1, title: "システム基本方針と公示要件対応" },
        { chapter: 2, title: "利用者向け見積シミュレーターの動作と判定ロジック" },
        { chapter: 3, title: "運行・精算における運用フローと監査証跡" },
        { chapter: 4, title: "旅客都合変更時の途中終了運用" },
        { chapter: 5, title: "確認済み証跡と運用開始前確認項目" },
        { chapter: 6, title: "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）" }
      ],
      reviewToc: [
        { chapter: 1, title: "事前確定運賃の申請概要" },
        { chapter: 2, title: "認可審査要件への対応" },
        { chapter: 3, title: "実画面証跡" },
        { chapter: 4, title: "運賃算定根拠" },
        { chapter: 5, title: "各種料金との区分" },
        { chapter: 6, title: "例外運用" },
        { chapter: 7, title: "監査証跡・保存・照合" },
        { chapter: 8, title: "本番相当環境E2E確認" },
        { chapter: 9, title: "Q&A" },
        { chapter: 10, title: "補足・運用開始前確認項目" }
      ],
      fullSetToc: [
        { no: "1", title: "申請書" },
        { no: "2", title: "審査確認ポイント一覧" },
        { no: "3", title: "添付資料一覧・ページ対応表" },
        { no: "4", title: "実画面証跡資料", children: [
          "4-1. ルート選択画面",
          "4-2. 旅客同意確認画面",
          "4-3. ドライバー確認画面",
          "4-4. 領収書・レシート明細画面",
          "4-5. 各種料金確認画面"
        ]},
        { no: "5", title: "公示要件対応表" },
        { no: "6", title: "算定式・距離制運賃・平準化係数" },
        { no: "7", title: "各種料金との区分" },
        { no: "8", title: "旅客都合変更・事故・通行止め等の運用" },
        { no: "9", title: "保存期間・監査証跡・改ざん検知" },
        { no: "10", title: "E2E確認結果" },
        { no: "11", title: "Q&A" },
        { no: "12", title: "別紙1 距離制運賃表" },
        { no: "13", title: "別紙2 各種料金表" },
        { no: "14", title: "補足資料" }
      ],
      chapterPositioning: {
        1: "本章は、関東運輸局の公示要件に対するシステム全体の対応方針・算定式・係数・ルート算定・同意証跡を整理したものです。",
        2: "本章は、利用者向け見積シミュレーターにおけるルート候補生成・選択ロジック・証跡保存の仕組みを説明します。",
        3: "本章は、LP見積からメーターアプリ運行・精算・完了までの本番フローと監査証跡を説明します。",
        4: "本章は、旅客都合によるルート変更等が発生した場合の途中終了運用を、認可改善の重要事項として独立して説明します。",
        5: "本章は、本番相当環境E2E確認結果と運用開始前の確認項目を整理したものです。",
        6: "本章は、データ保存規程、画面キャプチャ構成案、本番相当環境E2Eテストケース表、改ざん防止及びスナップショットハッシュの取扱いを整理した追加資料です。"
      },
      reviewChapterPositioning: {
        1: "本章は、事前確定運賃の申請目的、使用する配車アプリ、対象営業区域、適用する運賃・料金の種類を整理したものです。",
        2: "本章は、関東運輸局の公示要件に対する対応方針を、電子地図・算定式・ルート提示・同意・運転者提示の観点から整理したものです。",
        3: "本章は、実画面証跡資料との対応関係を示し、審査時に確認いただく画面項目を整理したものです。",
        4: "本章は、距離制運賃表・平準化係数・算定式・四捨五入の根拠を整理したものです。別紙1を参照してください。",
        5: "本章は、事前確定運賃本体と各種料金の区分を整理したものです。別紙2を参照してください。",
        6: "本章は、旅客都合ルート変更、事故・通行止め等、候補1件時、往復・立ち寄り、帰り未定等の例外運用を整理したものです。",
        7: "本章は、quoteSnapshot、同意日時、snapshotHash、caseRecords、meter_fixed_fare_runs、保存期間、閲覧権限を整理したものです。",
        8: "本章は、本番相当環境におけるE2E確認結果を整理したものです。",
        9: "本章は、想定質問と回答の概要を示します。詳細は別添Q&A資料を参照してください。",
        10: "本章は、運用開始前確認、将来強化候補、申請担当者による最終確認項目を整理したものです。"
      },
      qaChapterNote: "想定質問と回答の全文は、別添「Q&A資料」を参照してください。本章では、運輸局説明用の主要論点を整理します。",
      regulatory: regulatory,
      approval: approval,
      operations: operations,
      e2eReservationNote: "※上記予約IDは本番相当環境におけるE2E確認（スモークテスト）時の検証IDである。確認完了後、予約データ整理により本番D1上の当該テスト予約は削除済み。確認結果は開発記録および本資料上の実施記録として保持している。",
      fareTableAppendixNote: "実際の申請時には、申請予定または認可後の距離制運賃表を別紙として添付し、本システムの距離制運賃マスターが当該運賃表に基づくことを示す。",
      fareFeeDisplayNote: "迎車料金・予約料金・介助料等については、事前確定運賃とは区分し、明細上も別行で表示する。",
      driverRouteDisplay: {
        status: "主要経由地点・予約情報の読取確認済み",
        points: [
          "利用者が選択した selectedRoute / selectedRouteId / routePlan / polyline / 主要経由地点を quoteSnapshot に保存する",
          "reservation-v4 に保存された quoteSnapshot をメーターアプリが driver-proxy 経由で読み込む",
          "メーターアプリの予約詳細画面で迎車地・降車地・ルートID・見積距離・確定運賃等を確認できる",
          "snapshotHashVerified により、予約保存時の見積内容とメーターアプリ読取時の内容が一致することを照合する（本番相当環境E2E確認済み）",
          "confirmedFareMatchesSnapshot により、当初同意済み運賃額と読取運賃が一致することを照合する（本番相当環境E2E確認済み）"
        ],
        visualCheckNote: "運転者向けルート地図描画（polyline表示）は未実装のため、同一ルートまたは主要経由地点の最終目視確認は第10章の運用開始前確認項目とする。"
      },
      referenceMaterials: [
        "事前確定運賃システム概要書 兼 関東運輸局公示要件対応表",
        "事前確定運賃システム説明資料",
        "事前確定運賃M 運用・監査説明資料",
        "reservation-v4 test:phase5 実行結果",
        "care-taxi-meter 本番GitHub Pages反映確認",
        "complete-fixed-fare 本番相当環境E2E確認結果",
        "事前確定運賃システム 追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）",
        "本番D1 migration 0005 適用確認",
        "本番D1予約データ整理記録",
        "申請予定または認可後の距離制運賃表"
      ],
      preLaunchChecksSectionTitle: "運用開始前確認項目",
      preLaunchCheckIntro: "以下は、コード・API・DB上の動作確認後、提出前または運用開始前に運用者が画面上で最終目視確認を行う項目である。",
      preLaunchCheckSwapNote: "提出直前に確認完了した場合は、見出しを「運用開始前確認結果」に変更し、各項目末尾を「確認済み」に差し替え可能です。",
      passengerChangeMeterNote: "事前確定運賃Mの旅客都合途中終了操作は、事前確定運賃Mの運行中のみ表示され、GPSM・時間M・OBDM等の通常メーター運行には表示されない。",
      integratedMeterAppFlow: [
        "事前確定運賃Mの運行中のみ「旅客都合変更で途中終了」ボタンを表示する",
        "押下時に確認ダイアログを表示する",
        "確定後、精算前画面へ進む",
        "当初固定運賃額は変更しない",
        "決済端末等で当初同意済みの事前確定運賃額を収受する",
        "精算完了後、「通常メーターで新規運行を開始」ボタンを表示する",
        "ボタン押下で /case/start へ進み、通常メーター等の別案件を開始する"
      ],
      integratedPreLaunchChecks: [
        "管理画面予約詳細の目視確認",
        "メーターアプリ案件詳細の目視確認",
        "運転者画面における同一ルートまたは主要経由地点の目視確認",
        "通常メーター新規運行導線の目視確認",
        "事前確定運賃M以外の通常メーターモード基本動作確認",
        "精算時の障害者割引・福祉タクシー券処理の目視確認（割引対象運賃・割引額・充当額の記録）"
      ],
      appendix: global.PreFixedFareApprovalAppendixData
        ? global.PreFixedFareApprovalAppendixData.buildReportData()
        : null,
      footerNote: "本資料は運輸局への提出用説明資料案です。公示要件に沿った運用が説明可能な状態を示すものであり、最終的な申請書類への転記・体裁調整は申請担当者が行ってください。"
    };
  }

  global.PreFixedFareIntegratedSummaryData = {
    REPORT_TITLE: REPORT_TITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
