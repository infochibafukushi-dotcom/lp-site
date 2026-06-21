# lp-site
介護タクシーLP

## 運用方針（セキュリティ）
- 管理認証をフロント実装から除去し、`admin.html` へのアクセス制御はインフラ側で実施してください。
- 推奨: GitHub Pages + Cloudflare Access（メールドメイン制限 / One-time PIN / IDP連携）
- `admin.html` を公開したまま運用しないでください。必ず Access ポリシー配下で保護してください。

## 編集手順
1. `data/config.json` を編集（ヘッダー/フッター/ポップアップ）。
2. `data/sections.json` を編集（各セクション文言/画像/リンク）。
3. 画像は `assets/` 配下へ配置し、URLは `https://infochibafukushi-dotcom.github.io/lp-site/assets/...` を使用。
4. 変更後に品質チェックを実行。

## 品質チェック手順
```bash
npm run validate:json
npm run check:links
npm run quality
```

## 反映手順
1. 変更をコミット。
2. GitHub リポジトリへ push。
3. GitHub Pages 反映を待機（通常数分）。
4. 本番URLで主要導線（電話/LINE/予約）を実機確認。

## ロールバック手順
1. 直前の正常コミットを特定。
2. `git revert <commit>` で取り消しコミットを作成（履歴を壊さない運用を推奨）。
3. push 後、GitHub Pages の再反映を確認。
4. 緊急時は `data/config.json` と `data/sections.json` を直前正常版へ戻して先に復旧。

## SEO / 計測
- OGP と JSON-LD（LocalBusiness）を `index.html` へ実装。
- CV計測（電話 / LINE / 予約クリック）は `dataLayer` と `gtag` イベントに送信。

## 概算見積シミュレーター（/estimate/）

### Firestore を使う理由
- 料金・項目・説明文を**コード変更なし**で管理画面から更新するため。
- FC 展開時に**店舗（storeId）ごと**に設定を分離できるため。
- 項目の追加・削除・表示切替・並び順変更を**動的データ**として扱うため（GitHub JSON 保存だけではリアルタイム反映と多店舗運用が難しい）。

### 初回セットアップ
1. Firebase プロジェクトを作成し、Firestore を有効化。
2. `shared/firebase-config.example.js` を参考に `shared/firebase-config.js` に本番値を設定し `enabled: true` にする。
3. `firestore.rules` をデプロイ（公開読取・管理者書込）。
4. 管理者ユーザーに custom claim `admin: true` を付与。
5. 管理画面（`admin.html`）→「料金シミュレーター設定」→ ログイン →「初期データを投入」。
6. `https://<your-domain>/lp-site/estimate/` で動作確認。

### Phase 区分
| Phase | 内容 |
|-------|------|
| Phase 1（現在） | 距離手入力、Firestore 連携、介助説明、利用内容表示、LP ボタン、設定複製、JSON入出力、見積URL共有、管理画面プレビュー |
| Phase 2 | Google Maps 地図検索、reservation-v4 見積引き継ぎ |

### 管理画面の追加機能
- **設定を複製** — 複製元 storeId → 複製先 storeId へ Firestore コピー
- **JSONエクスポート / インポート** — 加盟店追加時の設定バックアップ
- **プレビューを見る** — `/estimate/?store={storeId}` を新規タブで開く

### 見積URL共有
見積結果の「見積URLをコピー」から、選択内容付き URL を共有できます。

例: `/estimate/?store=default&mobility=free-wheelchair&trip=round-trip&distance=5.5&estimateNo=EST-20260621-0001`

### 見積PDF・見積番号
- 「見積書PDFを保存」で見積日時・利用内容・内訳・合計・注意事項を PDF 化
- 見積番号形式: `EST-YYYYMMDD-0001`（履歴保存 ON 時は日次連番）
- 管理画面で「見積履歴を Firestore に保存する」を ON/OFF 切替可能
- 見積番号は `sessionStorage`（`lp_estimate_handoff`）と予約 URL パラメータ `estimateNo` で Phase 2 引き継ぎ可能

