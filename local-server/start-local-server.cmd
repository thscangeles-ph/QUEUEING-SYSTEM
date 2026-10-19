@echo off
rem THSC Queue Board - local queue server. Keep this window open (you can minimize it).
rem Closing this window stops the queue for every computer that uses this server.
cd /d "%~dp0.."
title THSC Queue Server - keep this window open
if exist "local-server\settings.cmd" goto have_settings
echo The local server is not set up yet. Double-click local-server\install-local-server.cmd first.
pause
exit /b 1
:have_settings
call "local-server\settings.cmd"
if exist ".next\BUILD_ID" goto built
echo The app is not built yet. Double-click local-server\install-local-server.cmd first.
pause
exit /b 1
:built
rem Only one server can use the port: if it is already running (e.g. started with Windows), stop here.
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if errorlevel 1 goto start_server
echo The queue server is already running on this computer (port %PORT%).
timeout /t 10
exit /b
:start_server
set "QUEUE_STORE=file"
set "NODE_ENV=production"
if not defined QUEUE_DATA_FILE set "QUEUE_DATA_FILE=%LOCALAPPDATA%\THSC-Queue\queue.json"
echo.
echo  THSC Queue Board - local server
echo  On this computer:  http://localhost:%PORT%
echo  Other computers:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|Loopback|Bluetooth' } | ForEach-Object { $t = if ($_.InterfaceAlias -match 'Wi-?Fi|Wireless|WLAN') { 'Wi-Fi:     ' } elseif ($_.InterfaceAlias -match 'Ethernet') { 'LAN cable: ' } else { $_.InterfaceAlias + ': ' }; '                    ' + $t + 'http://' + $_.IPAddress + ':%PORT%' }"
echo  Queue data:        %QUEUE_DATA_FILE%
echo.
:run
node node_modules\next\dist\bin\next start -H 0.0.0.0 -p %PORT%
echo.
echo The queue server stopped. Starting it again in 5 seconds (close this window to stop it)...
timeout /t 5 /nobreak >nul
goto run
