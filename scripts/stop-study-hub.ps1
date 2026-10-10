[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "StudyHub.Common.psm1") -Force
$context = Get-StudyHubProjectContext
$state = Get-StudyHubState -Context $context
if (-not $state) {
  Write-Host "No Study Hub server is recorded for this project."
  return
}

if (-not (Test-StudyHubManagedProcess -State $state -Context $context)) {
  Remove-Item -LiteralPath $context.StatePath -Force
  Write-Host "The recorded server is not running. Cleared this project's stale process record."
  return
}

$serverProcessId = [int]$state.processId
Stop-Process -Id $serverProcessId -ErrorAction Stop
Remove-Item -LiteralPath $context.StatePath -Force
Write-Host "Stopped this project's local server (process $serverProcessId). Application files and browser data were not changed."
