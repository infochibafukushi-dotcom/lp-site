# 帰り立ち寄りあり 全体走行予定ルート候補 設計

| 項目 | 内容 |
|------|------|
| ステータス | **設計案（未実装）** |
| 作成日 | 2026-06-26 |
| 関連コミット | d3ee016（ルート候補表示名整理）を前提とする |
| 対象モード | 事前確定運賃（`fareMode: pre_fixed_fare`）のみ |
| 対象プラン | `returnPlanType: return_with_stop`（帰り立ち寄りあり） |

---

## 1. 目的

帰り立ち寄りあり（`return_with_stop`）の場合でも、実質的に異なる走行予定ルートが **2件以上** あるとき、利用者が **全体走行予定ルート** を選択できるようにする。

運行全体は次の構造とする。

```text
S → G → 立ち寄り → S
```

現状は復路を `G → 立ち寄り → S` の intermediates 付き1本ルートとして取得しており、代替候補が構造的に1件になる。そのため、`立ち寄り → S` に実質的な差分があっても事前確定運賃候補にならない。

本設計は、**選択区間の差分を全体ルート候補として合成・提示** し、画面・PDF・`quoteSnapshot` に **全体走行予定ルート候補** として記録する。

---

## 2. 基本方針

### 2.1 区間の定義

| 区分 | 区間 | 説明 |
|------|------|------|
| 共通区間 | `S → G` | 往路。フェーズ1では先に選択・固定する場合あり |
| 共通区間 | `G → 立ち寄り` | 復路の前半。全全体候補で同一 |
| 選択区間 | `立ち寄り → S` | 復路の後半。ここに複数候補があり得る |

### 2.2 全体候補

全体候補は常に次の形で表現する。

```text
全体走行予定ルート候補：
S → G → 立ち寄り → S
```

例：

```text
全体候補A：おすすめルート
  S → G → 立ち寄り → S
  （立ち寄り → S はおすすめルート）

全体候補B：距離優先ルート / 高速道路ルート
  S → G → 立ち寄り → S
  （立ち寄り → S は距離優先ルートまたは高速道路ルート）
```

### 2.3 利用者向けの意味づけ（重要）

- 利用者が選択するのは **部分区間ではなく、全体走行予定ルート** である。
- 画面上に「立ち寄り → S だけを選ぶ」UIを出さない。
- 説明文で区間構造（共通／差分）を補足してよいが、**選択カードの主体は常に全体候補** とする。
- 「復路の走行予定ルートの選択」というレッグ単位の見せ方は、`return_with_stop` では使わない。

---

## 3. 事前確定運賃上の考え方

| 原則 | 内容 |
|------|------|
| 選択対象 | 部分区間ではなく **全体走行予定ルート** |
| 差分の扱い | 共通区間が同じでも、選択区間（`立ち寄り → S`）が異なれば **全体ルートは異なる** |
| 証跡 | 画面・PDF・`quoteSnapshot` には **全体ルート候補** として残す |
| 偽ルート禁止 | APIで取得した区間の合成のみ。距離・時間・polyline を捏造しない |
| 重複除外 | 実質同一の全体ルートは既存 `dedupeRoutes()` 相当の判定で除外する |
| 料金計算式 | **変更しない**（patternA・係数・介助料等は現行のまま） |
| 料金入力距離 | 選択した全体候補の `totalDistanceMeters` を `routePlan.totalDistanceMeters` に反映する（入力の更新であり計算式変更ではない） |

### 3.1 preFixedFareConfirmable の考え方（案）

`return_with_stop` かつ全体候補モード有効時：

| 条件 | `preFixedFareConfirmable` |
|------|---------------------------|
| `overallRouteCandidates.length >= 2` | `true`（往路・復路の個別判定に加え、全体候補数を正とする） |
| `overallRouteCandidates.length === 1` | `false`（確認対応。`fallbackReason: "only_one_distinct_route"` 等） |
| 往路が未選択（往路2候補時） | 全体候補表示前。往路選択完了まで全体 `preFixedFareConfirmable` は `false` |

既存の `outboundRoutePlan.preFixedFareConfirmable` / `returnRoutePlan.preFixedFareConfirmable` は **後方互換のため維持** する。トップレベルおよび全体選択の正は `overallRouteSelection` と集約 `preFixedFareConfirmable` とする。

### 3.2 fareConfirm=review

- 全体候補が2件以上かつ選択完了 → `fareConfirm=review` **を付けない**
- 全体候補が1件のみ、または往路未選択で確認対応 → 現行どおり `fareConfirm=review` を付与し得る

---

