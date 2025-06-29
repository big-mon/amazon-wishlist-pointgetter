# Devola: Amazon Wishlist Point Visualization

**Devola** は`Amazon.co.jp`のウィッシュリストやランキングページで、商品の獲得ポイントを自動表示する`Google Chrome 拡張機能`です。

**_Product:_** [Chrome Web Store](https://chrome.google.com/webstore/detail/devola-amazon-wishlist-po/khfjbdbepipkeecalhcpcnhkdfedkcki?hl=ja&authuser=0)

![Extension Demo](https://img.shields.io/badge/Status-Active-brightgreen) ![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue) ![Version](https://img.shields.io/badge/Manifest-V3-orange)

---

## 🎯 機能概要

### 主な機能
- **ウィッシュリストでのポイント表示**: Amazon.co.jpのウィッシュリストで各商品の獲得可能ポイントを自動表示
- **ランキングページでのポイント表示**: ベストセラーや新着ランキングページでもポイント情報を表示
- **リアルタイム更新**: 動的に追加される商品にも自動でポイント情報を付与
- **複数商品タイプ対応**: 通常商品、Kindle本など様々な商品形式に対応

### 対応ページ
- ウィッシュリストページ (`https://www.amazon.co.jp/*/wishlist/*`)
- ベストセラーページ (`https://www.amazon.co.jp/gp/bestsellers/*`)
- 新着ランキングページ (`https://www.amazon.co.jp/gp/new-releases/*`)
- 急上昇ランキングページ (`https://www.amazon.co.jp/gp/movers-and-shakers/*`)

### 動作仕組み
1. 対象ページの商品リストを自動検出
2. 各商品の個別ページにアクセスしてポイント情報を取得
3. 複数のCSSセレクターを使用して様々な商品タイプのポイントを解析
4. 取得したポイント情報を商品価格の横に表示

**⚠️ IMPORTANT:** Amazon.co.jp にのみ対応しており、Amazon.com での表示は非対応です。

## 🚀 開発環境セットアップ

### 必要な環境
- Node.js 18+
- pnpm (推奨) または npm
- Git

### Step 1: リポジトリのクローン

```sh
git clone git@github.com:big-mon/amazon-wishlist-pointgetter.git
cd amazon-wishlist-pointgetter
```

### Step 2: 依存関係のインストール

```sh
pnpm install
```

### Step 3: 開発・ビルド

```sh
# 開発用ビルド（最適化なし、ソースマップ付き）
pnpm dev

# 本番用ビルド（最適化・圧縮）
pnpm build

# 監視モード（ファイル変更時に自動リビルド）
pnpm watch

# TypeScript型チェック
pnpm type-check

# ビルドファイルのクリーンアップ
pnpm clean
```

ビルド成果物は `/dist` ディレクトリに出力されます。

### Step 4: Chrome拡張機能の読み込み

1. Chrome で `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `/dist` フォルダを選択

## 🛠 技術スタック

- **Language**: TypeScript 5.7+
- **Build Tool**: Webpack 5.99+
- **Package Manager**: pnpm
- **Target**: ES2022
- **Extension**: Manifest V3

## 📁 プロジェクト構造

```
├── src/
│   ├── index.ts          # エントリーポイント
│   ├── wishlist.ts       # ウィッシュリスト処理ロジック
│   └── util.ts           # ポイント取得・解析ユーティリティ
├── public/
│   ├── manifest.json     # Chrome拡張マニフェスト
│   ├── _locales/         # 多言語対応ファイル
│   └── images/           # アイコン画像
├── dist/                 # ビルド成果物（自動生成）
└── webpack.config.js     # Webpack設定
```

## 🔧 開発のポイント

### ポイント取得戦略
拡張機能は複数のCSSセレクターを使用して、様々な商品タイプからポイント情報を取得します：

- **通常商品**: `#addToCart #pointsInsideBuyBox_feature_div span.a-color-price`
- **Kindle商品**: `.loyalty-points .a-align-bottom`, `.ebooks-aip-points-label .a-color-price`

### 動的コンテンツ対応
MutationObserverを使用して、Ajaxで動的に追加される商品アイテムも自動的に検出・処理します。

## 🤝 貢献

1. フォークして feature ブランチを作成
2. 変更をコミット
3. プルリクエストを作成

## 📄 ライセンス

MIT License
