@echo off
setlocal
rem THSC Queue Board - update the clinic's local queue server to the newest version.
rem Double-click it to download the newest version from GitHub (needs the internet), or drag a
rem THSC-Queue ZIP file onto it to update from that file. The staff PIN (local-server\settings.cmd),
rem the TV address (tv-setup\queue-server.txt), today's queue and the TV pictures are kept.

rem This file is replaced during the update, so it runs from a copy in the Temp folder.
if defined THSC_UPDATE_COPY goto run_copy
set "THSC_UPDATE_COPY=1"
copy /y "%~f0" "%TEMP%\thsc-update-server.cmd" >nul
"%TEMP%\thsc-update-server.cmd" "%~dp0.." "%~1"
:run_copy
cd /d "%~1"
set "APP=%CD%"
set "ZIP=%~2"
title THSC Queue Board - update the queue server
echo.
echo  THSC Queue Board - update the queue server
echo  ==========================================
echo.
if exist "local-server\settings.cmd" goto have_settings
echo This computer is not set up as the queue server yet. Double-click local-server\install-local-server.cmd first.
pause
exit /b 1
:have_settings
call "local-server\settings.cmd"

rem ---- 1. Get the new version ----
set "WORK=%TEMP%\THSC-Queue-update"
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%"
if defined ZIP goto have_zip
echo Downloading the newest version...
set "ZIP=%WORK%\THSC-Queue.zip"
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = 'Tls12'; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://codeload.github.com/thscangeles-ph/QUEUEING-SYSTEM/zip/refs/heads/main' -OutFile '%ZIP%'"
if errorlevel 1 goto no_download
:have_zip
if not exist "%ZIP%" goto no_download
echo Unpacking %ZIP%...
powershell -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%WORK%\files' -Force"
if errorlevel 1 goto bad_zip
rem The app is the folder in the ZIP that holds package.json.
set "SRC="
for /f "delims=" %%d in ('powershell -NoProfile -Command "(Get-ChildItem -LiteralPath '%WORK%\files' -Recurse -Depth 2 -Filter package.json | Where-Object { Test-Path (Join-Path $_.DirectoryName 'public\thsc-queue-board.html') } | Select-Object -First 1).DirectoryName"') do set "SRC=%%d"
if not defined SRC goto bad_zip

rem ---- 2. Stop the queue server ----
echo Stopping the queue server (the screens reconnect by themselves when it is back)...
taskkill /fi "WINDOWTITLE eq THSC Queue Server*" /t /f >nul 2>nul
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

rem ---- 3. Copy the new version over this one, keeping this computer's settings ----
echo Copying the new version...
robocopy "%SRC%" "%APP%" /E /XD node_modules .next .git .queue-data dist /XF settings.cmd queue-server.txt /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto copy_failed
rem In the app's code folders, files the new version no longer has are removed too.
set "COPY_FAILED="
for %%d in (app components lib public) do (
  robocopy "%SRC%\%%d" "%APP%\%%d" /MIR /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 set "COPY_FAILED=1"
)
if defined COPY_FAILED goto copy_failed

rem ---- 4. Build it (needs the internet when the app's parts changed) ----
echo.
echo Building the new version. This takes a few minutes...
call npx --yes pnpm@11.25.0 install --frozen-lockfile
if errorlevel 1 goto build_failed
call npx --yes pnpm@11.25.0 build
if errorlevel 1 goto build_failed
rmdir /s /q "%WORK%" 2>nul

rem ---- 5. Start it again ----
echo.
echo  Updated. Starting the queue server again...
start "THSC Queue Server" /min "%APP%\local-server\start-local-server.cmd"
timeout /t 8 /nobreak >nul
echo.
echo  Done. The front desk, stations and the TV pick up the new version by themselves within a minute.
echo  If a screen looks old, press F5 on it (or Ctrl+F5).
pause
exit /b

:no_download
echo.
echo Could not download the new version. Check the internet connection and try again,
echo or drag the THSC-Queue ZIP file onto update-server.cmd.
pause
exit /b 1
:bad_zip
echo.
echo That ZIP file is not the THSC Queue Board. Use the THSC-Queue ZIP file.
pause
exit /b 1
:copy_failed
echo.
echo The new files could not be copied. Close any open files from this folder and run the update again.
start "THSC Queue Server" /min "%APP%\local-server\start-local-server.cmd"
pause
exit /b 1
:build_failed
echo.
echo The update did not finish building. Check the internet connection and run update-server.cmd again.
echo Until then the queue server is stopped.
pause
exit /b 1
