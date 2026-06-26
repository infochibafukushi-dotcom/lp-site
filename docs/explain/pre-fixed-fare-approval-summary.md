# 事前確定運賃システム説明資料

**認可申請時の説明資料（たたき台）**

---

## 1. 表紙・概要

| 項目 | 内容 |
|------|------|
| 対象 | 介護タクシーLP／見積シミュレーター |
| 目的 | 利用者が乗車前に走行予定ルート候補と概算運賃を確認し、候補から1つを選択したうえで予約に進める仕組みを説明する |
| 対象URL | https://infochibafukushi-dotcom.github.io/lp-site/estimate/ |
| 対象コミット | `1b40ce8` |
| 資料の位置づけ | 運輸局への認可説明用資料（本資料は認可の可否を断定するものではない） |

本資料は、事前確定運賃に関するシステムの動作・判定ロジック・証跡保存の仕組みを、Phase 2 および Phase 3-B の実装と検証結果に基づいて説明するものです。

---

## 2. システム全体フロー

利用者が見積シミュレーターを利用してから予約に進むまでの流れは、以下のとおりです。

1. **利用者が移動方法・介助内容・送迎方法を選択する**  
   例：無料車いす、乗降介助、階段介助なし、片道／往復、待機の有無など。

2. **出発地・目的地・必要に応じて立ち寄り先を入力する**  
   住所または施設名を入力し、走行ルートの計算対象とする。

3. **Google Routes API により走行予定ルート候補を取得する**  
   時間優先・一般道優先・高速道路利用など、複数の算定条件で候補を生成する。

4. **時間優先・一般道優先・高速道路ルート等を候補として表示する**  
   2件以上の候補がある場合、利用者に一覧表示する。帰り立ち寄りありの場合は全体走行予定ルート候補として表示する。

5. **利用者が候補から1つを選択する**  
   選択前は見積確定・予約導線へは進まない設計とする。

6. **選択されたルート距離・予定時間に基づき見積額を算定する**  
   事前確定運賃方式の距離運賃・介助料等を組み合わせて概算額を表示する。

7. **結果画面・PDF・quoteSnapshot・handoff に証跡を保存する**  
   選択内容、候補一覧、距離、予定時間、ルート生成条件、利用者選択結果を記録する。

8. **候補2件以上・選択済みなら通常予約導線へ進む**  
   `preFixedFareConfirmable = true` とし、予約URLに `fareConfirm=review` を付けない。ボタン文言は「この内容で予約する」。

9. **候補1件のみなら確認対応として予約導線へ進む**  
   `preFixedFareConfirmable = false` とし、予約URLに `fareConfirm=review` を付ける。ボタン文言は「確認対応として予約へ進む」。

---

## 3. 判定ロジック

| 条件 | システム判定 | 予約URL | ボタン文言 | 扱い |
|------|-------------|---------|-----------|------|
| 候補2件以上・利用者が1つ選択 | `preFixedFareConfirmable = true` | `fareConfirm=review` なし | この内容で予約する | 事前確定運賃候補 |
| 候補1件のみ | `preFixedFareConfirmable = false` | `fareConfirm=review` あり | 確認対応として予約へ進む | 確認対応 |
| 帰り立ち寄りあり・全体候補2件以上・選択済み | `preFixedFareConfirmable = true` | `fareConfirm=review` なし | この内容で予約する | 全体走行予定ルートとして事前確定運賃候補 |

### 補足

- 判定は `quoteSnapshot.preFixedFareConfirmable` および `overallRouteSelection.preFixedFareConfirmable` に反映される。
- 候補1件時は `fallbackReason: only_one_distinct_route` 等を記録し、確認対応である理由を画面・PDF・JSON に残す。
- 有料道路を含む候補を選択した場合でも、候補数が2件以上であれば事前確定運賃候補として扱う。有料道路料金自体は見積料金に含めない。

---

## 4. ルート候補の種類

本システムでは、電子地図APIの取得条件に応じて、以下のような走行予定ルート候補を生成・表示します。

### 時間優先ルート

所要時間を優先して算定した走行予定ルート。  
`routeStrategy: time_priority`、`generationReason: time_priority_route` として証跡に保存する。

### 一般道優先ルート

有料道路・高速道路を避け、一般道を優先して算定した走行予定ルート。  
`routeStrategy: general_road_priority`、`generationReason: general_road_priority_route` として証跡に保存する。

### 高速道路ルート

