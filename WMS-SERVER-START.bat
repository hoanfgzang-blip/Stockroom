@echo off
setlocal

set "ROOT=D:\code\WMS"
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"
set "PG_DATA=%LOCALAPPDATA%\WMS-server\postgres-data"
set "PG_LOG=%LOCALAPPDATA%\WMS-server\postgres.log"
set "ASPNETCORE_ENVIRONMENT=Development"

if not exist "%PG_DATA%\PG_VERSION" exit /b 1

"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" status >nul 2>&1
if errorlevel 3 (
        "%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -o "-p 55432" -l "%PG_LOG%" start >nul
    timeout /t 2 /nobreak >nul
)

start "WMS Backend" cmd /c "cd /d ""%ROOT%\WMS-"" && set ASPNETCORE_ENVIRONMENT=Development&& dotnet run --project WMS-.csproj --urls http://0.0.0.0:5295"
start "WMS Frontend" cmd /c "cd /d ""%ROOT%\frontend"" && npm.cmd run dev -- --host 0.0.0.0"

tasklist /FI "IMAGENAME eq cloudflared.exe" | find /I "cloudflared.exe" >nul
if errorlevel 1 start "WMS Tunnel" /min "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config "%USERPROFILE%\.cloudflared\wms-local.yml" run wms-local

exit /b 0
