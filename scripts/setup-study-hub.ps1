[CmdletBinding()]
param(
  [int]$Port = 0,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

try {
  $nodeCommand = Get-Command node -ErrorAction Stop
  $npmCommand = Get-Command npm.cmd -ErrorAction Stop
} catch {
  throw "Install Node.js 22.12+ or 24.x (including npm), reopen PowerShell, then rerun this setup."
}

$nodeOutput = & $nodeCommand.Source --version
if ($LASTEXITCODE -ne 0 -or $nodeOutput -notmatch "^v(?<version>\d+\.\d+\.\d+)") {
  throw "Could not determine the installed Node.js version."
}
$nodeVersion = [version]$Matches.version
$nodeSupported = ($nodeVersion.Major -eq 22 -and $nodeVersion -ge [version]"22.12.0") -or
  ($nodeVersion.Major -eq 24) -or ($nodeVersion.Major -ge 26)
if (-not $nodeSupported) {
  throw "Node.js $nodeVersion is outside the supported test-runner range. Install Node.js 22.12+ (22.x), 24.x, or 26+."
}

$npmOutput = & $npmCommand.Source --version
if ($LASTEXITCODE -ne 0 -or $npmOutput -notmatch "^(?<version>\d+\.\d+\.\d+)") {
  throw "Could not determine the installed npm version."
}
$npmVersion = [version]$Matches.version
if ($npmVersion -lt [version]"10.0.0") {
  throw "npm 10 or newer is required; found npm $npmVersion. Update Node.js/npm and retry."
}

if ($Port -eq 0) {
  if ($env:STUDY_HUB_PORT) {
    if ($env:STUDY_HUB_PORT -notmatch "^\d+$") {
      throw "STUDY_HUB_PORT must be a whole number between 1024 and 65535."
    }
    $Port = [int]$env:STUDY_HUB_PORT
  } else {
    $Port = 4173
  }
}
if ($Port -lt 1024 -or $Port -gt 65535) {
  throw "The port must be a whole number between 1024 and 65535."
}

$projectPath = [System.IO.Path]::GetFullPath($projectRoot)
try {
  $runningProjectServers = @(
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -eq "node.exe" -and
        -not [string]::IsNullOrEmpty($_.CommandLine) -and
        $_.CommandLine.IndexOf($projectPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $_.CommandLine -match "(?i)(vite(?:\.js)?|serve-production\.mjs)"
      }
  )
} catch {
  throw "Could not safely check whether a Study Hub server is running. No dependencies were changed. Close the app's development/production server and retry."
}
if ($runningProjectServers.Count -gt 0) {
  $processIds = ($runningProjectServers | ForEach-Object { $_.ProcessId }) -join ", "
  throw "A Study Hub server is already running (process $processIds). Stop it before setup; npm ci replaces node_modules and cannot run safely while Vite is using native build files."
}

Push-Location $projectRoot
try {
  Write-Host "Installing locked project dependencies with npm ci..."
  & $npmCommand.Source ci
  if ($LASTEXITCODE -ne 0) {
    throw "npm ci failed with exit code $LASTEXITCODE. Review the npm output above."
  }

  Write-Host "Building the production application..."
  & $npmCommand.Source run build
  if ($LASTEXITCODE -ne 0) {
    throw "The production build failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

$startArguments = @{
  Port = $Port
}
if ($OpenBrowser) {
  $startArguments.OpenBrowser = $true
}
& (Join-Path $PSScriptRoot "start-study-hub.ps1") @startArguments
