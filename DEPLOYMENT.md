# Chrome Web Store デプロイ

## ワークフローの動作

`.github/workflows/deploy.yml` は次の場合に動作します。

- `main` へのpush: push前のcommit（`github.event.before`）と現在のHEADで `package.json` の `version` が変わった場合だけ公開する
- `workflow_dispatch`: バージョン差分の確認を省略し、手動で公開する

pushに複数commitが含まれる場合も、直前の1 commitではなくpush前のSHAとHEADを比較します。`before` が未設定または全ゼロ、commitまたはその `package.json` を取得できない場合は、意図しない公開を避けるため安全にskipします。

公開前に pnpm 9.15.9 で固定ロックファイルから依存関係をインストールし、テスト、型チェック、クリーンな本番buildとzip作成を順に実行します。`package.json` のバージョンを変更するときは `pnpm sync-version` を実行し、`public/manifest.json` も同じバージョンにしてください。タグのpushだけではこのワークフローは起動しません。

## Chrome Web Store とOAuthの準備

1. Chrome Web Store Developer Dashboardで拡張機能を登録します。初回アップロード、Store listing、Privacyの入力は手動で完了してください。
2. Publisher > SettingsでPublisher IDを確認します。複数Publisherに所属する場合は対象を切り替えてから確認してください。
3. Google CloudプロジェクトでChrome Web Store APIを有効化します。
4. OAuth同意画面を設定します。ExternalでTestingを使う場合は、公開を担当するGoogleアカウントをテストユーザーに追加します。
5. OAuth client IDを「Web application」として作成し、Authorized redirect URIに `https://developers.google.com/oauthplayground` を追加します。
6. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) の設定で「Use your own OAuth credentials」を有効にし、そのclient IDとclient secretを入力します。
7. `https://www.googleapis.com/auth/chromewebstore` を独自scopeとして承認します。Chrome Web Store itemを所有するGoogleアカウントでログインしてください。
8. authorization codeをtokenへ交換し、表示されたrefresh tokenを安全に保存します。認証情報やtokenをリポジトリへ追加しないでください。

詳細は[Chrome Web Store API公式ガイド](https://developer.chrome.com/docs/webstore/using-api)を参照してください。

## GitHub ActionsのSecrets

Repository Settings > Secrets and variables > Actionsに次を登録します。

- `CHROME_EXTENSION_ID`: Chrome Web Storeの拡張機能ID
- `CHROME_PUBLISHER_ID`: 対象PublisherのID
- `CHROME_CLIENT_ID`: Web application OAuth client ID
- `CHROME_CLIENT_SECRET`: OAuth client secret
- `CHROME_REFRESH_TOKEN`: OAuth Playgroundで取得したrefresh token

## ローカルでのbuild、zip、upload

前提:

- Node.js 20以上
- pnpm 9.15.9
- Chrome Web Storeで既に登録済みのitemと、上記OAuth認証情報

```bash
if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.9 --activate
else
  npm install --global pnpm@9.15.9
fi

pnpm install --frozen-lockfile
pnpm test
pnpm type-check
pnpm build
pnpm zip
```

`package.json` の `packageManager` も `pnpm@9.15.9` に固定されています。Node.js 20以上でもCorepackが同梱または有効とは限らないため、Corepackコマンドが存在しない環境では上記npm fallbackを使用してください。

本番buildは最初に `dist/` 全体を削除し、外部source mapを含めずに再生成します。`pnpm zip` は既存の `extension.zip` と `dist/` を削除し、クリーンな本番buildを実行して、現在の `dist/` のファイルだけを決定的な順序と固定metadataでarchiveへ格納します。OSの `zip` コマンドは不要です。

uploadスクリプトが読む環境変数:

- 必須: `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`
- 任意: `CHROME_EXTENSION_ZIP_PATH`（既定 `extension.zip`）
- 任意: `CHROME_PUBLISH`（既定 `true`; `false` ならupload後にpublishしない）

値は `.env.example` を参考にshellまたは安全なsecret管理から設定し、次を実行します。

```bash
pnpm deploy-chrome
```

## 注意事項

- manifestのversionを上げずに既存itemへ新しいpackageをuploadすると失敗します。
- publishは審査への提出であり、即時公開を保証しません。
- refresh tokenは取り消しや失効があり得ます。`Invalid refresh token` の場合は所有者アカウントとOAuth設定を確認して再取得します。
- `Extension not found` はextension ID、publisher ID、選択中のPublisherを確認します。
- `Insufficient permissions` は所有者アカウントとscopeを確認します。
