(function(global){
  const A4 = {
    widthMm: 210,
    heightMm: 297,
    marginMm: 8
  };

  const STATIC_MAP_BASE_URL = "https://maps.googleapis.com/maps/api/staticmap";

  function mmToPx(mm){
    return mm * 96 / 25.4;
  }

  const CONTENT_WIDTH_PX = mmToPx(A4.widthMm - A4.marginMm * 2);
  const CONTENT_HEIGHT_PX = mmToPx(A4.heightMm - A4.marginMm * 2);

  function formatYen(amount){
    const n = Number(amount) || 0;
    return "¥" + n.toLocaleString("ja-JP");
  }

  function formatDateTime(iso){
    const d = iso ? new Date(iso) : new Date();
    if(Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function decodePolyline(encoded){
    const poly = String(encoded || "");
    if(!poly) return [];
    let index = 0;
    const len = poly.length;
    let lat = 0;
    let lng = 0;
    const points = [];

    while(index < len){
      let b;
      let shift = 0;
      let result = 0;
      do{
        b = poly.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      }while(b >= 0x20 && index < len);
      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;
      do{
        b = poly.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      }while(b >= 0x20 && index < len);
      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
  }

  function getRoutePlanPrimaryRoute(routePlan){
    if(routePlan?.outboundRoutePlan){
      const outbound = routePlan.outboundRoutePlan;
      if(Array.isArray(outbound.routes) && outbound.routes.length){
        const selectedId = String(outbound.selectedRouteId || "");
        const selected = outbound.routes.find(function(route){
          return String(route?.routeId || "") === selectedId;
        });
        return selected || outbound.routes[0];
      }
      return {
        encodedPolyline: String(outbound.encodedPolyline || ""),
        distanceMeters: Number(outbound.distanceMeters) || 0,
        durationSeconds: Number(outbound.durationSeconds) || 0
      };
    }
    if(!routePlan) return null;
    if(Array.isArray(routePlan.routes) && routePlan.routes.length){
      const selectedId = String(routePlan.selectedRouteId || "");
      const selected = routePlan.routes.find(function(route){
        return String(route?.routeId || "") === selectedId;
      });
      return selected || routePlan.routes[0];
    }
    return {
      encodedPolyline: String(routePlan.encodedPolyline || ""),
      distanceMeters: Number(routePlan.distanceMeters) || 0,
      durationSeconds: Number(routePlan.durationSeconds) || 0
    };
  }

  function getRouteEncodedPolyline(routePlan){
    const primaryRoute = getRoutePlanPrimaryRoute(routePlan);
    return String(primaryRoute?.encodedPolyline || routePlan?.encodedPolyline || "");
  }

  function hasRouteMapData(data){
    const display = global.EstimateRouteMapDisplay;
    if(display && typeof display.hasRenderableRouteMap === "function"){
      return Boolean(data?.routeMapDataUrl) || display.hasRenderableRouteMap(data?.routePlan);
    }
    return Boolean(data?.routeMapDataUrl) || Boolean(getRouteEncodedPolyline(data?.routePlan));
  }

  function formatRouteDistanceMeters(meters){
    const value = Number(meters) || 0;
    if(value <= 0){
      return "";
    }
    return (value / 1000).toFixed(1) + "km";
  }

  function formatRouteDurationSeconds(seconds){
    const sec = Number(seconds) || 0;
    if(sec <= 0){
      return "";
    }
    return Math.max(1, Math.round(sec / 60)) + "分";
  }

  function getRoadTypeLabel(roadType){
    return String(roadType || "") === "toll" ? "有料道路利用" : "一般道利用";
  }

  function getPolylineBounds(points){
    if(!Array.isArray(points) || !points.length){
      return null;
    }
    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;
    points.forEach(function(point){
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });
    return { minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng };
  }

  function getDefaultLayout(){
    return {
      baseFont: 11,
      titleFont: 20,
      sectionFont: 13.5,
      metaFont: 10.5,
      totalLabelFont: 12,
      totalFont: 26,
      resultNotesFont: 9,
      footerFont: 10.5,
      footerBusinessFont: 13,
      footerPhoneFont: 11.5,
      cellPadV: 4,
      cellPadH: 6,
      breakdownFont: 11,
      breakdownCellPadV: 4,
      breakdownLineHeight: 1.4,
      breakdownLabelPadRight: 12,
      breakdownTableWidth: 100,
      sectionGap: 6,
      lineHeight: 1.38,
      resultNotesLineHeight: 1.42,
      totalBlockPadV: 4,
      totalTopGap: 8,
      resultNotesGap: 4,
      footerGap: 4,
      footerQrSize: 44,
      qrRowGap: 20,
      qrLabelGap: 3,
      titleGap: 4,
      headingGap: 3,
      footerTopGap: 8,
      pagePadTop: 8,
      pagePadBottom: 8,
      routeMapHeight: 180,
      routeMapTitleGap: 4,
      routeMapInfoGap: 4,
      routeMapBottomGap: 6
    };
  }

  function cloneLayout(layout){
    return Object.assign({}, layout);
  }

  function countBreakdownRows(data){
    if(Array.isArray(data.fareSections) && data.fareSections.length){
      return data.fareSections.reduce(function(total, section){
        const rows = Array.isArray(section?.rows) ? section.rows.length : 0;
        return total + Math.max(rows, 1);
      }, 0);
    }
    return (data.breakdownRows || []).filter(function(row){
      return (Number(row.amount) || 0) > 0 || String(row.label || "").trim();
    }).length;
  }

  function tuneLayoutForContent(data, layout){
    const next = cloneLayout(layout);
    const breakdownCount = countBreakdownRows(data);
    const usageCount = (data.usageSummary || []).length;
    const hasNotes = Boolean(String(data.resultNotes || "").trim());
    const hasFooter = !data.pdfFooter || data.pdfFooter.enabled !== false;
    const hasMap = hasRouteMapData(data);

    next.breakdownTableWidth = 100;

    if(breakdownCount <= 3){
      next.breakdownFont = 12;
      next.breakdownCellPadV = 6;
      next.breakdownLineHeight = 1.45;
      next.sectionGap = 6;
      next.totalTopGap = 8;
      next.totalFont = 26;
    }else if(breakdownCount <= 5){
      next.breakdownFont = 11.5;
      next.breakdownCellPadV = 5;
      next.breakdownLineHeight = 1.42;
      next.totalFont = 25;
    }else if(breakdownCount <= 7){
      next.breakdownFont = 10.5;
      next.breakdownCellPadV = 3;
      next.breakdownLineHeight = 1.35;
      next.sectionGap = 5;
      next.totalFont = 24;
    }else{
      next.breakdownFont = 9.5;
      next.breakdownCellPadV = 2;
      next.breakdownLineHeight = 1.28;
      next.sectionGap = 4;
      next.baseFont = 10;
      next.sectionFont = 12.5;
      next.totalFont = 22;
      next.footerQrSize = 38;
      next.routeMapHeight = 170;
    }

    if(usageCount >= 7){
      next.cellPadV = Math.max(2, next.cellPadV - 1);
      next.sectionGap = Math.max(4, next.sectionGap - 1);
    }

    if(hasNotes && breakdownCount >= 6){
      next.resultNotesFont = 8.5;
      next.resultNotesLineHeight = 1.35;
    }

    if(hasMap){
      next.routeMapHeight = breakdownCount >= 8 ? 160 : (breakdownCount >= 6 ? 170 : 180);
      next.sectionGap = Math.max(3, next.sectionGap - 1);
      next.footerTopGap = Math.max(4, next.footerTopGap - 2);
      next.pagePadTop = Math.max(6, next.pagePadTop - 1);
      next.pagePadBottom = Math.max(6, next.pagePadBottom - 1);
    }

    if(hasFooter && hasMap && breakdownCount >= 7){
      next.footerQrSize = 36;
      next.routeMapHeight = Math.min(next.routeMapHeight, 170);
    }

    if(hasMap || breakdownCount >= 5){
      next.footerQrSize = Math.min(next.footerQrSize, 40);
    }

    return next;
  }

  function scaleLayout(layout, factor){
    const next = {};
    Object.keys(layout).forEach(function(key){
      let min = 6;
      if(key === "breakdownLabelPadRight"){
        min = 6;
      }else if(key === "breakdownTableWidth"){
        min = 88;
      }else if(key === "footerQrSize"){
        min = 32;
      }else if(key === "routeMapHeight"){
        min = 130;
      }else if(key === "breakdownFont" || key === "baseFont"){
        min = 9;
      }
      next[key] = Math.max(min, Math.round(layout[key] * factor * 10) / 10);
    });
    return next;
  }

  function footerRule(layout){
    return (
      "<div style=\"text-align:center;color:#bbb;font-size:9px;letter-spacing:1px;" +
      "margin:" + layout.footerGap + "px 0;line-height:1;\">────────────────</div>"
    );
  }

  function buildQrItemHtml(dataUrl, label, layout){
    if(!dataUrl){
      return "";
    }
    return (
      "<div style=\"flex:0 0 auto;text-align:center;\">" +
      "<img src=\"" + dataUrl + "\" alt=\"\" width=\"" + layout.footerQrSize + "\" height=\"" + layout.footerQrSize + "\" " +
      "style=\"display:block;margin:0 auto;\">" +
      (label
        ? "<div style=\"margin-top:" + layout.qrLabelGap + "px;font-size:8px;line-height:1.2;color:#666;\">" + escapeHtml(label) + "</div>"
        : "") +
      "</div>"
    );
  }

  function buildQrRowHtml(pdfFooter, layout, qrDataUrls){
    qrDataUrls = qrDataUrls || {};
    const homepageUrl = String(pdfFooter.homepageUrl || "").trim();
    const lineUrl = String(pdfFooter.lineUrl || "").trim();
    const homepageLabel = String(pdfFooter.homepageQrLabel || "ホームページはこちら").trim();
    const lineLabel = String(pdfFooter.lineQrLabel || "LINEで相談").trim();
    const items = [];

    if(homepageUrl && qrDataUrls.homepage){
      items.push(buildQrItemHtml(qrDataUrls.homepage, homepageLabel, layout));
    }
    if(lineUrl && qrDataUrls.line){
      items.push(buildQrItemHtml(qrDataUrls.line, lineLabel, layout));
    }
    if(!items.length){
      return "";
    }

    return (
      "<div style=\"display:flex;justify-content:center;align-items:flex-start;gap:" + layout.qrRowGap + "px;" +
      "margin-top:" + layout.footerGap + "px;\">" +
      items.join("") +
      "</div>"
    );
  }

  function buildPdfFooterHtml(pdfFooter, layout, qrDataUrls){
    if(!pdfFooter || pdfFooter.enabled === false){
      return "";
    }

    const businessName = String(pdfFooter.businessName || "").trim();
    const phone = String(pdfFooter.phone || "").trim();
    const message = String(pdfFooter.message || "").trim();
    const parts = [];

    if(businessName){
      parts.push(
        "<div style=\"font-weight:700;font-size:" + layout.footerBusinessFont + "px;line-height:1.3;letter-spacing:.02em;\">" +
        escapeHtml(businessName) +
        "</div>"
      );
    }
    if(phone){
      parts.push(
        "<div style=\"font-size:" + layout.footerPhoneFont + "px;line-height:1.3;font-weight:600;margin-top:2px;\">" +
        "TEL：" + escapeHtml(phone) +
        "</div>"
      );
    }

    const qrRowHtml = buildQrRowHtml(pdfFooter, layout, qrDataUrls);
    if(qrRowHtml){
      parts.push(qrRowHtml);
    }

    if(message){
      parts.push(
        "<div style=\"margin-top:" + (layout.footerGap + 1) + "px;font-size:" + Math.max(8.5, layout.footerFont - 1) + "px;line-height:1.35;color:#555;\">" +
        escapeHtml(message) +
        "</div>"
      );
    }

    if(!parts.length){
      return "";
    }

    return (
      footerRule(layout) +
      "<div style=\"font-size:" + layout.footerFont + "px;line-height:1.4;text-align:center;color:#333;\">" +
      parts.join("") +
      "</div>"
    );
  }

  function buildRouteStatusOptions(routePlan, options, quoteSnapshot){
    return {
      returnPlanType: options?.returnPlanType || quoteSnapshot?.returnPlanType || routePlan?.returnPlanType || null,
      outboundRoutePlan: options?.outboundRoutePlan || quoteSnapshot?.outboundRoutePlan || routePlan?.outboundRoutePlan || null,
      returnRoutePlan: options?.returnRoutePlan || quoteSnapshot?.returnRoutePlan || routePlan?.returnRoutePlan || null
    };
  }

  function resolveOverallRouteSelection(quoteSnapshot, routePlan){
    return quoteSnapshot?.overallRouteSelection
      || quoteSnapshot?.routePlan?.overallRouteSelection
      || routePlan?.overallRouteSelection
      || null;
  }

  function getOverallRoutePathLabel(overall){
    const segments = Array.isArray(overall?.commonSegments) ? overall.commonSegments : [];
    const selectable = overall?.selectableSegment || null;
    const outbound = segments.find(function(segment){
      return segment?.key === "outbound";
    });
    const returnCommon = segments.find(function(segment){
      return segment?.key === "return_common";
    });
    const home = String(outbound?.originAddress || "出発地").trim();
    const goal = String(outbound?.destinationAddress || returnCommon?.originAddress || "目的地").trim();
    const stop = String(returnCommon?.destinationAddress || selectable?.originAddress || "立ち寄り先").trim();
    return home + " → " + goal + " → " + stop + " → " + home;
  }

  function getSelectedOverallRouteCandidate(overall){
    if(!overall){
      return null;
    }
    const selectedId = String(overall.selectedOverallRouteId || "").trim();
    if(!selectedId){
      return null;
    }
    const candidates = Array.isArray(overall.overallRouteCandidates) ? overall.overallRouteCandidates : [];
    return candidates.find(function(candidate){
      return String(candidate?.routeId || "") === selectedId;
    }) || null;
  }

  function candidateUsesToll(candidate){
    if(!candidate){
      return false;
    }
    if(candidate.usesToll === true){
      return true;
    }
    const routeType = String(candidate.routeType || candidate.strategy || "").trim();
    return routeType === "toll_allowed";
  }

  function buildOverallRoutePdfParagraph(text, layout, options){
    const gap = Math.max(4, Number(layout?.routeMapTitleGap) || 6);
    const fontSize = Math.max(9, Number(layout?.metaFont) - 1 || 10);
    const color = options?.color || "#555";
    const weight = options?.weight || "400";
    const marginBottom = options?.marginBottom === undefined ? gap : options.marginBottom;
    return (
      "<p style=\"margin:0 0 " + marginBottom + "px;font-size:" + fontSize + "px;line-height:1.55;" +
      "color:" + color + ";font-weight:" + weight + ";\">" +
      escapeHtml(text) +
      "</p>"
    );
  }

  function buildOverallRoutePdfHtml(routePlan, quoteSnapshot, layout, options){
    const returnPlanType = options?.returnPlanType || quoteSnapshot?.returnPlanType || routePlan?.returnPlanType || null;
    if(returnPlanType !== "return_with_stop"){
      return "";
    }
    const overall = resolveOverallRouteSelection(quoteSnapshot, routePlan);
    if(!overall){
      return "";
    }

    const gap = Math.max(4, Number(layout?.routeMapTitleGap) || 6);
    const fontSize = Math.max(9, Number(layout?.metaFont) - 1 || 10);
    const segments = Array.isArray(overall.commonSegments) ? overall.commonSegments : [];
    const selectable = overall.selectableSegment || null;
    const outbound = segments.find(function(segment){
      return segment?.key === "outbound";
    });
    const returnCommon = segments.find(function(segment){
      return segment?.key === "return_common";
    });
    const candidates = Array.isArray(overall.overallRouteCandidates) ? overall.overallRouteCandidates : [];
    const selectedCandidate = getSelectedOverallRouteCandidate(overall);
    const showSelectedRoute = Boolean(selectedCandidate);
    const showReviewNotice = !showSelectedRoute
      || candidates.length <= 1
      || overall.fallbackReason === "only_one_distinct_route";
    const reviewNotice = global.PreFixedFareStatus?.getSingleCandidateNotice?.()
      || "ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。";

    const parts = [];
    parts.push(
      buildOverallRoutePdfParagraph("全体走行予定ルート：", layout, { color: "#333", weight: "700", marginBottom: 2 }) +
      buildOverallRoutePdfParagraph(getOverallRoutePathLabel(overall), layout, { color: "#333", weight: "600" })
    );

    const commonLines = [];
    if(outbound){
      commonLines.push(String(outbound.label || (outbound.originAddress + " → " + outbound.destinationAddress)).trim());
    }
    if(returnCommon){
      commonLines.push(String(returnCommon.label || (returnCommon.originAddress + " → " + returnCommon.destinationAddress)).trim());
    }
    if(commonLines.length){
      parts.push(buildOverallRoutePdfParagraph("共通区間：", layout, { color: "#333", weight: "700", marginBottom: 2 }));
      commonLines.forEach(function(line){
        parts.push(buildOverallRoutePdfParagraph("・" + line, layout));
      });
    }

    if(selectable){
      const selectableLine = String(selectable.label || (selectable.originAddress + " → " + selectable.destinationAddress)).trim();
      parts.push(buildOverallRoutePdfParagraph("選択区間：", layout, { color: "#333", weight: "700", marginBottom: 2 }));
      parts.push(buildOverallRoutePdfParagraph("・" + selectableLine, layout, { marginBottom: gap }));
    }

    if(showReviewNotice){
      parts.push(buildOverallRoutePdfParagraph(reviewNotice, layout, { color: "#8a6010", weight: "700" }));
    }

    if(showSelectedRoute){
      const routeLabel = String(
        selectedCandidate.routeLabel
        || quoteSnapshot?.selectedRouteLabel
        || ""
      ).trim();
      const routeDescription = String(
        selectedCandidate.routeDescription
        || quoteSnapshot?.selectedRouteDescription
        || ""
      ).trim();
      const totalDistanceLabel = formatRouteDistanceMeters(
        Number(selectedCandidate.totalDistanceMeters || quoteSnapshot?.totalDistanceMeters || routePlan?.totalDistanceMeters) || 0
      );
      const totalDurationLabel = formatRouteDurationSeconds(
        Number(selectedCandidate.totalDurationSeconds || quoteSnapshot?.totalDurationSeconds || routePlan?.totalDurationSeconds) || 0
      );

      parts.push(buildOverallRoutePdfParagraph("選択ルート：" + routeLabel, layout, { color: "#333", weight: "700" }));
      if(routeDescription){
        parts.push(buildOverallRoutePdfParagraph(routeDescription, layout));
      }
      const meta = [];
      if(totalDistanceLabel){
        meta.push("合計距離：" + totalDistanceLabel);
      }
      if(totalDurationLabel){
        meta.push("合計所要時間：" + totalDurationLabel);
      }
      if(meta.length){
        parts.push(buildOverallRoutePdfParagraph(meta.join("　"), layout));
      }
      if(candidateUsesToll(selectedCandidate)){
        parts.push(buildOverallRoutePdfParagraph(
          "有料道路料金は見積料金に含まれず、別途必要です。",
          layout,
          { color: "#8a6010", weight: "700" }
        ));
      }
    }

    return "<div class=\"estimate-pdf-overall-route\" style=\"margin:0 0 " + gap + "px;\">" + parts.join("") + "</div>";
  }

  function buildSelectedRouteLegPdfHtml(legPrefix, legPlan, quoteLeg, layout){
    if(!legPlan){
      return "";
    }
    const routes = Array.isArray(legPlan.routes) ? legPlan.routes
      : (Array.isArray(legPlan.routeCandidates) ? legPlan.routeCandidates : []);
    const selectedId = String(legPlan.selectedRouteId || quoteLeg?.selectedRouteId || "");
    const selected = routes.find(function(route){
      return String(route?.routeId || "") === selectedId;
    }) || routes[0] || null;
    const label = String(quoteLeg?.selectedRouteLabel || selected?.routeLabel || "").trim();
    if(!label){
      return "";
    }
    const description = String(quoteLeg?.selectedRouteDescription || selected?.routeDescription || "").trim();
    const distanceLabel = formatRouteDistanceMeters(
      Number(selected?.distanceMeters || quoteLeg?.distanceMeters || legPlan.distanceMeters) || 0
    );
    const durationLabel = formatRouteDurationSeconds(
      Number(selected?.durationSeconds || quoteLeg?.durationSeconds || legPlan.durationSeconds) || 0
    );
    const prefix = String(legPrefix || "").trim();
    const title = prefix ? ("選択ルート（" + prefix + "）：" + label) : ("選択ルート：" + label);
    const gap = Math.max(4, Number(layout?.routeMapTitleGap) || 6);
    const fontSize = Math.max(9, Number(layout?.metaFont) - 1 || 10);
    const parts = [
      "<p style=\"margin:0 0 " + gap + "px;font-size:" + fontSize + "px;line-height:1.55;color:#333;font-weight:700;\">" +
        escapeHtml(title) +
      "</p>"
    ];
    if(description){
      parts.push(
        "<p style=\"margin:0 0 " + gap + "px;font-size:" + fontSize + "px;line-height:1.55;color:#555;\">" +
          escapeHtml(description) +
        "</p>"
      );
    }
    const meta = [];
    if(distanceLabel){
      meta.push("距離：" + distanceLabel);
    }
    if(durationLabel){
      meta.push("所要時間：" + durationLabel);
    }
    if(meta.length){
      parts.push(
        "<p style=\"margin:0 0 " + gap + "px;font-size:" + fontSize + "px;line-height:1.55;color:#555;\">" +
          escapeHtml(meta.join("　")) +
        "</p>"
      );
    }
    return parts.join("");
  }

  function buildSelectedRoutesPdfHtml(routePlan, quoteSnapshot, layout, options){
    if(!routePlan){
      return "";
    }
    const statusOptions = buildRouteStatusOptions(routePlan, options, quoteSnapshot);
    const overallHtml = buildOverallRoutePdfHtml(routePlan, quoteSnapshot, layout, statusOptions);
    if(overallHtml){
      return overallHtml;
    }
    if(routePlan.outboundRoutePlan){
      const outboundHtml = buildSelectedRouteLegPdfHtml(
        "往路",
        routePlan.outboundRoutePlan,
        quoteSnapshot?.outboundRoutePlan,
        layout
      );
      const returnHtml = routePlan.returnRoutePlan
        ? buildSelectedRouteLegPdfHtml(
          "復路",
          routePlan.returnRoutePlan,
          quoteSnapshot?.returnRoutePlan,
          layout
        )
        : "";
      return outboundHtml + returnHtml;
    }
    return buildSelectedRouteLegPdfHtml("", routePlan, quoteSnapshot, layout);
  }

  function buildRouteMapHtml(routeMapDataUrl, layout, routePlan, options){
    const quoteSnapshot = options?.quoteSnapshot || null;
    const statusOptions = buildRouteStatusOptions(routePlan, options, quoteSnapshot);
    const overallHtml = buildOverallRoutePdfHtml(routePlan, quoteSnapshot, layout, statusOptions);
    const overallStatusHtml = global.PreFixedFareStatus
      && routePlan
      && typeof global.PreFixedFareStatus.isOverallRouteSelectionConfirmable === "function"
      && global.PreFixedFareStatus.isOverallRouteSelectionConfirmable(routePlan)
      ? global.PreFixedFareStatus.buildStatusPdfHtml(routePlan, layout, statusOptions)
      : "";
    const preFixedStatusHtml = overallHtml
      ? overallStatusHtml
      : (global.PreFixedFareStatus && routePlan
        ? global.PreFixedFareStatus.buildStatusPdfHtml(routePlan, layout, statusOptions)
        : "");
    const selectedRoutesHtml = buildSelectedRoutesPdfHtml(routePlan, quoteSnapshot, layout, statusOptions);
    const hasMap = Boolean(String(routeMapDataUrl || "").trim());
    if(!hasMap && !preFixedStatusHtml && !selectedRoutesHtml){
      return "";
    }
    const primaryRoute = getRoutePlanPrimaryRoute(routePlan);
    const infoParts = [];
    const roadLabel = getRoadTypeLabel(routePlan?.roadType);
    const outboundMeters = routePlan?.outboundRoutePlan
      ? Number(getRoutePlanPrimaryRoute({ routes: routePlan.outboundRoutePlan.routes, selectedRouteId: routePlan.outboundRoutePlan.selectedRouteId, distanceMeters: routePlan.outboundRoutePlan.distanceMeters })?.distanceMeters || routePlan.outboundRoutePlan.distanceMeters) || 0
      : 0;
    const returnMeters = routePlan?.returnRoutePlan
      ? Number(getRoutePlanPrimaryRoute({ routes: routePlan.returnRoutePlan.routes, selectedRouteId: routePlan.returnRoutePlan.selectedRouteId, distanceMeters: routePlan.returnRoutePlan.distanceMeters })?.distanceMeters || routePlan.returnRoutePlan.distanceMeters) || 0
      : 0;
    let distanceLabel = routePlan?.tripType === "round_trip"
      ? (
        (outboundMeters > 0 ? "往路：" + formatRouteDistanceMeters(outboundMeters) : "")
        + (returnMeters > 0 ? "　復路：" + formatRouteDistanceMeters(returnMeters) : "")
        + (Number(routePlan.totalDistanceMeters) > 0 ? "　合計：" + formatRouteDistanceMeters(routePlan.totalDistanceMeters) : "")
      )
      : formatRouteDistanceMeters(primaryRoute?.distanceMeters || routePlan?.distanceMeters);
    let durationLabel = formatRouteDurationSeconds(routePlan?.totalDurationSeconds || primaryRoute?.durationSeconds || routePlan?.durationSeconds);
    if(overallHtml){
      const overall = resolveOverallRouteSelection(quoteSnapshot, routePlan);
      const selectedOverall = getSelectedOverallRouteCandidate(overall);
      const totalMeters = Number(
        selectedOverall?.totalDistanceMeters
        || quoteSnapshot?.totalDistanceMeters
        || routePlan?.totalDistanceMeters
      ) || 0;
      const totalSeconds = Number(
        selectedOverall?.totalDurationSeconds
        || quoteSnapshot?.totalDurationSeconds
        || routePlan?.totalDurationSeconds
      ) || 0;
      if(totalMeters > 0){
        distanceLabel = "合計：" + formatRouteDistanceMeters(totalMeters);
      }
      if(totalSeconds > 0){
        durationLabel = formatRouteDurationSeconds(totalSeconds);
      }
    }
    if(roadLabel){
      infoParts.push("道路設定：" + roadLabel);
    }
    if(distanceLabel){
      infoParts.push("予定距離：" + distanceLabel);
    }
    if(durationLabel){
      infoParts.push("予定時間：" + durationLabel);
    }
    const infoHtml = infoParts.length
      ? (
        "<div style=\"margin-top:" + layout.routeMapInfoGap + "px;font-size:" + Math.max(9, layout.metaFont - 1) + "px;" +
        "line-height:1.5;color:#555;\">" + escapeHtml(infoParts.join("　")) + "</div>"
      )
      : "";
    const display = global.EstimateRouteMapDisplay;
    const segments = display && routePlan
      ? (typeof display.buildDisplayRouteMapSegments === "function"
        ? display.buildDisplayRouteMapSegments(routePlan)
        : display.buildRouteMapSegments(routePlan))
      : [];
    const legendHtml = hasMap && display && display.shouldShowLegend(segments)
      ? display.buildLegendPdfHtml(segments)
      : "";
    const mapImageHtml = hasMap
      ? (
        "<div style=\"position:relative;display:inline-block;width:100%;\">" +
          "<img src=\"" + routeMapDataUrl + "\" alt=\"走行予定ルート地図\" " +
          "style=\"display:block;width:100%;height:auto;max-height:" + layout.routeMapHeight + "px;object-fit:contain;" +
          "object-position:left bottom;border-radius:8px;background:#f5f5f5;\">" +
          legendHtml +
        "</div>"
      )
      : "";
    return (
      "<div class=\"estimate-pdf-route-map\" style=\"margin:0 0 " + layout.routeMapBottomGap + "px;\">" +
        "<div style=\"margin:0 0 " + layout.routeMapTitleGap + "px;font-size:" + Math.max(11, layout.sectionFont - 1) + "px;" +
        "font-weight:700;color:#9a6b16;line-height:1.22;\">走行予定ルート</div>" +
        preFixedStatusHtml +
        selectedRoutesHtml +
        mapImageHtml +
        infoHtml +
      "</div>"
    );
  }

  function emptyQrDataUrls(){
    return { homepage: "", line: "" };
  }

  function formatCoord(value){
    return Number(value).toFixed(6);
  }

  function buildStaticMapUrl(options){
    const apiKey = String(options?.apiKey || "").trim();
    let segments = Array.isArray(options?.segments) ? options.segments : [];
    let markers = Array.isArray(options?.markers) ? options.markers : [];
    let pathPoints = Array.isArray(options?.pathPoints) ? options.pathPoints : [];
    const widthPx = Math.min(640, Math.max(320, Math.round(Number(options?.widthPx) || CONTENT_WIDTH_PX)));
    const heightPx = Math.round(Number(options?.heightPx) || 240);

    const encodedPolyline = String(options?.encodedPolyline || "").trim();
    const startPoint = options?.startPoint;
    const endPoint = options?.endPoint;
    if(!segments.length && encodedPolyline && startPoint && endPoint){
      const legacyPath = pathPoints.length ? pathPoints : decodePolyline(encodedPolyline);
      segments = [{
        key: "outbound",
        color: "#1565C0",
        path: legacyPath,
        label: "往路"
      }];
      if(!markers.length){
        markers = [
          { position: startPoint, title: "出発地", label: "発", color: "0x2E7D32" },
          { position: endPoint, title: "目的地", label: "着", color: "0xC62828" }
        ];
      }
      if(!pathPoints.length){
        pathPoints = legacyPath;
      }
    }

    if(!apiKey || !segments.length){
      return "";
    }

    const bounds = getPolylineBounds(pathPoints.length ? pathPoints : getAllSegmentPoints(segments));
    const params = [
      "size=" + widthPx + "x" + heightPx,
      "scale=2",
      "maptype=roadmap",
      "language=" + encodeURIComponent(options?.language || "ja"),
      "region=" + encodeURIComponent(options?.region || "JP")
    ];

    if(bounds){
      const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0005);
      const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0005);
      const latPad = Math.max(latSpan * 0.17, 0.0008);
      const lngPad = Math.max(lngSpan * 0.17, 0.0008);
      const visibleSouthWest = formatCoord(bounds.minLat - latPad) + "," + formatCoord(bounds.minLng - lngPad);
      const visibleNorthEast = formatCoord(bounds.maxLat + latPad) + "," + formatCoord(bounds.maxLng + lngPad);
      params.push("visible=" + encodeURIComponent(visibleSouthWest + "|" + visibleNorthEast));
    }

    const display = global.EstimateRouteMapDisplay;
    segments.forEach(function(segment){
      const pathParam = display && typeof display.pathToStaticMapParam === "function"
        ? display.pathToStaticMapParam(segment)
        : "";
      if(pathParam){
        params.push("path=" + encodeURIComponent(pathParam));
      }
    });

    markers.forEach(function(markerInfo){
      const position = markerInfo?.position;
      if(!position){
        return;
      }
      const color = String(markerInfo.color || "0x2E7D32");
      const label = String(markerInfo.label || "").slice(0, 1);
      const markerParam = "size:small|color:" + color + (label ? "|label:" + label : "")
        + "|" + formatCoord(position.lat) + "," + formatCoord(position.lng);
      params.push("markers=" + encodeURIComponent(markerParam));
    });

    params.push("key=" + encodeURIComponent(apiKey));
    return STATIC_MAP_BASE_URL + "?" + params.join("&");
  }

  function getAllSegmentPoints(segments){
    const display = global.EstimateRouteMapDisplay;
    if(display && typeof display.getAllPathPoints === "function"){
      return display.getAllPathPoints(segments);
    }
    const points = [];
    segments.forEach(function(segment){
      (segment.path || []).forEach(function(point){
        points.push(point);
      });
    });
    return points;
  }

  function loadImageAsDataUrl(url){
    return new Promise(function(resolve, reject){
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function(){
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if(!ctx){
          reject(new Error("地図画像の変換に失敗しました。"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        try{
          resolve(canvas.toDataURL("image/png"));
        }catch(error){
          reject(error);
        }
      };
      img.onerror = function(){
        reject(new Error("地図画像の読み込みに失敗しました。"));
      };
      img.src = url;
    });
  }

  function canLoadImageUrl(url){
    return new Promise(function(resolve){
      const img = new Image();
      img.onload = function(){
        resolve(img.naturalWidth >= 200 && img.naturalHeight >= 80);
      };
      img.onerror = function(){ resolve(false); };
      img.src = url;
    });
  }

  async function resolveRouteMapDataUrl(routePlan, googleMaps, layout){
    const mapsConfig = googleMaps || {};
    if(mapsConfig.enabled === false){
      return "";
    }
    const apiKey = String(mapsConfig.apiKey || "").trim();
    const display = global.EstimateRouteMapDisplay;
    if(!routePlan || !apiKey || !display || typeof display.buildRouteMapSegments !== "function"){
      return "";
    }
    if(!display.hasRenderableRouteMap(routePlan)){
      return "";
    }

    const waypointLatLng = await display.resolveWaypointLatLng(routePlan, async function(address){
      if(!global.EstimateDistanceApi || typeof global.EstimateDistanceApi.geocodeAddress !== "function"){
        return null;
      }
      const result = await global.EstimateDistanceApi.geocodeAddress({
        apiKey: apiKey,
        address: address,
        languageCode: mapsConfig.language || "ja",
        region: mapsConfig.region || "JP"
      });
      return result?.location || null;
    });
    const buildSegments = typeof display.buildDisplayRouteMapSegments === "function"
      ? display.buildDisplayRouteMapSegments.bind(display)
      : display.buildRouteMapSegments.bind(display);
    const segments = buildSegments(routePlan, waypointLatLng);
    const markers = display.buildRouteMapMarkers(routePlan, segments, waypointLatLng);
    const pathPoints = display.getAllPathPoints(segments);
    if(pathPoints.length < 2){
      return "";
    }

    const mapHeight = layout ? layout.routeMapHeight : 240;
    const staticMapUrl = buildStaticMapUrl({
      apiKey: apiKey,
      segments: segments,
      markers: markers,
      pathPoints: pathPoints,
      widthPx: CONTENT_WIDTH_PX,
      heightPx: mapHeight,
      language: mapsConfig.language || "ja",
      region: mapsConfig.region || "JP"
    });
    if(!staticMapUrl){
      return "";
    }

    try{
      const dataUrl = await loadImageAsDataUrl(staticMapUrl);
      if(dataUrl){
        return dataUrl;
      }
    }catch(error){
      console.warn("[EstimatePdf] route map data URL conversion failed", error);
    }

    const canLoad = await canLoadImageUrl(staticMapUrl);
    return canLoad ? staticMapUrl : "";
  }

  function buildHiddenCaptureContainerStyle(){
    return [
      "position:fixed",
      "left:-9999px",
      "top:0",
      "width:" + CONTENT_WIDTH_PX + "px",
      "pointer-events:none",
      "overflow:visible"
    ].join(";");
  }

  function readElementContentHeight(element){
    if(!element){
      return 0;
    }
    return Math.max(
      element.scrollHeight || 0,
      element.offsetHeight || 0,
      element.clientHeight || 0,
      element.getBoundingClientRect().height || 0
    );
  }

  function buildFareCalculationMethodHtml(data, layout){
    if(!global.EstimateFareDisplay || typeof global.EstimateFareDisplay.buildFareCalculationLines !== "function"){
      return "";
    }
    const lines = global.EstimateFareDisplay.buildFareCalculationLines({
      quoteSnapshot: data.quoteSnapshot,
      breakdown: data.breakdown,
      total: data.total,
      routePlan: data.routePlan,
      routeLabel: "ルート算出システム",
      totalLabel: "合計料金"
    });
    if(!lines.length){
      return "";
    }
    const rowsHtml = lines.map(function(line){
      return (
        "<tr>" +
        "<td style=\"padding:" + Math.max(2, layout.breakdownCellPadV - 1) + "px " + layout.breakdownLabelPadRight + "px " +
        Math.max(2, layout.breakdownCellPadV - 1) + "px 0;border-bottom:1px solid #e8e8e8;color:#555;\">" +
        escapeHtml(line.label) +
        "</td>" +
        "<td style=\"padding:" + Math.max(2, layout.breakdownCellPadV - 1) + "px 0;border-bottom:1px solid #e8e8e8;" +
        (line.isTotal ? "font-weight:700;color:#c62828;" : "font-weight:600;") + "\">" +
        escapeHtml(line.value) +
        "</td>" +
        "</tr>"
      );
    }).join("");
    const sectionFont = Math.max(10, layout.sectionFont - 0.5);
    const bodyFont = Math.max(9, layout.baseFont - 0.5);
    return (
      "<div class=\"estimate-pdf-calc-method\" style=\"margin:" + Math.max(4, layout.sectionGap) + "px 0 " + layout.sectionGap + "px;\">" +
      "<h2 style=\"margin:0 0 " + layout.headingGap + "px;font-size:" + sectionFont + "px;color:#9a6b16;line-height:1.22;\">料金の計算方法</h2>" +
      "<table style=\"width:100%;border-collapse:collapse;font-size:" + bodyFont + "px;line-height:" + Math.max(1.28, layout.lineHeight - 0.08) + ";\">" +
      rowsHtml +
      "</table>" +
      "</div>"
    );
  }

  function buildQuoteSnapshotMetaHtml(quoteSnapshot){
    if(!quoteSnapshot){
      return "";
    }
    let json = "";
    try{
      json = JSON.stringify(quoteSnapshot);
    }catch(error){
      return "";
    }
    return (
      "<script type=\"application/json\" class=\"estimate-quote-snapshot-meta\" style=\"display:none!important\">" +
      escapeHtml(json) +
      "</script>"
    );
  }

  function buildPdfElement(data, layout, qrDataUrls){
    layout = layout || getDefaultLayout();
    qrDataUrls = qrDataUrls || emptyQrDataUrls();
    const el = document.createElement("div");
    el.className = "estimate-pdf-source";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
      "box-sizing:border-box",
      "width:" + CONTENT_WIDTH_PX + "px",
      "padding:0",
      "font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif",
      "color:#222",
      "background:#fff"
    ].join(";");

    const usageRows = (data.usageSummary || []).map(function(line){
      return (
        "<tr>" +
        "<td style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;border-bottom:1px solid #eee;color:#666;width:38%;\">" +
        escapeHtml(line.label) +
        "</td>" +
        "<td style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;border-bottom:1px solid #eee;font-weight:600;\">" +
        escapeHtml(line.value) +
        "</td>" +
        "</tr>"
      );
    }).join("");

    const fareSections = Array.isArray(data.fareSections) ? data.fareSections : [];
    const breakdownRows = (data.breakdownRows || []).map(function(row){
      return (
        "<tr>" +
        "<td style=\"padding:" + layout.breakdownCellPadV + "px " + layout.breakdownLabelPadRight + "px " + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;\">" +
        escapeHtml(row.label) +
        "</td>" +
        "<td class=\"estimate-pdf-amount\" style=\"padding:" + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;text-align:left;white-space:nowrap;font-weight:600;\">" +
        escapeHtml(formatYen(row.amount)) +
        "</td>" +
        "</tr>"
      );
    }).join("");
    const fareSectionRows = fareSections.map(function(section){
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      const titleRow =
        "<tr>" +
          "<td colspan=\"2\" style=\"padding:" + (layout.breakdownCellPadV + 1) + "px 0 6px;font-weight:700;color:#9a6b16;\">" +
            escapeHtml(section?.title || "") +
          "</td>" +
        "</tr>";
      const contentRows = rows.length
        ? rows.map(function(row){
          if(row.note){
            return (
              "<tr>" +
                "<td style=\"padding:" + layout.breakdownCellPadV + "px " + layout.breakdownLabelPadRight + "px " + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;\">" +
                  escapeHtml(row.label) +
                "</td>" +
                "<td style=\"padding:" + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;text-align:left;line-height:1.45;\">" +
                  escapeHtml(row.note) +
                "</td>" +
              "</tr>"
            );
          }
          return (
            "<tr>" +
              "<td style=\"padding:" + layout.breakdownCellPadV + "px " + layout.breakdownLabelPadRight + "px " + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;\">" +
                escapeHtml(row.label) +
              "</td>" +
              "<td class=\"estimate-pdf-amount\" style=\"padding:" + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;text-align:left;white-space:nowrap;font-weight:600;\">" +
                escapeHtml(formatYen(row.amount)) +
              "</td>" +
            "</tr>"
          );
        }).join("")
        : (
          "<tr>" +
            "<td style=\"padding:" + layout.breakdownCellPadV + "px " + layout.breakdownLabelPadRight + "px " + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;color:#666;\">該当なし</td>" +
            "<td style=\"padding:" + layout.breakdownCellPadV + "px 0;border-bottom:1px solid #e3e3e3;color:#666;\">-</td>" +
          "</tr>"
        );
      return titleRow + contentRows;
    }).join("");

    const resultNotes = String(data.resultNotes || "").trim();
    const resultNotesHtml = resultNotes
      ? (
        "<div style=\"margin:" + layout.resultNotesGap + "px 0 " + layout.footerGap + "px;font-size:" + layout.resultNotesFont + "px;" +
        "line-height:" + layout.resultNotesLineHeight + ";color:#555;white-space:pre-line;\">" +
        escapeHtml(resultNotes) +
        "</div>"
      )
      : "";

    const footerHtml = buildPdfFooterHtml(data.pdfFooter, layout, qrDataUrls);
    const routeMapHtml = buildRouteMapHtml(data.routeMapDataUrl, layout, data.routePlan, {
      quoteSnapshot: data.quoteSnapshot || null,
      returnPlanType: data.returnPlanType || data.quoteSnapshot?.returnPlanType || data.routePlan?.returnPlanType || null,
      outboundRoutePlan: data.quoteSnapshot?.outboundRoutePlan || data.routePlan?.outboundRoutePlan || null,
      returnRoutePlan: data.quoteSnapshot?.returnRoutePlan || data.routePlan?.returnRoutePlan || null
    });

    const fareCalculationHtml = buildFareCalculationMethodHtml(data, layout);

    const bodyFont = layout.baseFont + "px";
    const breakdownFont = layout.breakdownFont + "px";
    const tableStyle =
      "width:100%;border-collapse:collapse;margin-bottom:" + layout.sectionGap + "px;font-size:" + bodyFont + ";line-height:" + layout.lineHeight + ";";
    const breakdownTableStyle =
      "width:" + layout.breakdownTableWidth + "%;border-collapse:collapse;margin-bottom:" + layout.totalTopGap + "px;font-size:" + breakdownFont +
      ";line-height:" + layout.breakdownLineHeight + ";table-layout:fixed;";

    const totalHtml =
      footerRule(layout) +
      "<div class=\"estimate-pdf-total\" style=\"text-align:center;padding:" + layout.totalBlockPadV + "px 0 " + (layout.totalBlockPadV + 1) + "px;\">" +
        "<div style=\"font-size:" + layout.totalLabelFont + "px;color:#666;line-height:1.2;margin-bottom:2px;letter-spacing:.04em;\">合計目安</div>" +
        "<div style=\"font-size:" + layout.totalFont + "px;font-weight:800;color:#c62828;line-height:1.1;letter-spacing:.01em;\">" + escapeHtml(formatYen(data.total)) + "～</div>" +
      "</div>" +
      footerRule(layout);

    const pageShellStyle =
      "box-sizing:border-box;width:100%;padding-top:" + layout.pagePadTop + "px;padding-bottom:" + layout.pagePadBottom + "px;";

    const mainContentHtml =
        "<h1 style=\"margin:0 0 " + layout.titleGap + "px;font-size:" + layout.titleFont + "px;line-height:1.18;letter-spacing:.02em;\">概算見積書</h1>" +
        "<p style=\"margin:0 0 " + layout.sectionGap + "px;font-size:" + layout.metaFont + "px;color:#666;line-height:" + layout.lineHeight + ";\">" +
          escapeHtml(data.pageTitle || "かんたん料金確認") +
        "</p>" +
        "<table style=\"width:100%;border-collapse:collapse;margin-bottom:" + layout.sectionGap + "px;font-size:" + layout.metaFont + "px;line-height:" + layout.lineHeight + ";\">" +
          "<tr><td style=\"padding:" + layout.cellPadV + "px 0;color:#666;width:26%;\">見積番号</td><td style=\"padding:" + layout.cellPadV + "px 0;font-weight:700;\">" + escapeHtml(data.estimateNumber || "") + "</td></tr>" +
          "<tr><td style=\"padding:" + layout.cellPadV + "px 0;color:#666;\">見積日時</td><td style=\"padding:" + layout.cellPadV + "px 0;\">" + escapeHtml(formatDateTime(data.createdAt)) + "</td></tr>" +
        "</table>" +
        routeMapHtml +
        "<h2 style=\"margin:0 0 " + layout.headingGap + "px;font-size:" + layout.sectionFont + "px;color:#9a6b16;line-height:1.22;\">ご利用内容</h2>" +
        "<table style=\"" + tableStyle + "\">" + (usageRows || "<tr><td colspan=\"2\" style=\"padding:" + layout.cellPadV + "px " + layout.cellPadH + "px;\">—</td></tr>") + "</table>" +
        "<div class=\"estimate-pdf-breakdown-section\">" +
          "<h2 style=\"margin:0 0 " + layout.headingGap + "px;font-size:" + layout.sectionFont + "px;color:#9a6b16;line-height:1.22;\">料金内訳</h2>" +
          "<table class=\"estimate-pdf-breakdown\" style=\"" + breakdownTableStyle + "\">" +
            "<colgroup><col style=\"width:54%;\"><col style=\"width:46%;\"></colgroup>" +
            (fareSectionRows || breakdownRows || "<tr><td colspan=\"2\" style=\"padding:" + layout.breakdownCellPadV + "px " + layout.cellPadH + "px;\">—</td></tr>") +
          "</table>" +
        "</div>" +
        "<div class=\"estimate-pdf-total-section\">" + totalHtml + "</div>" +
        fareCalculationHtml +
        resultNotesHtml;

    const footerBlockHtml = footerHtml
      ? "<div class=\"estimate-pdf-footer-section\" style=\"margin-top:" + layout.footerTopGap + "px;\">" + footerHtml + "</div>"
      : "";

    el.innerHTML =
      "<div style=\"" + pageShellStyle + "\">" +
        mainContentHtml +
        footerBlockHtml +
      "</div>" +
      buildQuoteSnapshotMetaHtml(data.quoteSnapshot);
    return el;
  }

  function measureContentHeight(data, qrDataUrls){
    const container = document.createElement("div");
    container.style.cssText = buildHiddenCaptureContainerStyle();
    document.body.appendChild(container);

    let layout = tuneLayoutForContent(data, getDefaultLayout());
    let contentHeight = 0;
    try{
      for(let i = 0; i < 28; i++){
        const probe = buildPdfElement(data, layout, qrDataUrls);
        container.appendChild(probe);
        contentHeight = readElementContentHeight(probe);
        container.removeChild(probe);
        if(contentHeight > 0 && contentHeight <= CONTENT_HEIGHT_PX){
          break;
        }
        layout = scaleLayout(layout, 0.94);
      }

      if(contentHeight <= 0 || contentHeight > CONTENT_HEIGHT_PX){
        const fallback = buildPdfElement(data, layout, qrDataUrls);
        container.appendChild(fallback);
        const measuredHeight = readElementContentHeight(fallback);
        contentHeight = measuredHeight > 0
          ? Math.min(measuredHeight, CONTENT_HEIGHT_PX)
          : CONTENT_HEIGHT_PX;
        container.removeChild(fallback);
      }

      return { layout: layout, contentHeight: contentHeight };
    }finally{
      container.remove();
    }
  }

  function waitForNextFrame(){
    return new Promise(function(resolve){
      requestAnimationFrame(function(){
        requestAnimationFrame(resolve);
      });
    });
  }

  async function resolveQrDataUrls(pdfFooter, renderSize){
    const empty = emptyQrDataUrls();
    if(!pdfFooter || pdfFooter.enabled === false){
      return empty;
    }
    if(!global.EstimateQr || typeof global.EstimateQr.toDataUrl !== "function"){
      return empty;
    }

    const homepageUrl = String(pdfFooter.homepageUrl || "").trim();
    const lineUrl = String(pdfFooter.lineUrl || "").trim();
    const generateSize = Number(renderSize) > 0 ? Number(renderSize) * 2 : 112;

    const [homepage, line] = await Promise.all([
      homepageUrl ? global.EstimateQr.toDataUrl(homepageUrl, generateSize) : "",
      lineUrl ? global.EstimateQr.toDataUrl(lineUrl, generateSize) : ""
    ]);

    return {
      homepage: homepage || "",
      line: line || ""
    };
  }

  async function preparePdfRenderData(data){
    let layout = tuneLayoutForContent(data, getDefaultLayout());
    const qrDataUrls = await resolveQrDataUrls(data.pdfFooter, layout.footerQrSize);
    let routeMapDataUrl = String(data.routeMapDataUrl || "").trim();
    if(!routeMapDataUrl){
      routeMapDataUrl = await resolveRouteMapDataUrl(data.routePlan, data.googleMaps, layout);
    }
    let enriched = Object.assign({}, data, { routeMapDataUrl: routeMapDataUrl });
    let measured = measureContentHeight(enriched, qrDataUrls);

    if(routeMapDataUrl && measured.contentHeight > CONTENT_HEIGHT_PX && !String(data.routeMapDataUrl || "").trim()){
      layout = measured.layout;
      routeMapDataUrl = await resolveRouteMapDataUrl(data.routePlan, data.googleMaps, layout);
      enriched = Object.assign({}, data, { routeMapDataUrl: routeMapDataUrl });
      measured = measureContentHeight(enriched, qrDataUrls);
    }

    return {
      data: enriched,
      layout: measured.layout,
      contentHeight: measured.contentHeight,
      qrDataUrls: qrDataUrls
    };
  }

  async function buildPreviewElement(data){
    const prepared = await preparePdfRenderData(data);
    return buildPdfElement(prepared.data, prepared.layout, prepared.qrDataUrls);
  }

  async function savePdf(data){
    if(typeof html2pdf === "undefined"){
      throw new Error("PDF ライブラリが読み込まれていません。");
    }

    const prepared = await preparePdfRenderData(data);
    const element = buildPdfElement(prepared.data, prepared.layout, prepared.qrDataUrls);
    const container = document.createElement("div");
    container.style.cssText = buildHiddenCaptureContainerStyle();
    container.appendChild(element);
    document.body.appendChild(container);

    await waitForNextFrame();

    const filename = (data.estimateNumber || "estimate") + ".pdf";
    try{
      const worker = html2pdf().set({
        margin: A4.marginMm,
        filename: filename,
        pagebreak: { mode: ["css"] },
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: "#ffffff"
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      }).from(element);
      await worker.save();
    }finally{
      container.remove();
    }
  }

  global.EstimatePdf = {
    savePdf: savePdf,
    buildPreviewElement: buildPreviewElement,
    formatDateTime: formatDateTime,
    CONTENT_HEIGHT_PX: CONTENT_HEIGHT_PX,
    CONTENT_WIDTH_PX: CONTENT_WIDTH_PX,
    buildStaticMapUrl: buildStaticMapUrl,
    resolveRouteMapDataUrl: resolveRouteMapDataUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
