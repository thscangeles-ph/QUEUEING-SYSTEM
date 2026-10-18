@echo off
setlocal
rem THSC Queue Board - make this computer the clinic's queue server.
rem This package already contains the app and Node.js: no internet, installation or build is needed.
cd /d "%~dp0"
title THSC Queue Board - server setup
echo.
echo  THSC Queue Board - server setup
echo  ==============================
echo.
if exist "node\node.exe" if exist "app\server.js" goto files_ok
echo The files are missing. Close this window, right-click the ZIP file, choose "Extract All...",
echo and run SETUP.cmd from the extracted THSC-Queue-Server folder (not from inside the ZIP).
pause
exit /b 1
:files_ok

rem ---- 1. Staff PIN and port, saved on this computer only (settings.cmd) ----
if exist "settings.cmd" goto have_settings
echo Choose the staff PIN (at least 4 characters, numbers are easiest).
echo Staff type it once on each computer to use the front desk and stations.
:ask_pin
set "PIN="
set /p "PIN=Staff PIN: "
if not defined PIN goto ask_pin
if "%PIN:~3,1%"=="" (echo Use at least 4 characters.& goto ask_pin)
> "settings.cmd" echo set "QUEUE_STAFF_PIN=%PIN%"
>> "settings.cmd" echo set "PORT=3000"
>> "settings.cmd" echo set "QUEUE_DATA_FILE=%LOCALAPPDATA%\THSC-Queue\queue.json"
echo Saved. To change the PIN later, edit settings.cmd with Notepad.
:have_settings
call "settings.cmd"

rem ---- 2. Let the other computers and phones on the clinic network reach this computer ----
powershell -NoProfile -Command "if (Get-NetFirewallRule -DisplayName 'THSC Queue Board' -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 goto firewall_done
echo.
echo Windows will ask for permission to open port %PORT% for the queue server. Click Yes.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile -Command New-NetFirewallRule -DisplayName ''THSC Queue Board'' -Direction Inbound -Protocol TCP -LocalPort %PORT% -Action Allow -Profile Private,Domain'"
:firewall_done
powershell -NoProfile -Command "if (Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }) { Write-Host ''; Write-Host 'NOTE: this computer treats the clinic network as a Public network, which blocks the other computers.'; Write-Host 'Open Settings > Network and Internet > (your Wi-Fi or Ethernet) > Properties and choose Private network.' }"

rem ---- 3. The TV startup files in tv-setup open this computer's server ----
> "tv-setup\queue-server.txt" echo http://localhost:%PORT%

rem ---- 4. Start with Windows ----
echo.
choice /c YN /m "Start the queue server automatically when this computer turns on"
if errorlevel 2 goto no_autostart
> "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\THSC Queue Server.cmd" echo @start "THSC Queue Server" /min "%CD%\START-SERVER.cmd"
echo The queue server will start by itself when Windows starts.
:no_autostart

echo.
echo  Starting the queue server...
start "THSC Queue Server" /min "%CD%\START-SERVER.cmd"
timeout /t 6 /nobreak >nul
start "" "http://localhost:%PORT%/"
echo.
echo  Done. On the other computers, tablets and the TV, open one of these addresses:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { '    http://' + $_.IPAddress + ':%PORT%' }"
echo.
echo  Front desk: the address above.  Stations: add /queue/station?s=C1.  TV: add /queue/display.
echo  Keep the minimized "THSC Queue Server" window open while the clinic is running.
pause