## 4. 往路2候補時の方針（フェーズ1）

### 4.1 採用方針

往路候補が2件以上ある場合、**往路を先に選択・固定** する。

```text
1. 往路 S → G を選択（既存の往路候補UI）
2. 選択済み往路 + 共通 G → 立ち寄り + 立ち寄り → S 候補 を合成
3. 全体走行予定ルート候補を表示・選択
```

### 4.2 今回やらないこと

```text
往路候補 × 帰路（立ち寄り→S）候補 の全組み合わせ表示
```

全組み合わせは **将来課題** とする。理由：

- 候補数が乗算で増え、UX・認可説明が複雑化する
- フェーズ1の目的は「立ち寄り→S の差分を全体候補として提示すること」に限定する

### 4.3 往路1候補時

往路が1候補のみの場合は往路選択ステップを省略し、固定往路を用いて直接全体候補を表示する。

---

## 5. 現状との差分（背景）

| 項目 | 現状 | 本設計後 |
|------|------|----------|
| 復路API | `G→立ち寄り→S` を intermediates 1回、`computeAlternativeRoutes: false` | `G→立ち寄り` 固定取得 + `立ち寄り→S` を既存マルチ戦略で取得 |
| 候補数 | 復路は実質1件 | `立ち寄り→S` の実質差分に応じて全体候補2件以上 |
| UI | 「復路の走行予定ルートの選択」 | 「全体走行予定ルートの選択」 |
| quoteSnapshot | レッグ別 `routeCandidates` | `overallRouteSelection` を追加 |

参照実装（現状）：

- `estimate/estimate-distance-api.js` — `intermediateAddress` 時は候補1件固定
- `estimate/estimate-main.js` — `buildStructuredRoutePlan`, `renderRouteSelectionCards`
- `shared/estimate-route-map-display.js` — `return_with_stop` 時3セグメント表示（活用可能）

---

## 6. データモデル案

### 6.1 配置場所

`routePlan` および `quoteSnapshot` に **追加フィールド** として `overallRouteSelection` を置く。既存フィールドは削除・リネームしない。

### 6.2 スキーマ（案）

```json
{
  "overallRouteSelection": {
    "routePlanType": "return_with_stop",
    "selectionPhase": "overall",
    "fixedOutboundRouteId": "route_0",
    "commonSegments": [
      {
        "key": "outbound",
        "label": "S → G",
        "originAddress": "千葉市中央区出洲港8-3-2",
        "destinationAddress": "千葉メディカルセンター",
        "distanceMeters": 3300,
        "durationSeconds": 540,
        "routeId": "route_0",
        "routeStrategy": "recommended",
        "encodedPolyline": "..."
      },
      {
        "key": "return_common",
        "label": "G → 立ち寄り",
        "originAddress": "千葉メディカルセンター",
        "destinationAddress": "イオン千葉みなと",
        "distanceMeters": 2100,
        "durationSeconds": 420,
        "encodedPolyline": "..."
      }
    ],
    "selectableSegment": {
      "key": "return_selectable",
      "label": "立ち寄り → S",
      "originAddress": "イオン千葉みなと",
      "destinationAddress": "千葉市中央区出洲港8-3-2"
    },
    "overallRouteCandidates": [
      {
        "routeId": "overall_0",
        "routeLabel": "おすすめルート",
        "routeDescription": "時間と距離のバランスを考慮した標準的なルートです。",
        "routeType": "recommended",
        "strategy": "recommended",
        "usesToll": false,
        "totalDistanceMeters": 10200,
        "totalDurationSeconds": 1800,
        "segmentBreakdown": {
          "outbound": {
            "routeId": "route_0",
            "routeStrategy": "recommended",
            "distanceMeters": 3300,
            "durationSeconds": 540
          },
          "returnCommon": {
            "distanceMeters": 2100,
            "durationSeconds": 420
          },
          "returnSelectable": {
            "routeId": "route_0",
            "routeStrategy": "recommended",
            "routeLabel": "おすすめルート",
            "distanceMeters": 4800,
            "durationSeconds": 840,
            "usesToll": false
          }
        },
        "encodedPolyline": "...",
        "routeLegs": []
      },
      {
        "routeId": "overall_1",
        "routeLabel": "高速道路ルート",
        "routeDescription": "遠方移動に適したルートです。有料道路料金は別途必要です。",
        "routeType": "toll_allowed",
        "strategy": "toll_allowed",
        "usesToll": true,
        "totalDistanceMeters": 10800,
        "totalDurationSeconds": 1680,
        "segmentBreakdown": {
          "outbound": { "routeId": "route_0", "distanceMeters": 3300, "durationSeconds": 540 },
          "returnCommon": { "distanceMeters": 2100, "durationSeconds": 420 },
          "returnSelectable": {
            "routeId": "route_1",
            "routeStrategy": "toll_allowed",
            "routeLabel": "高速道路ルート",
            "distanceMeters": 5400,
            "durationSeconds": 720,
            "usesToll": true
          }
        }
      }
    ],
    "selectedOverallRouteId": "overall_0",
    "preFixedFareConfirmable": true,
    "fallbackReason": null
  }
}
```

