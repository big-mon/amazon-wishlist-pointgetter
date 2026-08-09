const assert = require("node:assert/strict");
const createWebpackConfig = require("../webpack.config");

assert.equal(
  typeof createWebpackConfig,
  "function",
  "webpack config must use argv.mode through a configuration factory",
);

const development = createWebpackConfig({}, { mode: "development" });
assert.equal(development.mode, "development");
assert.equal(development.optimization.minimize, false);
assert.equal(development.devtool, "eval-cheap-module-source-map");

const production = createWebpackConfig({}, { mode: "production" });
assert.equal(production.mode, "production");
assert.equal(production.optimization.minimize, true);
assert.equal(production.devtool, false);

console.log("Passed webpack mode tests.");
