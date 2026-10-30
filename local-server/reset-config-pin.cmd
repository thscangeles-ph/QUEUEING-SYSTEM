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
rem The database (queue.db) when the server uses it, otherwise queue.json.
"%NODE%" -e "const fs=require('fs'),path=require('path');const f=process.env.QUEUE_DATA_FILE;const dbf=path.join(path.dirname(f),'queue.db');const done=(m,c)=>{console.log(m);process.exit(c||0)};if(fs.existsSync(dbf)){process.emitWarning=()=>{};const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(dbf);db.exec('PRAGMA busy_timeout = 5000');const r=db.prepare('SELECT state FROM queue_state WHERE id = 1').get();if(!r)done('No queue data was found in '+dbf+'.',1);const s=JSON.parse(r.state);if(!s.settings||!s.settings.configPin)done('No configuration PIN is set.');delete s.settings.configPin;db.prepare('UPDATE queue_state SET state = ?, version = version + 1 WHERE id = 1').run(JSON.stringify(s));done('The configuration PIN was removed. Open System configuration and create a new one.')}if(!fs.existsSync(f))done('No queue data was found at '+f+'. Run this on the queue server computer.',1);const d=JSON.parse(fs.readFileSync(f,'utf8'));if(!d.state||!d.state.settings||!d.state.settings.configPin)done('No configuration PIN is set.');delete d.state.settings.configPin;d.version=(d.version||0)+1;fs.writeFileSync(f+'.reset.tmp',JSON.stringify(d));fs.renameSync(f+'.reset.tmp',f);done('The configuration PIN was removed. Open System configuration and create a new one.')"
if errorlevel 1 echo Could not remove it. Make sure this is the queue server computer.
echo.
pause
