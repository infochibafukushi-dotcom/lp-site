# 事前確定運賃M 運用・監査説明資料

**運輸局提出用 運用・監査説明資料**

---

## 1. 事前確定運賃Mの概要

| 項目 | 内容 |
|------|------|
| 対象 | 介護タクシーLP／見積シミュレーター／メーターアプリ（care-taxi-meter） |
| 目的 | 事前確定運賃Mの本番運用フロー、データ保存、整合性確認、監査証跡を説明する |
| 対象URL | https://infochibafukushi-dotcom.github.io/lp-site/estimate/ |
| メーターアプリ | https://infochibafukushi-dotcom.github.io/care-taxi-meter/ |
| 資料の位置づけ | 運輸局への提出用説明資料（本資料は認可の可否を断定するものではない） |

本資料は、LP見積からメーターアプリによる事前確定運賃M運行・精算・完了までの一連の本番運用を、運用・監査の観点から説明するものです。

---

## 10. 旅客都合変更時の基本運用

事前確定運賃Mにおいて、運行開始後に旅客都合で走行ルート変更、予定外の立ち寄り追加、目的地変更、または当初選択した走行予定ルートから外れる変更が発生した場合は、その時点で事前確定運賃による運送を終了する。

この場合、当初同意済みの事前確定運賃額を収受し、以後の運送は通常メーター等による別運送として新規に開始する。

### 途中終了のトリガー

- 走行ルート変更（旅客都合）
- 予定外の立ち寄り追加
- 目的地変更
- 当初選択した走行予定ルートから外れる変更

---

## 11. 金額の扱い

- 当初の事前確定運賃額は変更しない
- 途中までの距離による割引・距離割りは行わない
- 途中までの時間による再計算は行わない
- 通常メーター分を同じ事前確定運賃記録に加算しない
- 変更後の運送は別案件・別運行として記録する

---

## 12. メーターアプリ上の操作導線

- 事前確定運賃Mの運行中のみ「旅客都合変更で途中終了」ボタンを表示
- GPSM / 時間M / OBDM では表示しない
- 押下時に確認ダイアログを表示
- 確定後、精算前画面へ進む
- 当初固定運賃額は変更しない
- 精算完了後、通常メーターで新規運行を開始する導線を表示

---

## 13. 保存される監査証跡

### caseRecords 側

| フィールド | 値 |
|-----------|-----|
| status | completed_with_passenger_change |
| fareMode | pre_fixed_fare |
| completionReason | passenger_requested_route_change |
| preFixedFareException | 例外情報オブジェクト |
| reservationId | 対象予約ID |
| confirmedFareYen | 当初確定運賃（円） |
| snapshotHash | 同意スナップショットハッシュ |
| 監査ログ | pre_fixed_fare_passenger_change |

### reservation-v4 / D1 側（旅客都合途中終了）

| フィールド | 値 |
|-----------|-----|
| meter_fixed_fare_runs.status | completed |
| completion_status | completed_with_passenger_change |
| completion_reason | passenger_requested_route_change |
| pre_fixed_fare_exception_json | JSON文字列 |

### 通常完了の場合

| フィールド | 値 |
|-----------|-----|
| completion_status | completed |
| completion_reason | normal_completed |
| pre_fixed_fare_exception_json | null |

---

## 14. 通常完了との判別方法

### 通常完了

| フィールド | 値 |
|-----------|-----|
| caseRecords.status | completed |
| fixedFareCompletionStatus | completed |
| fixedFareCompletionReason | normal_completed |
| preFixedFareException | なし |
| 表示 | 事前確定M 完了 |

### 旅客都合途中終了

| フィールド | 値 |
|-----------|-----|
| caseRecords.status | completed_with_passenger_change |
| fixedFareCompletionStatus | completed_with_passenger_change |
| fixedFareCompletionReason | passenger_requested_route_change |
| preFixedFareException | あり |
| 表示 | 事前確定M 旅客都合途中終了 |

---

## 15. 予約詳細・管理画面の表示

### 旅客都合途中終了時の表示項目

- 事前確定M 旅客都合途中終了
- 事前確定運賃M：旅客都合によるルート変更・立ち寄り追加のため途中終了
- 終了理由
- 終了日時
- 当初事前確定運賃
- fareMode: pre_fixed_fare
- 以後の運送：通常メーター等の別運送として開始
- 終了地点
- 備考

### 通常完了時

通常完了では従来どおり「事前確定M 完了」と表示し、途中終了パネルは表示しない。

---

## 9. 本番E2E確認結果（更新）

### 確認済み予約ID

| 区分 | 予約ID | 表示ラベル |
|------|--------|-----------|
| 通常完了 | 209906021400 | 事前確定M 完了 |
| 旅客都合途中終了 | 209906041030 | 事前確定M 旅客都合途中終了 |

### 確認内容

- 通常完了予約は「事前確定M 完了」と表示
- 旅客都合途中終了予約は「事前確定M 旅客都合途中終了」と表示
- complete-fixed-fare API が completionStatus / completionReason / preFixedFareException を受信
- D1 に completion_status / completion_reason / pre_fixed_fare_exception_json を保存
- 予約詳細APIで fixedFareCompletionStatus / fixedFareCompletionReason / preFixedFareException を返却
- 通常完了予約への影響なし
- test:phase5 18/18 PASS

---

## 16. 運用開始前の目視確認項目

コード・API・D1・予約詳細表示の動作は確認済み。以下は運用開始前の目視確認項目として整理する。

- 管理画面の目視確認は運用者ログイン後に確認予定
- 案件詳細の実機目視確認は運用者ログイン後に確認予定
- GPSM / 時間M / OBDM の実機回帰確認は運用開始前確認項目として実施予定

---

*本資料は運輸局提出用の運用・監査説明資料です。最終的な申請書類への転記・体裁調整は、申請担当者が行ってください。*
