# ルート層・料金層 分離設計（認可取得後リファクタリング候補）

| 項目 | 内容 |
|------|------|
| ステータス | **設計のみ（未実装）** |
| 作成日 | 2026-06-25 |
| 目的 | 認可取得後に `fareMode` 横断のルート候補UIへ拡張するための設計検討 |
| 現段階の方針 | **実装しない**。`pre_fixed_fare` フロー完成・APIコスト抑制・認可取得を優先 |

---

## 背景

現状、ルート候補の取得・表示は `fareMode === "pre_fixed_fare"` に結合している。

- `estimate-main.js`: `requestPreFixedFareCandidates: isPreFixedFareMode()`
- `renderRouteSelectionSection()`: `isPreFixedFareMode()` で早期 return
- `preFixedFareConfirmable`: 候補2件以上＋事前確定運賃の法的確定可否

将来、運賃方式を追加しても **ルート選択UIを共通化** したい一方、現時点では事前確定運賃の認可取得を優先し、本設計はリファクタリング候補として保管する。

---

## ① `requestPreFixedFareCandidates` → `requestRouteCandidates` 名称変更の検討

### 現状の参照箇所

| ファイル | シンボル | 役割 |
|----------|----------|------|
| `estimate/estimate-distance-api.js` | `options.requestPreFixedFareCandidates` | `computeRouteDistance()` 内分岐フラグ |
| `estimate/estimate-distance-api.js` | `computePreFixedFareRouteCandidates()` | 4系統候補生成の実装本体 |
| `estimate/estimate-distance-api.js` | `EstimateDistanceApi.computePreFixedFareRouteCandidates` | 公開API（直接呼び出し可） |
| `estimate/estimate-main.js` | `requestPreFixedFareCandidates: isPreFixedFareMode()` | ルート計算時の呼び出し元 |
| `docs/design/route-candidate-selection-ui.md` | ドキュメント | 設計メモ |

**アプリケーションコード上の参照は少数（実質3箇所）** であり、名称変更は技術的に容易。

### 改名の可否

| 観点 | 評価 |
|------|------|
| 技術的実現性 | **可**。影響範囲が限定的 |
| 意味の正確性 | **改善される**。候補生成は運賃方式ではなくルート層の責務 |
| 後方互換 | 移行期間中は旧名をエイリアスとして残すことを推奨 |
| リスク | 低（内部フラグ＋エクスポート名。外部公開APIは現状ほぼなし） |

### 推奨する改名マップ

| 現名称 | 推奨新名称 | 備考 |
|--------|------------|------|
| `requestPreFixedFareCandidates` (option) | `requestRouteCandidates` | UI/呼び出し元が渡す意図フラグ |
| `computePreFixedFareRouteCandidates()` | `computeRouteCandidates()` | 実装関数名 |
| `EstimateDistanceApi.computePreFixedFareRouteCandidates` | `EstimateDistanceApi.computeRouteCandidates` | 公開API。旧名は deprecated エイリアス |

### 改名しても変わらないこと

- **呼び出し条件**は当面 `isPreFixedFareMode()` のまま維持可能（フラグ名だけ汎用化）
- 4系統生成・重複除去・`MAX_ROUTE_CANDIDATES` 等のロジックは不変
- 単一ルート取得パス（`computeRouteDistance` デフォルト）は別関数のまま残す

### 移行手順（認可取得後）

1. 新名称を追加し、旧名称を thin wrapper にする（1リリース）
2. 呼び出し元・ドキュメントを新名称へ置換
3. 旧名称を削除（次リリース以降）

---

## ② `preFixedFareConfirmable` と `routeSelectionAvailable` の概念分離

### 現状の問題

1つのフラグ `preFixedFareConfirmable` に、性質の異なる意味が混在している。

| 混在している意味 | 例 |
|------------------|-----|
| **UI可否** | 候補カードの「このルートを選択」ボタン表示 |
| **法的確定可否** | 事前確定運賃として旅客同意が有効か（2件以上） |
| **予約連携** | `fareConfirm=review` の付与 |
| **quoteSnapshot** | 監査・handoff 用の確定状態 |

