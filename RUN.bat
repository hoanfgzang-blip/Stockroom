@echo off
setlocal
title WMS Local Runner

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%WMS-"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_URL=http://localhost:5295"
set "FRONTEND_URL=http://localhost:5173"
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"
set "PG_DATA=%LOCALAPPDATA%\WMS-server\postgres-data"
set "PG_LOG=%LOCALAPPDATA%\WMS-server\postgres.log"
set "PG_PORT=55432"

echo ========================================
echo  WMS Local Runner
echo ========================================

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Khong tim thay dotnet trong PATH.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Khong tim thay npm trong PATH.
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\WMS-.csproj" (
    echo [ERROR] Khong tim thay backend WMS tai: %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Khong tim thay frontend WMS tai: %FRONTEND_DIR%
    pause
    exit /b 1
)

if exist "%PG_DATA%\PG_VERSION" (
    "%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" status >nul 2>&1
    if errorlevel 3 (
        echo [1/3] Dang bat PostgreSQL tai cong %PG_PORT%...
        "%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -o "-p %PG_PORT%" -l "%PG_LOG%" start >nul
        timeout /t 2 /nobreak >nul
    ) else (
        echo [OK] PostgreSQL dang chay tai cong %PG_PORT%
    )
) else (
    echo [WARN] Khong tim thay PostgreSQL data tai %PG_DATA%
)

echo [1/2] Dang bat backend tai %BACKEND_URL%...
start "WMS Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && dotnet run --project WMS-.csproj --urls %BACKEND_URL%"

timeout /t 2 /nobreak >nul

echo [2/2] Dang bat frontend tai %FRONTEND_URL%...
if not exist "%FRONTEND_DIR%\node_modules" (
    start "WMS Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm install && npm run dev"
) else (
    start "WMS Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"
)

echo.
echo Da bat local. Doi vai giay roi mo:
echo   Frontend: %FRONTEND_URL%
echo   Backend:  %BACKEND_URL%
echo   Database: 100.125.44.63:%PG_PORT%
echo.
pause

