@echo off
setlocal
rem THSC Queue Board - copy all the queue data to a USB flash drive (or the desktop), to move the queue server
rem to another computer. Double-click it on the OLD server. It stops the queue server for a moment, copies the
rem queue data folder (%LOCALAPPDATA%\THSC-Queue: patients and History, users, settings, TV playlist and pictures,
rem Telegram links, daily backups) into a THSC-Queue-Data-(date) folder, then starts the queue server again.
rem On the new server: install the queue server first, then double-click restore-data.cmd.
rem Works in the app folder (local-server\backup-data.cmd) and in the ready-to-run package (backup-data.cmd).
cd /d "%~dp0"
set "HERE=%~dp0"
title THSC Queue Board - copy the queue data
set "PORT=3000"
set "QUEUE_DATA_FILE="
if exist "settings.cmd" call "settings.cmd"
if not defined QUEUE_DATA_FILE set "QUEUE_DATA_FILE=%LOCALAPPDATA%\THSC-Queue\queue.json"
for %%f in ("%QUEUE_DATA_FILE%") do set "DATA_DIR=%%~dpf"
set "DATA_DIR=%DATA_DIR:~0,-1%"
echo.
echo  THSC Queue Board - copy the queue data (to move the queue server)
echo  =================================================================
echo.
if not exist "%DATA_DIR%\queue.db" if not exist "%DATA_DIR%\queue.json" goto no_data

rem Where: a folder on the first USB flash drive, otherwise on the desktop.
set "DEST="
for /f "delims=" %%d in ('powershell -NoProfile -Command "$root = [Environment]::GetFolderPath('Desktop'); foreach ($u in @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2')) { if ($u.FreeSpace -gt 0) { $root = $u.DeviceID + '\'; break } }; Join-Path $root ('THSC-Queue-Data-' + (Get-Date -Format 'yyyy-MM-dd-HHmm'))"') do set "DEST=%%d"
if not defined DEST goto copy_failed

echo  This copies the queue data:  %DATA_DIR%
echo  to:                          %DEST%
echo  (patients and History, users, settings, TV playlist and pictures, Telegram links, daily backups)
echo.
echo  To save it on a USB flash drive, plug the drive in BEFORE you start this.
echo  The queue server stops for about a minute while it copies: do this when no patient is waiting.
echo.
choice /c YN /m "Copy the queue data now"
if errorlevel 2 goto cancelled
echo.

echo  1. Stopping the queue server...
call "%HERE%stop-queue-server.cmd" %PORT%
if errorlevel 1 goto stop_failed
timeout /t 2 /nobreak >nul

echo  2. Copying the queue data...
robocopy "%DATA_DIR%" "%DEST%\data" /E /R:2 /W:2 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto copy_failed
> "%DEST%\READ-ME.txt" (
  echo THSC Queue Board - queue data of the queue server %COMPUTERNAME%, copied %DATE% %TIME%
  echo.
  echo The "data" folder has the patients and History, users, settings, TV playlist and pictures,
  echo Telegram links and the daily backups. It has patient information: keep it safe, and delete
  echo this folder once the new queue server works.
  echo.
  echo On the NEW server:
  echo 1. Install the queue server first: local-server\install-local-server.cmd in the app folder
  echo    ^(or SETUP.cmd in the ready-to-run package^), with the same staff PIN as the old server.
  echo 2. Plug in this USB flash drive, then double-click local-server\restore-data.cmd
  echo    ^(restore-data.cmd in the package^). It finds this folder and puts the data back.
  echo    You can also drag this folder onto restore-data.cmd.
)

echo  3. Starting the queue server again...
call :start_server
echo.
echo  Done. The queue data is in:
echo    %DEST%
echo.
echo  On the NEW server: install the queue server first, plug in this USB flash drive,
echo  then double-click restore-data.cmd in its local-server folder.
echo  This copy has patient information: keep it safe, and delete it once the new server works.
start "" explorer "%DEST%"
echo.
pause
exit /b 0

:start_server
if exist "%HERE%START-SERVER.cmd" (start "THSC Queue Server" /min "%HERE%START-SERVER.cmd") else (start "THSC Queue Server" /min "%HERE%start-local-server.cmd")
exit /b 0

:no_data
echo  No queue data was found in %DATA_DIR%.
echo  Run this on the queue server computer, as the Windows user that runs the queue server.
echo.
pause
exit /b 1

:stop_failed
echo.
echo  The queue server could not be stopped, so nothing was copied. Restart this computer and try again.
echo.
pause
exit /b 1

:copy_failed
echo.
echo  The queue data could not be copied ^(is the USB flash drive full or removed?^).
echo  Starting the queue server again...
call :start_server
echo.
pause
exit /b 1

:cancelled
echo  Cancelled. Nothing was copied.
echo.
pause
exit /b 0
