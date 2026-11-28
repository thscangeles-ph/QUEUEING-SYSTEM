@echo off
setlocal
rem THSC Queue Board - put the queue data from the old server on this NEW queue server.
rem Install the queue server first (local-server\install-local-server.cmd, or SETUP.cmd in the ready-to-run
rem package), then double-click this. It finds the newest THSC-Queue-Data-(date) folder made by backup-data.cmd
rem (or THSC-Queue-Backup-(date) made by uninstall-server.cmd) on a USB flash drive or the desktop; you can also
rem drag that folder onto this file. It keeps a copy of this computer's queue data first, then replaces it with
rem the backup and starts the queue server again.
cd /d "%~dp0"
set "HERE=%~dp0"
title THSC Queue Board - put back the queue data
set "PORT=3000"
set "QUEUE_DATA_FILE="
if exist "settings.cmd" call "settings.cmd"
if not defined QUEUE_DATA_FILE set "QUEUE_DATA_FILE=%LOCALAPPDATA%\THSC-Queue\queue.json"
for %%f in ("%QUEUE_DATA_FILE%") do set "DATA_DIR=%%~dpf"
set "DATA_DIR=%DATA_DIR:~0,-1%"
echo.
echo  THSC Queue Board - put back the queue data from the old server
echo  ===============================================================
echo.

rem The backup: the folder dragged onto this file, or the newest one on a USB flash drive or the desktop.
set "SRC=%~1"
if defined SRC goto check_src
for /f "delims=" %%d in ('powershell -NoProfile -Command "$roots = @([Environment]::GetFolderPath('Desktop')); foreach ($u in @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2')) { $roots += $u.DeviceID + '\' }; $best = $null; foreach ($r in $roots) { foreach ($f in @(Get-ChildItem -LiteralPath $r -Directory -ErrorAction SilentlyContinue)) { if ($f.Name -match '^THSC-Queue-(Data|Backup)-' -and ((Test-Path (Join-Path $f.FullName 'data\queue.db')) -or (Test-Path (Join-Path $f.FullName 'data\queue.json')))) { if (-not $best -or $f.LastWriteTime -gt $best.LastWriteTime) { $best = $f } } } }; if ($best) { $best.FullName }"') do set "SRC=%%d"
if not defined SRC goto not_found
:check_src
set "SRC_DATA="
if exist "%SRC%\data\queue.db" set "SRC_DATA=%SRC%\data"
if exist "%SRC%\data\queue.json" set "SRC_DATA=%SRC%\data"
if not defined SRC_DATA if exist "%SRC%\queue.db" set "SRC_DATA=%SRC%"
if not defined SRC_DATA if exist "%SRC%\queue.json" set "SRC_DATA=%SRC%"
if not defined SRC_DATA goto not_found

for /f "delims=" %%t in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd-HHmm'"') do set "STAMP=%%t"
set "KEEP=%DATA_DIR%-before-restore-%STAMP%"

echo  Queue data from the old server:  %SRC_DATA%
echo  goes into this computer's:       %DATA_DIR%
echo.
echo  It REPLACES the queue data on this computer (a copy of it is kept in
echo  %KEEP%^).
echo  The queue server stops for about a minute.
echo.
choice /c YN /m "Put back the queue data now"
if errorlevel 2 goto cancelled
echo.

echo  1. Stopping the queue server...
call "%HERE%stop-queue-server.cmd" %PORT%
if errorlevel 1 goto stop_failed
timeout /t 2 /nobreak >nul

echo  2. Keeping a copy of this computer's queue data...
if exist "%DATA_DIR%" (
  robocopy "%DATA_DIR%" "%KEEP%" /E /R:2 /W:2 /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 goto copy_failed
)

rem Mirror, not just copy: the database's old journal files (queue.db-wal, queue.db-shm) must not stay
rem beside the restored queue.db.
echo  3. Putting back the queue data from the old server...
robocopy "%SRC_DATA%" "%DATA_DIR%" /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto copy_failed

echo  4. Starting the queue server again...
call :start_server
timeout /t 8 /nobreak >nul
start "" "http://localhost:%PORT%/"
echo.
echo  Done. Check in the THSC Queue Board:
echo    - sign in with the OLD administrator username and PIN
echo    - System configuration ^> History shows the old visits
echo    - the TV playlist, stations and QR poster settings are the old ones
echo.
echo  Give this computer the old server's IP address, so the TVs, kiosk, staff computers and the QR code
echo  keep working. Delete the copy on the USB flash drive once everything works ^(it has patient information^).
echo.
pause
exit /b 0

:start_server
if exist "%HERE%START-SERVER.cmd" (start "THSC Queue Server" /min "%HERE%START-SERVER.cmd") else (start "THSC Queue Server" /min "%HERE%start-local-server.cmd")
exit /b 0

:not_found
echo  No queue data from the old server was found.
echo  Plug in the USB flash drive with the THSC-Queue-Data-(date) folder made by backup-data.cmd
echo  on the old server, then run this again. Or drag that folder onto restore-data.cmd.
echo.
pause
exit /b 1

:stop_failed
echo.
echo  The queue server could not be stopped, so nothing was changed. Restart this computer and try again.
echo.
pause
exit /b 1

:copy_failed
echo.
echo  The queue data could not be copied. This computer's own queue data is in
echo    %KEEP%
echo  Starting the queue server again...
call :start_server
echo.
pause
exit /b 1

:cancelled
echo  Cancelled. Nothing was changed.
echo.
pause
exit /b 0
