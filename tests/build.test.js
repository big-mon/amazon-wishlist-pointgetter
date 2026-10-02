const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const { setTimeout: sleep } = require("node:timers/promises");
const { buildSync } = require("esbuild");
const { buildExtension, buildProduction, watchDevelopment } = require("../scripts/build-production");

const root = path.resolve(__dirname, "..");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "devola-build-test-"));
for (const name of ["src", "public", "tsconfig.json"]) {
  fs.cpSync(path.join(root, name), path.join(fixture, name), { recursive: true });
}
const output = (name) => path.join(fixture, "dist", name);
const bundle = () => fs.readFileSync(output("js/index.js"), "utf8");
const waitFor = async (check) => {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, "watch must update the output within 5 seconds");
    await sleep(50);
  }
};

async function main() {
  let stopWatching;
  try {
    buildProduction(fixture);
    const production = bundle();
    let started = false;
    new vm.Script(production).runInNewContext({
      MutationObserver: class {},
      document: { getElementById: () => { started = true; return null; } },
      console: { log() {}, warn() {} },
    });
    assert.equal(started, true, "the packaged classic script must start wishlist processing");
    assert.doesNotMatch(production, /sourceMappingURL|eval\(/);
    for (const name of ["manifest.json", "_locales/en/messages.json", "_locales/ja/messages.json", "images/icon128.png", "images/icon48.png", "images/icon16.png"]) {
      assert.deepEqual(fs.readFileSync(output(name)), fs.readFileSync(path.join(root, "public", name)));
    }
    fs.writeFileSync(output("stale.txt"), "old build");
    buildExtension(fixture, true);
    assert.equal(fs.existsSync(output("stale.txt")), false);
    assert.match(bundle(), /sourceMappingURL=data:/);
    assert.ok(bundle().length > production.length);

    // Run the existing behavior suites against esbuild's minified modules too.
    for (const name of ["util", "wishlist"]) {
      buildSync({ absWorkingDir: fixture, entryPoints: [`src/${name}.ts`], outfile: `${name}.cjs`, bundle: true, format: "cjs", platform: "browser", target: "es2022", minify: true });
      const testFile = path.join(fixture, `${name}.test.cjs`);
      const source = fs.readFileSync(path.join(__dirname, `${name}.test.js`), "utf8");
      fs.writeFileSync(testFile, source.replace(`"../src/${name}.ts"`, `"./${name}.cjs"`));
      const result = spawnSync(process.execPath, [testFile], { encoding: "utf8" });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }

    fs.writeFileSync(path.join(fixture, "public/watch-probe.txt"), "temporary asset");
    stopWatching = watchDevelopment(fixture);
    fs.writeFileSync(path.join(fixture, "public/_locales/en/messages.json"), '{"probe":"updated"}\n');
    fs.appendFileSync(path.join(fixture, "src/index.ts"), '\nconsole.log("source watch probe");\n');
    await waitFor(() => fs.existsSync(output("js/index.js")) && bundle().includes("source watch probe") && fs.existsSync(output("_locales/en/messages.json")) && fs.readFileSync(output("_locales/en/messages.json"), "utf8").includes("updated"));
    fs.rmSync(path.join(fixture, "public/watch-probe.txt"));
    await waitFor(() => !fs.existsSync(output("watch-probe.txt")));
    console.log("Passed production/development builds, minified behavior suites, and source/public watch tests.");
  } finally {
    stopWatching?.();
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
