(function(global){
  const REPORT_TITLE = "事前確定運賃システム 統合説明資料";

  function buildReportData(options){
    if(!global.PreFixedFareReportData || !global.PreFixedFareApprovalSummaryData || !global.PreFixedFareOperationsSummaryData){
      throw new Error("統合資料の元データモジュールが読み込まれていません");
    }

    const config = options?.config || {};
    const estimateConfig = options?.estimateConfig || {};
    const regulatory = global.PreFixedFareReportData.buildReportData({ config: config, estimateConfig: estimateConfig });
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
        points: [
          "利用者が選択した selectedRoute / selectedRouteId / routePlan / polyline / 主要経由地点を quoteSnapshot に保存する",
          "reservation-v4 に保存された quoteSnapshot をメーターアプリが読み込む",
          "メーターアプリ側で運転者が同じ予約情報・ルート情報を確認できる設計である",
          "snapshotHashVerified により、予約保存時の見積内容とメーターアプリ読取時の内容が一致することを検証する",
          "confirmedFareMatchesSnapshot により、当初同意済み運賃額と読取運賃が一致することを検証する"
        ],
        visualCheckNote: "利用者が選択した走行予定ルート情報は quoteSnapshot として保存され、メーターアプリが予約読取時に同一の予約情報・運賃情報を参照する。運転者向け画面でのルート表示は運用開始前の目視確認項目として確認する。"
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
      preLaunchCheckIntro: "以下は運用開始前の目視確認項目（確認予定）です。提出直前に確認完了後は、見出しを「運用開始前確認結果」に変更できます。",
      preLaunchCheckSwapNote: "提出直前に確認済みへ差し替え可能な項目の例：管理画面予約詳細、メーターアプリ案件詳細、事前確定M予約詳細、通常メーター新規運行導線、事前確定運賃M以外の通常メーターモード基本動作。",
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
        "管理画面の目視確認（確認予定）",
        "案件詳細の実機目視確認（確認予定）",
        "事前確定運賃M以外の通常メーターモードの基本動作確認（確認予定）"
      ],
      footerNote: "本資料は運輸局への提出用説明資料案です。公示要件に沿った運用が説明可能な状態を示すものであり、最終的な申請書類への転記・体裁調整は申請担当者が行ってください。"
    };
  }

  global.PreFixedFareIntegratedSummaryData = {
    REPORT_TITLE: REPORT_TITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
