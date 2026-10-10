function Get-StudyHubProjectContext {
  $projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  $viteCli = Join-Path $projectRoot "node_modules\vite\bin\vite.js"
  $nodeCommand = Get-Command node -ErrorAction Stop
  $localAppData = $env:LOCALAPPDATA
  if ([string]::IsNullOrWhiteSpace($localAppData)) {
    $localAppData = Join-Path $HOME "AppData\Local"
  }

  $normalizedRoot = [System.IO.Path]::GetFullPath($projectRoot).TrimEnd("\").ToLowerInvariant()
  $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $rootHash = [System.BitConverter]::ToString(
      $hashAlgorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($normalizedRoot))
    ).Replace("-", "").Substring(0, 12).ToLowerInvariant()
  } finally {
    $hashAlgorithm.Dispose()
  }

  $stateDirectory = Join-Path $localAppData (Join-Path "CollegeStudyHub" $rootHash)
  [pscustomobject]@{
    Root = $projectRoot
    ViteCli = $viteCli
    NodePath = $nodeCommand.Source
    StateDirectory = $stateDirectory
    StatePath = Join-Path $stateDirectory "server.json"
    LockPath = Join-Path $stateDirectory "startup.lock"
    StandardOutputPath = Join-Path $stateDirectory "server.stdout.log"
    StandardErrorPath = Join-Path $stateDirectory "server.stderr.log"
    StartupShortcutName = "College Study Hub - $rootHash.lnk"
  }
}

function Get-StudyHubState {
  param([Parameter(Mandatory = $true)]$Context)
  if (-not (Test-Path -LiteralPath $Context.StatePath -PathType Leaf)) {
    return $null
  }
  try {
    return Get-Content -LiteralPath $Context.StatePath -Raw | ConvertFrom-Json
  } catch {
    throw "The local server state file is invalid: $($Context.StatePath). Stop the server manually if needed, then remove only that state file."
  }
}

function Test-StudyHubManagedProcess {
  param(
    [Parameter(Mandatory = $true)]$State,
    [Parameter(Mandatory = $true)]$Context
  )
  $serverProcessId = 0
  if (-not [int]::TryParse([string]$State.processId, [ref]$serverProcessId) -or $serverProcessId -le 0) {
    return $false
  }

  $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $serverProcessId" -ErrorAction SilentlyContinue
  if (-not $processInfo) {
    return $false
  }
  $expectedNodePath = [System.IO.Path]::GetFullPath($Context.NodePath)
  $actualNodePath = [System.IO.Path]::GetFullPath([string]$processInfo.ExecutablePath)
  $commandLine = [string]$processInfo.CommandLine
  return (
    [string]::Equals($expectedNodePath, $actualNodePath, [System.StringComparison]::OrdinalIgnoreCase) -and
    $commandLine.IndexOf($Context.ViteCli, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $commandLine.IndexOf("preview", [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $commandLine.IndexOf("127.0.0.1", [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  )
}

function Test-StudyHubServer {
  param([Parameter(Mandatory = $true)][string]$Url)
  if ($Url -notmatch "^http://127\.0\.0\.1:\d+$") {
    return $false
  }
  try {
    $response = Invoke-WebRequest -Uri "$Url/" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content.Contains("<title>College Study Hub</title>")
  } catch {
    return $false
  }
}

function Write-StudyHubState {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)]$State
  )
  $temporaryPath = "$($Context.StatePath).$PID.tmp"
  $json = $State | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($temporaryPath, $json, [System.Text.Encoding]::UTF8)
  Move-Item -LiteralPath $temporaryPath -Destination $Context.StatePath -Force
}

Export-ModuleMember -Function @(
  "Get-StudyHubProjectContext",
  "Get-StudyHubState",
  "Test-StudyHubManagedProcess",
  "Test-StudyHubServer",
  "Write-StudyHubState"
)