高速道路・有料道路を利用することで所要時間短縮を見込む走行予定ルート。  
`routeStrategy: toll_allowed`、`generationReason: toll_allowed_route` として証跡に保存する。  
有料道路料金は見積料金に含まず、別途必要であることを画面・PDF上で明示する（「有料道路料金は見積料金に含まれず、別途必要です。」）。

### 主要道路優先ルート

主要道路または主要経由地点を明示して算定する候補。Phase 3-B 時点では主に設計済みであり、今後の拡張候補として位置づける。

### 候補の重複整理（dedupe）

API取得結果が実質同一であっても、算定条件（`routeStrategy` / `generationReason`）が異なる候補は `dedupeDecision: kept` として保持し、条件差を証跡化する。同一と判断した候補は `dedupeDecision: dropped` として記録する。

---

## 5. 候補1件時の扱い

電子地図APIの結果や経路条件により、実質的に異なる走行予定ルート候補が1件のみとなる場合があります。

この場合、本システムでは事前確定運賃候補としては扱わず、確認対応として予約に進む設計としています。

これにより、2以上の走行予定ルート候補から利用者が選択できない場合に、事前確定運賃として断定しない安全側の運用としています。

### 画面・予約導線上の表現

- 結果画面に「ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。」等の文言を表示する。
- 予約URLに `fareConfirm=review` を付与する。
- 予約ボタンは「確認対応として予約へ進む」とする。

### Phase 2 証跡による確認例

- 往復・帰り立ち寄りありで全体候補が1件のみとなったケース（`docs/evidence/pre-fixed-fare-phase2/case-c-*`）において、上記の確認対応フローが動作することを確認済み。

---

## 6. 帰り立ち寄りありの説明

往復・帰り立ち寄りあり（`return_with_stop`）の場合、単に復路だけを候補表示するのではなく、

**出発地 → 目的地 → 立ち寄り先 → 出発地**

の全体走行予定ルートとして候補を合成・表示します。

利用者は「立ち寄り先 → 出発地」だけを選ぶのではなく、往路・立ち寄り区間を含む全体走行予定ルート候補から1つを選択します。

### 内部構造の概要

- **往路**：出発地 → 目的地（共通区間として固定）
- **復路共通区間**：目的地 → 立ち寄り先（全候補で共通）
- **復路選択区間**：立ち寄り先 → 出発地（候補ごとに異なる走行予定ルート）

上記を合成した `overallRouteCandidates` を一覧表示し、利用者が `selectedOverallRouteId` で1件を選択します。

### 結果画面の表現

- 全体候補2件以上・選択済みの場合：「全体走行予定ルート：事前確定運賃候補（選択済み）」を表示する。
- PDF にも全体走行予定ルート・共通区間・選択区間の情報を含める。

---

## 7. quoteSnapshot / handoff の証跡

見積結果には **quoteSnapshot** を保存します。  
quoteSnapshot には、選択されたルート、候補一覧、選択ID、距離、予定時間、ルート生成条件、dedupe結果などを保存します。

**handoff** は予約システムへ引き継ぐためのJSONであり、`sessionStorage.lp_estimate_handoff` に保存されます。handoff 内の `quoteSnapshot` フィールドに、見積時点のルート選択証跡が含まれます。

### 代表フィールド

| フィールド | 説明 |
|-----------|------|
| `estimateNo` | 見積番号（予約URL引き継ぎ用） |
| `preFixedFareConfirmable` | 事前確定運賃候補として確定可能か |
| `routeCandidates` | 表示・保存された走行予定ルート候補一覧 |
| `selectedRouteId` | 利用者が選択したルートID |
| `routeStrategy` | 候補ごとの算定戦略（`time_priority` 等） |
| `routeLabel` | 候補の表示名（時間優先ルート 等） |
| `generationReason` | 候補生成理由（`time_priority_route` 等） |
| `dedupeDecision` | 重複整理結果（`kept` / `dropped`） |
| `usesToll` | 有料道路利用の有無 |
| `distanceMeters` | 選択ルートの距離（メートル） |
| `durationSeconds` | 選択ルートの予定時間（秒） |
| `overallRouteSelection` | 帰り立ち寄り時の全体走行予定ルート選択情報 |
| `overallRouteCandidates` | 全体走行予定ルート候補一覧 |
| `selectedOverallRouteId` | 利用者が選択した全体ルートID |

### 保存先の関係

```text
結果画面到達
  → sessionStorage.lp_estimate_handoff（handoff 全体）
      → handoff.quoteSnapshot（見積証跡）
  → PDF生成（選択ルート・候補・ステータス文言を含む）
  → 予約URL（estimateNo、必要時 fareConfirm=review）
```

