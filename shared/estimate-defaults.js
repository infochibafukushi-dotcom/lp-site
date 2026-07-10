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

  function trafficZoneItem(id, label, coefficient, order, municipalities){
    return {
      id: id,
      label: label,
      coefficient: Number(coefficient) || 0,
      order: order,
      municipalities: Array.isArray(municipalities) ? municipalities.slice() : []
    };
  }

  function createDefaultTrafficZones(){
    return {
      items: [
        trafficZoneItem("keiyo", "京葉交通圏", 1.20, 1, [
          "千葉市", "船橋市", "市川市", "習志野市", "八千代市", "浦安市", "四街道市", "佐倉市"
        ]),
        trafficZoneItem("togashi", "東葛交通圏", 1.15, 2, [
          "松戸市", "柏市", "流山市", "野田市", "我孫子市", "鎌ケ谷市", "白井市"
        ]),
        trafficZoneItem("chiba", "千葉交通圏", 1.18, 3, [
          "成田市", "匝瑳市", "富里市", "芝山町", "多古町", "神崎町", "栄町"
        ]),
        trafficZoneItem("hokuso", "北総交通圏", 1.13, 4, [
          "印西市", "白井市", "富里市", "成田市", "香取市", "佐原町", "多古町"
        ]),
        trafficZoneItem("toso", "東総交通圏", 1.13, 5, [
          "旭市", "匝瑳市", "東金市", "山武市", "大網白里市", "九十九里町", "芝山町"
        ]),
        trafficZoneItem("sanmu-togane", "山武東金交通圏", 1.13, 6, [
          "東金市", "山武市", "大網白里市", "九十九里町", "茂原市", "長生村"
        ]),
        trafficZoneItem("ichihara", "市原交通圏", 1.15, 7, [
          "市原市", "木更津市", "君津市", "富津市", "袖ケ浦市"
        ]),
        trafficZoneItem("gaihou", "外房交通圏", 1.13, 8, [
          "銚子市", "旭市", "匝瑳市", "香取市", "茂原市", "東金市"
        ]),
        trafficZoneItem("nanbou", "南房交通圏", 1.13, 9, [
          "館山市", "鴨川市", "南房総市", "木更津市", "君津市", "富津市"
        ])
      ]
    };
  }

  function getFareConstants(){
    return global.FareConstants || null;
  }

  function getDefaultDistancePricingPatternA(){
    const fc = getFareConstants();
    if(fc && typeof fc.getDistancePricingPatternA === "function"){
      return fc.getDistancePricingPatternA();
    }
    return {
      initialDistanceKm: 1.06,
      initialFare: 520,
      incrementDistanceKm: 0.212,
      incrementFare: 100
    };
  }

  function getDefaultCharterTimeBlockParams(){
    const fc = getFareConstants();
    if(fc && typeof fc.getCharterTimeBlockParams === "function"){
      return fc.getCharterTimeBlockParams();
    }
    return {
      baseMinutes: 30,
      baseAmount: 4180,
      perBlockMinutes: 30,
      perBlockAmount: 4180
    };
  }

  function createDefaultEstimateConfig(){
    const distancePatternA = getDefaultDistancePricingPatternA();
    const charterTimeParams = getDefaultCharterTimeBlockParams();
    return {
      enabled: true,
      version: 1,
      updatedAt: new Date().toISOString(),
      page: {
        title: "かんたん料金確認",
        description: "ご利用内容を選択すると料金の目安をご確認いただけます。\n実際の料金は運行ルートや介助内容等により変動する場合があります。",
        disclaimer: "※表示料金は概算です。\n※実際の料金は運行ルート、交通状況、運行時間、迎車場所、介助内容等により変動する場合があります。\n※待機・院内付き添い料金は実際の利用時間により変動します。\n※障害者割引・福祉タクシー券等は概算見積には反映しておりません。",
        resultNotes: "※表示料金は概算です。\n※実際の料金は運行距離、交通状況、待機時間、付き添い時間、介助内容等により変動する場合があります。",
        preFixedFareNotice: "事前確定運賃は、乗車前に提示した走行予定ルートまたは主要経由地点、運賃額についてお客様の同意を得た場合に適用します。渋滞・交通規制等により運転者がルート変更する場合も、お客様の同意を得たうえで、運賃は事前確定額のままとなります。ただし、お客様都合で目的地・経由地・ルートを変更する場合は、その時点で事前確定運賃による運送を終了し、以後は別途精算します。介助料・機材料・有料道路料金等は、事前確定運賃とは別に区分してご請求します。",
        distanceLabel: "走行ルート設定",
        distanceNote: "住所・施設名から走行ルートを計算します。",
        tollRoadNote: "通行料金は実費負担となります。"
      },
      basicFees: {
        baseFare: item("baseFare", "基本運賃", 0, "distance・distance_time 方式では初乗運賃は距離運賃に含まれます（本項目は未使用）。", 1, { visible: false }),
        pickupFee: item("pickupFee", "迎車料金", 800, "", 2),
        specialVehicleFee: item(
          "specialVehicleFee",
          "特殊車両使用料",
          1000,
          "特殊車両（リフト車・スロープ車・車いす固定装置搭載車等）の維持管理費として加算する料金です。",
          3
        )
      },
      distancePricing: {
        mode: "patternA",
        patternA: distancePatternA,
        patternB: {
          perKmRate: 450
        }
      },
      trafficZones: createDefaultTrafficZones(),
      preFixedFare: {
        trafficZoneId: "chiba"
      },
      fareMode: "time",
      fareModeOptions: [
        { id: "time", label: "時間制運賃", enabled: true },
        { id: "distance", label: "距離制運賃", enabled: true },
        { id: "distance_time", label: "距離＋予定時間加算（概算）", enabled: true },
        { id: "pre_fixed_fare", label: "事前確定運賃", enabled: true }
      ],
      fareComponents: {
        time: [
          {
            key: "timeBaseFare",
            label: "時間制運賃",
            calculator: "time_block",
            params: charterTimeParams
          },
          { key: "pickupFee", label: "迎車料金", calculator: "fixed_fee_ref", feeRef: "pickupFee" },
          { key: "specialVehicleFee", label: "特殊車両使用料", calculator: "fixed_fee_ref", feeRef: "specialVehicleFee" }
        ],
        distance: [
          { key: "pickupFee", label: "迎車料金", calculator: "fixed_fee_ref", feeRef: "pickupFee" },
          { key: "specialVehicleFee", label: "特殊車両使用料", calculator: "fixed_fee_ref", feeRef: "specialVehicleFee" },
          { key: "distanceFare", label: "距離運賃", calculator: "distance_pricing_ref", pricingRef: "distancePricing" }
        ],
        distance_time: [
          { key: "pickupFee", label: "迎車料金", calculator: "fixed_fee_ref", feeRef: "pickupFee" },
          { key: "specialVehicleFee", label: "特殊車両使用料", calculator: "fixed_fee_ref", feeRef: "specialVehicleFee" },
          { key: "distanceFare", label: "距離運賃", calculator: "distance_pricing_ref", pricingRef: "distancePricing" },
          {
            key: "timeAdjustment",
            label: "予定時間加算（概算）",
            calculator: "time_block",
            params: {
              baseMinutes: 20,
              baseAmount: 0,
              perBlockMinutes: 10,
              perBlockAmount: 300
            }
          }
        ],
        pre_fixed_fare: [
          { key: "pickupFee", label: "迎車料金", calculator: "fixed_fee_ref", feeRef: "pickupFee" },
          { key: "specialVehicleFee", label: "特殊車両使用料", calculator: "fixed_fee_ref", feeRef: "specialVehicleFee" },
          { key: "distanceFare", label: "距離運賃", calculator: "distance_pricing_ref", pricingRef: "distancePricing" },
          {
            key: "timeAdjustment",
            label: "予定時間加算（概算）",
            calculator: "time_block",
            params: {
              baseMinutes: 20,
              baseAmount: 0,
              perBlockMinutes: 10,
              perBlockAmount: 300
            }
          }
        ]
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
            tripItem("round-trip", "往復", "往路・復路をそれぞれ確認して料金目安を計算します。帰りの時間や立ち寄りがある場合もご相談ください。", 2, { distanceMultiplier: 2, showInSelector: true }),
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
      pdfFooter: {
        enabled: true,
        businessName: "",
        phone: "",
        homepageUrl: "",
        homepageQrLabel: "ホームページはこちら",
        lineUrl: "",
        lineQrLabel: "LINEで相談",
        message: "ご予約・ご相談はお気軽にお問い合わせください"
      },
      resultLabels: {
        baseFare: "基本運賃",
        pickupFee: "迎車料金",
        specialVehicleFee: "特殊車両使用料",
        distanceFare: "距離運賃",
        wheelchairFee: "車いす料金",
        assistanceFee: "介助料金",
        stairFee: "階段介助料金",
        waitingFee: "待機料金",
        escortFee: "付き添い料金",
        fixedFareSection: "事前確定運賃",
        estimatedFareSection: "概算料金内訳",
        calcBasisToggleOpen: "料金の計算方法を見る",
        calcBasisToggleClose: "料金の計算方法を閉じる",
        calcBasisTitle: "料金の計算方法",
        careServiceSection: "介助・サービス料金",
        expenseSection: "実費・別途費用",
        tollRoadExpense: "有料道路・高速道路通行料金",
        fareModeTime: "時間定額運賃",
        fareModeDistance: "距離定額運賃",
        fareModeDistanceTime: "距離＋予定時間加算（概算）",
        fareModePreFixed: "事前確定運賃",
        fareBasisSection: "運賃計算根拠",
        usageSummary: "ご利用内容",
        total: "概算料金",
        totalEstimateSection: "合計目安"
      }
    };
  }

  global.EstimateDefaults = {
    createDefaultEstimateConfig: createDefaultEstimateConfig,
    createDefaultTrafficZones: createDefaultTrafficZones
  };
})(typeof window !== "undefined" ? window : globalThis);
