# 事前確定運賃 Phase 3：GO型「時間優先／一般道優先」2ルート取得強化 設計

| 項目 | 内容 |
|------|------|
| ステータス | **設計のみ（未実装）** |
| 作成日 | 2026-06-26 |
| 前提コミット | `22bc145`（Phase 2-A〜2-D 完了） |
| 目的 | 1ルートになりやすいケースでも、GO型に近い「時間優先／一般道優先」の2候補を出せる可能性を高める |
| スコープ外 | 料金計算式変更、`preFixedFareConfirmable` の雑な緩和、Phase 2 証跡構造の破壊 |

---

## 1. 背景

Phase 2 までに、事前確定運賃モードでは以下が確立されている。

| 状態 | `preFixedFareConfirmable` | 予約導線 |
|------|---------------------------|----------|
| 候補2件以上・選択済み | `true` | 「この内容で予約する」（`fareConfirm=review` なし） |
| 候補1件 | `false` | 「確認対応として予約へ進む」（`fareConfirm=review` あり） |

帰り立ち寄り（`return_with_stop`）では、全体走行予定ルート候補（`overallRouteSelection`）を主体とし、Phase 2 証跡（画面・PDF・`quoteSnapshot`・handoff）が整備済みである（`docs/evidence/pre-fixed-fare-phase2/`）。

一方、片道や短距離・単純経路では、Google Routes API が実質1候補しか返さず、重複除去後も1件のまま **確認対応** に落ちるケースが多い。認可取得に向け、GO アプリと同様に **算定条件の異なる走行予定ルート候補** を旅客に提示できるケースを増やす必要がある。

本 Phase 3 は **設計・方針整理のみ** とし、実装は 3-B 以降で段階的に行う。

---

## 2. GO型UIから得た示唆

### 2.1 短距離ケース

GO では短距離でも地図上ほぼ同じルートに見えながら、次の2候補が並ぶ。

```text
時間優先　約4分
一般道優先　約4分
```

**示唆**

- 地図上の視覚的差分が小さくても、**ルート生成条件・算定条件の違い** を旅客に明示できる設計が有効。
- 距離・時間が近接していても、`routeStrategy` / `avoidHighways` / `avoidTolls` 等が異なれば **別候補として残す余地** がある（証跡付き）。

### 2.2 長距離ケース

```text
時間優先（有料道）　約66分
一般道優先　　　　　約89分
```

**示唆**

- 基本軸は **時間優先** と **一般道優先** の2系統。
- 有料道路を含む場合はラベルに **（有料道）** を付与し、有料道路料金の別途負担を明示する。
- 長距離では経路形状も分かれやすいが、短距離では条件差の明示が主役になりうる。

### 2.3 本システムへの適用方針

| GO型の考え方 | 本システムでの対応 |
|--------------|-------------------|
| 時間優先ルート | `routeStrategy: time_priority` として独立 API 取得 |
| 一般道優先ルート | `routeStrategy: general_road_priority` として独立 API 取得 |
| 有料道明示 | `usesToll === true` 時にラベル・説明・PDF で別途必要を表示 |
| 主要道路経由 | 既存 `arterial_road` / waypoint を「主要経由地点」として旅客に明示 |
| 偽候補の禁止 | 同一 API 条件・同一経路の重複は除外。名前だけの二重化はしない |

---

## 3. 現在の候補生成ロジック

### 3.1 エントリポイント

| 関数 | ファイル | 役割 |
|------|----------|------|
| `computePreFixedFareRouteCandidates()` | `estimate/estimate-distance-api.js` | 事前確定運賃の候補生成本体 |
| `computeSegmentRouteCandidates()` | 同上 | 中間地点なし時の4系統生成 |
| `computeReturnWithStopOverallRouteSelection()` | 同上 | 帰り立ち寄り全体候補 |
| `buildRoutesRequestBody()` | 同上 | Routes API リクエスト組み立て |

`estimate-main.js` から `requestPreFixedFareCandidates: isPreFixedFareMode()` で呼び出される。

### 3.2 現行4系統（`computeSegmentRouteCandidates`）

