[CmdletBinding()]
param(
  [int]$Port = 0,
  [switch]$OpenBrowser
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
  throw "The production build is missing. Run .\scripts\setup-study-hub.ps1 or npm run build first."
}
if (-not (Test-Path -LiteralPath $context.ViteCli -PathType Leaf)) {
  throw "Vite is not installed in this project. Run .\scripts\setup-study-hub.ps1 first."
}

New-Item -ItemType Directory -Path $context.StateDirectory -Force | Out-Null
try {
  $lockStream = [System.IO.File]::Open(
    $context.LockPath,
    [System.IO.FileMode]::OpenOrCreate,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
  )
} catch {
  throw "Another Study Hub startup attempt is already running. Wait a few seconds and retry."
}

try {
  $state = Get-StudyHubState -Context $context
  if ($state) {
    if (Test-StudyHubManagedProcess -State $state -Context $context) {
      $url = [string]$state.url
      if (Test-StudyHubServer -Url $url) {
        Write-Host "Study Hub is already running at $url"
        if ($OpenBrowser) {
          Start-Process $url
        }
        return
      }
      throw "The recorded Study Hub process is still running but is not serving the application. Check logs in $($context.StateDirectory); no additional server was started."
    } else {
      Remove-Item -LiteralPath $context.StatePath -Force
    }
  }

  $arguments = "`"$($context.ViteCli)`" preview --host 127.0.0.1 --port $Port"
  try {
    $serverProcess = Start-Process `
      -FilePath $context.NodePath `
      -ArgumentList $arguments `
      -WorkingDirectory $context.Root `
      -RedirectStandardOutput $context.StandardOutputPath `
      -RedirectStandardError $context.StandardErrorPath `
      -WindowStyle Hidden `
      -PassThru
  } catch {
    throw "The local production server could not be started: $($_.Exception.Message)"
  }

  $state = [pscustomobject]@{
    root = $context.Root
    processId = $serverProcess.Id
    requestedPort = $Port
    port = $Port
    url = "http://127.0.0.1:$Port"
    standardOutput = $context.StandardOutputPath
    standardError = $context.StandardErrorPath
    startedAt = [DateTime]::UtcNow.ToString("o")
  }
  Write-StudyHubState -Context $context -State $state

  $readyUrl = $null
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $serverProcess.Refresh()
    if ($serverProcess.HasExited) {
      break
    }
    if (Test-Path -LiteralPath $context.StandardOutputPath -PathType Leaf) {
      $output = Get-Content -LiteralPath $context.StandardOutputPath -Raw
      if ($null -eq $output) {
        $output = ""
      }
      $output = [regex]::Replace([string]$output, "\x1b\[[0-9;]*m", "")
      $urlMatch = [regex]::Match(
        [string]$output,
        "http://(?:127\.0\.0\.1|localhost):(?<port>\d+)/?",
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
      )
      if ($urlMatch.Success) {
        $candidateUrl = "http://127.0.0.1:$($urlMatch.Groups["port"].Value)"
        if (Test-StudyHubServer -Url $candidateUrl) {
          $readyUrl = $candidateUrl
          break
        }
      }
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $readyUrl) {
    $diagnostics = @()
    foreach ($logPath in @($context.StandardOutputPath, $context.StandardErrorPath)) {
      if (Test-Path -LiteralPath $logPath -PathType Leaf) {
        $diagnostics += Get-Content -LiteralPath $logPath -Tail 12
      }
    }
    $detail = if ($diagnostics.Count) { "`n$($diagnostics -join "`n")" } else { "" }
    throw "Study Hub did not become ready. Check the startup logs in $($context.StateDirectory).$detail"
  }

  $state.url = $readyUrl
  $state.port = [int]([uri]$readyUrl).Port
  Write-StudyHubState -Context $context -State $state
  Write-Host "Study Hub is running locally at $readyUrl"
  if ($state.port -ne $Port) {
    Write-Warning "Preferred port $Port was occupied. Browser data is origin-specific; keep using $readyUrl to reach data stored for this port."
  }
  if ($OpenBrowser) {
    Start-Process $readyUrl
  }
} finally {
  $lockStream.Dispose()
}
