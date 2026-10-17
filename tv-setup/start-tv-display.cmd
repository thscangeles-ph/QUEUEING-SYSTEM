@echo off
rem THSC Queue Board - lobby TV.
rem Opens the TV display full screen in Microsoft Edge with sound allowed, so no one has to click.
rem To start it whenever the TV computer turns on: press Windows+R, type shell:startup, press Enter,
rem and copy this file into the folder that opens. To close the TV display, press Alt+F4.

set "SITE=https://queueing-system-self.vercel.app"
rem A local queue server (local-server\install-local-server.cmd) writes its address into queue-server.txt
rem next to this file; on another computer, create that file with the address, e.g. http://192.168.1.20:3000
if exist "%~dp0queue-server.txt" set /p SITE=<"%~dp0queue-server.txt"

rem Wait up to 90 seconds for the queue server (it may still be starting when the computer turns on).
powershell -NoProfile -Command "for ($i = 0; $i -lt 45; $i++) { try { Invoke-WebRequest -UseBasicParsing '%SITE%/api/queue' -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep 2 } }" >nul 2>nul
set "TV_URL=%SITE%/queue/display"

rem A separate Edge profile so these settings apply even if Edge is already open.
start "" msedge --kiosk "%TV_URL%" --edge-kiosk-type=fullscreen --no-first-run --autoplay-policy=no-user-gesture-required --user-data-dir="%LOCALAPPDATA%\THSC-TV"
