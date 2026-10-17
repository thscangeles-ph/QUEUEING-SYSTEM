@echo off
rem THSC Queue Board - front desk computer with the lobby TV as an extended (second) screen.
rem Opens the front desk on the main screen and the TV display full screen on the extended screen,
rem with sound allowed, so no one has to click on the TV.
rem In Windows display settings, choose "Extend these displays" (Windows+P, then Extend).
rem To start it whenever the computer turns on: press Windows+R, type shell:startup, press Enter,
rem and copy this file into the folder that opens. To close the TV display, click it and press Alt+F4.

set "SITE=https://queueing-system-self.vercel.app"
rem A local queue server (local-server\install-local-server.cmd) writes its address into queue-server.txt
rem next to this file; on another computer, create that file with the address, e.g. http://192.168.1.20:3000
if exist "%~dp0queue-server.txt" set /p SITE=<"%~dp0queue-server.txt"

rem Wait up to 90 seconds for the queue server (it may still be starting when the computer turns on).
powershell -NoProfile -Command "for ($i = 0; $i -lt 45; $i++) { try { Invoke-WebRequest -UseBasicParsing '%SITE%/api/queue' -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep 2 } }" >nul 2>nul

rem Find the extended screen: the top-left corner of the first screen that is not the main one.
set "TV_X="
for /f "tokens=1,2" %%a in ('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $s = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1; if ($s) { '{0} {1}' -f ($s.Bounds.X + 50), ($s.Bounds.Y + 50) }"') do (
  set "TV_X=%%a"
  set "TV_Y=%%b"
)

rem Front desk on the main screen (normal Edge, where the staff PIN is saved).
start "" msedge --new-window "%SITE%/"

if not defined TV_X (
  echo No extended screen found. Press Windows+P and choose Extend, then run this file again.
  echo The front desk has been opened on this screen.
  timeout /t 15
  exit /b
)

rem TV display full screen on the extended screen, with its own Edge profile so the kiosk settings apply.
start "" msedge --kiosk "%SITE%/queue/display" --edge-kiosk-type=fullscreen --no-first-run --autoplay-policy=no-user-gesture-required --user-data-dir="%LOCALAPPDATA%\THSC-TV" --window-position=%TV_X%,%TV_Y%
