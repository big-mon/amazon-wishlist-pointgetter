const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (_env, argv = {}) => {
  const mode = argv.mode || "production";
  const isDevelopment = mode === "development";

  return {
    mode,
    // エントリーポイントとなるファイル
    entry: {
      index: `${__dirname}/src/index.ts`,
    },
    output: {
      path: `${__dirname}/dist/js`,
      filename: "[name].js",
      clean: true,
    },
    devtool: isDevelopment ? "eval-cheap-module-source-map" : false,
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
          exclude: /node_modules/,
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
    optimization: {
      minimize: !isDevelopment,
    },
  };
};
