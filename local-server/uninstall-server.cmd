@echo off
setlocal
rem THSC Queue Board - remove the queue server from this computer, e.g. when it moves to another server.
rem Double-click it on the OLD server. It first saves a backup of the queue data and settings on the desktop
rem (recommended, for the new server), then: stops the queue server, removes it from Windows startup, deletes
rem the desktop icons, removes the "THSC Queue Board" firewall rule (Windows asks; click Yes), deletes the queue
rem data and TV pictures (%LOCALAPPDATA%\THSC-Queue) and deletes the program folder.
rem Works in the app folder (local-server\uninstall-server.cmd) and in the ready-to-run package (uninstall-server.cmd).

rem The program folder is deleted too, so this runs from a copy in the Temp folder.
if defined THSC_UNINSTALL_COPY goto run_copy
set "THSC_UNINSTALL_COPY=1"
set "ROOT=%~dp0.."
if exist "%~dp0START-SERVER.cmd" set "ROOT=%~dp0."
copy /y "%~f0" "%TEMP%\thsc-uninstall-server.cmd" >nul
"%TEMP%\thsc-uninstall-server.cmd" "%ROOT%"
:run_copy
cd /d "%~1"
set "ROOT=%CD%"
cd /d "%TEMP%"
title THSC Queue Board - remove the queue server
echo.
echo  THSC Queue Board - remove the queue server from this computer
echo  =============================================================
echo.

rem Only a THSC Queue Board folder is deleted: the app folder, or the ready-to-run package.
set "KIND="
if exist "%ROOT%\START-SERVER.cmd" if exist "%ROOT%\app\server.js" set "KIND=package"
if exist "%ROOT%\local-server\start-local-server.cmd" if exist "%ROOT%\public\thsc-queue-board.html" set "KIND=app"
if not defined KIND goto not_found
set "SETTINGS=%ROOT%\local-server\settings.cmd"
if "%KIND%"=="package" set "SETTINGS=%ROOT%\settings.cmd"
set "PORT=3000"
set "QUEUE_DATA_FILE="
if exist "%SETTINGS%" call "%SETTINGS%"
if not defined QUEUE_DATA_FILE set "QUEUE_DATA_FILE=%LOCALAPPDATA%\THSC-Queue\queue.json"
for %%f in ("%QUEUE_DATA_FILE%") do set "DATA_DIR=%%~dpf"
set "DATA_DIR=%DATA_DIR:~0,-1%"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo  This removes the THSC Queue Board server from this computer:
echo    - stops the queue server
echo    - removes it from Windows startup and deletes its desktop icons
echo    - removes the "THSC Queue Board" firewall rule
echo    - deletes the queue data and TV pictures:  %DATA_DIR%
echo    - deletes the program folder:              %ROOT%
echo  The front desk, stations, TV, kiosk and phones stop working until they use the new server.
echo.
rem (SET clears the error level in a .cmd file, so BACKUP is cleared before CHOICE.)
set "BACKUP="
choice /c YN /m "Save a backup of the queue data and settings on the desktop first (recommended)"
if not errorlevel 2 set "BACKUP=1"
echo.
set "ANSWER="
set /p "ANSWER=Type REMOVE and press Enter to remove the queue server (anything else cancels): "
if /i not "%ANSWER%"=="REMOVE" goto cancelled
echo.

rem ---- 1. Stop the queue server ----
echo  1. Stopping the queue server...
taskkill /fi "WINDOWTITLE eq THSC Queue Server*" /t /f >nul 2>nul
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 3 /nobreak >nul

