@echo off
setlocal
rem THSC Queue Board - put Queue Board icons on this computer's desktop (the queue server):
rem   THSC Queue Board      opens the front desk
rem   THSC Front Desk + TV  opens the front desk, and the TV display full screen on the extended (second) screen
rem   THSC Queue Server     starts the queue server if it is not running
rem Double-click it again any time to put back an icon that was deleted.
cd /d "%~dp0"
rem The ready-to-run package has START-SERVER.cmd beside this file; the app folder has this file in local-server.
if exist "START-SERVER.cmd" (
  set "ROOT=%CD%"
  set "SERVER=%CD%\START-SERVER.cmd"
) else (
  set "ROOT=%CD%\.."
  set "SERVER=%CD%\start-local-server.cmd"
)
for %%r in ("%ROOT%") do set "ROOT=%%~fr"
set "PORT=3000"
if exist "settings.cmd" call "settings.cmd"
set "ICON=%CD%\thsc-queue.ico"
set "DESK_TV=%ROOT%\tv-setup\start-desk-and-tv.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d = [Environment]::GetFolderPath('Desktop'); $url = 'http://localhost:' + $env:PORT + '/'; Set-Content -LiteralPath (Join-Path $d 'THSC Queue Board.url') -Encoding Default -Value @('[InternetShortcut]', ('URL=' + $url), ('IconFile=' + $env:ICON), 'IconIndex=0'); $shell = New-Object -ComObject WScript.Shell; foreach ($i in @(@('THSC Front Desk + TV', $env:DESK_TV, 'Open the front desk, and the TV display on the extended screen'), @('THSC Queue Server', $env:SERVER, 'Start the THSC queue server'))) { $s = $shell.CreateShortcut((Join-Path $d ($i[0] + '.lnk'))); $s.TargetPath = $i[1]; $s.WorkingDirectory = Split-Path $i[1]; $s.IconLocation = $env:ICON + ',0'; $s.WindowStyle = 7; $s.Description = $i[2]; $s.Save() }; Write-Host ('Icons added to ' + $d)"
if errorlevel 1 (
  echo The icons could not be added.
) else (
  echo.
  echo  THSC Queue Board      - the front desk
  echo  THSC Front Desk + TV  - the front desk, and the TV full screen on the second screen
  echo  THSC Queue Server     - starts the queue server if it is not running
)
echo.
if not "%~1"=="quiet" pause
