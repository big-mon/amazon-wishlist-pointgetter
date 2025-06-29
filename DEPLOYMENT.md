# 自動デプロイ設定

## 概要
このプロジェクトは GitHub Actions を使用して Chrome Web Store への自動デプロイを行います。

## 必要な設定

### 1. Chrome Web Store Developer Dashboard での設定

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) にアクセス
2. 拡張機能を登録（初回のみ手動アップロードが必要）
3. 拡張機能IDをメモしておく（URLの `detail/` の後の文字列）

### 2. Google Cloud Console での API設定

1. [Google Cloud Console](https://console.cloud.google.com/) で新しいプロジェクトを作成
2. Chrome Web Store API を有効化
3. **OAuth同意画面** を設定：
   - ユーザータイプ: **外部**
   - アプリ名、ユーザーサポートメール、デベロッパー連絡先を入力
   - **テストユーザー**に自分のGmailアドレスを追加
4. 認証情報 → OAuth 2.0 クライアント ID を作成
   - アプリケーションの種類: デスクトップアプリケーション
   - 承認済みリダイレクトURIに `http://localhost:8080` を追加
5. クライアントIDとクライアントシークレットをメモ

### 3. リフレッシュトークンの取得

**手順1: 認証URLにアクセス**

以下のURLにアクセス（YOUR_CLIENT_IDを実際のクライアントIDに置き換え）：

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/chromewebstore
```

**手順2: 承認とコード取得**

1. Googleアカウントでログイン
2. 「このアプリは確認されていません」画面が表示された場合：
   - 「詳細」をクリック
   - 「（アプリ名）に移動（安全ではありません）」をクリック
3. Chrome Web Store への権限を承認
4. 「認証コード」（4/から始まる長い文字列）をコピー

**手順3: リフレッシュトークンに変換**

以下のコマンドを実行（YOUR_CLIENT_ID、YOUR_CLIENT_SECRET、YOUR_AUTH_CODEを置き換え）：

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTH_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

**レスポンス例**：
```json
{
  "access_token": "ya29.a0...",
  "expires_in": 3599,
  "refresh_token": "1//04...（これを使用）",
  "scope": "https://www.googleapis.com/auth/chromewebstore",
  "token_type": "Bearer"
}
```

`refresh_token`の値をGitHub Secretsに設定してください。

### 4. GitHub Secrets の設定

GitHub リポジトリの Settings → Secrets and variables → Actions で以下を設定：

- `CHROME_EXTENSION_ID`: Chrome Web Store の拡張機能ID
- `CHROME_CLIENT_ID`: Google Cloud Console のクライアントID
- `CHROME_CLIENT_SECRET`: Google Cloud Console のクライアントシークレット
- `CHROME_REFRESH_TOKEN`: 手順3で取得したリフレッシュトークン

## 使用方法

### 自動デプロイ
バージョンタグをプッシュすると自動的にデプロイされます：

```bash
git tag v1.0.1
git push origin v1.0.1
```

### 手動デプロイ
GitHub Actions の "Deploy to Chrome Web Store" ワークフローを手動実行することも可能です。

### ローカルからのデプロイ
環境変数を設定してローカルからデプロイ：

```bash
export CHROME_EXTENSION_ID="your_extension_id"
export CHROME_CLIENT_ID="your_client_id"
export CHROME_CLIENT_SECRET="your_client_secret"
export CHROME_REFRESH_TOKEN="your_refresh_token"

pnpm deploy-chrome
```

## 注意事項

- 初回は手動でChrome Web Storeに拡張機能をアップロードする必要があります
- リフレッシュトークンは定期的に更新が必要な場合があります
- 拡張機能のレビューは自動では行われません（Googleの審査が必要）
- 本番環境への公開は慎重に行ってください

## トラブルシューティング

### よくあるエラー
1. `Invalid refresh token` - リフレッシュトークンを再取得
2. `Extension not found` - 拡張機能IDを確認
3. `Insufficient permissions` - OAuth スコープを確認

### ログの確認
GitHub Actions の実行ログで詳細なエラー情報を確認できます。