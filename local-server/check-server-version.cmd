@echo off
setlocal
rem THSC Queue Board - check that the queue server now runs the version that was just built (used by the update files).
rem Usage: check-server-version.cmd [port]. It waits up to 90 seconds for the server to answer.
set "CHECK_PORT=%~1"
if not defined CHECK_PORT set "CHECK_PORT=3000"
cd /d "%~dp0.."
powershell -NoProfile -Command "$want = (Get-Content -Raw '.next\BUILD_ID' -ErrorAction SilentlyContinue); if ($want) { $want = $want.Trim() }; for ($i = 0; $i -lt 45; $i++) { try { $info = Invoke-RestMethod -UseBasicParsing 'http://localhost:%CHECK_PORT%/api/server-info' -TimeoutSec 3; if ($info.build -and $info.build -eq $want) { Write-Host '  Checked: the queue server runs the new version.'; exit 0 } } catch { }; Start-Sleep -Seconds 2 }; Write-Host ''; Write-Host '  WARNING: the queue server is NOT running the new version yet: an old one is still running,'; Write-Host '  or it did not start. Restart this computer; the new version then starts by itself.'; exit 1"
exit /b %errorlevel%
