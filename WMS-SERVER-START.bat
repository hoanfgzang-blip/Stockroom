@echo off
setlocal

set "ROOT=D:\code\WMS"
set "FRONTEND_DIR=%ROOT%\frontend"
set "WEBROOT_DIR=%ROOT%\WMS-\wwwroot"
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"
set "PG_DATA=%LOCALAPPDATA%\WMS-server\postgres-data"
set "PG_LOG=%LOCALAPPDATA%\WMS-server\postgres.log"
set "ASPNETCORE_ENVIRONMENT=Production"

if not exist "%PG_DATA%\PG_VERSION" exit /b 1

if not exist "%FRONTEND_DIR%\package.json" exit /b 1

rem Build the SPA into the ASP.NET static root. Production must expose one origin only.
pushd "%FRONTEND_DIR%"
call npm.cmd run build
if errorlevel 1 (
    popd
    exit /b 1
)
popd
robocopy "%FRONTEND_DIR%\dist" "%WEBROOT_DIR%" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 exit /b 1

"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" status >nul 2>&1
if errorlevel 3 (
        "%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -o "-p 55432" -l "%PG_LOG%" start >nul
    timeout /t 2 /nobreak >nul
)

start "WMS Backend" cmd /c "cd /d ""%ROOT%\WMS-"" && set ASPNETCORE_ENVIRONMENT=Production&& dotnet run --no-launch-profile --project WMS-.csproj --urls http://127.0.0.1:5295"

tasklist /FI "IMAGENAME eq cloudflared.exe" | find /I "cloudflared.exe" >nul
if errorlevel 1 start "WMS Tunnel" /min "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config "%USERPROFILE%\.cloudflared\wms-local.yml" run wms-local

exit /b 0