rem ---- 2. Backup on the desktop: the queue data (with settings and TV pictures) and settings.cmd ----
if not defined BACKUP goto backup_done
echo  2. Saving the backup on the desktop...
for /f "delims=" %%d in ('powershell -NoProfile -Command "Join-Path ([Environment]::GetFolderPath('Desktop')) ('THSC-Queue-Backup-' + (Get-Date -Format 'yyyy-MM-dd-HHmm'))"') do set "BACKUP=%%d"
if "%BACKUP%"=="1" goto backup_failed
mkdir "%BACKUP%\data" 2>nul
if not exist "%BACKUP%\data" goto backup_failed
if not exist "%DATA_DIR%" (echo     No queue data was found at %DATA_DIR%.) else (
  robocopy "%DATA_DIR%" "%BACKUP%\data" /E /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 goto backup_failed
)
if exist "%SETTINGS%" copy /y "%SETTINGS%" "%BACKUP%\settings.cmd" >nul
> "%BACKUP%\HOW-TO-RESTORE.txt" (
  echo THSC Queue Board - backup of the queue server %COMPUTERNAME%, made %DATE% %TIME%
  echo.
  echo The "data" folder holds the settings, configuration PIN, number tags, TV playlist and pictures,
  echo and the queue of that day. settings.cmd holds the staff PIN; open it with Notepad to see it.
  echo.
  echo TO USE IT ON THE NEW SERVER
  echo 1. Set up the queue server on the new computer as usual: local-server\install-local-server.cmd,
  echo    or SETUP.cmd in the ready-to-run package. Use the same staff PIN as in settings.cmd.
  echo    Do not copy settings.cmd itself to the new computer: setup makes its own.
  echo 2. Close the "THSC Queue Server" window on the new computer.
  echo 3. Press Windows+R, type %%LOCALAPPDATA%%\THSC-Queue and press Enter.
  echo    If Windows says it cannot find it, create the THSC-Queue folder in %%LOCALAPPDATA%% first.
  echo 4. Copy everything inside the "data" folder of this backup into it. Choose "Replace the files".
  echo 5. Start the queue server again: the THSC Queue Server icon, or restart the computer.
  echo 6. If the new server has a different IP address, change the QR code address in System configuration,
  echo    the firewall rule in pfSense, tv-setup\queue-server.txt on the TV computers, and the
  echo    bookmarks on the kiosk tablets and staff phones.
)
echo     Saved: %BACKUP%
:backup_done

rem ---- 3. Windows startup, desktop icons and the TV browser profiles ----
echo  3. Removing it from Windows startup and deleting the desktop icons...
del /q "%STARTUP%\THSC Queue Server.cmd" 2>nul
del /q "%STARTUP%\start-desk-and-tv.cmd" 2>nul
powershell -NoProfile -Command "$d = [Environment]::GetFolderPath('Desktop'); foreach ($n in 'THSC Queue Board.url', 'THSC Front Desk + TV.lnk', 'THSC Queue Server.lnk') { Remove-Item -LiteralPath (Join-Path $d $n) -Force -ErrorAction SilentlyContinue }"
rd /s /q "%LOCALAPPDATA%\THSC-TV-Screen" >nul 2>nul
rd /s /q "%LOCALAPPDATA%\THSC-TV" >nul 2>nul

rem ---- 4. The firewall rule (needs administrator rights) ----
powershell -NoProfile -Command "if (Get-NetFirewallRule -DisplayName 'THSC Queue Board' -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if not errorlevel 1 goto firewall_done
echo  4. Removing the firewall rule. Windows asks for permission: click Yes.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile -Command Remove-NetFirewallRule -DisplayName ''THSC Queue Board'''" 2>nul
powershell -NoProfile -Command "if (Get-NetFirewallRule -DisplayName 'THSC Queue Board' -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 echo     The firewall rule is still there. Remove "THSC Queue Board" in Windows Defender Firewall, Inbound Rules.
:firewall_done

rem ---- 5. The queue data and TV pictures: only the queue server's own files ----
echo  5. Deleting the queue data and TV pictures...
del /q "%QUEUE_DATA_FILE%" "%QUEUE_DATA_FILE%.*.tmp" >nul 2>nul
del /q "%DATA_DIR%\telegram-contacts.json" >nul 2>nul
if exist "%DATA_DIR%\media" rd /s /q "%DATA_DIR%\media"
rd "%DATA_DIR%" >nul 2>nul

rem ---- 6. The program folder ----
echo  6. Deleting the program folder %ROOT% (this can take a minute)...
rd /s /q "%ROOT%" >nul 2>nul
if exist "%ROOT%" (set "LEFT=1") else (set "LEFT=")

echo.
echo  Done. The THSC Queue Board server was removed from this computer.
if defined LEFT echo  Some files in %ROOT% are still open: restart the computer, then delete that folder.
if defined BACKUP echo  The backup is on the desktop: %BACKUP% (read HOW-TO-RESTORE.txt there).
if "%KIND%"=="app" echo  Node.js stays installed. Remove it in Settings, Apps if nothing else on this computer uses it.
echo  If the Bluetooth slip printer moves to the new server, remove it here in Settings, Bluetooth and devices.
echo.
pause
del /q "%~f0" >nul 2>nul & exit /b

:not_found
echo This is not a THSC Queue Board folder, so nothing was removed.
echo Run uninstall-server.cmd from the queue server's folder: local-server in the app folder,
echo or the THSC-Queue-Server folder of the ready-to-run package.
pause
exit /b 1
:cancelled
echo Cancelled. Nothing was removed.
pause
exit /b
:backup_failed
echo.
echo The backup could not be saved, so nothing was deleted. The queue server is stopped:
echo start it again with the THSC Queue Server icon, or restart the computer.
pause
exit /b 1