| 順 | `routeStrategy` | 表示名（`pre-fixed-fare-route-presentation.js`） | 取得条件 |
|----|-----------------|--------------------------------------------------|----------|
| 1 | `recommended` | おすすめルート | `computeAlternativeRoutes: true`、`avoidTolls`/`avoidHighways` = ユーザー `roadType` |
| 2 | `shorter_distance` | 距離優先ルート | 候補プールから最短。`recommended` と重複なら除外 |
| 3 | `arterial_road` | 幹線道路ルート | 幹線 waypoint 経由再リクエスト、`avoidHighways: false` |
| 4 | `toll_allowed` | 高速道路ルート | `avoidTolls: false`、`usesToll(route)` のもののみ採用 |

共通 API 設定（`buildRoutesRequestBody`）:

```javascript
routingPreference: "TRAFFIC_AWARE"
travelMode: "DRIVE"
extraComputations: ["TOLLS"]
```

最大候補数: `MAX_ROUTE_CANDIDATES = 4`

### 3.3 ユーザー `roadType` の影響

`state.roadType === "general"` のとき:

- `recommended` プール: `avoidTolls: true`, `avoidHighways: true`
- `arterial_road`: `avoidTolls: true`, `avoidHighways: false`
- `toll_allowed`: ユーザーが一般道選択でも **別途** `avoidTolls: false` で取得（有料道候補の追加目的）

`roadType === "toll"` のとき:

- 推奨プールは有料道・高速を許可した条件で取得

### 3.4 中間地点（立ち寄り）ありの片道

`intermediateAddress` がある場合は **候補生成パイプラインをスキップ** し、単一ルートのみ返す（`computeAlternativeRoutes: false`）。  
→ 往復の立ち寄りは `return_with_stop` の全体候補フローで別途処理。

### 3.5 確定可否判定

```javascript
preFixedFareConfirmable = deduped.length >= 2
fallbackReason = preFixedFareConfirmable ? null : "only_one_distinct_route"
```

帰り立ち寄りでは `overallRouteCandidates.length >= 2` かつ `selectedOverallRouteId` ありがトップレベル `preFixedFareConfirmable` の正（Phase 2-D）。

### 3.6 表示・証跡

| 層 | 実装 |
|----|------|
| カードUI | `estimate-main.js` `renderRouteSelectionCards()` |
| ラベル解決 | `shared/pre-fixed-fare-route-presentation.js` |
| quoteSnapshot | `estimate-calc.js` `buildRouteCandidateSnapshot()` |
| PDF | `estimate-pdf.js`（全体ルート・確認対応文言） |
| 予約URL | `getReservationUrl()` — `false` 時 `fareConfirm=review` |

現行 `buildRouteCandidateSnapshot` は `avoidTolls` / `avoidHighways` / `usesToll` / `intermediateWaypoint` まで保存するが、`routingPreference` / `generationReason` / `dedupeDecision` / `routeGeneration` メタは **未保存**。

---

## 4. 1候補になりやすい原因

### 4.1 API・地理的要因

| 原因 | 説明 |
|------|------|
| 代替ルート不足 | `computeAlternativeRoutes: true` でも短距離・単純経路では API が1件のみ返すことが多い |
| 幹線 waypoint 不成立 | `selectArterialWaypoint()` は経路距離 `< 3000m` で常に `null`（`pre-fixed-fare-route-waypoints.js`） |
| 有料道なし | `toll_allowed` は `usesToll === false` のルートをスキップし、採用0件になりうる |
| 中間地点強制単一 | `intermediateAddress` 指定時は代替取得しない |

### 4.2 現行戦略の限界

| 原因 | 説明 |
|------|------|
| `recommended` ≒ `shorter_distance` | プールが1件なら距離優先も生成されない。2件あっても最短が推奨と重複しやすい |
| 戦略の軸が GO型と異なる | 「おすすめ／距離優先」は旅客向け GO 表現（時間優先／一般道優先）と一致しない |
| `roadType=general` の一律回避 | 時間優先・一般道優先の **対比** を意図的に作っていない |

### 4.3 重複除去（dedupe）の影響

`isDuplicateRoute()`（`estimate-distance-api.js`）は以下のいずれかで **同一扱い**:

1. `encodedPolyline` 完全一致
2. 距離差 `< 100m` **かつ** 時間差 `< 60秒`
3. `routeSummary` / `routeLabels` 一致
4. 同一 `intermediateWaypoint.waypointId` かつ上記相当

**問題点（Phase 3 で見直し対象）**