---

## 8. 証跡ファイル一覧

実装・画面確認の証跡は、以下のフォルダに保存しています。

| フォルダ | 内容 |
|---------|------|
| `docs/evidence/pre-fixed-fare-phase2/` | Phase 2：全体走行予定ルート・候補1件時の確認対応 |
| `docs/evidence/pre-fixed-fare-phase3/` | Phase 3-B：時間優先／一般道優先2候補、高速道路候補、帰り立ち寄り回帰 |

各フォルダに `phase*-evidence-summary.md` があり、ケースごとの検証結果をまとめています。

### Phase 3-B 証跡（主要）

| ケース | 内容 | PDF | quoteSnapshot | handoff | screenshot |
|--------|------|-----|---------------|---------|------------|
| 短距離 | 時間優先 / 一般道優先の2候補 | `case-1-short-distance.pdf` | `case-1-quote-snapshot.json` | `case-1-handoff.json` | `case-1-short-distance-screen.png` |
| 長距離 | 時間優先 / 一般道優先 / 高速道路ルート | `case-2-long-distance.pdf` | `case-2-quote-snapshot.json` | `case-2-handoff.json` | `case-2-long-distance-screen.png` |
| 帰り立ち寄り | 全体走行予定ルート候補 | `case-3-return-with-stop.pdf` | `case-3-quote-snapshot.json` | `case-3-handoff.json` | `case-3-return-with-stop-screen.png` |

いずれも `docs/evidence/pre-fixed-fare-phase3/` 配下に保存。

### Phase 2 証跡（補足）

| ケース | 内容 | 主なファイル |
|--------|------|-------------|
| ケースB | 全体候補2件以上・選択済み | `case-b-overall-two-candidates.pdf` 他 |
| ケースC | 全体候補1件・確認対応 | `case-c-single-candidate-review.pdf` 他 |

いずれも `docs/evidence/pre-fixed-fare-phase2/` 配下に保存。

### 関連コミット

| コミット | 内容 |
|---------|------|
| `1b40ce8` | 事前確定運賃 Phase 3-B の証跡を追加 |
| `1c259bd` | 候補2件以上でルート選択後に結果画面へ進めるよう修正 |
| `9c38984` | 時間優先と一般道優先のルート候補取得を追加 |
| `a85f895` | 事前確定運賃 Phase 3 の GO型2候補設計を追加 |
| `22bc145` | 事前確定運賃 Phase 2 の証跡を追加 |
| `5b68e0b` | 全体ルート選択時の確認対応表示を整理 |

---

## 9. 認可説明用の要約文

本システムでは、電子地図APIにより、時間優先・一般道優先・高速道路利用等の条件で走行予定ルート候補を生成します。

利用者は表示された走行予定ルート候補から1つを選択し、選択されたルートの距離・予定時間に基づき見積額が算定されます。

有料道路を含む候補については、有料道路料金が見積料金に含まれず、別途必要であることを明示します。

候補が1件のみの場合は、事前確定運賃候補としては扱わず、確認対応として予約に進む設計としています。

選択内容、候補一覧、距離、予定時間、ルート生成条件、利用者選択結果は、PDF・quoteSnapshot・handoff に保存され、後から確認できる証跡として保持されます。

---

## 10. 本資料が説明する7点との対応

| 説明すべき事項 | 本資料での説明箇所 |
|---------------|-------------------|
| 2以上の走行予定ルート候補を表示できること | セクション2・4・8（Phase 3-B 短距離・長距離証跡） |
| 利用者が候補から1つを選択できること | セクション2（ステップ5）・3 |
| 選択した走行予定ルートに基づいて運賃を算定していること | セクション2（ステップ6）・7 |
| 候補1件の場合は確認対応とする安全側の処理 | セクション3・5（Phase 2 ケースC 証跡） |
| 時間優先・一般道優先・高速道路ルート等の条件差を証跡として保存していること | セクション4・7（`routeStrategy` / `generationReason` / `dedupeDecision`） |
| PDF・quoteSnapshot・handoff に選択内容が残ること | セクション2（ステップ7）・7・8 |
| 帰り立ち寄りありでも S→G→立ち寄り→S の全体走行予定ルート候補として扱うこと | セクション6・8（Phase 2 ケースB / Phase 3-B ケース3 証跡） |

---

*本資料は認可申請時の説明資料（たたき台）です。最終的な申請書類への転記・体裁調整は、申請担当者が行ってください。*
