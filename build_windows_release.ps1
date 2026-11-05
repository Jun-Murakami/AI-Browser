# Requires: PowerShell 7+, Node 22+, Rust stable, AzureSignTool（コード署名する場合）
# Purpose : Tauri 版の Windows MSI をビルド・コード署名し、release/ と latest.json に追加する。
#           最後に確認のうえ GitHub Releases に下書きとしてアップロードする。
#
# DialogSuite の build_windows_release.ps1 と同じ流れで、配布先だけ Firebase Hosting ではなく
# GitHub Releases にしている（OSS のため）。macOS 版は先に build_macos.zsh で release/ に追加しておく
# （このフォルダは mac と同期している）。

[CmdletBinding()]
param(
  [string]$KeyPath = "$PSScriptRoot\.tauri\myapp.key",
  # アップデータ署名鍵のパスワード（既定の鍵はパスワード無しなので通常は不要）
  [string]$KeyPassword = "",
  # リリースノートの本文（省略時は対話入力）
  [string]$ReleaseNotes = "",
  # リリースノートを外部ファイルから読み込む場合のパス（-ReleaseNotes より優先）
  [string]$ReleaseNotesFile = "",
  # Authenticode コード署名（Azure Key Vault）をスキップする場合に指定
  [switch]$SkipCodeSign,
  # GitHub にプレリリースとして作る（releases/latest に出ないので既存ユーザーに届かない）
  [switch]$Prerelease,
  # 署名に使う AzureSignTool のコマンド/パス（既定: PATH 上の azuresigntool）
  [string]$AzureSignToolPath = "azuresigntool"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# リポジトリ直下の .env を読み込む（既に設定されている環境変数は上書きしない）
function Import-DotEnv {
  $envPath = Join-Path $PSScriptRoot '.env'
  if (-not (Test-Path -LiteralPath $envPath)) { return }
  foreach ($rawLine in Get-Content -LiteralPath $envPath) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $eq = $line.IndexOf('=')
    if ($eq -le 0) { continue }
    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if (-not (Test-Path -LiteralPath "env:$key")) { Set-Item -LiteralPath "env:$key" -Value $value }
  }
}

# =========================
# Authenticode コード署名（Azure Key Vault + AzureSignTool）
# bundle.windows.signCommand により tauri build が exe → MSI の順に署名し、
# その後にアップデータ用の .sig を生成する（ビルド後に手動署名すると .sig が不一致になり自動更新が壊れる）。
# 署名対象は src-tauri/sign-azure.ps1 が「配布物（本体 exe / MSI）だけ」に絞る（許可リスト方式）。
# 署名コマンドとアップデータ用ファイルの生成は一時 JSON にして `tauri build --config` で重ねる。
# tauri.conf.json 自体は書き換えない（書き換えると改行や整形が変わり、同期先の mac も含めて作業ツリーが汚れる）。
# =========================

function Assert-CodeSignPrereqs {
  if (-not (Get-Command $AzureSignToolPath -ErrorAction SilentlyContinue)) {
    throw "AzureSignTool ('$AzureSignToolPath') が見つかりません。'dotnet tool install --global AzureSignTool' で導入するか、-SkipCodeSign を指定してください。"
  }
  foreach ($name in @('AZURE_KEY_VAULT_URL', 'AZURE_KEY_VAULT_CERTIFICATE')) {
    if (-not (Test-Path -LiteralPath "env:$name")) {
      throw "$name が設定されていません（.env を確認するか、-SkipCodeSign を指定してください）。"
    }
  }
  $hasSp = $env:AZURE_KEY_VAULT_CLIENT_ID -and $env:AZURE_KEY_VAULT_TENANT_ID -and $env:AZURE_KEY_VAULT_CLIENT_SECRET
  $hasAzCli = [bool](Get-Command az -ErrorAction SilentlyContinue)
  if (-not ($hasSp -or $hasAzCli)) {
    throw "Azure Key Vault への認証情報が見つかりません。.env のサービスプリンシパル（AZURE_KEY_VAULT_CLIENT_ID/TENANT_ID/CLIENT_SECRET）か 'az login' を用意するか、-SkipCodeSign を指定してください。"
  }
  $authMode = if ($hasSp) { "サービスプリンシパル (.env)" } else { "Azure CLI セッション" }
  Write-Host "  コード署名の認証方式: $authMode" -ForegroundColor DarkCyan
}

# PowerShell 実行ファイルの絶対パスを解決（Tauri バンドラの子プロセスは PATH に pwsh/powershell が
# 無いことがあるため、cmd を絶対パスにして "program not found" を防ぐ）。
function Resolve-PwshPath {
  foreach ($name in @('pwsh', 'powershell')) {
    $c = Get-Command $name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
  }
  $fallback = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  if (Test-Path -LiteralPath $fallback) { return $fallback }
  throw "PowerShell 実行ファイル(pwsh/powershell)が見つかりません。"
}

