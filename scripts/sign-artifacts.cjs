#!/usr/bin/env node

/**
 * electron-builder afterAllArtifactBuild フック
 *
 * Linux には OS 強制の署名関門が無いため、配布物の「完全性（改ざん検知）」と
 * 「真正性（誰が作ったか）」を配布側で担保する。
 *   - SHA256SUMS       : 各成果物の SHA-256（`sha256sum -c` 互換フォーマット）
 *   - SHA256SUMS.asc   : SHA256SUMS への GPG デタッチ署名（鍵がある場合のみ）
 *
 * ユーザー側の検証手順:
 *   gpg --verify SHA256SUMS.asc SHA256SUMS   # 真正性
 *   sha256sum -c SHA256SUMS                  # 完全性
 *
 * 環境変数:
 *   GPG_SIGNING_KEY : 署名に使う鍵ID/フィンガープリント/メール（省略時は既定鍵）
 *   SKIP_GPG_SIGN   : 'true' で署名をスキップ（チェックサムのみ生成）
 *
 * 戻り値で追加成果物のパスを返すと electron-builder の publish 対象に含まれる。
 */

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// 署名・チェックサム対象とする配布物本体の拡張子（.yml/.blockmap などは除外）
const DISTRIBUTABLE = /\.(AppImage|deb|rpm|snap|exe|dmg|zip|pkg)$/i;

/** @param {{ artifactPaths: string[] }} buildResult */
module.exports = async function afterAllArtifactBuild(buildResult) {
  const artifacts = (buildResult.artifactPaths || []).filter((p) =>
    DISTRIBUTABLE.test(path.basename(p)),
  );

  if (artifacts.length === 0) {
    return [];
  }

  const outDir = path.dirname(artifacts[0]);
  const sumsPath = path.join(outDir, 'SHA256SUMS');

  // SHA-256 を生成（"<hash>  <filename>" 形式 = sha256sum -c 互換）
  const lines = artifacts.map((p) => {
    const hash = createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    return `${hash}  ${path.basename(p)}`;
  });
  fs.writeFileSync(sumsPath, `${lines.join('\n')}\n`);
  console.log(`  • SHA256SUMS を生成 (${artifacts.length} 件の成果物)`);

  const additionalArtifacts = [sumsPath];

  if (process.env.SKIP_GPG_SIGN === 'true') {
    console.log('  • SKIP_GPG_SIGN=true のため GPG 署名をスキップ');
    return additionalArtifacts;
  }

  // gpg の有無を確認（無ければチェックサムのみで続行）
  try {
    execFileSync('gpg', ['--version'], { stdio: 'ignore' });
  } catch {
    console.warn('  • gpg が見つからないため署名をスキップ（チェックサムのみ）');
    return additionalArtifacts;
  }

  const ascPath = `${sumsPath}.asc`;
  const args = [
    '--batch',
    '--yes',
    '--armor',
    '--detach-sign',
    '--output',
    ascPath,
  ];
  if (process.env.GPG_SIGNING_KEY) {
    args.push('--local-user', process.env.GPG_SIGNING_KEY);
  }
  args.push(sumsPath);

  try {
    execFileSync('gpg', args, { stdio: 'inherit' });
    console.log('  • SHA256SUMS.asc を生成（GPG 署名）');
    additionalArtifacts.push(ascPath);
  } catch {
    console.warn(
      '  • GPG 署名に失敗（署名鍵が無い等）。チェックサムのみ同梱します。',
    );
  }

  return additionalArtifacts;
};