- 条件 (2) により、**算定条件が異なる**（例: `avoidHighways` のみ異なる）候補でも、短距離では潰される可能性が高い。
- `routeStrategy` の違いは dedupe 判定に **含まれていない**。
- GO型の「時間優先／一般道優先」は意図的に近い結果を出しつつ条件差を示すため、戦略別の dedupe ルールが必要。

### 4.4 帰り立ち寄り特有

復路選択区間（`立ち寄り → 出発地`）の `computeSegmentRouteCandidates` 結果が1件に集約されると、全体候補も1件（Phase 2 ケースC: 千葉メディカルセンター × 蘇我駅）。

---

## 5. 時間優先／一般道優先の基本方針

### 5.1 新戦略の定義

Phase 3 では GO型の主軸として、以下2戦略を **パイプラインの最優先** で追加する（既存4系統との関係は 5.4 参照）。

#### 5.1.1 時間優先ルート（`time_priority`）

| 項目 | 内容 |
|------|------|
| `routeStrategy` | `time_priority` |
| `routeType` | `time_priority` |
| 表示名 | `時間優先ルート`（`usesToll === true` 時は `時間優先（有料道）`） |
| API 条件 | `routingPreference: TRAFFIC_AWARE`, `avoidHighways: false`, `avoidTolls: false`（またはユーザーが有料道拒否時は `avoidTolls: true`） |
| `computeAlternativeRoutes` | `false`（単独リクエストで意図を明確化） |
| 説明文 | 所要時間を優先して算定した走行予定ルートです。有料道路を含む場合、有料道路料金は別途必要です。 |
| `generationReason` | `time_priority_route` |

#### 5.1.2 一般道優先ルート（`general_road_priority`）

| 項目 | 内容 |
|------|------|
| `routeStrategy` | `general_road_priority` |
| `routeType` | `general_road_priority` |
| 表示名 | `一般道優先ルート` |
| API 条件 | `routingPreference: TRAFFIC_AWARE`, `avoidHighways: true`, `avoidTolls: true` |
| `computeAlternativeRoutes` | `false` |
| 説明文 | 有料道路を使わず、一般道を優先して算定した走行予定ルートです。 |
| `generationReason` | `general_road_priority_route` |

### 5.2 ユーザー `roadType` との整合

| ユーザー設定 | 時間優先の `avoidTolls` | 一般道優先 | 備考 |
|--------------|-------------------------|------------|------|
| 有料道利用可（`toll`） | `false` | 変更なし（常に回避） | GO型の2軸が最大限機能 |
| 一般道のみ（`general`） | `true` | 変更なし | 時間優先も有料道は使わないが、高速 vs 一般道の差は残りうる |

**原則**: 一般道優先は常に `avoidHighways: true`, `avoidTolls: true`。時間優先は「ユーザーが許可した範囲で最短時間」を取る。

### 5.3 短距離での2候補化

短距離で距離・時間が近接しても:

- API 取得条件が異なれば **別候補として保持**（dedupe 見直し後）。
- UI・PDF では算定条件の差を必ず表示（「交通状況を考慮し所要時間優先」「有料道路・高速道路を避けて算定」）。
- `encodedPolyline` が完全一致する場合のみ完全重複として除外（後述 dedupe）。

### 5.4 既存4系統との位置づけ（案）

| 優先度 | 戦略 | Phase 3 での扱い |
|--------|------|----------------|
| 1 | `time_priority` | **新規追加・最優先** |
| 2 | `general_road_priority` | **新規追加・最優先** |
| 3 | `toll_allowed` | 存続。`usesToll` 時のみ表示（6章） |
| 4 | `arterial_road` | 存続。主要経由地点として再ラベル（7章） |
| 5 | `recommended` | パイプラインからは外すか、`time_priority` に統合 |
| 6 | `shorter_distance` | パイプラインからは外すか、補助的に残す |

**推奨**: `recommended` / `shorter_distance` は Phase 3-B で **`time_priority` / `general_road_priority` に置換** し、表示名を GO 型に寄せる。既存 `routeStrategy` 値は quoteSnapshot 後方互換のためドキュメントに残すが、新規生成では使わない。

`routeGenerationStrategies`（配列）は Phase 3-E で次のように更新:

```javascript
["time_priority", "general_road_priority", "toll_allowed", "major_road_priority"]
```

（`major_road_priority` は `arterial_road` の表示・証跡上のエイリアス名として検討）

---

## 6. 有料道路利用ルートの扱い

