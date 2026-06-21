(function(global){
  function item(id, label, amount, description, order, extra){
    return Object.assign({
      id: id,
      label: label,
      description: String(description || ""),
      amount: Number(amount) || 0,
      visible: true,
      order: order
    }, extra || {});
  }

  function tripItem(id, label, description, order, behavior){
    return item(id, label, 0, description, order, {
      distanceMultiplier: behavior.distanceMultiplier ?? 1,
      waitingFeeRef: behavior.waitingFeeRef || "",
      escortFeeRef: behavior.escortFeeRef || "",
      showInSelector: behavior.showInSelector !== false
    });
  }

  function addonItem(id, label, description, order, behavior){
    return item(id, label, 0, description, order, {
      waitingFeeRef: behavior.waitingFeeRef || "",
      escortFeeRef: behavior.escortFeeRef || ""
    });
  }

  function createDefaultEstimateConfig(){
    return {
      enabled: true,
      version: 1,
      updatedAt: new Date().toISOString(),
      page: {
        title: "概算見積シミュレーター",
        description: "ご利用内容を選択すると概算料金を確認できます。\n実際の料金は運行ルートや介助内容等により変動する場合があります。",
        disclaimer: "※表示料金は概算です。\n※実際の料金は運行ルート、交通状況、運行時間、迎車場所、介助内容等により変動する場合があります。\n※待機・院内付き添い料金は実際の利用時間により変動します。\n※障害者割引・福祉タクシー券等は概算見積には反映しておりません。",
        resultNotes: "※表示料金は概算です。\n※実際の料金は運行距離、交通状況、待機時間、付き添い時間、介助内容等により変動する場合があります。",
        distanceLabel: "片道距離（km）",
        distanceNote: "※往復送迎を選択した場合は運賃距離を自動で2倍計算します。"
      },
      basicFees: {
        baseFare: item("baseFare", "基本運賃", 730, "", 1),
        reservationFee: item("reservationFee", "予約料金", 400, "", 2),
        pickupFee: item("pickupFee", "迎車料金", 500, "", 3)
      },
      distancePricing: {
        mode: "patternA",
        patternA: {
          initialDistanceKm: 1.096,
          initialFare: 730,
          incrementDistanceKm: 0.221,
          incrementFare: 100
        },
        patternB: {
          perKmRate: 450
        }
      },
      categories: {
        mobility: {
          label: "移動方法",
          items: [
            item("cane-walk", "杖・歩行器", 0, "杖や歩行器での移動に対応します。", 1),
            item("own-wheelchair", "ご自身の車いす", 0, "普段ご利用されている車いすのままご乗車いただけます。", 2),
            item("free-wheelchair", "無料車いす", 0, "当社の標準車いすを無料でご利用いただけます。", 3),
            item("reclining-wheelchair", "リクライニング車いす", 2500, "長時間の移動や座位保持が難しい方向けのリクライニング式車いすです。", 4),
            item("stretcher", "ストレッチャー", 4000, "寝たままの状態で搬送できる設備です。座ることが難しい方に対応します。", 5)
          ]
        },
        assistance: {
          label: "介助内容",
          items: [
            item("watch-assist", "見守り介助", 0, "転倒防止のため付き添いながら移動を見守ります。", 1),
            item("boarding-assist", "乗降介助", 1100, "車いす固定やリフト操作、\n車への乗り降りをお手伝いします。", 2),
            item("body-assist", "身体介助", 1600, "お部屋から車いすへの移乗介助、\n車両への乗降介助、\n車いす固定などを行います。", 3)
          ]
        },
        stairAssist: {
          label: "階段介助",
          items: [
            item("stair-none", "階段介助なし", 0, "", 1),
            item("stair-watch", "見守り介助", 0, "階段や移動時に転倒防止のため付き添い、安全確認を行います。\n身体を支える介助は含みません。", 2),
            item("stair-floor2", "2階移動", 3000, "エレベーターのない建物などで、階段を利用して移動する際の介助です。\n階数や介助人数により料金が異なります。", 3),
            item("stair-floor3", "3階移動", 5000, "エレベーターのない建物などで、階段を利用して移動する際の介助です。\n階数や介助人数により料金が異なります。", 4),
            item("stair-floor4", "4階移動", 7000, "エレベーターのない建物などで、階段を利用して移動する際の介助です。\n階数や介助人数により料金が異なります。", 5),
            item("stair-floor5", "5階移動", 10000, "エレベーターのない建物などで、階段を利用して移動する際の介助です。\n階数や介助人数により料金が異なります。", 6)
          ]
        },
        tripType: {
          label: "送迎方法",
          items: [
            tripItem("one-way", "片道", "片道の送迎です。", 1, { distanceMultiplier: 1, showInSelector: true }),
            tripItem("round-trip", "往復", "往復の送迎です。距離運賃は2倍で計算します。", 2, { distanceMultiplier: 2, showInSelector: true }),
            tripItem("waiting", "待機（旧）", "旧設定項目です。", 3, { distanceMultiplier: 2, waitingFeeRef: "waiting30min", showInSelector: false }),
            tripItem("hospital-escort", "病院付き添い（旧）", "旧設定項目です。", 4, { distanceMultiplier: 2, escortFeeRef: "escort30min", showInSelector: false })
          ]
        },
        roundTripAddon: {
          label: "待機・付き添い",
          items: [
            addonItem("addon-waiting", "待機（30分）", "目的地での待機中、車両と乗務員が待機するサービスです。\n表示料金は30分を基準とした概算です。", 1, { waitingFeeRef: "waiting30min" }),
            addonItem("addon-escort", "付き添い（30分）", "受付、施設内移動、会計などをお手伝いします。\n表示料金は30分を基準とした概算です。", 2, { escortFeeRef: "escort30min" })
          ]
        }
      },
      waitingFees: {
        waiting30min: item("waiting30min", "待機（30分）", 800, "通院やお買い物などの間、車両と乗務員が待機するサービスです。\n表示料金は30分を基準とした概算です。", 1),
        escort30min: item("escort30min", "付き添い（30分）", 1600, "受付、施設内移動、会計、薬の受け取りなどをお手伝いします。\n表示料金は30分を基準とした概算です。", 2)
      },
      mappings: {
        mobilityAssistance: {
          "cane-walk": { mode: "select", assistanceIds: ["watch-assist", "boarding-assist", "body-assist"], assistanceId: "" },
          "own-wheelchair": { mode: "required", assistanceIds: ["boarding-assist", "body-assist"], assistanceId: "" },
          "free-wheelchair": { mode: "required", assistanceIds: ["boarding-assist", "body-assist"], assistanceId: "" },
          "reclining-wheelchair": { mode: "required", assistanceIds: ["boarding-assist", "body-assist"], assistanceId: "" },
          "stretcher": { mode: "fixed", assistanceIds: [], assistanceId: "body-assist" }
        }
      },
      googleMaps: {
        enabled: true,
        apiKey: "",
        language: "ja",
        region: "JP"
      },
      resultLabels: {
        baseFare: "基本運賃",
        reservationPickupFee: "予約・迎車料金",
        reservationFee: "予約料金",
        pickupFee: "迎車料金",
        distanceFare: "距離運賃",
        wheelchairFee: "車いす料金",
        assistanceFee: "介助料金",
        stairFee: "階段介助料金",
        waitingFee: "待機料金",
        escortFee: "付き添い料金",
        usageSummary: "ご利用内容",
        total: "概算料金"
      }
    };
  }

  global.EstimateDefaults = {
    createDefaultEstimateConfig: createDefaultEstimateConfig
  };
})(typeof window !== "undefined" ? window : globalThis);