### 6.3 フィールド説明

| フィールド | 型 | 意味 |
|------------|-----|------|
| `routePlanType` | `string` | 常に `return_with_stop` |
| `selectionPhase` | `string` | `outbound`（往路選択中） / `overall`（全体候補選択中） / `completed` |
| `fixedOutboundRouteId` | `string` | 合成に使った往路候補ID |
| `commonSegments[]` | `Segment[]` | 全候補で共通の区間 |
| `selectableSegment` | `SegmentMeta` | 差分が出る区間のメタ（候補は `overallRouteCandidates[].segmentBreakdown.returnSelectable`） |
| `overallRouteCandidates[]` | `OverallRouteCandidate[]` | **利用者が選ぶ全体候補一覧** |
| `selectedOverallRouteId` | `string` | 選択済み全体候補ID |
| `preFixedFareConfirmable` | `boolean` | 全体候補ベースの確定可否（2件以上で `true`） |
| `fallbackReason` | `string \| null` | 候補1件時など |

### 6.4 既存フィールドとの関係（後方互換）

| 既存 | 本設計での扱い |
|------|----------------|
| `outboundRoutePlan` | 維持。`fixedOutboundRouteId` の実体 |
| `returnRoutePlan` | 維持。選択後は `selectedOverallRouteId` に対応する合成復路を格納 |
| `returnRoutePlan.routeCandidates` | 監査用に合成後ミラー可。正は `overallRouteCandidates` |
| `selectedRouteLabel` / `selectedRouteDescription`（トップ） | 選択した **全体候補** の表示名・説明を入れる |
| `totalDistanceMeters` / `totalDurationSeconds` | 選択全体候補の合算値 |
| `returnFareStatus` | リネームしない。`fixed_candidate` 等は現行意味を維持 |

### 6.5 合成ルール（Phase 2 で実装）

1. `G → 立ち寄り` を1回取得（`computeAlternativeRoutes: false`、waypoint 固定）
2. `立ち寄り → S` を既存 `computePreFixedFareRouteCandidates`（intermediate なし）で取得
3. 選択済み往路 `S → G` と合成：

```text
totalDistanceMeters =
  outbound.distanceMeters
  + returnCommon.distanceMeters
  + returnSelectable.distanceMeters

totalDurationSeconds = 同上（各区間の合算）
```

4. `encodedPolyline` / `routeLegs` は区間連結（地図3色表示と整合）
5. 全体候補間で `dedupeRoutes()` 相当の重複判定を実施

---

## 7. 画面表示案

### 7.1 セクション構成（return_with_stop 時）

1. **往路候補が2件以上** → 先に「往路の走行予定ルートの選択」（既存UI）
2. 往路選択後 → **「全体走行予定ルートの選択」**（新規UI。復路単独セクションは出さない）

### 7.2 説明文言（案）

```text
復路は、目的地 → 立ち寄り先 → 出発地の指定ルートで距離を算定します。

目的地 → 立ち寄り先 までは共通です。
立ち寄り先 → 出発地 の区間で、以下の走行予定ルートから選択できます。
```

※ 上記は補足説明。カードタイトル・選択ラベルは必ず **全体走行予定ルート候補** とする。

### 7.3 候補カード（案）

```text
【全体走行予定ルートの選択】

全体候補1：おすすめルート
S → G → 立ち寄り → S
時間と距離のバランスを考慮した標準的なルートです。
合計距離：10.2km　所要時間：30分
[このルートを選択]

全体候補2：高速道路ルート
S → G → 立ち寄り → S
遠方移動に適したルートです。有料道路料金は別途必要です。
有料道路料金は見積料金に含まれず、別途必要です。
合計距離：10.8km　所要時間：28分
[このルートを選択]
```

### 7.4 表示上の禁止事項

- 「復路の走行予定ルートの選択」という見出しで `立ち寄り→S` のみを選ばせるUI
- 内部キー（`recommended` / `shorter_distance` 等）の画面露出
- 共通区間だけの距離を候補カードの主表示にすること

### 7.5 地図

既存の3セグメント表示を継続：

