# 事前確定運賃 認可資料用 画面キャプチャ取得記録シート

新規検証予約（TC-001 相当）で取得する4画面キャプチャの ID・金額・ファイル名を管理するための記録シートです。

**注意:** 旧スモーク予約 `209906021400` は実施記録としてのみ参照し、再キャプチャには使用しません。

---

## 1. 案件基本情報

| 項目 | 記入欄 |
|---|---|
| **取得日** | 2026/07/05 |
| **取得者** | |
| **estimateNo** | EST-20260705-3755 |
| **reservationId** | 202607050600 |
| **confirmedFare（事前確定運賃・円）** | 28,000 |
| **出発地** | 中央区出洲港8-3-2 |
| **目的地** | 成田空港第二ターミナル |
| **送迎条件** | 例: 無料車いす / 乗降介助 / 階段介助なし / 片道 |
| **選択ルート** | 例: ルートA（時間優先ルート） |
| **予約日時（検証用）** | 見積: 2026/07/05 03:39 / 同意: 2026/07/05 03:40 |
| **利用者名（検証用）** | （提出資料ではマスク） |
| **備考** | 案件番号: 26705-MAINS-0001 |

**画像保存先:** `screenshots/pre-fixed-fare-approval-20260705/`（提出前メモ: 同フォルダ `NOTES.md`）

**画面証跡PDF用画像保存先:** `assets/evidence/pre-fixed-fare-20260705/`（管理画面「認可・運賃資料」→ **画面証跡資料PDF** から出力）

| No | ファイル |
|---|---|
| 1 | `assets/evidence/pre-fixed-fare-20260705/01_route_selection_EST-20260705-3755.png` |
| 2 | `assets/evidence/pre-fixed-fare-20260705/02_consent_confirm_EST-20260705-3755.png` |
| 3 | `assets/evidence/pre-fixed-fare-20260705/03_confirmed_route_202607050600.png` |
| 4 | `assets/evidence/pre-fixed-fare-20260705/04_receipt_detail_202607050600.png` |

---

## 2. 4画面キャプチャ記録

| No | キャプチャ名 | 撮影済 | ファイル名 | 撮影日時 | メモ |
|---|---|---|---|---|---|
| 1 | 利用者の2ルート選択画面（lp-site STEP6） | ☑ | `01_route_selection_EST-20260705-3755.png` | 2026/07/05 03:39 | 補助: `01b_estimate_result_EST-20260705-3755.png` |
| 2 | 旅客同意確認画面（reservation-v4） | ☑ | `02_consent_confirm_EST-20260705-3755.png` | 2026/07/05 03:40 | 補助: `02b_reservation_complete_202607050600.png` |
| 3 | ドライバーの確定ルート確認画面（care-taxi-meter） | ☑ | `03_confirmed_route_202607050600.png` | 2026/07/05 | 補助: `03a_driver_reservation_list_202607050600.png`, `03b_fixed_fare_meter_202607050600.png` |
| 4 | 領収書・レシート明細画面（care-taxi-meter） | ☑ | `04_receipt_detail_202607050600.png` | 2026/07/05 | 補助: `04a_settlement_202607050600.png`, `04b_receipt_complete_202607050600.png` |

### 認可資料・追加資料ページ — 貼付候補4枚

| No | ファイル |
|---|---|
| 1 | `screenshots/pre-fixed-fare-approval-20260705/01_route_selection_EST-20260705-3755.png` |
| 2 | `screenshots/pre-fixed-fare-approval-20260705/03b_fixed_fare_meter_202607050600.png`（同意証跡セクション） |
| 3 | `screenshots/pre-fixed-fare-approval-20260705/03b_fixed_fare_meter_202607050600.png` |
| 4 | `screenshots/pre-fixed-fare-approval-20260705/03b_fixed_fare_meter_202607050600.png`（料金・内訳） |

詳細・マスク方針: `screenshots/pre-fixed-fare-approval-20260705/NOTES.md`

### ファイル名の推奨形式

```
{取得日YYYYMMDD}_{estimateNo}_{No}-{短い説明}.png
```

例:

```
20260705_EST-20260705-1234_1-route-selection.png
20260705_EST-20260705-1234_2-consent.png
20260705_EST-20260705-1234_3-driver-confirmed-route.png
20260705_EST-20260705-1234_4-receipt.png
```

---

## 3. 個人情報マスク確認

各キャプチャ保存前に確認し、☑ を入れてください。

**提出資料でのマスク対象:** 電話番号、メールアドレス、利用者名、乗務員名  
**証跡として残す項目:** 予約ID、見積番号、出発地、目的地、確定運賃

| 確認項目 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 利用者氏名・ふりがなをマスクした | ☐ | ☐ | ☐ | ☐ |
| 電話番号をマスクした | ☐ | ☐ | ☐ | ☐ |
| メールアドレスをマスクした | ☐ | ☐ | ☐ | ☐ |
| 乗務員ログインID・実名をマスクした | ☐ | ☐ | ☐ | ☐ |
| 車両番号をマスクした | ☐ | ☐ | ☐ | ☐ |
| 内部UUID（caseRecordId 等）をマスクした | ☐ | ☐ | ☐ | ☐ |
| QRコード・決済端末情報をマスクした | ☐ | ☐ | ☐ | ☐ |
| **estimateNo / reservationId は残している** | ☐ | ☐ | ☐ | ☐ |
| **出発地・目的地（施設名）は証跡として残している** | ☐ | ☐ | ☐ | ☐ |

---

## 4. 取得後チェックリスト

案件完了後、以下をすべて確認してから認可資料へ転記してください。

- [ ] ①〜④すべて同じ **estimateNo** / **reservationId** で紐付けた
- [ ] ①で **2候補**（ルートA / ルートB）が写っている
- [ ] LP 予約URLに **`fareConfirm=review` が付いていない**
- [ ] ②で **同意ボタン／チェック** と **事前確定運賃額・注意事項** が写っている
- [ ] ③で **「事前確定運賃：○○円」** と **確定ルート地図** が写っている
- [ ] ④で **「事前確定運賃 ○○円」** ラベルと **別行明細**（迎車・介助等）が写っている
- [ ] ④の **confirmedFare** が本シート「案件基本情報」と一致する
- [ ] 運行完了後、予約詳細が **「事前確定M 完了」** になっている
- [ ] 旧予約ID **209906021400** は使用していない
- [ ] 4ファイルすべて個人情報マスク確認（§3）済み

---

## 5. 参照

| 項目 | 内容 |
|---|---|
| 開始URL | https://infochibafukushi-dotcom.github.io/lp-site/estimate/ |
| 予約URL | https://infochibafukushi-dotcom.github.io/reservation-v4/?source=estimate&estimateNo={estimateNo} |
| メーターURL | https://infochibafukushi-dotcom.github.io/care-taxi-meter/ |
| 推奨ルート入力 | 出発: パールホテル新宿曙橋 / 到着: 東京女子医科大学病院 |
| estimateNo 確認 | LP 見積結果「見積番号」ボックス / 予約URL の `estimateNo=` |
| reservationId 確認 | reservation-v4 予約完了画面 / care-taxi-meter 予約詳細 |

---

*本シートは運輸局提出用キャプチャ取得の作業管理用です。認可資料本文への転記は申請担当者が行ってください。*
