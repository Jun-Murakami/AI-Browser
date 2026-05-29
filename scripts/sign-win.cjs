#!/usr/bin/env node

/**
 * electron-builder の `win.signtoolOptions.sign` カスタム関数。
 * Azure Key Vault に置いた証明書を AzureSignTool 経由で取り出して署名する。
 * 本体 exe と NSIS インストーラの両方がこのフックを通って署名される。
 *
 * 環境変数（.env から読み込むか、CI のシークレットで渡す）:
 *   AZURE_KEY_VAULT_URL           例: https://my-vault.vault.azure.net
 *   AZURE_KEY_VAULT_TENANT_ID     Azure AD テナント ID
 *   AZURE_KEY_VAULT_CLIENT_ID     Azure AD アプリの client id
 *   AZURE_KEY_VAULT_CLIENT_SECRET 省略時は managed identity (-kvm) を試行
 *   AZURE_KEY_VAULT_CERTIFICATE   Key Vault 内の証明書名
 *   AZURE_SIGN_TIMESTAMP_URL      省略時 http://timestamp.digicert.com
 *   SKIP_WIN_SIGN                 'true' で署名をスキップ（ローカル確認用）
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadDotEnv } = require(path.join(__dirname, 'load-env.cjs'));

// electron-builder の sign フックは npm script ではなく electron-builder
// プロセスから require されるため、.env が読み込まれていない可能性がある。
// ここで明示的に .env をロードする（既存の env は上書きしない）。
loadDotEnv();

function findAzureSignTool() {
  for (const name of ['AzureSignTool', 'azuresigntool', 'AzureSignTool.exe']) {
    try {
      execFileSync(name, ['--version'], { stdio: 'ignore' });
      return name;
    } catch {
      // 次を試す
    }
  }
  return null;
}

exports.default = async function sign(configuration) {
  const target = configuration.path;
  if (!target || !fs.existsSync(target)) {
    console.warn(`[sign-win] skip: target not found (${target})`);
    return;
  }

  if (process.env.SKIP_WIN_SIGN === 'true') {
    console.log(`[sign-win] SKIP_WIN_SIGN=true → skip ${target}`);
    return;
  }

  const required = [
    'AZURE_KEY_VAULT_URL',
    'AZURE_KEY_VAULT_TENANT_ID',
    'AZURE_KEY_VAULT_CLIENT_ID',
    'AZURE_KEY_VAULT_CERTIFICATE',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[sign-win] Azure Key Vault の設定が不足しています: ${missing.join(', ')}（SKIP_WIN_SIGN=true でスキップ可）`,
    );
  }

  const tool = findAzureSignTool();
  if (!tool) {
    throw new Error(
      '[sign-win] AzureSignTool が見つかりません。`dotnet tool install --global AzureSignTool` でインストールしてください。',
    );
  }

  const timestampUrl =
    process.env.AZURE_SIGN_TIMESTAMP_URL || 'http://timestamp.digicert.com';

  const args = [
    'sign',
    '-kvu', process.env.AZURE_KEY_VAULT_URL,
    '-kvt', process.env.AZURE_KEY_VAULT_TENANT_ID,
    '-kvi', process.env.AZURE_KEY_VAULT_CLIENT_ID,
    '-kvc', process.env.AZURE_KEY_VAULT_CERTIFICATE,
    '-tr', timestampUrl,
    '-td', 'sha256',
    '-fd', 'sha256',
    '-v',
  ];
  if (process.env.AZURE_KEY_VAULT_CLIENT_SECRET) {
    args.push('-kvs', process.env.AZURE_KEY_VAULT_CLIENT_SECRET);
  } else {
    // managed identity フォールバック
    args.push('-kvm');
  }
  args.push(target);

  console.log(`[sign-win] signing: ${target}`);
  execFileSync(tool, args, { stdio: 'inherit' });
};
