@echo off
setlocal
rem THSC Queue Board - let phones, tablets and other computers reach this queue server.
rem Run it on the SERVER computer when other devices show "This site can't be reached" or
rem "took too long to respond". It needs administrator rights (Windows asks; click Yes).
rem It: sets the clinic network to Private, removes Windows Firewall rules that block Node.js
rem (made when "Cancel" was clicked on the firewall question), and allows the queue port.
title THSC Queue Board - fix network access
set "PORT=3000"
if exist "%~dp0settings.cmd" call "%~dp0settings.cmd"

net session >nul 2>&1
if not errorlevel 1 goto admin
echo Asking Windows for administrator rights... click Yes.
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b
:admin

echo.
echo  1. Setting the clinic network to Private...
powershell -NoProfile -Command "Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' } | ForEach-Object { Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private; Write-Host ('    ' + $_.InterfaceAlias + ': now Private') }"
echo  2. Removing firewall rules that block Node.js...
powershell -NoProfile -Command "$rules = Get-NetFirewallApplicationFilter | Where-Object { $_.Program -like '*node.exe' } | Get-NetFirewallRule | Where-Object { $_.Action -eq 'Block' -and $_.Direction -eq 'Inbound' }; if ($rules) { $rules | Remove-NetFirewallRule; Write-Host ('    removed ' + @($rules).Count + ' blocking rule(s)') } else { Write-Host '    none found' }"
echo  3. Allowing the queue server port %PORT%...
powershell -NoProfile -Command "Remove-NetFirewallRule -DisplayName 'THSC Queue Board' -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName 'THSC Queue Board' -Direction Inbound -Protocol TCP -LocalPort %PORT% -Action Allow -Profile Any | Out-Null; Write-Host '    allowed on every network'"
echo.
echo  Done. On the phone or tablet, connect to the SAME Wi-Fi as this computer, then open:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|Loopback|Bluetooth' } | ForEach-Object { $t = if ($_.InterfaceAlias -match 'Wi-?Fi|Wireless|WLAN') { 'Wi-Fi:     ' } elseif ($_.InterfaceAlias -match 'Ethernet') { 'LAN cable: ' } else { $_.InterfaceAlias + ': ' }; '    ' + $t + 'http://' + $_.IPAddress + ':%PORT%' }"
echo.
echo  If it still cannot be reached, the phone is probably on a different Wi-Fi (for example a guest
echo  network): on the phone, check that its Wi-Fi IP address starts like the address above.
pause
