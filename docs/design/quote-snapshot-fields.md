# quoteSnapshot フィールド定義（事前確定運賃・ルート候補）

| 項目 | 内容 |
|------|------|
| ステータス | **現行仕様のドキュメント** |
| 作成日 | 2026-06-25 |
| 目的 | `quoteSnapshot` の認可・監査用フィールドの意味を明文化し、画面・PDF・予約連携との整合を保つ |

---

## 概要

`quoteSnapshot` は `estimate/estimate-calc.js` の `computeEstimate()` で組み立てられ、handoff・PDF・予約連携・認可説明資料の証跡として利用される。

事前確定運賃モード（`fareMode: pre_fixed_fare`）では、ルート候補の取得結果に応じて **確定可能** か **確認対応** かをフィールドで記録する。

---

## フィールド定義

### `preFixedFareConfirmable`

| 属性 | 内容 |
|------|------|
| 型 | `boolean` |
| スコープ | トップレベル（往復集約）および各レッグ（`outboundRoutePlan` / `returnRoutePlan`） |
| 意味 | **事前確定運賃として確定可能か** |
| `true` の条件 | 対象レッグで実質的に異なるルート候補が **2件以上** 取得できた場合 |
| `false` の条件 | 候補が1件のみ、候補0件、復路が帰り未定で往路のみ確定可能な場合の集約判定 等 |

**利用箇所**

- 結果画面：往路/復路の「事前確定運賃候補」または「確認対応」表示
- 予約URL：`false` のとき `fareConfirm=review` を付与（`estimate-main.js` `getReservationUrl()`）
- PDF・handoff：証跡として JSON に保存

**注意**

- `true` は「法的に確定済み」ではなく「旅客が複数候補から選択し、事前確定運賃として算定可能な状態」を示す。
- 料金計算ロジック自体はこのフラグに依存しない（距離・時間は選択ルートから算出）。

---

### `routeCandidates`（および `routeCandidates.length`）

| 属性 | 内容 |
|------|------|
| 型 | `RouteCandidate[]` |
| スコープ | トップレベル（片道レガシー）および各レッグ |
| 意味 | Google Routes API から取得し、重複除去後に残った **実質的な候補一覧** |
| `length` の意味 | 取得できた実質的な候補数 |

**判定との関係**

| `routeCandidates.length` | `preFixedFareConfirmable` | 画面表示 |
|--------------------------|---------------------------|----------|
| 0 | `false` | エラー／候補なし |
| 1 | `false` | 確認対応 |
| 2以上 | `true` | 事前確定運賃候補（旅客選択後） |

**注意**

- 候補が1件のとき、偽の第2候補は **作らない**（`estimate-distance-api.js` の重複除去後の件数をそのまま記録）。
- レッグ単位の `routeCandidates` とトップレベルの `routeCandidates` は、片道/往復・構造化の有無で参照先が異なる場合がある。監査時は `outboundRoutePlan` / `returnRoutePlan` を正とする。

---

### `fallbackReason`

| 属性 | 内容 |
|------|------|
| 型 | `string \| null` |
| スコープ | トップレベルおよび各レッグ |
| 意味 | 候補不足など、**事前確定運賃として確定できない理由** |

**現行の値**

| 値 | 意味 |
|----|------|
| `null` | 確定可能（`preFixedFareConfirmable === true`） |
| `"only_one_distinct_route"` | 重複除去後に実質的に異なるルートが1件のみ |

**注意**

- 画面では主に `preFixedFareConfirmable` と組み合わせて「確認対応」文言を出す。`fallbackReason` 自体は利用者向けラベルには直接出さない（証跡・分析用）。
- 表示モジュール（`shared/pre-fixed-fare-status.js`）は候補数判定に `routeCandidates` を優先し、`fallbackReason: "only_one_distinct_route"` も参照する（`routes` 配列との件数不一致を避ける）。
- 将来、API失敗・ジオコーディング失敗等の理由コードを追加する場合は **既存値を維持** し拡張する。

