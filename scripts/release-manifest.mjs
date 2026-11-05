#!/usr/bin/env node

/**
 * Tauri 版のリリース成果物を release/ にまとめ、GitHub Releases に上げるための補助スクリプト。
 * build_macos.zsh / build_windows_release.ps1 から呼ばれる（DialogSuite の updates/ と同じ役割）。
 *
 * release/ の中身:
 *   - インストーラ（Electron 版のアプリ内アップデータが拾える名前に揃える）
 *       AI-Browser-<version>-setup_win_x64.msi
 *       AI-Browser-<version>_mac_universal.dmg
 *     と、それぞれの .sha256（+ gpg があれば .sha256.asc。scripts/sign-artifacts.cjs で生成）
 *   - Tauri アップデータ用の macOS アーカイブ AI-Browser_universal.app.tar.gz
 *     （Electron 版が "mac" を含む名前を拾うので、名前に mac を入れない）
 *   - latest.json … Tauri アップデータが読む。署名（.sig の中身）はここに埋め込むので .sig は上げない
 *   - manifest.json … アップロードするファイルと順序の記録（このスクリプト用）
 *
 * Electron 版のアップデータは、リリースのアセットから名前で最初に見つかったものを使う。
 * .sha256 も同じ名前を含むため、インストーラを先にアップロードする（publish が順序を守る）。
 *
 * 使い方:
 *   node scripts/release-manifest.mjs clean
 *   node scripts/release-manifest.mjs add --src <path> --name <file name>
 *        [--kind installer|updater] [--checksum] [--sig <path> --platforms <a,b>]
 *   node scripts/release-manifest.mjs notes --file <path>
 *   node scripts/release-manifest.mjs publish [--prerelease]
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Electron 版のチェックサム生成（CommonJS）を読み込むため
const requireCjs = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_DIR = path.join(ROOT, 'release');
const LATEST_JSON = path.join(RELEASE_DIR, 'latest.json');
const MANIFEST_JSON = path.join(RELEASE_DIR, 'manifest.json');
const REPO = 'Jun-Murakami/AI-Browser';

const { version } = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
);
const tag = `v${version}`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

// 別バージョンの記録が残っていたら捨てる（release/ は次のリリースまで残るため）
function loadManifest() {
  const m = readJson(MANIFEST_JSON, null);
  return m && m.version === version ? m : { version, files: [] };
}

function loadLatest() {
  const l = readJson(LATEST_JSON, null);
  if (l && l.version === version) return l;
  return { version, notes: '', pub_date: '', platforms: {} };
}

function downloadUrl(fileName) {
  return `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

async function add(args) {
  const src = args.src;
  const name = args.name;
  if (!src || !name) throw new Error('add には --src と --name が必要です');
  if (!fs.existsSync(src)) throw new Error(`見つかりません: ${src}`);

  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const dest = path.join(RELEASE_DIR, name);
  fs.copyFileSync(src, dest);
  console.log(`  + ${name}`);

  const manifest = loadManifest();
  const record = (fileName, kind) => {
    manifest.files = manifest.files.filter((f) => f.name !== fileName);
    manifest.files.push({ name: fileName, kind });
  };
  record(name, args.kind === 'updater' ? 'updater' : 'installer');

  // .sha256（+ .sha256.asc）は Electron 版と同じ処理で作る
  if (args.checksum) {
    const signArtifacts = requireCjs('./sign-artifacts.cjs');
    const extra = await signArtifacts({ artifactPaths: [dest] });
    for (const p of extra) record(path.basename(p), 'checksum');
  }
  writeJson(MANIFEST_JSON, manifest);

  // アップデータ用: .sig の中身を latest.json の各プラットフォームに書く
  if (args.sig) {
    const platforms = String(args.platforms || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (platforms.length === 0) throw new Error('--sig には --platforms が必要です');
    const signature = fs.readFileSync(args.sig, 'utf8').trim();
    const latest = loadLatest();
    for (const platform of platforms) {
      latest.platforms[platform] = { url: downloadUrl(name), signature };
    }
    latest.pub_date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    writeJson(LATEST_JSON, latest);
    console.log(`  latest.json: ${platforms.join(', ')}`);
  }
}

function notes(args) {
  const text = args.file ? fs.readFileSync(args.file, 'utf8') : args.text;
  if (typeof text !== 'string') throw new Error('notes には --file か --text が必要です');
  const latest = loadLatest();
  latest.notes = text.trim();
  writeJson(LATEST_JSON, latest);
}

function clean() {
  fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  console.log('  release/ を空にしました');
}

function gh(args, options = {}) {
  return execFileSync('gh', args, { stdio: 'inherit', ...options });
}

function publish(args) {
  const manifest = loadManifest();
  const latest = loadLatest();
  if (manifest.files.length === 0) throw new Error('release/ に上げるファイルがありません');
  if (Object.keys(latest.platforms).length === 0) {
    throw new Error('latest.json にプラットフォームがありません');
  }

  // インストーラ → アップデータ → チェックサム → latest.json の順に上げる
  const order = { installer: 0, updater: 1, checksum: 2 };
  const files = [...manifest.files]
    .sort((a, b) => order[a.kind] - order[b.kind])
    .map((f) => path.join(RELEASE_DIR, f.name));
  for (const f of files) {
    if (!fs.existsSync(f)) throw new Error(`見つかりません: ${f}`);
  }
  files.push(LATEST_JSON);

  let exists = true;
  try {
    execFileSync('gh', ['release', 'view', tag, '-R', REPO], { stdio: 'ignore' });
  } catch {
    exists = false;
  }

  if (!exists) {
    // 下書きで作る。公開は GitHub 上で内容を確認してから手動で行う。
    // 下書き・プレリリースは releases/latest に出ないので、既存ユーザーには届かない
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    const notesFile = path.join(RELEASE_DIR, 'release-notes.md');
    fs.writeFileSync(notesFile, latest.notes || '');
    const createArgs = [
      'release', 'create', tag, '-R', REPO,
      '--draft',
      '--title', `AI Browser ${tag}`,
      '--notes-file', notesFile,
      '--target', branch,
    ];
    if (args.prerelease) createArgs.push('--prerelease');
    gh(createArgs);
  }

  // 1 ファイルずつ上げて作成順を固定する。API の並びが作成順でも名前順でも
  // インストーラが対応する .sha256 より先に来る（名前順なら "x.msi" < "x.msi.sha256"）
  for (const f of files) {
    console.log(`  upload: ${path.basename(f)}`);
    gh(['release', 'upload', tag, f, '-R', REPO, '--clobber']);
  }
  console.log(`\n下書きのリリースを確認して公開してください: https://github.com/${REPO}/releases`);
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
try {
  switch (command) {
    case 'clean':
      clean();
      break;
    case 'add':
      await add(args);
      break;
    case 'notes':
      notes(args);
      break;
    case 'publish':
      publish(args);
      break;
    default:
      console.error('usage: release-manifest.mjs <clean|add|notes|publish> [options]');
      process.exit(1);
  }
} catch (error) {
  console.error(`[release-manifest] ${error.message}`);
  process.exit(1);
}