概算モード（`distance_time`）で候補UIを出す場合、**候補1件でも選択可能**だが、**事前確定運賃としては不可** — 現フラグでは表現できない。

### 分離後の概念定義

#### `routeSelectionAvailable`（新設・ルート層）

| 属性 | 内容 |
|------|------|
| スコープ | レッグ単位（`outboundRoutePlan` / `returnRoutePlan`）および集約 `routePlan` |
| 真になる条件 | `routeCandidates.length >= 1` かつ Routes API 取得成功 |
| 用途 | 候補UI表示、地図更新、`selectRoute()` の実行可否（概算含む） |
| fareMode 依存 | **なし** |

#### `preFixedFareConfirmable`（既存・認可層）

| 属性 | 内容 |
|------|------|
| スコープ | レッグ単位および往復集約 |
| 真になる条件 | `distinctRouteCount >= 2`（実質的に異なる候補が2件以上） |
| 用途 | 事前確定運賃の法的確定、予約URL `fareConfirm=review` 抑制、認可レポート |
| fareMode 依存 | **`pre_fixed_fare` のみ意味を持つ** |

#### 補助フラグ（既存維持または整理）

| フラグ | 層 | 説明 |
|--------|-----|------|
| `multipleRoutesAvailable` | ルート層 | 2件以上候補あり（`routeSelectionAvailable` とほぼ同等だが「複数」強調） |
| `preFixedFareScope` | 認可層 | `outbound_only` / `outbound_and_return` |
| `returnFareStatus` | 認可層 | `fixed_candidate` / `review_required` |
| `fallbackReason` | ルート層 | `only_one_distinct_route` 等 |

### 判定マトリクス（設計）

| 状況 | `routeSelectionAvailable` | `preFixedFareConfirmable` | UI動作（将来） | 事前確定運賃 |
|------|---------------------------|---------------------------|----------------|--------------|
| 候補0件 | false | false | エラー表示 | 不可 |
| 候補1件 | true | false | カード表示・選択可（概算） | 確認対応 |
| 候補2件以上 | true | true | カード表示・選択必須 | 確定候補 |
| 立ち寄り復路（API 1本） | true | false | 地図・距離表示 | 往路のみ確定可 |

### 配置先（案）

```
estimate-distance-api.js（取得時）
  └─ legResult.routeSelectionAvailable = deduped.length >= 1
  └─ legResult.preFixedFareConfirmable = deduped.length >= 2  // 名称は認可用として維持

estimate-main.js（集約時）
  └─ routePlan.routeSelectionAvailable = outboundAvailable && (returnAvailable || !returnLeg)
  └─ routePlan.preFixedFareConfirmable = 既存ロジック（認可専用）

estimate-main.js（UI）
  └─ 候補UI表示: routeSelectionAvailable
  └─ selectRoute 実行: routeSelectionAvailable（概算）/ preFixedFareConfirmable（事前確定で厳格化する場合は fareMode 分岐）
  └─ 予約URL: isPreFixedFareMode() && !preFixedFareConfirmable のみ
```

### quoteSnapshot への反映（案）

| フィールド | 認可取得前 | 認可取得後リファクタ時 |
|------------|------------|------------------------|
| `preFixedFareConfirmable` | 維持 | 維持（破壊的変更を避ける） |
| `routeSelectionAvailable` | 未存在 | **追加**（新規フィールド） |
| `preFixedFareMode` | 維持 | 維持 |

既存の handoff・予約連携は `preFixedFareConfirmable` を参照し続け、新フィールドはUI・分析用とする。

---

## ③ Routes API 取得層と料金計算層の完全分離構成案

### 現状アーキテクチャ（簡略）

