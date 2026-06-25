# ルート候補選択UI 調査・設計案

## 目的

「道路利用設定」（一般道 / 高速）を、利用者が理解しやすい **ルート候補カード選択UI** に置き換える可否を調査する。

例:

```
ルート①（推奨）  一般道   約5.3km  約12分
ルート②          高速利用  約5.9km  約10分
```

---

## 調査結果

### 1. Routes API で複数ルート取得は可能か

**結論: 可能（既に実装済み）**

`estimate/estimate-distance-api.js` の `computePreFixedFareRouteCandidates()` は、事前確定運賃モード（`fareMode: pre_fixed_fare`）で以下4系統を生成している。

| 戦略 | ラベル | 取得方法 |
|------|--------|----------|
| recommended | おすすめルート | `computeAlternativeRoutes: true` で複数候補取得 |
| shorter_distance | 距離優先ルート | 候補プールから最短を選択 |
| arterial_road | 幹線道路ルート | 幹線waypoint経由で再リクエスト |
| toll_allowed | 有料道路利用ルート | `avoidTolls: false` で再リクエスト |

重複除去後、最大4件まで `routeCandidates` として返す。  
**2件以上** 取得できた場合のみ `preFixedFareConfirmable: true` となり、旅客選択が有効になる。

概算モード（`distance_time`）では単一ルートのみ返す実装。

### 2. 候補ごとに距離・時間は取得可能か

**結論: 可能（既に実装済み）**

各候補に以下が含まれる。

- `distanceMeters` / `distanceKm`
- `durationSeconds` / `durationMinutes`
- `routeLabel` / `routeDescription`
- `roadType`（general / toll）
- `encodedPolyline`（地図・PDF用）

結果画面の `renderRouteSelectionCards()` で距離・時間・有料道路利用有無を既に表示している。

### 3. quoteSnapshot 保存方法

**結論: 既存構造をそのまま利用可能**

ルート選択時に `selectRoute()` → `syncStateFromRoutePlan()` → `computeEstimate()` が走り、`quoteSnapshot` に以下が保存される。

- `selectedRouteId` / `selectedRouteLabel`
- `routeCandidates` / `alternativeRoutes`
- `encodedPolyline` / `distanceMeters` / `durationSeconds`
- `preFixedFareConfirmable`
- 往復時は `routePlan.outboundRoutePlan` / `returnRoutePlan` それぞれに選択ルート

**道路利用ラジオを廃止しても、選択された候補の `roadType` が quoteSnapshot に残るため、保存方式の変更は不要。**

### 4. PDF 保存方法

**結論: 既存のまま利用可能**

- 選択中ルートの `encodedPolyline` から Static Map を生成（`estimate-pdf.js`）
- 色分け凡例・マーカーは `EstimateRouteMapDisplay` 経由で反映済み
- ルート候補一覧そのものをPDFに載せる場合は、結果画面と同様のカードHTMLを `buildRouteMapHtml` 付近に追加するだけで対応可能

### 5. 既存構造を壊さず実装できるか

**結論: 可能。UI層の差し替えが中心**

| 層 | 変更 |
|----|------|
| Routes API / 距離計算 | 変更不要 |
| quoteSnapshot / 認可 | 変更不要 |
| `roadType` state | 内部では候補選択時に同期（後方互換） |
| STEP6 UI | 道路利用ラジオ削除 → ルート計算後に候補カード表示 |
| 結果画面 | 既存 `renderRouteSelectionSection` をSTEP6へ前倒し可能 |

---

## 設計案（実装フェーズ用）

### UIフロー

```
STEP6 走行ルート設定
  ├ 出発地・目的地入力
  ├ 「ルートを計算する」
  ├ 地図プレビュー（色分け・凡例）
  └ ルート候補カード（2件以上時）
       ルート① おすすめ  一般道  5.3km  12分  [選択]
       ルート② 高速利用    有料道  5.9km  10分  [選択]
```

### 道路利用ラジオとの関係

- **削除**: STEP6 の `roadType` ラジオ（一般道 / 高速）
- **代替**: 計算時は `avoidTolls` 固定または両系統を同時取得（現行 pre_fixed ロジック）
- **選択後**: 選んだ候補の `roadType` を `state.roadType` にミラー（既存ロジック互換）

### 表示ラベル案

| routeStrategy | 利用者向け表示 |
|---------------|----------------|
| recommended | ルート①（推奨） |
| shorter_distance | 距離が短いルート |
| arterial_road | 幹線道路ルート |
| toll_allowed | 高速・有料道路利用 |

各行に `一般道` / `高速利用` は `roadType` から自動表示（既存 `getRoadTypeLabel`）。

### 候補1件時

現行どおり `preFixedFareConfirmable: false` とし、

> 走行予定ルート候補が1件のみのため、事前確定運賃としての自動確定はできません。

を表示。道路利用ラジオに戻さない。

### 概算モード（distance_time）

複数候補を出さない現行仕様を維持。STEP6では地図＋距離表示のみ。

### 実装ステップ（次フェーズ）

1. STEP6 から `roadType` ラジオ削除
2. `calculateRouteDistance` 完了後、STEP6内に `renderRouteSelectionCards` をインライン表示
3. 候補選択で STEP6 完了扱い（または結果画面と役割分担を整理）
4. `state.roadType` を選択候補から自動同期
5. スマホ・PC・PDF・往復パターンの回帰確認

### リスク

| リスク | 対策 |
|--------|------|
| 計算ボタン2段階でUXが長い | 初回計算で候補＋地図を同時表示 |
| 往復で往路・復路それぞれ選択 | 現行どおり往路/復路セクションを分離（変更不要） |
| APIコスト増 | 現行4系統取得と同じ（増えない） |

---

## まとめ

**ルート候補選択UIは技術的に実現可能であり、バックエンド・quoteSnapshot・PDFの大幅変更は不要。**  
次フェーズでは STEP6 の「道路利用設定」ラジオを廃止し、既存の `renderRouteSelectionCards` をステップ内に統合するUI改善が最適。
