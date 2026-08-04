@echo off
setlocal

call "%~dp0WMS-SERVER-START.bat"

echo.
echo WMS server da khoi dong.
echo Website:  https://wms.ice-tcv.id.vn
echo Frontend: http://100.125.44.63:5173
echo Backend:  http://100.125.44.63:5295
echo Database: 100.125.44.63:55432 (Tailscale)
echo.
pause
