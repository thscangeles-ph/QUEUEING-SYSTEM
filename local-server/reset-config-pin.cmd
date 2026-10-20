@echo off
setlocal
rem THSC Queue Board - remove a forgotten configuration PIN (the PIN that opens System configuration).
rem Run it on the queue server computer. Afterwards, open System configuration and create a new PIN.
rem The staff PIN, the settings and today's queue are not changed.
cd /d "%~dp0"
title THSC Queue Board - reset the configuration PIN
rem settings.cmd is beside this file (local-server, or the ready-to-run package, which also has its own Node.js).
set "NODE=node"
if exist "settings.cmd" call "settings.cmd"
if exist "node\node.exe" set "NODE=node\node.exe"
if not defined QUEUE_DATA_FILE set "QUEUE_DATA_FILE=%LOCALAPPDATA%\THSC-Queue\queue.json"
echo.
echo  This removes the configuration PIN, so the next person who opens System configuration
echo  creates a new one. Queue data: %QUEUE_DATA_FILE%
echo.
choice /c YN /m "Remove the configuration PIN"
if errorlevel 2 exit /b
"%NODE%" -e "const fs=require('fs');const f=process.env.QUEUE_DATA_FILE;if(!fs.existsSync(f)){console.log('No queue data was found at '+f+'. Run this on the queue server computer.');process.exit(1)}const d=JSON.parse(fs.readFileSync(f,'utf8'));if(!d.state||!d.state.settings||!d.state.settings.configPin){console.log('No configuration PIN is set.');process.exit(0)}delete d.state.settings.configPin;d.version=(d.version||0)+1;fs.writeFileSync(f+'.reset.tmp',JSON.stringify(d));fs.renameSync(f+'.reset.tmp',f);console.log('The configuration PIN was removed. Open System configuration and create a new one.')"
if errorlevel 1 echo Could not remove it. Make sure this is the queue server computer.
echo.
pause