```
[UI: estimate-main.js]
    │
    ├─ fareMode 判定 ──► requestPreFixedFareCandidates
    │
    ▼
[Distance API: estimate-distance-api.js]
    ├─ computeRouteDistance()        … 単一ルート
    └─ computePreFixedFareRouteCandidates() … 複数候補
    │
    ▼
[routePlan in state]
    │
    ├─► [Map/PDF: estimate-route-map-display.js, estimate-pdf.js]
    │
    └─► [Fare: estimate-calc.js computeEstimate()]
            └─ fareMode 別 breakdown + quoteSnapshot
```

**課題:** 取得トリガーとUI表示が `fareMode` に結合。Distance API の戻り値に `preFixedFareConfirmable` が含まれ、ルート層が認可概念を知っている。

### 目標アーキテクチャ（分離後）

```
┌─────────────────────────────────────────────────────────┐
│  Presentation Layer (estimate-main.js)                   │
│  - STEP6 住所入力・候補UI・地図                          │
│  - fareMode に依らない routePlan 操作                    │
│  - fareMode 固有の文言・予約連携のみ分岐                  │
└───────────────────────┬─────────────────────────────────┘
                        │ RouteRequest / RoutePlan
┌───────────────────────▼─────────────────────────────────┐
│  Route Layer (新: estimate-route-service.js 等)          │
│  - computeRouteCandidates()  … 複数候補                  │
│  - computeSingleRoute()      … 単一ルート（将来も残す）   │
│  - buildStructuredRoutePlan() … 往復構造化               │
│  - selectRoute() / syncStateFromRoutePlan()              │
│  - 出力: RoutePlan（fareMode 非依存）                    │
└───────────────────────┬─────────────────────────────────┘
                        │ Google Routes API
┌───────────────────────▼─────────────────────────────────┐
│  estimate-distance-api.js（インフラ層）                  │
│  - fetchRoutesRequest / geocodeAddress                   │
│  - normalizeRawRoute / dedupeRoutes                      │
│  - routeStrategy 実行のみ。運賃・認可を知らない           │
└─────────────────────────────────────────────────────────┘

                        │ RoutePlan + EstimateFormState
┌───────────────────────▼─────────────────────────────────┐
│  Fare Layer (estimate-calc.js)                          │
│  - getEffectiveBilledDistanceKm(state)  … routePlan 参照 │
│  - getEffectiveRideMinutes(state)                        │
│  - computeEstimate(config, state)  … fareMode 別計算    │
│  - buildFareBasis / quoteSnapshot                       │
│  - pre_fixed_fare のみ: 交通圏係数・preFixedFareMeta     │
└─────────────────────────────────────────────────────────┘

                        │ quoteSnapshot + routePlan
┌───────────────────────▼─────────────────────────────────┐
│  Output Layer                                           │
│  - PDF (estimate-pdf.js)                                │
│  - handoff / quoteRegister                              │
│  - 認可レポート (pre-fixed-fare-report-data.js)          │
└─────────────────────────────────────────────────────────┘
```

### 層間インターフェース（案）

#### RouteRequest（UI → Route Layer）

```ts
{
  origin: string,
  destination: string,
  intermediateAddress?: string,
  roadType?: "general" | "toll",        // 単一ルート用。候補生成時は strategy 側で吸収
  requestRouteCandidates?: boolean,      // 旧 requestPreFixedFareCandidates
  apiKey, languageCode, region
}
```

#### RouteLegPlan（Route Layer 内部・永続）

```ts
{
  provider: "google_routes",
  origin: { address },
  destination: { address },
  waypoint?: { waypointAddress, waypointLatLng? },
  selectedRouteId: string,
  routes: RouteCandidate[],
  routeCandidates: RouteCandidate[],
  distanceMeters, durationSeconds,
  encodedPolyline, roadType, routeStrategy, ...
  routeSelectionAvailable: boolean,      // 新
  preFixedFareConfirmable: boolean,    // 認可メタ（取得層で算出しても fare 層は解釈のみ）
  fallbackReason?: string
}
```

#### RoutePlan（Route Layer → Fare / Output）