### 6.1 現行との差分

現行 `toll_allowed` は「高速道路ルート」として表示。Phase 3 では GO 型に合わせて整理する。

| 項目 | 現行 | Phase 3 案 |
|------|------|------------|
| 戦略キー | `toll_allowed` | `toll_allowed` を維持（後方互換） |
| 表示名 | 高速道路ルート | **有料道路利用ルート** |
| 表示条件 | `usesToll` のルートを採用時 | **`usesToll === true` の場合のみ候補リストに含める** |
| 時間優先との関係 | 独立 | 時間優先が既に有料道利用かつ `usesToll` なら、`toll_allowed` は dedupe で除外 |

### 6.2 表示ルール

```text
有料道路利用ルート
約XX分
有料道路料金は見積料金に含まれず、別途必要です。
```

時間優先候補が有料道を含む場合:

```text
時間優先（有料道）
約XX分
有料道路料金は別途必要です。
```

### 6.3 取得条件

```text
routingPreference: TRAFFIC_AWARE
avoidHighways: false
avoidTolls: false
computeAlternativeRoutes: true  // 有料道を含む代替を探索
extraComputations: ["TOLLS"]
```

`usesToll === false` のレスポンスは候補に **含めない**（現行と同様）。

### 6.4 料金・証跡

- 運賃計算式は変更しない。
- `tollExcludedFromFare: true` を維持。
- `quoteSnapshot` の `usesToll` / `tollInfo` / 説明文で別途負担を記録。

---

## 7. 主要経由地点つきルートの扱い

### 7.1 現行資産

`shared/pre-fixed-fare-route-waypoints.js` に千葉県内10地点の幹線 waypoint が定義済み。`selectArterialWaypoint()` が出発地・目的地のコリドー上か判定する。

### 7.2 Phase 3 での見直し

| 項目 | 内容 |
|------|------|
| 戦略キー | 内部は `arterial_road` 維持。表示・証跡では `major_road_priority` / `routeType: major_road_priority` を併記可 |
| 表示名 | `主要道路優先ルート` または `主要経由：〇〇方面`（waypoint ラベルから生成） |
| 説明文 | この候補は、〇〇を主要経由地点として算定した走行予定ルートです。 |
| waypoint の扱い | **利用者に見える主要経由地点** として UI・PDF・`quoteSnapshot.intermediateWaypoint` に保存 |
| 禁止表現 | 「参考地点であり、必ず通過しない場合があります」は使わない |

### 7.3 1候補時の再検索 UI（3-F）

候補1件のとき、自動で勝手に経由地を挟まない。代わりに:

```text
この条件では、事前確定運賃に必要な複数ルート候補を生成できませんでした。
主要経由地点を指定して再検索することで、別の走行予定ルート候補を作成できる場合があります。
```

ボタン:

- **主要経由地を選んで再検索** — コリドー上の waypoint 一覧を提示し、ユーザー選択後に `intermediateWaypoint` 付きで再取得
- **確認対応として予約へ進む** — 現行どおり `fareConfirm=review`

**重要**: 経由地はユーザーが選んだものだけ API に渡す。システムが利用者に見えない経由地を勝手に挟むことは禁止（方針どおり）。

### 7.4 コリドー判定の緩和（検討）

短距離で waypoint が選ばれない問題に対し、3-B / 3-F で以下を検討（実装時に A/B 確認）:

- 再検索 UI ではコリドー外 waypoint も **一覧表示** し、選択時に警告文を付与
- 自動パイプラインでは現行コリドー判定を維持（勝手に経由しない）

---

## 8. dedupe見直し案

### 8.1 設計原則

| 区分 | ルール |
|------|--------|
| 完全重複として除外 | 下記 8.2 の **厳密一致** |
| 別候補として残す | `routeStrategy` または routing 条件が異なり、旅客に算定条件差を説明できる場合 |
| 禁止 | 同一 API 条件・同一結果を名前だけ変えて2件にしない |

### 8.2 完全重複（除外）条件 — すべて満たす場合のみ

```text
encodedPolyline が完全一致
AND distanceMeters が同一
AND durationSeconds が同一
AND routeStrategy が同一
AND routing 条件が同一（routingPreference, avoidHighways, avoidTolls, intermediateWaypoint）
```

いずれかが異なれば **別候補候補** として dedupe パスに進む。

### 8.3 現行ルールからの変更

