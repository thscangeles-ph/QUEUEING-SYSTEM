@echo off
rem THSC Queue Board - lobby TV.
rem Opens the TV display full screen in Microsoft Edge with sound allowed, so no one has to click.
rem To start it whenever the TV computer turns on: press Windows+R, type shell:startup, press Enter,
rem and copy this file into the folder that opens. To close the TV display, press Alt+F4.

set "TV_URL=https://queueing-system-self.vercel.app/queue/display"

rem A separate Edge profile so these settings apply even if Edge is already open.
start "" msedge --kiosk "%TV_URL%" --edge-kiosk-type=fullscreen --no-first-run --autoplay-policy=no-user-gesture-required --user-data-dir="%LOCALAPPDATA%\THSC-TV"
