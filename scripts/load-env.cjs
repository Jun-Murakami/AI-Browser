#!/usr/bin/env node

/**
 * リポジトリルートの .env を読み込んで process.env に設定する小さなヘルパー。
 * dotenv パッケージは transitive 依存のため、フォールバックとして自前パーサを
 * 用意してビルドスクリプトから常に require できるようにする。
 *
 * 仕様:
 *   - KEY=VALUE 形式 (シェル互換の最小限)
 *   - 先頭 # の行はコメントとして無視
 *   - VALUE が "..." または '...' で囲まれていれば外す
 *   - 既存の process.env を上書きしない（CI のシークレット優先）
 */
const fs = require('node:fs');
const path = require('node:path');

function loadDotEnv(envPath) {
  const resolved = envPath || path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(resolved)) return false;

  const content = fs.readFileSync(resolved, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

module.exports = { loadDotEnv };
