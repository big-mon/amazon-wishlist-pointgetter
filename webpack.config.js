const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  // エントリーポイントとなるファイル
  entry: {
    index: `${__dirname}/src/index.ts`,
  },
  output: {
    path: `${__dirname}/dist/js`,
    filename: "[name].js",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /.ts$/,
        use: "ts-loader",
        exclude: "/node_modules/",
      },
    ],
  },
  resolve: {
    // importにて自動解決させる拡張子
    extensions: [".ts", ".js"],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: "public", to: "../" }],
    }),
  ],
};
