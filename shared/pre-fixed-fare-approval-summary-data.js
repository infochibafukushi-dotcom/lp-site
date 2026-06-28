(function(global){
  const REPORT_TITLE = "事前確定運賃システム説明資料";
  const TARGET_COMMIT = "45bfb24";
  const TARGET_URL = "https://infochibafukushi-dotcom.github.io/lp-site/estimate/";

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
        subtitle: "認可申請時の説明資料（たたき台）",
        targetSystem: "介護タクシーLP／見積シミュレーター",
        purpose: "利用者が乗車前に走行予定ルート候補と概算運賃を確認し、候補から1つを選択したうえで予約に進める仕組みを説明する",
        targetUrl: TARGET_URL,
        targetCommit: TARGET_COMMIT,
        positioning: "運輸局への認可説明用資料（本資料は認可の可否を断定するものではない）",
        createdAt: todayJst(),
        createdBy: "LP管理画面"
      },
      overviewNote: "本資料は、事前確定運賃に関するシステムの動作・判定ロジック・証跡保存の仕組みを、Phase 2 および Phase 3-B の実装と検証結果に基づいて説明するものです。",
      systemFlow: [
        "利用者が移動方法・介助内容・送迎方法を選択する（例：無料車いす、乗降介助、階段介助なし、片道／往復、待機の有無など）",
        "出発地・目的地・必要に応じて立ち寄り先を入力する",
        "Google Routes API により走行予定ルート候補を取得する（時間優先・一般道優先・高速道路利用など）",
        "時間優先・一般道優先・高速道路ルート等を候補として表示する（帰り立ち寄りありの場合は全体走行予定ルート候補）",
        "利用者が候補から1つを選択する（選択前は見積確定・予約導線へは進まない）",
        "選択されたルート距離・予定時間に基づき見積額を算定する",
        "結果画面・PDF・quoteSnapshot・handoff に証跡を保存する",
        "候補2件以上・選択済みなら通常予約導線へ進む（preFixedFareConfirmable=true、fareConfirm=review なし、「この内容で予約する」）",
        "候補1件のみなら確認対応として予約導線へ進む（preFixedFareConfirmable=false、fareConfirm=review あり、「確認対応として予約へ進む」）"
      ],
      judgmentRows: [
        {
          condition: "候補2件以上・利用者が1つ選択",
          system: "preFixedFareConfirmable=true",
          reservationUrl: "fareConfirm=review なし",
          button: "この内容で予約する",
          handling: "事前確定運賃候補"
        },
        {
          condition: "候補1件のみ",
          system: "preFixedFareConfirmable=false",
          reservationUrl: "fareConfirm=review あり",
          button: "確認対応として予約へ進む",
          handling: "通常メーター運賃または確認対応（事前確定運賃として断定しない）"
        },
        {
          condition: "帰り立ち寄りあり・全体候補2件以上・選択済み",
          system: "preFixedFareConfirmable=true",
          reservationUrl: "fareConfirm=review なし",
          button: "この内容で予約する",
          handling: "全体走行予定ルートとして事前確定運賃候補"
        }
      ],
      judgmentNotes: [
        "判定は quoteSnapshot.preFixedFareConfirmable および overallRouteSelection.preFixedFareConfirmable に反映される",
        "候補1件時は fallbackReason: only_one_distinct_route 等を記録し、通常メーター運賃または確認対応として扱い、事前確定運賃として断定しない理由を画面・PDF・JSON に残す",
        "有料道路を含む候補を選択した場合でも、候補数が2件以上であれば事前確定運賃候補として扱う。有料道路料金は事前確定運賃とは別の実費・別料金として扱い、見積料金に含めない"
      ],
      routeCandidateTypes: [
        {
          name: "時間優先ルート",
          description: "所要時間を優先して算定した走行予定ルート。routeStrategy: time_priority、generationReason: time_priority_route として証跡に保存する。"
        },
        {
          name: "一般道優先ルート",
          description: "有料道路・高速道路を避け、一般道を優先して算定した走行予定ルート。routeStrategy: general_road_priority、generationReason: general_road_priority_route として証跡に保存する。"
        },
        {
          name: "高速道路ルート",
          description: "高速道路・有料道路を利用することで所要時間短縮を見込む走行予定ルート。routeStrategy: toll_allowed、generationReason: toll_allowed_route として証跡に保存する。有料道路料金は見積料金に含まず、別途必要であることを明示する。"
        },
        {
          name: "主要道路優先ルート",
          description: "主要道路または主要経由地点を明示して算定する候補。Phase 3-B 時点では主に設計済みであり、今後の拡張候補として位置づける。"
        }
      ],
      dedupeNote: "API取得結果が実質同一であっても、算定条件（routeStrategy / generationReason）が異なる候補は dedupeDecision: kept として保持し、条件差を証跡化する。同一と判断した候補は dedupeDecision: dropped として記録する。",
      singleCandidate: {
        intro: [
          "電子地図APIの結果や経路条件により、実質的に異なる走行予定ルート候補が1件のみとなる場合があります。",
          "この場合、本システムでは事前確定運賃候補としては扱わず、通常メーター運賃または確認対応として予約に進む設計としています。",
          "これにより、2以上の走行予定ルート候補から利用者が選択できない場合に、事前確定運賃として断定しない安全側の運用としています。"
        ],
        ui: [
          "結果画面に「ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。」等の文言を表示する",
          "予約URLに fareConfirm=review を付与する",
          "予約ボタンは「確認対応として予約へ進む」とする"
        ],
        evidence: "往復・帰り立ち寄りありで全体候補が1件のみとなったケース（docs/evidence/pre-fixed-fare-phase2/case-c-*）において、確認対応フローが動作することを確認済み"
      },
      returnWithStop: {
        intro: [
          "往復・帰り立ち寄りあり（return_with_stop）の場合、単に復路だけを候補表示するのではなく、出発地 → 目的地 → 立ち寄り先 → 出発地 の全体走行予定ルートとして候補を合成・表示します。",
          "利用者は「立ち寄り先 → 出発地」だけを選ぶのではなく、往路・立ち寄り区間を含む全体走行予定ルート候補から1つを選択します。"
        ],
        structure: [
          "往路：出発地 → 目的地（共通区間として固定）",
          "復路共通区間：目的地 → 立ち寄り先（全候補で共通）",
          "復路選択区間：立ち寄り先 → 出発地（候補ごとに異なる走行予定ルート）",
          "上記を合成した overallRouteCandidates を一覧表示し、利用者が selectedOverallRouteId で1件を選択する"
        ],
        display: [
          "全体候補2件以上・選択済みの場合：「全体走行予定ルート：事前確定運賃候補（選択済み）」を表示する",
          "PDF にも全体走行予定ルート・共通区間・選択区間の情報を含める"
        ]
      },
      snapshotIntro: [
        "見積結果には quoteSnapshot を保存する。選択されたルート、候補一覧、選択ID、距離、予定時間、ルート生成条件、dedupe結果などを保存する。",
        "handoff は予約システムへ引き継ぐためのJSONであり、sessionStorage.lp_estimate_handoff に保存される。handoff 内の quoteSnapshot フィールドに、見積時点のルート選択証跡が含まれる。"
      ],
      snapshotFields: [
        { field: "estimateNo", description: "見積番号（予約URL引き継ぎ用）" },
        { field: "preFixedFareConfirmable", description: "事前確定運賃候補として確定可能か" },
        { field: "routeCandidates", description: "表示・保存された走行予定ルート候補一覧" },
        { field: "selectedRouteId", description: "利用者が選択したルートID" },
        { field: "routeStrategy", description: "候補ごとの算定戦略（time_priority 等）" },
        { field: "routeLabel", description: "候補の表示名（時間優先ルート 等）" },
        { field: "generationReason", description: "候補生成理由（time_priority_route 等）" },
        { field: "dedupeDecision", description: "重複整理結果（kept / dropped）" },
        { field: "usesToll", description: "有料道路利用の有無" },
        { field: "distanceMeters", description: "選択ルートの距離（メートル）" },
        { field: "durationSeconds", description: "選択ルートの予定時間（秒）" },
        { field: "overallRouteSelection", description: "帰り立ち寄り時の全体走行予定ルート選択情報" },
        { field: "overallRouteCandidates", description: "全体走行予定ルート候補一覧" },
        { field: "selectedOverallRouteId", description: "利用者が選択した全体ルートID" }
      ],
      snapshotFlow: [
        "結果画面到達 → sessionStorage.lp_estimate_handoff（handoff 全体）",
        "handoff.quoteSnapshot（見積証跡）",
        "PDF生成（選択ルート・候補・ステータス文言を含む）",
        "予約URL（estimateNo、必要時 fareConfirm=review）"
      ],
      evidenceFolders: [
        {
          folder: "docs/evidence/pre-fixed-fare-phase2/",
          description: "Phase 2：全体走行予定ルート・候補1件時の確認対応"
        },
        {
          folder: "docs/evidence/pre-fixed-fare-phase3/",
          description: "Phase 3-B：時間優先／一般道優先2候補、高速道路候補、帰り立ち寄り回帰"
        }
      ],
      phase3EvidenceRows: [
        {
          caseName: "短距離",
          content: "時間優先 / 一般道優先の2候補",
          pdf: "case-1-short-distance.pdf",
          quoteSnapshot: "case-1-quote-snapshot.json",
          handoff: "case-1-handoff.json",
          screenshot: "case-1-short-distance-screen.png"
        },
        {
          caseName: "長距離",
          content: "時間優先 / 一般道優先 / 高速道路ルート",
          pdf: "case-2-long-distance.pdf",
          quoteSnapshot: "case-2-quote-snapshot.json",
          handoff: "case-2-handoff.json",
          screenshot: "case-2-long-distance-screen.png"
        },
        {
          caseName: "帰り立ち寄り",
          content: "全体走行予定ルート候補",
          pdf: "case-3-return-with-stop.pdf",
          quoteSnapshot: "case-3-quote-snapshot.json",
          handoff: "case-3-handoff.json",
          screenshot: "case-3-return-with-stop-screen.png"
        }
      ],
      phase2EvidenceRows: [
        {
          caseName: "ケースB",
          content: "全体候補2件以上・選択済み",
          files: "case-b-overall-two-candidates.pdf 他"
        },
        {
          caseName: "ケースC",
          content: "全体候補1件・確認対応",
          files: "case-c-single-candidate-review.pdf 他"
        }
      ],
      relatedCommits: [
        { commit: "1b40ce8", description: "事前確定運賃 Phase 3-B の証跡を追加" },
        { commit: "1c259bd", description: "候補2件以上でルート選択後に結果画面へ進めるよう修正" },
        { commit: "9c38984", description: "時間優先と一般道優先のルート候補取得を追加" },
        { commit: "a85f895", description: "事前確定運賃 Phase 3 の GO型2候補設計を追加" },
        { commit: "22bc145", description: "事前確定運賃 Phase 2 の証跡を追加" },
        { commit: "5b68e0b", description: "全体ルート選択時の確認対応表示を整理" }
      ],
      approvalSummary: [
        "本システムでは、電子地図APIにより、時間優先・一般道優先・高速道路利用等の条件で走行予定ルート候補を生成します。",
        "利用者は表示された走行予定ルート候補から1つを選択し、選択されたルートの距離・予定時間に基づき見積額が算定されます。",
        "有料道路を含む候補については、有料道路料金が見積料金に含まれず、別途必要であることを明示します。",
        "候補が1件のみの場合は、事前確定運賃候補としては扱わず、確認対応として予約に進む設計としています。",
        "選択内容、候補一覧、距離、予定時間、ルート生成条件、利用者選択結果は、PDF・quoteSnapshot・handoff に保存され、後から確認できる証跡として保持されます。"
      ],
      footerNote: "本資料は認可申請時の説明資料（たたき台）です。最終的な申請書類への転記・体裁調整は、申請担当者が行ってください。"
    };
  }

  global.PreFixedFareApprovalSummaryData = {
    REPORT_TITLE: REPORT_TITLE,
    TARGET_COMMIT: TARGET_COMMIT,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
