# 事前確定運賃 Phase 3-B 証跡サマリー

## 対象

- リポジトリ：`infochibafukushi-dotcom/lp-site`
- 最新コミット：`1c259bd`（Phase 3-B GO型2候補生成・表示対応）
- Git状態：証跡保存時点で HEAD `1c259bd`、作業ツリーは証跡ファイル追加のみ（未コミット）
- GitHub Pages URL：https://infochibafukushi-dotcom.github.io/lp-site/estimate/?v=1c259bd
- 検証日：2026-06-26

## Phase 3-B の目的

GO型に近い「時間優先ルート」「一般道優先ルート」を生成し、短距離でも2候補表示できるケースを増やす。

## ケース1：短距離・GO型2候補

- 入力条件：
  - 片道
  - 出発地：パールホテル新宿曙橋
  - 目的地：東京女子医科大学病院
  - STEP1〜5：無料車いす / 乗降介助 / 階段介助なし / 片道
- estimateNo：`EST-20260626-6995`
- 候補数：**2**
- 表示名：**時間優先ルート** / **一般道優先ルート**
- selectedRouteId：**`route_0`**（時間優先ルート）
- preFixedFareConfirmable：**true**
- fareConfirm=review：**なし**
- 予約ボタン：**「この内容で予約する」**
- 予約URL：`https://infochibafukushi-dotcom.github.io/reservation-v4/?source=estimate&estimateNo=EST-20260626-6995`
- quoteSnapshot証跡：
  - `routeCandidates` に `time_priority` / `general_road_priority`
  - `generationReason`：`time_priority_route` / `general_road_priority_route`
  - `dedupeDecision`：`kept` / `kept`
- PDF：生成OK（`EstimatePdf.buildPreviewElement` → A4 PDF）
- 保存ファイル：
  - `case-1-short-distance-screen.png`
  - `case-1-short-distance.pdf`
  - `case-1-quote-snapshot.json`
  - `case-1-handoff.json`

## ケース2：長距離・高速道路候補あり

- 入力条件：
  - 片道
  - 出発地：千葉市中央区出洲港8-3-2
  - 目的地：東京ディズニーランド
  - STEP1〜5：無料車いす / 乗降介助 / 階段介助なし / 片道
- estimateNo：`EST-20260626-2431`
- 候補数：**3**
- 表示名：**時間優先ルート** / **一般道優先ルート** / **高速道路ルート**
- selectedRouteId：**`route_2`**（高速道路ルート）
- usesToll：**true**（選択ルート）
- 有料道路注記：**「有料道路料金は見積料金に含まれず、別途必要です。」** 表示あり
- preFixedFareConfirmable：**true**
- fareConfirm=review：**なし**
- 予約ボタン：**「この内容で予約する」**
- 予約URL：`https://infochibafukushi-dotcom.github.io/reservation-v4/?source=estimate&estimateNo=EST-20260626-2431`
- quoteSnapshot証跡：
  - `routeCandidates` に `time_priority` / `general_road_priority` / `toll_allowed`
  - `generationReason` / `dedupeDecision` 保存済み（いずれも `kept`）
- PDF：生成OK
- 保存ファイル：
  - `case-2-long-distance-screen.png`
  - `case-2-long-distance.pdf`
  - `case-2-quote-snapshot.json`
  - `case-2-handoff.json`

## ケース3：return_with_stop 回帰

- 入力条件：
  - 往復 / 帰りに立ち寄る
  - 出発地：千葉市中央区出洲港8-3-2
  - 目的地：東京ディズニーランド
  - 立ち寄り：船橋市立医療センター
  - STEP1〜5：無料車いす / 乗降介助 / 階段介助なし / 往復 / 待機30分
- estimateNo：`EST-20260626-7562`
- overallRouteCandidates.length：**2**
- 全体候補表示名：**時間優先ルート** / **高速道路ルート**
- selectedOverallRouteId：**`overall_0`**
- preFixedFareConfirmable：**true**
- fareConfirm=review：**なし**
- 予約ボタン：**「この内容で予約する」**
- 予約URL：`https://infochibafukushi-dotcom.github.io/reservation-v4/?source=estimate&estimateNo=EST-20260626-7562`
- 結果画面表示：
  - 「全体走行予定ルート：事前確定運賃候補（選択済み）」
  - 全体ルートパス（出発地 → 目的地 → 立ち寄り先 → 出発地）選択済み表示
- PDF：全体走行予定ルート・選択ルート・全体ステータス表示を含む（生成OK）
- 保存ファイル：
  - `case-3-return-with-stop-screen.png`
  - `case-3-return-with-stop.pdf`
  - `case-3-quote-snapshot.json`
  - `case-3-handoff.json`

## 判断

- 短距離：**合格** — 2候補（時間優先 / 一般道優先）表示、`preFixedFareConfirmable=true`、`fareConfirm=review` なし、quoteSnapshot に算定条件差（`routeStrategy` / `generationReason` / `dedupeDecision`）保存
- 長距離：**合格** — 3候補表示、高速道路ルート選択可、有料道路注記あり、`preFixedFareConfirmable=true`、`fareConfirm=review` なし
- return_with_stop：**合格** — 全体候補2件、選択済み表示、Phase 2 回帰要件を満たす
- Phase 3-B 完了判断：**完了可** — 3ケースとも期待結果・確認項目を満たす

## 補足

- 候補が同距離・同時間でも、`routeStrategy` / `generationReason` / `dedupeDecision` を保存して算定条件差を証跡化
- 有料道路料金は見積料金に含めず、別途必要であることを明示
- 本証跡は GitHub Pages 実API（`1c259bd` 反映環境）で取得
- 証跡取得は Puppeteer による自動操作（結果画面到達 → スクリーンショット / PDF / sessionStorage JSON 保存）
