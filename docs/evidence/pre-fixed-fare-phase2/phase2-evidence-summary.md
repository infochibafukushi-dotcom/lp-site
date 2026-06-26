# 事前確定運賃 Phase 2 証跡サマリー

## 対象

- リポジトリ：`infochibafukushi-dotcom/lp-site`
- 最新コミット：`5b68e0b`（全体ルート選択時の確認対応表示を整理する）
- Git状態：証跡保存時点で HEAD `5b68e0b`、作業ツリーは証跡ファイル追加のみ（未コミット）
- GitHub Pages URL：https://infochibafukushi-dotcom.github.io/lp-site/estimate/?v=5b68e0b
- 検証日：2026-06-26

## ケースB：全体候補2件以上・選択済み

- 入力条件：
  - 往復 / 帰りに立ち寄る
  - 出発地：千葉市中央区出洲港8-3-2
  - 目的地：東京ディズニーランド
  - 立ち寄り：船橋市立医療センター
  - STEP1〜5：無料車いす / 乗降介助 / 階段介助なし / 往復 / 待機30分
- estimateNo：`EST-20260626-4193`
- overallRouteCandidates.length：**2**
- selectedOverallRouteId：**`overall_0`**
- preFixedFareConfirmable：**true**
- fareConfirm=review：**なし**
- 予約ボタン：**「この内容で予約する」**
- 予約URL：`https://infochibafukushi-dotcom.github.io/reservation-v4/?source=estimate&estimateNo=EST-20260626-4193`
- 結果画面表示：
  - 「全体走行予定ルート：事前確定運賃候補（選択済み）」
  - 全体ルートパス（出発地 → 目的地 → 立ち寄り先 → 出発地）選択済み表示
- PDF：
  - 「全体走行予定ルート：事前確定運賃候補（選択済み）」を含む
  - 全体走行予定ルート・共通区間・選択ルート情報を含む
- 保存ファイル：
  - `case-b-overall-two-candidates-screen.png`
  - `case-b-overall-two-candidates.pdf`
  - `case-b-quote-snapshot.json`
  - `case-b-handoff.json`

## ケースC：全体候補1件・確認対応

- 入力条件：
  - 往復 / 帰りに立ち寄る
  - 出発地：千葉市中央区出洲港8-3-2
  - 目的地：千葉メディカルセンター
  - 立ち寄り：蘇我駅
  - STEP1〜5：無料車いす / 乗降介助 / 階段介助なし / 往復 / 待機30分
- estimateNo：`EST-20260626-2598`
- overallRouteCandidates.length：**1**
- selectedOverallRouteId：**なし（null）**
- preFixedFareConfirmable：**false**
- fareConfirm=review：**あり**
- 予約ボタン：**「確認対応として予約へ進む」**
- 予約URL：`https://infochibafukushi-dotcom.github.io/reservation-v4/?source=estimate&estimateNo=EST-20260626-2598&fareConfirm=review`
- 結果画面表示：
  - 「ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。」
  - 「往路：確認対応」「復路：確認対応」
  - 立ち寄り復路の経路構造説明
- PDF：
  - 確認対応文言（1件のみの理由）を含む
  - `overallRouteSelection` に基づく全体走行予定ルート・共通区間・選択区間表示
  - `fallbackReason: only_one_distinct_route`
- 保存ファイル：
  - `case-c-single-candidate-review-screen.png`
  - `case-c-single-candidate-review.pdf`
  - `case-c-quote-snapshot.json`
  - `case-c-handoff.json`

## 判断

- 候補2件以上かつ選択済みの場合：
  - `preFixedFareConfirmable = true`
  - 予約URLに `fareConfirm=review` を付けない
  - 予約ボタンは「この内容で予約する」
  - 結果画面・PDFとも「全体走行予定ルート：事前確定運賃候補（選択済み）」を優先表示
- 候補1件の場合：
  - `preFixedFareConfirmable = false`
  - 予約URLに `fareConfirm=review` を付ける
  - 予約ボタンは「確認対応として予約へ進む」
  - 確認対応文言と全体ルート構造を画面・PDF・quoteSnapshot に残す
- 運用上の扱い：
  - 帰り立ち寄り（`return_with_stop`）では、利用者が選択するのは部分区間ではなく **全体走行予定ルート**
  - 候補2件以上では選択完了後に事前確定運賃候補として扱い、1件のみでは予約後確認対応とする

## 未確認・補足

- 片道・候補2件以上は、今回の住所ペア（出洲港8-3-2 → 船橋市立医療センター）＋一般道設定では Google Routes API が1候補のみ返したため、任意確認扱いとする
- 本証跡は GitHub Pages 実API（`5b68e0b` 反映環境）で取得
- 証跡取得は Puppeteer による自動操作（結果画面到達 → スクリーンショット / PDF / JSON 保存）
