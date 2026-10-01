# Devola

Amazon.co.jpのほしい物リストに、商品の獲得予定ポイントを表示するChrome拡張機能です。画面内の商品について商品ページを取得し、価格の横にポイントを追加します。スクロールやリストの更新で追加された商品も処理します。

## 使い方

[Chrome Web Store](https://chromewebstore.google.com/detail/khfjbdbepipkeecalhcpcnhkdfedkcki)からインストールし、Amazon.co.jpのほしい物リストを開きます。設定は不要です。

Amazon.co.jp以外には対応していません。Amazonの公式拡張機能ではなく、ページ構造の変更によって表示できなくなる場合があります。表示内容は購入時の条件と一致するとは限らないため、購入前にAmazonの商品ページで確認してください。

商品情報の解析と表示はブラウザ内で行い、商品ページの取得ではAmazonと通信します。開発者への送信やアクセス解析はありません。詳細は[プライバシーポリシー](./PRIVACY_POLICY.md)を参照してください。

## 開発

Node.js 24 LTS（24.12.0以上の24.x）とpnpm 11.23.0を使用します。miseを使う場合は、このディレクトリで `mise trust`、`mise install` を実行して `mise.toml` のツールを有効にしてください。pnpmを個別に用意する場合は `npm install --global pnpm@11.23.0` を使用できます。

```bash
git clone https://github.com/big-mon/amazon-wishlist-pointgetter.git
cd amazon-wishlist-pointgetter
pnpm install --frozen-lockfile
pnpm dev
```

Chromeで `chrome://extensions/` を開き、デベロッパーモードを有効にして「パッケージ化されていない拡張機能を読み込む」から、このリポジトリの `dist/` を選択します。Store版をインストール済みの場合は、検証中は無効にしてください。再ビルド後は拡張機能を再読み込みし、ほしい物リストのページを更新します。

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | ソースマップ付きの開発ビルド |
| `pnpm watch` | `src/` と `public/` の変更を監視して開発ビルド（自動再読み込みは行いません） |
| `pnpm test` | DOM処理・ポイント解析・ビルド・配布物の回帰テスト |
| `pnpm type-check` | TypeScriptの型チェック |
| `pnpm build` | `dist/` を削除して本番ビルド |
| `pnpm zip` | クリーンな本番ビルドから `extension.zip` を作成 |
| `pnpm audit --audit-level high` | 依存関係の脆弱性確認 |

## 保守

`src/index.ts` が起点、`src/wishlist.ts` がリストへの表示処理、`src/util.ts` が商品ページの取得と解析を担当します。対応するDOM構造はソースと `tests/` を参照してください。

テストはNode.jsの型消去でTypeScriptを実行します。型消去で実行できる構文を使用し、型チェックは別途実行してください。esbuildはManifest V3用の単一content scriptを生成します。esbuild更新時は `package.json` の固定バージョンと `pnpm-workspace.yaml` の `allowBuilds` を揃えます。

バージョンは `package.json` で変更し、`pnpm sync-version` でmanifestに同期します。Huskyのcommit hookでも同期されます。生成物はcommitしません。変更時の確認事項は [AGENTS.md](./AGENTS.md)、公開手順は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。

## ライセンス

[MIT License](./LICENSE)。