---

### `returnFareStatus`

| 属性 | 内容 |
|------|------|
| 型 | `string \| null` |
| スコープ | トップレベル（往復時のみ） |
| 設定箇所 | `estimate-main.js` `buildStructuredRoutePlan()` |

**現行の値と意味**

| 値 | 意味 |
|----|------|
| `null` | 片道、または往復でない |
| `"review_required"` | 復路が帰り未定（`returnPlanType: return_pending`）。事前確定運賃の対象外 |
| `"fixed_candidate"` | 復路ルートが計算済み（`returnRoutePlan` が存在） |

**名前に関する注意（重要）**

`fixed_candidate` は **「事前確定運賃として確定可能」ではない**。

- 復路のルート計算が完了したことを示すステータス名である。
- 候補が1件のみの場合、`returnFareStatus` は `"fixed_candidate"` でも `returnRoutePlan.preFixedFareConfirmable` は `false` となり、画面・PDFでは **確認対応** と表示する。
- この不一致が監査・開発時の混乱要因となるため、本ドキュメントで意味を固定する。

**`preFixedFareConfirmable` との使い分け**

| フィールド | 主な用途 |
|------------|----------|
| `preFixedFareConfirmable` | 確定可否の **正** とする boolean。予約URL・画面表示はこちらを参照 |
| `returnFareStatus` | 復路の **計算状態**（未定 / 計算済み）の区分。表示は補助的に利用可 |

---

## 往復・立ち寄り関連フィールド

### `returnPlanType`

| 値 | 意味 |
|----|------|
| `same_return` | 同一経路で帰る |
| `return_with_stop` | 帰りに立ち寄る（復路：目的地 → 立ち寄り先 → 出発地） |
| `different_return_destination` | 帰り先が異なる |
| `return_pending` | 帰り未定（復路は確認対応） |

### `preFixedFareScope`

| 値 | 意味 |
|----|------|
| `outbound_only` | 往路のみ事前確定運賃スコープ（帰り未定時） |
| `outbound_and_return` | 往路・復路ともスコープに含む |

---

## 予約URL連携

`preFixedFareConfirmable === false`（トップレベル）の場合：

```
fareConfirm=review
```

が予約URLに付与される。候補1件・帰り未定・往復のいずれか一方が非確定、など集約結果に従う。

---

## 将来的な整理案（破壊的変更は未実施）

`returnFareStatus` の `fixed_candidate` は誤解を招くため、将来次のような値へ整理できるか検討する。

| 案の値 | 意味 |
|--------|------|
| `route_calculated` | 復路ルート計算済み（現 `fixed_candidate` に相当） |
| `review_required` | 確認対応が必要（現行と同じ） |
| `confirmable` | 復路が事前確定運賃として確定可能 |
| `not_confirmable` | 復路計算済みだが候補不足等で確定不可 |

移行時は：

1. 新フィールド追加（例：`returnFareConfirmStatus`）
2. 予約側・レポート側を段階的に移行
3. `returnFareStatus` は deprecate 後に削除

**現段階では既存フィールド名を維持** し、本ドキュメントと画面表示で意味を補足する。

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `estimate/estimate-distance-api.js` | 候補生成・`preFixedFareConfirmable` / `fallbackReason` 設定 |
| `estimate/estimate-main.js` | `returnFareStatus` 集約・画面表示・予約URL |
| `estimate/estimate-calc.js` | `quoteSnapshot` 組み立て |
| `shared/pre-fixed-fare-status.js` | 画面・PDF共通の確認対応文言 |
| `docs/design/fare-mode-route-layer-refactor.md` | ルート層・認可層の分離設計（将来） |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-25 | 初版作成（`preFixedFareConfirmable` / `fallbackReason` / `returnFareStatus` の現行意味を明文化） |
| 2026-06-25 | 表示モジュールの候補数判定・PDF地図なし時の説明表示を追記 |
