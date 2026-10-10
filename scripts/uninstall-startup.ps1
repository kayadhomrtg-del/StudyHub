[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "StudyHub.Common.psm1") -Force
$context = Get-StudyHubProjectContext
if ([string]::IsNullOrWhiteSpace($env:APPDATA)) {
  throw "The current user's APPDATA directory is not available."
}

$shortcutPath = Join-Path (
  Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
) $context.StartupShortcutName
if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
  Write-Host "No startup shortcut for this project was found."
  return
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$expectedScript = Join-Path $PSScriptRoot "start-study-hub.ps1"
if (
  -not [string]::Equals(
    [System.IO.Path]::GetFullPath($shortcut.TargetPath),
    [System.IO.Path]::GetFullPath((Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe")),
    [System.StringComparison]::OrdinalIgnoreCase
  ) -or
  $shortcut.Arguments.IndexOf($expectedScript, [System.StringComparison]::OrdinalIgnoreCase) -lt 0
) {
  throw "The project-specific startup shortcut has been changed and was left untouched: $shortcutPath"
}

Remove-Item -LiteralPath $shortcutPath -Force
Write-Host "Removed this project's per-user startup shortcut. The server, project files, browser data, and backups were not changed."
