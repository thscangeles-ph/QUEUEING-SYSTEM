@echo off
setlocal
rem THSC Queue Board - stop the queue server completely (used by the update files before building).
rem The server window restarts the server by itself when it stops (start-local-server.cmd), so its window
rem (the restart loop) is closed first, then any server still on the port. Usage: stop-queue-server.cmd [port]
set "STOP_PORT=%~1"
if not defined STOP_PORT set "STOP_PORT=3000"
taskkill /fi "WINDOWTITLE eq THSC Queue Server*" /t /f >nul 2>nul
taskkill /fi "WINDOWTITLE eq Administrator:  THSC Queue Server*" /t /f >nul 2>nul
powershell -NoProfile -Command "$loops = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'start-local-server\.cmd|START-SERVER\.cmd' }; foreach ($p in $loops) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }; $servers = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'next[\\/]dist[\\/]bin[\\/]next.*start|app[\\/]server\.js' }; foreach ($p in $servers) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }; for ($i = 0; $i -lt 8; $i++) { Get-NetTCPConnection -LocalPort %STOP_PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 1 }; if (Get-NetTCPConnection -LocalPort %STOP_PORT% -State Listen -ErrorAction SilentlyContinue) { Write-Host '  The queue server could not be stopped. Restart this computer, then run the update again.'; exit 1 }"
exit /b %errorlevel%
