const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createZipFromDirectory } = require("../scripts/package-extension");

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "devola-package-test-"));

try {
  const dist = path.join(temporaryRoot, "dist");
  const archive = path.join(temporaryRoot, "extension.zip");
  mkdirSync(dist);

  writeFileSync(path.join(dist, "stale-fixture.txt"), "stale");
  createZipFromDirectory(dist, archive);

  rmSync(path.join(dist, "stale-fixture.txt"));
  writeFileSync(path.join(dist, "current.txt"), "current");
  createZipFromDirectory(dist, archive);
  const firstArchive = readFileSync(archive);

  assert.equal(firstArchive.includes(Buffer.from("stale-fixture.txt")), false);
  assert.equal(firstArchive.includes(Buffer.from("current.txt")), true);

  createZipFromDirectory(dist, archive);
  assert.deepEqual(readFileSync(archive), firstArchive, "packaging is byte-for-byte deterministic");

  console.log("Passed extension packaging tests.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