| 現行 | Phase 3 案 |
|------|------------|
| 距離差100m未満かつ時間差60秒未満で同一 | **routeStrategy が異なれば残す**。同一 strategy 内でのみ近接判定を適用 |
| summary 一致で同一 | 同一 strategy かつ polyline 一致に近い場合の補助判定に降格 |
| polyline 一致で無条件同一 | **routing 条件も一致する場合のみ** 除外（strategy 違いは polyline 一致でも残さない…ではなく、polyline一致＋条件一致で除外） |

**整理した判定フロー（案）**

```
1. routingFingerprint 不一致 → 別候補（KEEP）
2. routeStrategy 不一致 → 別候補（KEEP）※ polyline が同じでも可（GO短距離ケース）
3. encodedPolyline 完全一致 → DUPLICATE
4. 同一 strategy 内で距離差<100m かつ 時間差<60s → DUPLICATE
5. それ以外 → KEEP
```

### 8.4 dedupe 証跡

各候補に `dedupeDecision` を付与:

| 値 | 意味 |
|----|------|
| `kept` | パイプラインに残った |
| `deduped_exact_match` | 完全重複で除外 |
| `deduped_same_strategy_near_match` | 同一戦略内の近接一致で除外 |

パイプライン全体で `routeGeneration.dedupedCount` を記録。

### 8.5 全体候補（`return_with_stop`）

`dedupeOverallRouteCandidates()` も同様に、選択区間の `routeStrategy` / routing 条件を考慮するよう 3-D で更新。現行は選択区間の polyline 近接のみ。

---

## 9. quoteSnapshot証跡案

### 9.1 各 `routeCandidates[]` 要素の拡張

現行フィールド（`routeLabel`, `avoidTolls`, `usesToll` 等）は **維持** し、以下を追加:

```json
{
  "routeId": "route_0",
  "routeStrategy": "time_priority",
  "routeLabel": "時間優先ルート",
  "routeDescription": "所要時間を優先して算定した走行予定ルートです。...",
  "routingPreference": "TRAFFIC_AWARE",
  "avoidHighways": false,
  "avoidTolls": false,
  "usesToll": true,
  "distanceMeters": 71200,
  "durationSeconds": 3960,
  "generationReason": "time_priority_route",
  "intermediateWaypoint": null,
  "dedupeDecision": "kept"
}
```

一般道優先の例:

```json
{
  "routeId": "route_1",
  "routeStrategy": "general_road_priority",
  "routeLabel": "一般道優先ルート",
  "routingPreference": "TRAFFIC_AWARE",
  "avoidHighways": true,
  "avoidTolls": true,
  "usesToll": false,
  "distanceMeters": 73500,
  "durationSeconds": 5340,
  "generationReason": "general_road_priority_route",
  "intermediateWaypoint": null,
  "dedupeDecision": "kept"
}
```

主要経由ありの例:

```json
{
  "routeStrategy": "arterial_road",
  "routeType": "major_road_priority",
  "routeLabel": "主要経由：京葉道路方面",
  "generationReason": "major_road_priority_route",
  "intermediateWaypoint": {
    "waypointId": "keiyo-road-funabashi",
    "waypointLabel": "京葉道路（船橋・習志野付近）"
  },
  "dedupeDecision": "kept"
}
```

### 9.2 トップレベル `routeGeneration` メタ

```json
{
  "routeGeneration": {
    "pipelineVersion": "phase3-go-style-v1",
    "phasesAttempted": [
      "time_priority",
      "general_road_priority",
      "toll_allowed",
      "major_road_priority"
    ],
    "phasesSucceeded": ["time_priority", "general_road_priority"],
    "dedupedCount": 2,
    "rawRouteCount": 2,
    "fallbackReason": null
  }
}
```

候補1件時:

```json
{
  "routeGeneration": {
    "pipelineVersion": "phase3-go-style-v1",
    "phasesAttempted": ["time_priority", "general_road_priority", "toll_allowed", "major_road_priority"],
    "phasesSucceeded": ["time_priority"],
    "dedupedCount": 1,
    "fallbackReason": "only_one_distinct_route"
  }
}
```

### 9.3 後方互換

- 既存 `routeGenerationStrategies` 配列は Phase 3 でも併記（値は新戦略名に更新）。
- Phase 2 証跡の `preFixedFareConfirmable` / `fallbackReason` セマンティクスは **変更しない**。
- `buildRouteCandidateSnapshot()` への追加はオプショナルフィールドのみ（既存コンシューマを壊さない）。

