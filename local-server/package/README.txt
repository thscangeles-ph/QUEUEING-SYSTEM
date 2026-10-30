THSC Queue Board - clinic server package
========================================

This folder turns any Windows 10 or 11 computer into the clinic's queue server.
Everything is included (the app and Node.js), so no internet, installation or build is needed.

SET UP (once per computer)
1. Right-click THSC-Queue-Server.zip and choose "Extract All...". Extract it to C:\
   so you get the folder C:\THSC-Queue-Server. Do not run anything from inside the ZIP.
2. Double-click SETUP.cmd.
   - If Windows says "Windows protected your PC", click "More info", then "Run anyway".
   - Choose the staff PIN (at least 4 characters).
   - Click Yes when Windows asks to open the network port, and "Allow" if the firewall asks about Node.js.
   - Answer Y to start the server whenever the computer turns on.
   - Answer Y to open the front desk and the TV display (full screen, with sound, on the extended
     screen) every time the server starts. To change it later, edit OPEN_DESK_AND_TV in settings.cmd.
     If start-desk-and-tv.cmd was copied into the Startup folder before, delete it there (shell:startup),
     otherwise the desk and TV open twice.
   - Answer Y to put Queue Board icons on the desktop: "THSC Queue Board" (front desk),
     "THSC Front Desk + TV" and "THSC Queue Server". To put them back later, double-click
     make-desktop-icons.cmd.
3. SETUP shows this computer's address, e.g. http://192.168.1.20:3000. Open it on the other computers:
     Front desk:  http://192.168.1.20:3000
     Station C1:  http://192.168.1.20:3000/queue/station?s=C1
     TV:          http://192.168.1.20:3000/queue/display
   On this computer itself, use http://localhost:3000

EVERY DAY
- Keep the minimized "THSC Queue Server" window open. If it was closed, double-click START-SERVER.cmd.
- After the TV is opened or refreshed, click once on it to turn its sound on
  (or use tv-setup\start-desk-and-tv.cmd, which needs no click).

UPDATE TO A NEW VERSION
1. Close the "THSC Queue Server" window.
2. Extract the new ZIP to C:\ and choose "Replace the files". Your PIN (settings.cmd) and the queue are kept.
3. Double-click START-SERVER.cmd (or restart the computer).

GOOD TO KNOW
- The credits folder lists the open-source software inside this package, with its licenses.
- Everything (the queue, settings, every day's visits, TV pictures, Telegram links and messages) is saved in a
  database, %LOCALAPPDATA%\THSC-Queue\queue.db, with a daily copy in its backups folder (the last 30 days).
- Give this computer a fixed address in the router, so the address does not change.
- If other computers or phones cannot connect ("This site can't be reached" / "took too long to respond"),
  double-click fix-network.cmd on this computer: it sets the network to Private, removes firewall rules that
  block Node.js and allows the queue port. The phone must be on the same Wi-Fi as this computer.
- Patients' phones must be on the clinic Wi-Fi to use the QR code.
- Only one computer should be the server. To move it to another computer, see MOVE TO ANOTHER SERVER below.

MOVE TO ANOTHER SERVER (or remove it)
1. On the old server, double-click uninstall-server.cmd. Answer Y to save a backup on the desktop, then type
   REMOVE. It stops the server, removes it from Windows startup, deletes the desktop icons and the firewall
   rule (click Yes when Windows asks), deletes the queue data and this folder.
2. Set up the new server with SETUP.cmd (use the same staff PIN), then follow HOW-TO-RESTORE.txt in the
   backup folder to bring back the settings, TV pictures and the queue.
3. Easiest: give the new server the old server's IP address. Otherwise change the QR code address in
   System configuration, the TV computers' queue-server.txt and the bookmarks on tablets and phones.
