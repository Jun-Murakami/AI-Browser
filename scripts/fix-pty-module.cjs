#!/usr/bin/env node

/**
 * node-pty-prebuilt-multiarchのLinux環境でのパス問題を修正するスクリプト
 * 
 * 問題: ライブラリがprebuilds/ディレクトリからバイナリを正しく読み込めない
 * 解決: プリビルドバイナリをbuild/Release/ディレクトリにコピーする
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ライブラリのパス
const ptyModulePath = path.join(__dirname, '../node_modules/@homebridge/node-pty-prebuilt-multiarch');

// プラットフォームとアーキテクチャを取得
const platform = os.platform();
const arch = os.arch();

console.log(`🔧 Fixing pty.node module for ${platform}-${arch}...`);

// Windows環境では既にbuild/Release/pty.nodeが存在するためスキップ
if (platform === 'win32') {
  const existingPtyNode = path.join(ptyModulePath, 'build', 'Release', 'pty.node');
  if (fs.existsSync(existingPtyNode)) {
    console.log(`✅ Windows: pty.node already exists at ${existingPtyNode}`);
    console.log(`🎉 No fix needed for Windows platform`);
    process.exit(0);
  }
}

// macOS環境では通常問題が発生しないため、既存ファイルをチェックしてスキップ
if (platform === 'darwin') {
  const existingPtyNode = path.join(ptyModulePath, 'build', 'Release', 'pty.node');
  if (fs.existsSync(existingPtyNode)) {
    console.log(`✅ macOS: pty.node already exists at ${existingPtyNode}`);
    console.log(`🎉 No fix needed for macOS platform`);
    process.exit(0);
  }
  // macOSでファイルが存在しない場合は、プリビルドバイナリを探す
  console.log(`⚠️  macOS: pty.node not found, checking for prebuilt binaries...`);
}

// プリビルドバイナリのパス
const prebuildsPath = path.join(ptyModulePath, 'prebuilds');
const buildPath = path.join(ptyModulePath, 'build', 'Release');

// Node.jsのABIバージョンを取得
const abiVersion = process.versions.modules;
const isElectron = process.versions.hasOwnProperty('electron');

// プリビルドファイル名を生成
function getPrebuildFileName() {
  const tags = [];
  tags.push(isElectron ? 'electron' : 'node');
  tags.push('abi' + abiVersion);
  
  // Alpine Linux (musl) のチェック
  if (platform === 'linux' && fs.existsSync('/etc/alpine-release')) {
    tags.push('musl');
  }
  
  return tags.join('.') + '.node';
}

// プラットフォームとアーキテクチャの組み合わせを生成
function getPlatformArch() {
  if (platform === 'darwin') {
    // macOS: x64 または arm64
    return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (platform === 'win32') {
    // Windows: ia32 または x64
    return arch === 'x64' ? 'win32-x64' : 'win32-ia32';
  } else if (platform === 'linux') {
    // Linux: ia32, x64, arm, arm64
    if (arch === 'arm' || arch === 'armv6') {
      return 'linux-arm';
    } else if (arch === 'arm64') {
      return 'linux-arm64';
    } else if (arch === 'ia32') {
      return 'linux-ia32';
    } else {
      return 'linux-x64';
    }
  }
  return `${platform}-${arch}`;
}

const prebuildFileName = getPrebuildFileName();
const platformArch = getPlatformArch();

// ソースファイルのパス
const sourceFile = path.join(prebuildsPath, platformArch, prebuildFileName);
const destFile = path.join(buildPath, 'pty.node');

console.log(`📁 Source: ${sourceFile}`);
console.log(`📁 Destination: ${destFile}`);

try {
  // ソースファイルが存在するかチェック
  if (!fs.existsSync(sourceFile)) {
    console.log(`❌ Source file not found: ${sourceFile}`);
    
    // 利用可能なファイルをリストアップ
    const prebuildDir = path.join(prebuildsPath, platformArch);
    if (fs.existsSync(prebuildDir)) {
      const files = fs.readdirSync(prebuildDir);
      console.log(`📋 Available files in ${prebuildDir}:`);
      files.forEach(file => console.log(`   - ${file}`));
    } else {
      console.log(`❌ Prebuilds directory not found: ${prebuildDir}`);
    }
    
    process.exit(1);
  }

  // デスティネーションディレクトリを作成
  if (!fs.existsSync(buildPath)) {
    fs.mkdirSync(buildPath, { recursive: true });
    console.log(`📁 Created directory: ${buildPath}`);
  }

  // ファイルをコピー
  fs.copyFileSync(sourceFile, destFile);
  console.log(`✅ Successfully copied pty.node`);
  
  // ファイルサイズを確認
  const stats = fs.statSync(destFile);
  console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
  
} catch (error) {
  console.error(`❌ Error fixing pty.module:`, error.message);
  process.exit(1);
}

console.log(`🎉 pty.node module fix completed!`);
