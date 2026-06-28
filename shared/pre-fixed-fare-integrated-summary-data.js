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
        "運賃額・明細区分はコード上確認済み",
        "estimate-main.js 見積結果画面、fixedFareBreakdown / serviceFees（割引適用時の前後表示は運用開始前確認項目）"
      ),
      "注意事項を提示し同意取得",
      "同意導線・保存はコード・API・DB上確認済み",
      "estimate-defaults preFixedFareNotice、reservation-v4 estimate_consent / quote_consents、本番E2E確認"
    );

    next.snapshotConfirmed = (regulatory.snapshotConfirmed || []).concat([
      "選択ルート情報（selectedRoute / selectedRouteId / routeCandidates / routePlan）",
      "同意情報（同意日時、同意文面、同意文面バージョン）",
      "snapshotHash（見積登録時生成・予約・メーター読取時照合）",
      "見積状態管理（quotes.status: active / consumed / expired / canceled）"
    ]);

    next.snapshotUnconfirmedTitle = "今後の強化候補";
    next.snapshotUnconfirmed = [
      "サーバー署名（HMAC等）— 現状は snapshotHash による整合性確認で代替"
    ];

    next.stateManagement = Object.assign({}, regulatory.stateManagement || {}, {
      note: "quotes テーブルで active / consumed / expired / canceled と有効期限を管理。最終目視確認は第5章に整理。"
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
        createdBy: "LP管理画面",
        documentType: "運輸局への提出用説明資料案。最終的な申請書類への転記・体裁調整は申請担当者が行う。"
      },
      toc: [
        { chapter: 1, title: "システム基本方針と公示要件対応" },
        { chapter: 2, title: "利用者向け見積シミュレーターの動作と判定ロジック" },
        { chapter: 3, title: "運行・精算における運用フローと監査証跡" },
        { chapter: 4, title: "旅客都合変更時の途中終了運用" },
        { chapter: 5, title: "確認済み証跡と運用開始前確認項目" }
      ],
      chapterPositioning: {
        1: "本章は、関東運輸局の公示要件に対するシステム全体の対応方針・算定式・係数・ルート算定・同意証跡を整理したものです。",
        2: "本章は、利用者向け見積シミュレーターにおけるルート候補生成・選択ロジック・証跡保存の仕組みを説明します。",
        3: "本章は、LP見積からメーターアプリ運行・精算・完了までの本番フローと監査証跡を説明します。",
        4: "本章は、旅客都合によるルート変更等が発生した場合の途中終了運用を、認可改善の重要事項として独立して説明します。",
        5: "本章は、本番E2E確認結果と運用開始前の確認項目を整理したものです。"
      },
      regulatory: regulatory,
      approval: approval,
      operations: operations,
      e2eReservationNote: "※上記予約IDは本番環境におけるE2E確認時の検証IDである。確認完了後、予約データ整理により本番D1上の当該テスト予約は削除済み。確認結果は開発記録および本資料上の実施記録として保持している。",
      fareTableAppendixNote: "実際の申請時には、申請予定または認可後の距離制運賃表を別紙として添付し、本システムの距離制運賃マスターが当該運賃表に基づくことを示す。",
      fareFeeDisplayNote: "迎車料金・予約料金・介助料等については、事前確定運賃とは区分し、明細上も別行で表示する。",
      driverRouteDisplay: {
        status: "主要経由地点・予約情報の読取確認済み",
        points: [
          "利用者が選択した selectedRoute / selectedRouteId / routePlan / polyline / 主要経由地点を quoteSnapshot に保存する",
          "reservation-v4 に保存された quoteSnapshot をメーターアプリが driver-proxy 経由で読み込む",
          "メーターアプリの予約詳細画面で迎車地・降車地・ルートID・見積距離・確定運賃等を確認できる",
          "snapshotHashVerified により、予約保存時の見積内容とメーターアプリ読取時の内容が一致することを検証する（本番E2E確認済み）",
          "confirmedFareMatchesSnapshot により、当初同意済み運賃額と読取運賃が一致することを検証する（本番E2E確認済み）"
        ],
        visualCheckNote: "運転者向けルート地図描画（polyline表示）は未実装のため、同一ルートまたは主要経由地点の最終目視確認は第5章の運用開始前確認項目とする。"
      },
      referenceMaterials: [
        "事前確定運賃システム概要書 兼 関東運輸局公示要件対応表",
        "事前確定運賃システム説明資料",
        "事前確定運賃M 運用・監査説明資料",
        "reservation-v4 test:phase5 実行結果",
        "care-taxi-meter 本番GitHub Pages反映確認",
        "complete-fixed-fare 本番E2E確認結果",
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
        "割引適用時の運賃前後表示の目視確認（福祉施策等を適用する場合）"
      ],
      footerNote: "本資料は運輸局への提出用説明資料案です。公示要件に沿った運用が説明可能な状態を示すものであり、最終的な申請書類への転記・体裁調整は申請担当者が行ってください。"
    };
  }

  global.PreFixedFareIntegratedSummaryData = {
    REPORT_TITLE: REPORT_TITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
