[CmdletBinding()]
param(
  [int]$Port = 0,
  [switch]$OpenBrowserAtSignIn
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "StudyHub.Common.psm1") -Force
$context = Get-StudyHubProjectContext

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
if (-not (Test-Path -LiteralPath (Join-Path $context.Root "dist\index.html") -PathType Leaf)) {
  throw "Build the production application first with .\scripts\setup-study-hub.ps1 or npm run build."
}

if ([string]::IsNullOrWhiteSpace($env:APPDATA)) {
  throw "The current user's APPDATA directory is not available."
}
$startupDirectory = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
New-Item -ItemType Directory -Path $startupDirectory -Force | Out-Null
$shortcutPath = Join-Path $startupDirectory $context.StartupShortcutName
$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path -LiteralPath $powershellPath -PathType Leaf)) {
  throw "Windows PowerShell could not be found at its standard Windows path: $powershellPath"
}

$argumentList = @(
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy Bypass",
  "-WindowStyle Hidden",
  "-File `"$($PSScriptRoot)\start-study-hub.ps1`"",
  "-Port $Port"
)
if ($OpenBrowserAtSignIn) {
  $argumentList += "-OpenBrowser"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = $argumentList -join " "
$shortcut.WorkingDirectory = $context.Root
$shortcut.Description = "Start the local College Study Hub production application at Windows sign-in."
$shortcut.Save()

$browserBehavior = if ($OpenBrowserAtSignIn) { "The default browser will also open at sign-in." } else { "The browser will not open automatically." }
Write-Host "Automatic startup is installed for this Windows user: $shortcutPath"
Write-Host "The local server will start on port $Port. $browserBehavior"
