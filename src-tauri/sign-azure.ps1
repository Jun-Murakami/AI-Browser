# Tauri の bundle.windows.signCommand から 1 ファイルずつ呼ばれる署名ラッパー
# （signCommand は build_windows_release.ps1 が --config で絶対パスで付ける）
# （DialogSuite の sign-azure.ps1 と同じ方式）。
#
# Tauri はバンドル過程で多数の PE（本体 exe、WiX 自身の DLL、一時ファイル等）に対して署名コマンドを呼ぶ。
# それら全部を Azure Key Vault で署名すると遅く無意味なので「許可リスト方式」にし、
# 実際に配布する成果物だけを署名して、それ以外は exit 0 で素通りさせる。
#   - 本体 exe         : target\...\release\ 直下の .exe
#   - MSI インストーラ : *.msi
#   - NSIS インストーラ: *-setup.exe
# Tauri はカスタム署名コマンドの実行後に再検証しない（終了コードのみ見る）ため、この方式が成立する。
#
# 認証情報は Electron 版（v1.7.2）と同じ .env の変数を使う。
#   AZURE_KEY_VAULT_URL / AZURE_KEY_VAULT_CERTIFICATE           : Key Vault の URL と証明書名
#   AZURE_KEY_VAULT_TENANT_ID / _CLIENT_ID / _CLIENT_SECRET     : サービスプリンシパル
#   AZURE_SIGN_TIMESTAMP_URL                                     : 省略時 http://timestamp.digicert.com
#   SKIP_WIN_SIGN=true                                           : 署名をスキップ（ローカル確認用）
# Key Vault の設定が無ければ署名せずに通す。
# シークレットをコマンドライン引数に載せないよう、サービスプリンシパルは AZURE_CLIENT_ID などの
# 環境変数に移して -kvm（DefaultAzureCredential）で認証させる。az login のセッションでも動く。

param([Parameter(Mandatory = $true, Position = 0)][string]$FilePath)

$ErrorActionPreference = 'Stop'

# 署名する対象（配布物のみ）。いずれかに一致したものだけ署名する。
$signPatterns = @(
    '\.msi$',                          # MSI インストーラ
    '-setup\.exe$',                    # NSIS インストーラ
    '[\\/]release[\\/][^\\/]+\.exe$'   # 本体 exe（release 直下の exe のみ。サブフォルダの exe は対象外）
)

$shouldSign = $false
foreach ($pat in $signPatterns) {
    if ($FilePath -match $pat) { $shouldSign = $true; break }
}
if (-not $shouldSign) {
    Write-Host "sign-azure: skip -> $FilePath"
    exit 0
}

# リポジトリ直下の .env を読み込む（既に設定されている環境変数は上書きしない）
$envPath = Join-Path $PSScriptRoot '..\.env'
if (Test-Path -LiteralPath $envPath) {
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
        if (-not (Test-Path -LiteralPath "env:$key")) {
            Set-Item -LiteralPath "env:$key" -Value $value
        }
    }
}

if ($env:SKIP_WIN_SIGN -eq 'true') {
    Write-Host "sign-azure: SKIP_WIN_SIGN=true -> skip $FilePath" -ForegroundColor Yellow
    exit 0
}

# Key Vault の設定が無い環境（コントリビューターの手元など）では署名せずにビルドを通す。
# 配布用の build_windows_release.ps1 は事前に設定を確認するので、リリースが無署名になることはない
foreach ($required in @('AZURE_KEY_VAULT_URL', 'AZURE_KEY_VAULT_CERTIFICATE')) {
    if (-not (Test-Path -LiteralPath "env:$required")) {
        Write-Warning "sign-azure: $required が無いため署名しません -> $FilePath"
        exit 0
    }
}

# サービスプリンシパルを DefaultAzureCredential（EnvironmentCredential）の変数名に移す
if ($env:AZURE_KEY_VAULT_TENANT_ID -and -not $env:AZURE_TENANT_ID) { $env:AZURE_TENANT_ID = $env:AZURE_KEY_VAULT_TENANT_ID }
if ($env:AZURE_KEY_VAULT_CLIENT_ID -and -not $env:AZURE_CLIENT_ID) { $env:AZURE_CLIENT_ID = $env:AZURE_KEY_VAULT_CLIENT_ID }
if ($env:AZURE_KEY_VAULT_CLIENT_SECRET -and -not $env:AZURE_CLIENT_SECRET) { $env:AZURE_CLIENT_SECRET = $env:AZURE_KEY_VAULT_CLIENT_SECRET }

$timestampUrl = if ($env:AZURE_SIGN_TIMESTAMP_URL) { $env:AZURE_SIGN_TIMESTAMP_URL } else { 'http://timestamp.digicert.com' }

Write-Host "sign-azure: signing -> $FilePath"
& azuresigntool sign `
    -kvu $env:AZURE_KEY_VAULT_URL `
    -kvc $env:AZURE_KEY_VAULT_CERTIFICATE `
    -kvm `
    -tr $timestampUrl `
    -td sha256 `
    -fd sha256 `
    "$FilePath"

exit $LASTEXITCODE
