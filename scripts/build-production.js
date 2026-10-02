const { cpSync, rmSync, watch } = require("node:fs");
const path = require("node:path");
const { buildSync } = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");

const buildExtension = (root = projectRoot, development = false) => {
  rmSync(path.join(root, "dist"), { recursive: true, force: true });
  buildSync({
    absWorkingDir: root,
    entryPoints: ["src/index.ts"],
    outfile: "dist/js/index.js",
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: !development,
    sourcemap: development ? "inline" : false,
    logLevel: "info",
  });
  cpSync(path.join(root, "public"), path.join(root, "dist"), { recursive: true });
};

const buildProduction = (root = projectRoot) => buildExtension(root);

const watchDevelopment = (root = projectRoot) => {
  let timer;
  const rebuild = () => {
    try {
      buildExtension(root, true);
    } catch (error) {
      console.error(error.message);
    }
  };
  const watchers = ["src", "public"].map((directory) =>
    watch(path.join(root, directory), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(rebuild, 100);
    }),
  );
  rebuild();
  return () => {
    clearTimeout(timer);
    watchers.forEach((watcher) => watcher.close());
  };
};

if (require.main === module) {
  if (process.argv.includes("--watch")) {
    watchDevelopment();
  } else {
    buildExtension(projectRoot, process.argv.includes("--development"));
  }
}

module.exports = { buildExtension, buildProduction, watchDevelopment };