# ビルド時だけ tauri.conf.json に重ねる設定を一時ファイルに書き出し、そのパスを返す。
# 署名コマンドは tauri.conf.json には書かず、ここで絶対パスで足す
# （相対パスだと tauri build の作業ディレクトリによって見つからない。DialogSuite も同じ理由で絶対パス化している）。
# そのため、署名鍵や Azure の無い環境でも素の `tauri build` は署名なしで通る。
function New-BuildConfigOverride {
  if ($SkipCodeSign) {
    $signCommand = $null
    Write-Host "  -SkipCodeSign: 署名コマンドを付けずにビルドします。" -ForegroundColor Yellow
  } else {
    $wrapperPath = Join-Path $PSScriptRoot 'src-tauri\sign-azure.ps1'
    $signCommand = [ordered]@{
      cmd = (Resolve-PwshPath)
      args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $wrapperPath, '%1')
    }
  }
  # アップデータ用の .sig はリリース時だけ作る（署名鍵の無い環境でも tauri build が通るよう、
  # tauri.conf.json では有効にしていない）
  $override = @{ bundle = @{ createUpdaterArtifacts = $true; windows = @{ signCommand = $signCommand } } }
  $path = Join-Path ([System.IO.Path]::GetTempPath()) "ai-browser-build-$([guid]::NewGuid()).json"
  [System.IO.File]::WriteAllText($path, ($override | ConvertTo-Json -Depth 10), [System.Text.UTF8Encoding]::new($false))
  return $path
}

# tauri build（MSI のみ）を実行し、署名フェーズの冗長な出力をコンソールから抑える。
# 全文は tauri-build.log に保存（失敗時は末尾を表示）。
function Invoke-FilteredTauriBuild {
  param([string]$ConfigOverridePath)
  $buildLog = Join-Path $PSScriptRoot 'tauri-build.log'
  $dropPatterns = @(
    '^File: ', 'Successfully verified:', 'SignTool Error: No signature found',
    '^\s*Number of errors:\s*\d+\s*$', '^Index\s+Algorithm\s+Timestamp', '^=+\s*$',
    'with a custom signing command\s*$', '^\s+Signing [A-Za-z]:[\\/]',
    'Signing Output of signing command:', 'sign-azure: skip', '^\s*$'
  )
  # --bundles msi: Windows は MSI のみ生成（DialogSuite と同じ）
  # --ci: 対話入力をしない（パスワード無しの鍵で TAURI_SIGNING_PRIVATE_KEY_PASSWORD が無くても止まらない）
  $tauriArgs = @('--bundles', 'msi', '--ci', '--config', $ConfigOverridePath)
  npm run tauri build -- @tauriArgs 2>&1 | Tee-Object -FilePath $buildLog | ForEach-Object {
    $line = if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { [string]$_ }
    $drop = $false
    foreach ($p in $dropPatterns) { if ($line -match $p) { $drop = $true; break } }
    if (-not $drop) { Write-Host $line }
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "--- tauri build 失敗。ログ末尾40行（全文: $buildLog） ---" -ForegroundColor Red
    Get-Content -LiteralPath $buildLog -Tail 40 | ForEach-Object { Write-Host $_ }
    throw "tauri build に失敗しました (exit $LASTEXITCODE)"
  }
}

function Invoke-Node {
  node @args
  if ($LASTEXITCODE -ne 0) { throw "node $($args -join ' ') に失敗しました (exit $LASTEXITCODE)" }
}

Import-DotEnv
$version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
Write-Host "AI-Browser v$version (Windows)" -ForegroundColor Cyan

Write-Host "[1/6] Set TAURI_SIGNING_PRIVATE_KEY" -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "アップデータ署名鍵が見つかりません: $KeyPath（npx tauri signer generate -w .tauri/myapp.key で作成）"
}
$env:TAURI_SIGNING_PRIVATE_KEY = $KeyPath
# この鍵はパスワード無し。ほかのプロジェクト用に TAURI_SIGNING_PRIVATE_KEY_PASSWORD が設定されていると
# それで復号しようとして失敗するので、-KeyPassword が無ければ消す（--ci により空パスワードで復号される）
if ($KeyPassword) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $KeyPassword
} else {
  Remove-Item -LiteralPath env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
}

if ($SkipCodeSign) {
  Write-Host "[1b/6] -SkipCodeSign: Authenticode 署名をスキップします" -ForegroundColor Yellow
  # tauri build を直接実行したときの既定（.env の SKIP_WIN_SIGN）にも反映させる
  $env:SKIP_WIN_SIGN = 'true'
} else {
  Write-Host "[1b/6] Verify code-signing prerequisites" -ForegroundColor Cyan
  Assert-CodeSignPrereqs
}

