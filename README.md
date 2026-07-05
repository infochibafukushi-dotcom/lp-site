# lp-site
介護タクシーLP

## 運用方針（セキュリティ）
- GitHub Pages は静的公開のため、`admin.html` を URL だけで完全には保護できません。
- 管理認証をフロント実装から除去しており、`admin.html` へのアクセス制御は将来的に Cloudflare Access 等のインフラ側で実施してください。
- 推奨: GitHub Pages + Cloudflare Access（メールドメイン制限 / One-time PIN / IDP連携）
- `admin.html` を公開したまま運用しないでください。必ず Access ポリシー配下で保護してください。
- `robots.txt` と `admin.html` の `noindex` は検索エンジン向けの除外指定であり、認証ではありません。
- GitHub Personal Access Token（PAT）は共有PC・公共PCでは入力しないでください。
- PAT は fine-grained token、最小権限（対象リポジトリのみ）、有効期限付きで運用してください。

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

### 設定ファイル
- 料金・項目・説明文は `data/estimate-config.json` で管理します（`config.json` / `sections.json` と同じ運用）。
- 管理画面（`admin.html`）→「料金シミュレーター設定」で編集し、GitHub へ保存すると Pages に反映されます。

### 初回セットアップ
1. `data/estimate-config.json` がリポジトリに含まれていることを確認。
2. 管理画面で料金を編集 →「estimate-config.json を保存」または「すべて保存」。
3. `https://<your-domain>/lp-site/estimate/` で動作確認。

### Phase 区分
| Phase | 内容 |
|-------|------|
| Phase 1（現在） | 距離手入力、JSON 設定、介助説明、利用内容表示、LP 案内、JSON入出力、見積URL共有、管理画面プレビュー |
| Phase 2 | Google Maps 地図検索、reservation-v4 見積引き継ぎ |

### 管理画面の機能
- **estimate-config.json を保存** — GitHub 経由で公開設定を更新
- **JSONエクスポート / インポート** — 別 LP への設定コピー・バックアップ
- **プレビューを見る** — `/estimate/` を新規タブで開く

### 見積URL共有
見積結果の「見積URLをコピー」から、選択内容付き URL を共有できます。

例: `/estimate/?mobility=free-wheelchair&trip=round-trip&distance=5.5&estimateNo=EST-20260621-0001`

### 見積PDF・見積番号
- 「見積書PDFを保存」で見積日時・利用内容・内訳・合計・注意事項を PDF 化
- 見積番号形式: `EST-YYYYMMDD-XXXX`（クライアント側で採番）
- 見積番号は `sessionStorage`（`lp_estimate_handoff`）と予約 URL パラメータ `estimateNo` で Phase 2 引き継ぎ可能

