const { lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { buildProduction } = require("./build-production");

const projectRoot = path.resolve(__dirname, "..");

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return crc >>> 0;
});

const crc32 = (data) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const comparePaths = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const collectFiles = (directory, relativeDirectory = "") =>
  readdirSync(path.join(directory, relativeDirectory))
    .sort(comparePaths)
    .flatMap((name) => {
      const relativePath = path.join(relativeDirectory, name);
      const absolutePath = path.join(directory, relativePath);
      const stats = lstatSync(absolutePath);
      if (stats.isSymbolicLink()) {
        throw new Error(`Refusing to package symbolic link: ${relativePath}`);
      }
      return stats.isDirectory() ? collectFiles(directory, relativePath) : [relativePath];
    });

const createZipFromDirectory = (sourceDirectory, archivePath) => {
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;

  for (const relativePath of collectFiles(sourceDirectory)) {
    const archiveName = relativePath.split(path.sep).join("/");
    const name = Buffer.from(archiveName, "utf8");
    const data = readFileSync(path.join(sourceDirectory, relativePath));
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x0021, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);

    const localRecord = Buffer.concat([localHeader, name, data]);
    localRecords.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x0021, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralRecords.push(Buffer.concat([centralHeader, name]));

    offset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(centralRecords.length, 8);
  endRecord.writeUInt16LE(centralRecords.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);

  rmSync(archivePath, { force: true });
  writeFileSync(archivePath, Buffer.concat([...localRecords, centralDirectory, endRecord]));
};

const packageExtension = (root = projectRoot) => {
  const archivePath = path.join(root, "extension.zip");
  rmSync(archivePath, { force: true });
  buildProduction(root);
  createZipFromDirectory(path.join(root, "dist"), archivePath);
};

if (require.main === module) {
  packageExtension();
}

module.exports = { createZipFromDirectory, packageExtension };
