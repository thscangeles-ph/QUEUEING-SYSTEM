@echo off
setlocal
rem THSC Queue Board - make this computer the clinic's local queue server.
rem Double-click it once. Run it again after copying a new version of the app into this folder.
rem The front desk, stations, TV and patient phones on the clinic network then use this computer
rem instead of the Vercel website. Queue data stays on this computer.
cd /d "%~dp0.."
title THSC Queue Board - local server setup
echo.
echo  THSC Queue Board - local server setup
echo  ====================================
echo.

rem ---- 1. Node.js (runs the queue server) ----
where node >nul 2>nul
if not errorlevel 1 goto have_node
echo Node.js is not installed. Installing it now (this needs the internet)...
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if errorlevel 1 echo Could not install it automatically. Download the LTS version from https://nodejs.org and install it.
echo.
echo When the installation has finished, close this window and double-click
echo install-local-server.cmd again.
pause
exit /b
:have_node
for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% GEQ 20 goto node_ok
echo This computer has an old Node.js. Install the LTS version from https://nodejs.org and run this again.
pause
exit /b 1
:node_ok

rem ---- 2. Staff PIN and port, saved on this computer only (local-server\settings.cmd) ----
if exist "local-server\settings.cmd" goto have_settings
echo Choose the staff PIN. Staff type it once on each computer to use the front desk and stations.
:ask_pin
set "PIN="
set /p "PIN=Staff PIN: "
if not defined PIN goto ask_pin
> "local-server\settings.cmd" echo set "QUEUE_STAFF_PIN=%PIN%"
>> "local-server\settings.cmd" echo set "PORT=3000"
>> "local-server\settings.cmd" echo set "QUEUE_DATA_FILE=%LOCALAPPDATA%\THSC-Queue\queue.json"
echo Saved. To change the PIN later, edit local-server\settings.cmd with Notepad.
:have_settings
call "local-server\settings.cmd"

rem ---- 3. Download the app's parts and build it (needs the internet this once) ----
echo.
echo Installing the app. This takes a few minutes...
call npx --yes pnpm@11.25.0 install --frozen-lockfile
if errorlevel 1 goto failed
call npx --yes pnpm@11.25.0 build
if errorlevel 1 goto failed

rem ---- 4. Let the other computers and phones on the clinic network reach this computer ----
powershell -NoProfile -Command "if (Get-NetFirewallRule -DisplayName 'THSC Queue Board' -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 goto firewall_done
echo.
echo Windows will ask for permission to open port %PORT% for the queue server. Click Yes.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile -Command New-NetFirewallRule -DisplayName ''THSC Queue Board'' -Direction Inbound -Protocol TCP -LocalPort %PORT% -Action Allow -Profile Private,Domain'"
:firewall_done
powershell -NoProfile -Command "if (Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }) { Write-Host ''; Write-Host 'NOTE: this computer treats the clinic network as a Public network, which blocks the other computers.'; Write-Host 'Open Settings > Network and Internet > (your Wi-Fi or Ethernet) > Properties and choose Private network.' }"

rem ---- 5. The TV startup files on this computer open this local server ----
> "tv-setup\queue-server.txt" echo http://localhost:%PORT%

rem ---- 6. Start with Windows ----
echo.
choice /c YN /m "Start the queue server automatically when this computer turns on"
if errorlevel 2 goto no_autostart
> "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\THSC Queue Server.cmd" echo @start "THSC Queue Server" /min "%CD%\local-server\start-local-server.cmd"
echo The queue server will start by itself when Windows starts.
:no_autostart

rem ---- Open the front desk and the TV when the server starts (tv-setup\start-desk-and-tv.cmd) ----
if defined OPEN_DESK_AND_TV goto desk_tv_done
echo.
echo This computer can open the front desk, and the TV display full screen with sound on the
echo extended (second) screen, every time the queue server starts.
choice /c YN /m "Open the front desk and the TV display when the server starts"
if errorlevel 2 (>> "local-server\settings.cmd" echo set "OPEN_DESK_AND_TV=0") else (>> "local-server\settings.cmd" echo set "OPEN_DESK_AND_TV=1")
call "local-server\settings.cmd"
:desk_tv_done

echo.
echo  Done. Starting the queue server now...
echo.
start "THSC Queue Server" /min "%CD%\local-server\start-local-server.cmd"
timeout /t 8 /nobreak >nul
rem The server opens the front desk itself when it is set to open the desk and TV.
if not "%OPEN_DESK_AND_TV%"=="1" start "" "http://localhost:%PORT%/"
echo  On the other computers, tablets and the TV, open one of these addresses:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|Loopback|Bluetooth' } | ForEach-Object { $t = if ($_.InterfaceAlias -match 'Wi-?Fi|Wireless|WLAN') { 'Wi-Fi:     ' } elseif ($_.InterfaceAlias -match 'Ethernet') { 'LAN cable: ' } else { $_.InterfaceAlias + ': ' }; '    ' + $t + 'http://' + $_.IPAddress + ':%PORT%' }"
echo.
echo  Front desk: the address above.  Stations: add /queue/station?s=C1.  TV: add /queue/display.
echo  On another TV computer, put the address in tv-setup\queue-server.txt next to the TV startup file.
pause
exit /b

:failed
echo.
echo Setup did not finish. Check the internet connection and run install-local-server.cmd again.
pause
exit /b 1