```ts
{
  tripType: "one_way" | "round_trip",
  returnPlanType?: string,
  outboundRoutePlan: RouteLegPlan,
  returnRoutePlan?: RouteLegPlan,
  totalDistanceMeters: number,
  totalDurationSeconds: number,
  pickup?: { address, latLng, geocoding },
  destination?: { address, latLng },
  // 認可メタ（pre_fixed_fare 時に意味を持つ）
  preFixedFareScope?: string,
  returnFareStatus?: string,
  preFixedFareConfirmable?: boolean,
  routeSelectionAvailable?: boolean,     // 新
  // レガシー互換フィールド（段階的廃止）
  encodedPolyline?, selectedRouteId?, ...
}
```

#### FareInput（Fare Layer への入力）

```ts
{
  config: EstimateConfig,   // fareMode を含む
  state: {
    ...formSelections,
    routePlan: RoutePlan,
    roadType: string
  }
}
```

**Fare Layer は `config.fareMode` のみで計算方式を決定し、ルート取得方法は知らない。**

### 分離の原則

| 原則 | 内容 |
|------|------|
| 単方向依存 | Route → Fare のみ。Fare → Routes API 禁止 |
| 認可の局所化 | `preFixedFareConfirmable` の解釈は Fare/Handoff/予約層 |
| APIコスト制御 | `requestRouteCandidates` は呼び出し元（Presentation）が `fareMode` または設定で制御 |
| 後方互換 | `quoteSnapshot` の既存フィールドは deprecate せず拡張のみ |

### 現状からの移行で触るファイル（認可取得後）

| 優先度 | ファイル | 変更内容 |
|--------|----------|----------|
| P1 | `estimate-distance-api.js` | フラグ改名、戻り値に `routeSelectionAvailable` 追加 |
| P1 | `estimate-main.js` | UIゲートを `routeSelectionAvailable` へ、取得トリガーは当面 `pre_fixed_fare` 維持可 |
| P2 | `estimate-calc.js` | `quoteSnapshot` 拡張、判定ヘルパー分離 |
| P2 | `estimate-route-map-display.js` | 変更なし（`routePlan` 入力のまま） |
| P3 | 新規 `estimate-route-service.js` | `buildStructuredRoutePlan` / `selectRoute` を UI から抽出 |
| P3 | `estimate-pdf.js` | 変更なし |
| P3 | `shared/pre-fixed-fare-report-data.js` | 認可説明のフィールド名更新 |

---

## ④ 事前確定運賃モードで再利用できる `routePlan` 構造の確認

### 結論

**`routePlan` 構造は将来の運賃方式でも距離・時間・ルート形状の入力として再利用可能。**  
ただし **認可専用フィールド** は `pre_fixed_fare` 時のみ解釈すべき。

### 構造化ルート（往復・現行の主経路）

`isStructuredRoutePlan(routePlan)` = `routePlan.outboundRoutePlan` が存在

```
routePlan
├── tripType                    … 全 fareMode で利用可
├── returnPlanType              … 往復時。全 fareMode で利用可
├── outboundRoutePlan (Leg)     … 往路
├── returnRoutePlan (Leg)       … 復路（任意）
├── totalDistanceMeters         … ★ 料金計算の主入力
├── totalDurationSeconds        … ★ 時間制・distance_time で利用
├── pickup / destination        … 地図・交通圏・表示
├── preFixedFareScope           … △ pre_fixed_fare 専用
├── returnFareStatus            … △ pre_fixed_fare 専用
├── preFixedFareConfirmable     … △ pre_fixed_fare 専用
└── (legacy flat fields)        … 後方互換。段階的廃止候補
```

### Leg（`outboundRoutePlan` / `returnRoutePlan`）

```
Leg
├── origin / destination / waypoint
├── selectedRouteId
├── routes[] / routeCandidates[]   … 候補一覧
├── distanceMeters / durationSeconds
├── encodedPolyline / routeToken   … 地図・PDF
├── roadType                       … 全 fareMode（有料道路実費表示等）
├── routeStrategy / routeLabel     … UI表示
├── preFixedFareConfirmable        … △ 認可専用
└── fallbackReason
```

