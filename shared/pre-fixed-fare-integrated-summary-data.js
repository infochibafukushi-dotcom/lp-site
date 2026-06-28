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
      footerNote: "本資料は運輸局提出用の統合説明資料案です。公示要件に沿った運用が説明可能な状態を示すものであり、最終的な申請書類への転記・体裁調整は申請担当者が行ってください。"
    };
  }

  global.PreFixedFareIntegratedSummaryData = {
    REPORT_TITLE: REPORT_TITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
