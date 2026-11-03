@echo off
setlocal
rem THSC Queue Board - remove all staff accounts (users), e.g. when the only administrator forgot their PIN.
rem Run it on the queue server computer. Afterwards the old shared staff PIN works again: open the THSC Queue Admin
rem icon (or http://localhost:3000/#admin) to create the administrator again, then add the staff accounts again.
rem The settings, the queue and the history are not changed.
cd /d "%~dp0"
title THSC Queue Board - reset the staff accounts
set "NODE=node"
set "PORT=3000"
if exist "settings.cmd" call "settings.cmd"
if exist "node\node.exe" set "NODE=node\node.exe"
if not defined QUEUE_DATA_FILE set "QUEUE_DATA_FILE=%LOCALAPPDATA%\THSC-Queue\queue.json"
echo.
echo  This removes ALL staff accounts (users) of the Queue Board, so the administrator can be created again.
echo  Until then, the old shared staff PIN opens the front desk and stations.
echo.
choice /c YN /m "Remove all staff accounts"
if errorlevel 2 exit /b
echo Stopping the queue server...
taskkill /fi "WINDOWTITLE eq THSC Queue Server*" /t /f >nul 2>nul
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
rem The database (queue.db) when the server uses it, otherwise staff-users.json beside queue.json.
"%NODE%" -e "const fs=require('fs'),path=require('path');const dir=path.dirname(process.env.QUEUE_DATA_FILE);const dbf=path.join(dir,'queue.db');if(fs.existsSync(dbf)){process.emitWarning=()=>{};const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(dbf);db.exec('PRAGMA busy_timeout = 5000');db.prepare('DELETE FROM data WHERE name = ?').run('staff-users')}const f=path.join(dir,'staff-users.json');if(fs.existsSync(f))fs.unlinkSync(f);console.log('The staff accounts were removed.')"
if errorlevel 1 echo Could not remove them. Make sure this is the queue server computer.
echo Starting the queue server again...
if exist "START-SERVER.cmd" (start "THSC Queue Server" /min "%CD%\START-SERVER.cmd") else (start "THSC Queue Server" /min "%CD%\start-local-server.cmd")
echo.
echo  Done. Open the THSC Queue Admin icon to create the administrator again.
pause