### 各 fareMode が `routePlan` から消費するフィールド

| fareMode | 消費フィールド | 現状 |
|----------|----------------|------|
| `distance` | `totalDistanceMeters` → `getEffectiveBilledDistanceKm` | **利用済み** |
| `distance_time` | 距離＋`totalDurationSeconds` → 時間ブロック加算 | **利用済み** |
| `time` | `totalDurationSeconds` → `getEffectiveRideMinutes` | **利用済み** |
| `pre_fixed_fare` | 上記＋交通圏係数＋認可メタ | **利用済み** |
| （将来追加） | `totalDistanceMeters` / `totalDurationSeconds` / `roadType` | **追加可能** |

`estimate-calc.js` の `getEffectiveBilledDistanceKm` / `getEffectiveRideMinutes` は **すでに `routePlan` 優先** であり、fareMode 非依存の読み取り層になっている。

### フラット `routePlan`（片道・レガシー）

`outboundRoutePlan` なしの単一オブジェクト。後方互換用。

- 地図・PDF・概算は動作する
- 往復構造化・色分け・双方向候補は `outboundRoutePlan` / `returnRoutePlan` が必要

**将来の運賃方式追加時も、往復は構造化 `routePlan` を標準とする。**

### quoteSnapshot への投影

`computeEstimate()` は `buildStructuredRoutePlanSnapshot(state)` を `quoteSnapshot.routePlan` に格納。

含まれる情報:

- `outboundRoutePlan` / `returnRoutePlan`（各 Leg のスナップショット）
- `totalDistanceMeters` / `totalDurationSeconds`
- 選択ルートID・polyline・候補一覧
- `preFixedFareConfirmable`（認可）

**handoff・PDF・予約は `quoteSnapshot.routePlan` または `state.routePlan` を参照するため、fareMode を増やしてもルート形状の保存形式は流用可能。**

### 再利用時に注意するフィールド（pre_fixed 専用）

| フィールド | 他 fareMode での扱い |
|------------|---------------------|
| `preFixedFareConfirmable` | 無視または常に false |
| `preFixedFareScope` | 無視 |
| `returnFareStatus` | 表示用にのみ流用可（「復路確認対応」等） |
| `preFixedFareMode` (quoteSnapshot) | fareMode の写し。判定は `fareMode` を正とする |

---

## 認可取得後リファクタリングロードマップ（案）

| Phase | 内容 | リスク | 現段階 |
|-------|------|--------|--------|
| 0 | 現状維持：`pre_fixed_fare` のみ候補取得・表示 | — | **実施中** |
| 1 | 名称変更：`requestRouteCandidates` 導入＋旧名エイリアス | 低 | 候補 |
| 2 | `routeSelectionAvailable` 追加。UI判定の内部整理 | 低 | 候補 |
| 3 | `selectRoute` / 候補UI の confirmable 分岐を fareMode 別に | 中 | 候補 |
| 4 | Route Service 層抽出（`estimate-route-service.js`） | 中 | 候補 |
| 5 | 全 fareMode で候補取得（APIコスト増・設定フラグ化） | 高 | **保留** |
| 6 | `roadType` ラジオ廃止・候補UI完全置換 | 中 | 候補 |

---

## 非対象（本設計では実施しない）

- 現段階での `fareMode` 横断候補表示の実装
- `estimate-config.json` の `fareMode` 変更
- Routes API 呼び出し回数の増加
- 料金計算ロジック・認可ロジックの変更
- quoteSnapshot 既存フィールドの削除

---

## 関連ドキュメント

- [route-candidate-selection-ui.md](./route-candidate-selection-ui.md) — STEP6 候補UIの初期設計
- [shared/pre-fixed-fare-report-data.js](../../shared/pre-fixed-fare-report-data.js) — 認可要件エビデンス

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-25 | 初版作成（設計のみ、コード未変更） |