### 9.4 変更ファイル（実装時）

| ファイル | 変更内容 |
|----------|----------|
| `estimate/estimate-distance-api.js` | 生成・dedupe・`routeGeneration` 返却 |
| `estimate/estimate-calc.js` | `buildRouteCandidateSnapshot` 拡張 |
| `estimate/estimate-main.js` | `routePlan` へのメタ伝播 |
| `docs/design/quote-snapshot-fields.md` | フィールド追記 |

---

## 10. UI表示案

### 10.1 候補2件以上

カード例（長距離）:

```text
時間優先（有料道）
約66分
有料道路料金は別途必要です
```

```text
一般道優先
約89分
有料道路を使わないルートです
```

短距離:

```text
時間優先
約4分
```

```text
一般道優先
約4分
```

**詳細（カード説明または折りたたみ）**

| 候補 | 算定条件の明示 |
|------|----------------|
| 時間優先 | 交通状況を考慮し、所要時間を優先して算定 |
| 一般道優先 | 有料道路・高速道路を避けて算定 |

### 10.2 候補1件

現行の警告に加え、3-F の導線:

```text
この条件では、事前確定運賃に必要な複数ルート候補を生成できませんでした。
主要経由地点を指定して再検索することで、別の走行予定ルート候補を作成できる場合があります。
```

| ボタン | 動作 |
|--------|------|
| 主要経由地を選んで再検索 | waypoint 選択モーダル → 再計算 |
| 確認対応として予約へ進む | 現行どおり |

### 10.3 `pre-fixed-fare-route-presentation.js` 更新（3-B）

`ROUTE_PRESENTATION` に `time_priority`, `general_road_priority`, `major_road_priority` を追加。`time_priority` で `usesToll` 時は動的に `時間優先（有料道）` を返す関数を既存 `resolveRoutePresentation` に統合。

### 10.4 帰り立ち寄り

全体候補カードのラベルも同様に GO 型表記へ。Phase 2 の「全体走行予定ルート」UX は維持。

---

## 11. PDF表示案

### 11.1 片道・レッグ別

各候補について PDF に含める項目:

| 項目 | 内容 |
|------|------|
| ルート名 | `時間優先（有料道）` / `一般道優先` 等 |
| 所要時間 | `約XX分` |
| 算定条件 | 1行説明（UI と同文案） |
| 有料道 | 該当時「有料道路料金は見積料金に含まれず、別途必要」 |
| 主要経由 | waypoint ラベル（ある場合） |

選択済みルートは現行どおり Static Map + 選択ルート情報。

### 11.2 帰り立ち寄り（`return_with_stop`）

Phase 2-C の全体ルート PDF ブロックを拡張:

- 全体候補ごとに GO 型ラベル・算定条件・有料道注記
- 確認対応時は現行の `only_one_distinct_route` 文言を維持
- `routeGeneration.pipelineVersion` を PDF フッターまたは監査ブロックに任意記載（実装判断）

### 11.3 変更ファイル（実装時）

- `estimate/estimate-pdf.js`
- `shared/pre-fixed-fare-report-data.js`（認可説明データ）

---

## 12. 認可説明用文言

設計書・認可資料に掲載する説明（そのまま利用可）:

> 本システムでは、電子地図APIにより、時間優先・一般道優先・有料道路利用・主要道路優先等の条件で走行予定ルート候補を生成します。
>
> 各候補は旅客に表示され、旅客が選択した走行予定ルートに基づいて事前確定運賃を算定します。
>
> 有料道路を含む候補については、有料道路料金が見積料金に含まれず、別途必要であることを明示します。
>
> 同一条件・同一経路の重複候補は除外します。
>
> 実質的に異なる候補が2件以上成立しない場合は、事前確定運賃として確定せず、確認対応として予約に進みます。

---

## 13. 実装リスク