Write-Host "[2/6] Build (Windows, MSI$(if (-not $SkipCodeSign) { ', code-signed' }))" -ForegroundColor Cyan
# アプリ内のライセンス表示（src/renderer/src/assets/license.json）を更新
npm run licenses
if ($LASTEXITCODE -ne 0) { throw "npm run licenses に失敗しました (exit $LASTEXITCODE)" }
$configOverridePath = New-BuildConfigOverride
try {
  Invoke-FilteredTauriBuild -ConfigOverridePath $configOverridePath
} finally {
  Remove-Item -LiteralPath $configOverridePath -ErrorAction SilentlyContinue
}

Write-Host "[3/6] Locate MSI / MSI.sig" -ForegroundColor Cyan
$msiDir = Join-Path $PSScriptRoot 'src-tauri\target\release\bundle\msi'
$msi = Get-ChildItem -LiteralPath $msiDir -Filter "*_${version}_x64_*.msi" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $msi) { throw "MSI が見つかりません: $msiDir（バージョン $version）" }
$sigPath = "$($msi.FullName).sig"
if (-not (Test-Path -LiteralPath $sigPath)) { throw "アップデータ署名 (.sig) が見つかりません: $sigPath" }
Write-Host "  MSI    : $($msi.FullName)"
Write-Host "  MSI.sig: $sigPath"

if (-not $SkipCodeSign) {
  $authSig = Get-AuthenticodeSignature -LiteralPath $msi.FullName
  if ($authSig.Status -ne 'Valid') {
    throw "MSI の Authenticode 署名が無効です ($($authSig.Status)): $($authSig.StatusMessage)"
  }
  Write-Host "  Authenticode: Valid ($($authSig.SignerCertificate.Subject))" -ForegroundColor Green
}

# Electron 版のアップデータが "setup_win" を含む名前を拾うため、同じ命名にする
$destName = "AI-Browser-$version-setup_win_x64.msi"
Write-Host "[4/6] Add to release/ as $destName" -ForegroundColor Cyan
Invoke-Node scripts/release-manifest.mjs add --src $msi.FullName --name $destName --kind installer --checksum --sig $sigPath --platforms windows-x86_64

# リリースノート（引数 > ファイル > 対話入力 の優先順）
Write-Host "[5/6] Capture release notes" -ForegroundColor Cyan
$releaseNotesContent = $ReleaseNotes
if ([string]::IsNullOrWhiteSpace($releaseNotesContent) -and -not [string]::IsNullOrWhiteSpace($ReleaseNotesFile)) {
  if (-not (Test-Path -LiteralPath $ReleaseNotesFile)) { throw "Release notes file not found: $ReleaseNotesFile" }
  $releaseNotesContent = Get-Content -LiteralPath $ReleaseNotesFile -Raw
}
if ([string]::IsNullOrWhiteSpace($releaseNotesContent)) {
  Write-Host "  Enter release notes (finish with a single '.' on a line):" -ForegroundColor DarkCyan
  $lines = @()
  while ($true) {
    $line = Read-Host
    if ($line -eq '.') { break }
    $lines += $line
  }
  $releaseNotesContent = [string]::Join("`n", $lines)
}
$notesPath = Join-Path ([System.IO.Path]::GetTempPath()) "ai-browser-notes-$([guid]::NewGuid()).md"
[System.IO.File]::WriteAllText($notesPath, $releaseNotesContent, [System.Text.UTF8Encoding]::new($false))
try {
  Invoke-Node scripts/release-manifest.mjs notes --file $notesPath
} finally {
  Remove-Item -LiteralPath $notesPath -ErrorAction SilentlyContinue
}

$latestPath = Join-Path $PSScriptRoot 'release\latest.json'
$latest = Get-Content -LiteralPath $latestPath -Raw | ConvertFrom-Json
$platforms = @($latest.platforms.PSObject.Properties.Name)
Write-Host "[6/6] Done" -ForegroundColor Green
Write-Host "  - release/: $(Join-Path $PSScriptRoot 'release')"
Write-Host "  - latest.json のプラットフォーム: $($platforms -join ', ')"
if ($platforms -notcontains 'darwin-aarch64') {
  Write-Host "  [warn] macOS 版が latest.json にありません（先に mac で build_macos.zsh を実行）" -ForegroundColor Yellow
}

# GitHub Releases へのアップロード（下書き）。公開は GitHub 上で確認してから手動で行う
Write-Host ""
$answer = $null
try {
  $answer = Read-Host "GitHub Releases に v$version の下書きとしてアップロードしますか? (y/n)"
} catch {
  $answer = 'n'
}
if ($answer -match '^(y|Y)$') {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "GitHub CLI (gh) が見つかりません。release/ の中身を手動でアップロードしてください。" -ForegroundColor Red
  } else {
    $publishArgs = @('scripts/release-manifest.mjs', 'publish')
    if ($Prerelease) { $publishArgs += '--prerelease' }
    Invoke-Node @publishArgs
  }
} else {
  Write-Host "[Upload] スキップしました。後で 'node scripts/release-manifest.mjs publish' でも上げられます。" -ForegroundColor DarkYellow
}
