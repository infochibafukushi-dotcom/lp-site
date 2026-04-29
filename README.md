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