| リスク | 影響 | 緩和策 |
|--------|------|--------|
| Routes API 呼び出し増 | コスト・レイテンシ増 | 時間優先・一般道優先は各1リクエストに限定。既存プール取得との統合を検討 |
| 短距離で一般道優先が時間優先と実質同一 | 旅客混乱 | 算定条件の明示で GO 型と同様に対応。polyline 完全一致のみ dedupe |
| dedupe 緩和しすぎ | 偽の2候補と見なされるリスク | routing 条件＋strategy を必須記録。完全同一は除外を維持 |
| dedupe 厳しすぎ | 2候補化できない | Phase 3 前後でケースB/C 相当の証跡パックで再検証 |
| `roadType` ラジオと候補UIの二重意味 | UX 混乱 | 将来 `route-candidate-selection-ui.md` どおりラジオ廃止を検討。Phase 3 では同期維持 |
| 帰り立ち寄り全体候補への波及 | Phase 2 回帰 | 3-G で `computeSegmentRouteCandidates` 変更を全体フローに統合し、ケースB/C を再実行 |
| `preFixedFareConfirmable` 誤判定 | 認可・予約導線の不整合 | 判定式は `deduped.length >= 2` のまま変更しない |
| waypoint 再検索の誤選択 | 不合理経路 | ユーザー明示選択のみ。コリドー外は警告表示 |

---

## 14. 推奨実装手順

| Phase | 内容 | 主な変更 |
|-------|------|----------|
| **3-A** | 設計書追加 | 本ドキュメント |
| **3-B** | 時間優先／一般道優先の取得ロジック追加 | `estimate-distance-api.js`, `pre-fixed-fare-route-presentation.js` |
| **3-C** | 有料道路利用ルートの明示表示 | presentation, UI カード, `usesToll` ラベル動的化 |
| **3-D** | dedupe 見直し | `isDuplicateRoute`, `dedupeRoutes`, `dedupeOverallRouteCandidates` |
| **3-E** | quoteSnapshot `routeGeneration` 証跡追加 | `estimate-calc.js`, `quote-snapshot-fields.md` |
| **3-F** | 1候補時の主要経由地点再検索 UI | `estimate-main.js`, waypoint 選択 UI |
| **3-G** | `return_with_stop` 全体候補への統合 | `computeReturnWithStopOverallRouteSelection` 経路 |
| **3-H** | PDF・handoff・証跡パック更新 | `estimate-pdf.js`, `docs/evidence/pre-fixed-fare-phase3/` |

### 14.1 各ステップの完了条件

| Step | 完了条件 |
|------|----------|
| 3-B | 片道で時間優先・一般道優先の2リクエストが走り、quoteSnapshot に routing 条件が残る |
| 3-C | `usesToll` 時に「（有料道）」表記が UI・PDF で一貫 |
| 3-D | 異なる strategy で近接距離・時間の候補が2件残るテストケースが通る |
| 3-E | `routeGeneration.pipelineVersion` が handoff JSON に含まれる |
| 3-F | 1候補時に再検索ボタンが表示され、選択 waypoint で再計算できる |
| 3-G | ケースB（2全体候補）・ケースC（1全体候補）が Phase 2 同等以上の証跡で再現 |
| 3-H | 新証跡パック・PDF サンプルが `docs/evidence/` に保存 |

### 14.2 テスト観点（実装時）

- 短距離（市内数km）で時間優先／一般道優先の2候補が出るか
- 長距離（ディズニーランド等）で有料道ラベルが付くか
- 候補1件時に `fareConfirm=review` が維持されるか
- 同一 polyline・同一条件の重複が除外されるか
- API 条件が異なるのに名前だけ違う候補を **作っていない** か（コードレビュー）

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `estimate/estimate-distance-api.js` | 候補生成・dedupe・API |
| `shared/pre-fixed-fare-route-presentation.js` | 表示名・説明 |
| `shared/pre-fixed-fare-route-waypoints.js` | 主要経由地点マスタ |
| `shared/pre-fixed-fare-status.js` | 確認対応判定・文言 |
| `estimate/estimate-main.js` | UI・予約URL |
| `estimate/estimate-calc.js` | quoteSnapshot |
| `estimate/estimate-pdf.js` | PDF |
| `docs/design/quote-snapshot-fields.md` | 証跡フィールド定義 |
| `docs/design/return-with-stop-overall-route-candidates.md` | 全体候補設計（Phase 2） |
| `docs/evidence/pre-fixed-fare-phase2/` | Phase 2 証跡 |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-26 | 初版作成（Phase 3-A 設計のみ） |
| 2026-06-26 | Phase 3-B 実装：`time_priority` / `general_road_priority` 取得・dedupe 最小見直し・証跡フィールド追加 |
