const { rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

const buildProduction = (root = projectRoot) => {
  rmSync(path.join(root, "dist"), { recursive: true, force: true });

  const webpackCli = require.resolve("webpack-cli/bin/cli.js", { paths: [root] });
  const result = spawnSync(process.execPath, [webpackCli, "--mode=production"], {
    cwd: root,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Production build failed with exit code ${result.status}`);
  }
};

if (require.main === module) {
  buildProduction();
}

module.exports = { buildProduction };
