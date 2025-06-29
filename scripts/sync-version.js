#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const manifestJsonPath = path.join(__dirname, '..', 'public', 'manifest.json');

function syncVersion() {
  try {
    // package.jsonからバージョンを読み取り
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    // manifest.jsonを読み取り
    const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
    
    // バージョンが異なる場合のみ更新
    if (manifestJson.version !== version) {
      manifestJson.version = version;
      
      // manifest.jsonを更新
      fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');
      
      console.log(`✅ Version synced: ${version}`);
      console.log(`   package.json: ${version}`);
      console.log(`   manifest.json: ${version}`);
    } else {
      console.log(`✅ Versions already in sync: ${version}`);
    }
  } catch (error) {
    console.error('❌ Error syncing versions:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  syncVersion();
}

module.exports = syncVersion;