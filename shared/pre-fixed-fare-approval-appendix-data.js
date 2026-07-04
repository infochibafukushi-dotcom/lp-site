(function(global){
  const DATA_RETENTION_TITLE = "事前確定運賃に係るデータ管理及び監査証跡保存規程";
  const SCREENSHOT_TITLE = "画面キャプチャ資料の構成案";
  const E2E_TEST_TITLE = "本番相当環境E2Eテストケース表";
  const TAMPER_PROTECTION_TITLE = "改ざん防止及びスナップショットハッシュの取扱い";

  function todayJst(){
    return new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function buildDataRetentionRegulation(){
    return {
      title: DATA_RETENTION_TITLE,
      sections: [
        {
          number: "1",
          title: "データの保存期間",
          paragraphs: [
            "本システムにおける予約見積データ、旅客同意日時、選択ルート情報、主要経由地点、スナップショットハッシュ値、運行開始・終了ログ、ルート変更ログ、精算明細、領収書・レシート情報は、監査対応、苦情対応及び運賃収受の適正性確認のため、運送終了日から3年間保存する。",
            "なお、本保存期間は、旅客自動車運送事業に関する各種記録の保存義務及び監査時の提示要請に対応するため、当社の社内保存規程として定めるものであり、法令上必要とされる保存期間を下回らない運用とする。",
            "保存対象データは、クラウドデータベースに一元保存し、保存期間内における任意削除、改ざん、上書きによる証跡消失を防止する。"
          ]
        },
        {
          number: "2",
          title: "閲覧権限の限定",
          paragraphs: [
            "保存データの閲覧及び出力権限は、運行管理者、補助者、及びシステム管理責任者に限定する。",
            "乗務員端末では、担当する当日運行又は業務上必要な予約情報のみ閲覧可能とし、過去の監査証跡、他乗務員の運行記録、全体集計データにはアクセスできない権限制御を行う。"
          ]
        },
        {
          number: "3",
          title: "監査時及び苦情対応時の出力方法",
          paragraphs: [
            "地方運輸局による監査、又は旅客からの苦情申立てがあった場合、運行管理者又はシステム管理責任者は、管理画面又は保存データから「予約ID」「見積番号」「運行日」「車両番号」「乗務員名」をキーとして対象データを確認する。",
            "対象データについては、監査・苦情対応時に確認資料として整理できるよう、以下の項目を保存・確認対象とする。PDF又はCSV等による提出用出力については、運用開始までに出力方法を明確化する。"
          ],
          outputItems: [
            "予約時の同意内容",
            "選択ルート及び主要経由地点",
            "事前確定運賃額",
            "同意日時",
            "スナップショットハッシュ",
            "運行開始及び終了記録",
            "ルート変更ログ",
            "精算明細",
            "領収書又はレシート発行記録"
          ],
          closing:
            "これにより、予約時の同意内容、実際の運行内容、精算内容を後日照合できる状態を維持する。"
        }
      ]
    };
  }

  function buildScreenshotCaptures(){
    return {
      title: SCREENSHOT_TITLE,
      intro:
        "以下は、運輸局への説明時に添付する画面キャプチャ資料の構成案である。実画像が未整備の場合は、各枠を「画面キャプチャ貼付欄」として使用する。",
      screens: [
        {
          number: "1",
          title: "利用者予約・ルート選択画面",
          captureContent:
            "同一画面に「ルートA」「ルートB」など、2以上の走行予定ルートが並んでいる画面。各ルートについて、地図、距離、所要時間、事前確定運賃額、有料道路料金の有無を表示する。",
          proofText:
            "公示要件に基づき、旅客に対して地理的・時間的に合理的な2以上の異なる走行予定ルート及びそれぞれの運賃額を明確に提示し、旅客自身が選択できるUIを確保している。"
        },
        {
          number: "2",
          title: "旅客同意確認画面",
          captureContent:
            "選択したルートの地図、事前確定運賃額、注意事項、同意ボタンを表示している画面。",
          proofText:
            "同意ボタンの押下日時、選択されたルート情報、主要経由地点及び運賃額を1つのデータセットとして予約IDに紐づけて保存し、同意時点の内容を後から確認できるようにしている。"
        },
        {
          number: "3",
          title: "ドライバー用メーターアプリ画面",
          captureContent:
            "地図上に同意済みの確定ルートを表示し、画面上に「事前確定運賃：〇〇円」などの固定運賃表示がある画面。",
          proofText:
            "外部ナビが渋滞等で再計算した場合でも、本メーター画面上では旅客同意済みの確定ルートを保持し、乗務員が運行中に目視確認できる仕様としている。"
        },
        {
          number: "4",
          title: "決済・領収書発行画面",
          captureContent:
            "精算時の領収書又はレシートに、事前確定運賃、迎車料金、介助料、待機料、実費、有料道路料金、割引額等が別明細で表示されている画面。",
          proofText:
            "事前確定運賃である運賃本体と、介助料・待機料・実費等の付帯料金を区分して精算・表示し、旅客に誤認を与えない明細交付を行う。" +
            "障害者割引等の割引額は、見積・同意時点では反映せず、精算時にメーターアプリで割引対象運賃・割引額・精算後金額を記録する。"
        }
      ]
    };
  }

  function buildE2eTestCases(){
    return {
      title: E2E_TEST_TITLE,
      note:
        "本表は、本番相当環境におけるスモークテスト・E2E確認の実施記録である。予約IDに2099年の日付を含むものは、本番相当環境での検証用データであり、本番運用データではない。",
      headers: ["ID", "テストシナリオ", "期待される挙動", "結果", "エビデンス"],
      rows: [
        [
          "TC-001",
          "通常の複数ルート選択・運行",
          "2以上のルートから旅客が選択し、同意した金額で運行完了",
          "合格",
          "予約ID: 209906021400"
        ],
        [
          "TC-002",
          "ルート候補が1件のみ",
          "事前確定運賃として確定せず、通常見積又は通常メーターへ切替",
          "合格",
          "システムログ確認済"
        ],
        [
          "TC-003",
          "旅客都合による途中降車",
          "事前確定運賃をその時点で終了し、以後は別運送又は通常メーター扱い",
          "合格",
          "予約ID: 2099041030"
        ],
        [
          "TC-004",
          "事故・通行止めによる迂回",
          "旅客了承ログを保存し、原則として当初の事前確定運賃を維持",
          "合格",
          "迂回ログ: RQ-04"
        ],
        [
          "TC-005",
          "障害者割引＋福祉タクシー券",
          "精算時に割引対象運賃・割引額を記録し、福祉券は支払充当として処理（見積同意時点では割引非反映）",
          "合格",
          "精算レシート: R-005"
        ],
        [
          "TC-006",
          "スナップショット不一致検知",
          "保存データと再計算ハッシュが不一致の場合、管理者確認へ回す",
          "合格",
          "エラー検知ログ確認済"
        ]
      ]
    };
  }

  function buildTamperProtection(){
    return {
      title: TAMPER_PROTECTION_TITLE,
      paragraphs: [
        "現行システムでは、見積・同意時点における選択ルート情報、主要経由地点、推計距離、推計時間、運賃額、同意日時等を1つのデータセットとして保存し、当該データセットからSHA-256方式による一方向性のスナップショットハッシュを生成・保存する。",
        "運行開始時、精算時、及び監査確認時には、保存データから再計算したハッシュ値と、予約・同意時に保存されたハッシュ値を照合することで、予約後にルート情報、運賃額、同意日時等が変更されていないことを確認する。",
        "ハッシュ値が一致しない場合は、同意時点のデータと現在データに差異があるものとして検知し、事前確定運賃としての通常処理を停止し、管理者確認の対象とする。",
        "HMAC方式については、将来的に外部API連携、複数事業者連携、又はサーバー間認証を強化する場合の追加対策として検討する。現行運用では、スナップショットハッシュ照合、データベース権限制御、操作ログ保存により、予約時同意内容と運行・精算内容の整合性を確認できる体制を構築している。"
      ],
      terminologyNote:
        "スナップショットハッシュは、改ざん防止そのものではなく、同意時点データとの整合性確認・不一致検知のための仕組みとして位置づける。"
    };
  }

  function buildReportData(options){
    options = options || {};
    return {
      meta: {
        createdAt: todayJst(),
        createdBy: options.createdBy || "管理画面",
        documentType: "運輸局への提出用追加資料"
      },
      dataRetentionRegulation: buildDataRetentionRegulation(),
      screenshotCaptures: buildScreenshotCaptures(),
      e2eTestCases: buildE2eTestCases(),
      tamperProtection: buildTamperProtection(),
      footerNote:
        "本資料は運輸局への説明補助資料であり、個別の認可判断を保証するものではない。"
    };
  }

  global.PreFixedFareApprovalAppendixData = {
    DATA_RETENTION_TITLE: DATA_RETENTION_TITLE,
    SCREENSHOT_TITLE: SCREENSHOT_TITLE,
    E2E_TEST_TITLE: E2E_TEST_TITLE,
    TAMPER_PROTECTION_TITLE: TAMPER_PROTECTION_TITLE,
    buildDataRetentionRegulation: buildDataRetentionRegulation,
    buildScreenshotCaptures: buildScreenshotCaptures,
    buildE2eTestCases: buildE2eTestCases,
    buildTamperProtection: buildTamperProtection,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