| 色 | 区間 |
|----|------|
| 青 | S → G（往路） |
| 緑 | G → 立ち寄り |
| 赤 | 立ち寄り → S（選択候補で差し替え） |

---

## 8. PDF表示案

### 8.1 出力ブロック（案）

```text
走行予定ルート：
S → G → 立ち寄り → S

共通区間：
・S → G（xx.x km / xx分）
・G → 立ち寄り（xx.x km / xx分）

選択区間：
・立ち寄り → S（xx.x km / xx分）

選択ルート：おすすめルート
時間と距離のバランスを考慮した標準的なルートです。

合計距離：xx.x km
合計所要時間：xx分
```

高速道路ルート選択時は、説明文に **有料道路料金は別途必要** を明記する（d3ee016 の表示方針を踏襲）。

### 8.2 確認対応時

全体候補1件の場合は、現行どおり確認対応文言（`pre-fixed-fare-status.js`）に加え、上記の経路構造・選択ルート名（1件）を残す。

---

## 9. 実装フェーズ

### Phase 1：設計書作成のみ ← **今回**

- 本ドキュメントの作成
- コード変更なし

### Phase 2：API分割取得・合成ロジック

| タスク | 内容 |
|--------|------|
| API分割 | `G → 立ち寄り` を1回取得 |
| 候補取得 | `立ち寄り → S` を既存マルチ戦略で取得（偽ルートなし） |
| 合成 | 選択済み往路 + 共通 + 選択区間候補 → `overallRouteCandidates` |
| dedupe | 全体候補の実質重複除外 |
| 距離反映 | `routePlan.totalDistanceMeters` / `totalDurationSeconds` 更新 |

想定ファイル：`estimate/estimate-distance-api.js`, `estimate/estimate-main.js`

### Phase 3：UI・PDF・quoteSnapshot反映

| タスク | 内容 |
|--------|------|
| UI | 全体走行予定ルート候補の選択UI（往路先固定フロー含む） |
| PDF | 共通区間・選択区間・全体ルートの出力 |
| quoteSnapshot | `overallRouteSelection` の handoff 保存 |
| ステータス | `pre-fixed-fare-status.js` の文言調整 |

想定ファイル：`estimate/estimate-main.js`, `estimate/estimate-pdf.js`, `estimate/estimate-calc.js`, `shared/pre-fixed-fare-status.js`, `docs/design/quote-snapshot-fields.md`

### Phase 4：検証

| ケース | 確認内容 |
|--------|----------|
| 全体候補1件 | 確認対応、`fareConfirm=review`、予約導線 |
| 立ち寄り→S が2候補以上 | 全体候補2件以上、選択後 `preFixedFareConfirmable=true` |
| 往路2候補 | 往路先選択 → 全体候補表示（全組み合わせなし） |
| 高速道路候補 | 全体候補として表示、有料道路別途の明記 |
| PDF | 全体ルート・共通区間・選択区間・合計距離時間 |
| quoteSnapshot | `overallRouteSelection` 全フィールド |

---

## 10. 注意事項

| 項目 | 方針 |
|------|------|
| 料金計算ロジック | **変更しない**（係数・単価・内訳計算は現行維持） |
| 偽の2ルート | **作らない**（API区間の合成のみ） |
| 既存 quoteSnapshot フィールド | **壊さない**（追加のみ） |
| `distance_time` モード | **影響させない**（`pre_fixed_fare` のみ） |
| `returnFareStatus` | **リネームしない** |
| 有料道路料金 | 見積に含めず **別途必要** と画面・PDF・説明文で明示 |
| 当日急な立ち寄り追加 | **本設計の対象外**（別扱い・確認対応） |
| dedupe | 大幅変更はしない。全体候補生成後に実質同一を除外 |
| 全組み合わせ表示 | フェーズ1では **実装しない**（将来課題） |

---

## 11. 関連ドキュメント

- [quote-snapshot-fields.md](./quote-snapshot-fields.md) — 既存 `quoteSnapshot` 定義
- [route-candidate-selection-ui.md](./route-candidate-selection-ui.md) — ルート候補カードUI（d3ee016）
- `shared/pre-fixed-fare-route-presentation.js` — 表示名・説明文（おすすめ / 距離優先 / 高速道路 / 幹線道路）

---

## 12. 将来課題

- 往路候補 × `立ち寄り→S` 候補の全組み合わせ表示
- 幹線道路ルートが `立ち寄り→S` で成立するケースの全体候補への反映
- `quote-snapshot-fields.md` への `overallRouteSelection` 正式追記（Phase 3 実装時）
