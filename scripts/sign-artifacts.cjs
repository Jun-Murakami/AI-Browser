#!/usr/bin/env node

/**
 * electron-builder afterAllArtifactBuild フック
 *
 * Linux には OS 強制の署名関門が無いため、配布物の「完全性（改ざん検知）」と
 * 「真正性（誰が作ったか）」を配布側で担保する。
 *
 * チェックサム/署名は「成果物バイナリごとに 1 ファイル」生成する。
 *   - <artifact>.sha256      : その成果物の SHA-256（`sha256sum -c` 互換フォーマット）
 *   - <artifact>.sha256.asc  : <artifact>.sha256 への GPG デタッチ署名（鍵がある場合のみ）
 *
 * 単一の SHA256SUMS にまとめないのは、win/mac/linux を別環境で個別ビルドして
 * 同じリリースにアップロードする際、共通名のファイルが後勝ちで上書きされ、
 * 他プラットフォームの検証エントリが失われるのを防ぐため。各 .sha256 は対応する
 * バイナリ名に紐づくため、複数環境・複数回ビルドでも衝突しない。
 *
 * ユーザー側の検証手順（例: AppImage）:
 *   gpg --verify AI-Browser-1.7.0.AppImage.sha256.asc AI-Browser-1.7.0.AppImage.sha256  # 真正性
 *   sha256sum -c AI-Browser-1.7.0.AppImage.sha256                                       # 完全性
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
const { loadDotEnv } = require(path.join(__dirname, 'load-env.cjs'));

// electron-builder プロセスから require されるため .env が未ロードの可能性がある。
// GPG_SIGNING_KEY / SKIP_GPG_SIGN を拾うためここで .env を読み込む。
loadDotEnv();

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

  // gpg の有無を一度だけ確認（SKIP 指定 or 未インストールならチェックサムのみ）
  let canSign = process.env.SKIP_GPG_SIGN !== 'true';
  if (canSign) {
    try {
      execFileSync('gpg', ['--version'], { stdio: 'ignore' });
    } catch {
      console.warn('  • gpg が見つからないため署名をスキップ（チェックサムのみ）');
      canSign = false;
    }
  } else {
    console.log('  • SKIP_GPG_SIGN=true のため GPG 署名をスキップ');
  }

  const additionalArtifacts = [];

  for (const artifactPath of artifacts) {
    const baseName = path.basename(artifactPath);

    // 成果物ごとの .sha256（"<hash>  <filename>" 形式 = sha256sum -c 互換）
    const hash = createHash('sha256')
      .update(fs.readFileSync(artifactPath))
      .digest('hex');
    const sha256Path = `${artifactPath}.sha256`;
    fs.writeFileSync(sha256Path, `${hash}  ${baseName}\n`);
    additionalArtifacts.push(sha256Path);
    console.log(`  • ${baseName}.sha256 を生成`);

    if (!canSign) {
      continue;
    }

    // <artifact>.sha256 へのデタッチ署名（<artifact>.sha256.asc）
    const ascPath = `${sha256Path}.asc`;
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
    args.push(sha256Path);

    try {
      execFileSync('gpg', args, { stdio: 'inherit' });
      additionalArtifacts.push(ascPath);
      console.log(`  • ${baseName}.sha256.asc を生成（GPG 署名）`);
    } catch {
      console.warn(
        `  • ${baseName}.sha256 の GPG 署名に失敗（署名鍵が無い等）。チェックサムのみ同梱します。`,
      );
    }
  }

  return additionalArtifacts;
};
