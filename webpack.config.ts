import webpack from "webpack";
import path from "path";
import CopyWebpackPlugin from "copy-webpack-plugin";

const config: webpack.Configuration = {
  entry: {
    base: path.join(__dirname, "src/base.ts"),
    util: path.join(__dirname, "src/util.ts"),
    ranking: path.join(__dirname, "src/ranking.ts"),
    wishlist: path.join(__dirname, "src/wishlist.ts"),
  },
  output: {
    path: path.join(__dirname, "dist/js"),
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
    extensions: [".ts", ".js"],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: "public", to: "../" }],
    }),
  ],
};

export default config;
