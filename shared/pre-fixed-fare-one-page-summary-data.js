(function(global){
  const REPORT_TITLE = "事前確定運賃システム 運用フロー説明資料";
  const REPORT_SUBTITLE = "走行予定ルート・運賃同意・運行中確認・ルート変更・精算記録の流れ";

  function todayJst(){
    return new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function buildReportData(options){
    options = options || {};
    return {
      title: REPORT_TITLE,
      subtitle: REPORT_SUBTITLE,
      meta: {
        createdAt: todayJst(),
        createdBy: options.createdBy || "LP管理画面"
      },
      overview:
        "本システムでは、電子地図上で走行予定ルート又は主要経由地点を示し、事前確定運賃額を提示したうえで旅客同意を取得します。" +
        "運行時は同意済みの確定ルートをメーター画面で確認できます。" +
        "旅客都合の変更時は事前確定運賃を区切り、交通規制等の迂回時は旅客同意を記録して運行を継続します。",
      flowSteps: [
        "見積入力",
        "複数ルート提示",
        "旅客同意",
        "確定ルート保存",
        "運転者確認",
        "運行・ナビ",
        "ルート変更記録",
        "精算・領収書"
      ],
      sections: [
        {
          id: "estimate-input",
          number: "1",
          title: "予約・見積入力",
          tone: "default",
          items: [
            "乗車地・降車地・経由地、介助・車いす等のサービス内容を入力する。",
            "事前確定運賃の運賃本体と、介助料・待機料・実費等を区分して算定する。"
          ]
        },
        {
          id: "multi-route",
          number: "2",
          title: "複数ルート提示",
          tone: "default",
          items: [
            "2以上の走行予定ルートを提示する（時間優先・一般道・距離優先・高速道路など）。",
            "各ルートの電子地図・距離・所要時間・運賃目安を表示し、有料道路料金は実費として別枠表示する。"
          ]
        },
        {
          id: "consent-snapshot",
          number: "3",
          title: "旅客同意・確定ルート保存",
          tone: "important",
          items: [
            "旅客はルート・運賃額・サービス内容を確認し、1つの走行予定ルートを選択・同意する。",
            "走行予定ルート、主要経由地点、運賃額、同意日時を保存し、スナップショットハッシュで後から確認できる。"
          ]
        },
        {
          id: "driver-start",
          number: "4",
          title: "運転者確認・運行開始",
          tone: "default",
          items: [
            "運転者はメーター画面の「確定ルートを見る」で、同意済みの走行予定ルート・主要経由地点・運賃額を確認できる。",
            "「ナビ開始」は外部地図アプリ起動のみ。「固定運賃で運行開始」で運行記録を開始する。"
          ]
        },
        {
          id: "nav-separation",
          number: "5",
          title: "ナビと確定ルートの分離",
          tone: "important",
          items: [
            "外部ナビは運転補助として利用する。証跡上の正本は旅客が同意した確定ルートである。",
            "外部ナビが再計算しても、メーター側は同意済みの確定ルートを保持する。"
          ]
        },
        {
          id: "route-change",
          number: "6",
          title: "ルート変更時の処理",
          tone: "caution",
          items: [
            "旅客都合の目的地変更・立ち寄り追加・途中終了は、事前確定運賃をその時点で区切り、以降は追加区間運賃または別運送とする。",
            "交通規制・事故・通行止め・安全上の迂回は、旅客同意を記録し、原則として事前確定運賃のまま継続する。",
            "追加介助料・駐車場代・有料道路代等は事前確定運賃とは別明細で計上する。"
          ]
        },
        {
          id: "settlement",
          number: "7",
          title: "精算・領収書・保存記録",
          tone: "important",
          items: [
            "精算・領収書では、事前確定運賃、追加区間運賃、追加介助料、待機・付き添い、実費を別明細で表示する。",
            "予約ID、同意日時、スナップショットハッシュ、運行開始時刻、ルート変更ログ、精算額を保存する。"
          ]
        }
      ],
      changeTable: {
        title: "ルート変更時の取扱い",
        headers: ["変更区分", "例", "運賃処理", "保存記録"],
        rows: [
          [
            "旅客都合",
            "立ち寄り追加、目的地変更、途中終了",
            "事前確定運賃を区切り、追加区間を別計算",
            "GPS、理由、同意、追加運賃"
          ],
          [
            "交通規制・迂回",
            "事故、通行止め、工事、安全上の迂回",
            "旅客同意のうえ事前確定運賃のまま継続",
            "GPS、理由、同意"
          ],
          [
            "追加介助・実費",
            "追加乗降介助、駐車場代、有料道路代",
            "事前確定運賃とは別明細で加算",
            "項目、金額、入力者、時刻"
          ]
        ]
      }
    };
  }

  global.PreFixedFareOnePageSummaryData = {
    REPORT_TITLE: REPORT_TITLE,
    REPORT_SUBTITLE: REPORT_SUBTITLE,
    buildReportData: buildReportData
  };
})(typeof window !== "undefined" ? window : globalThis);
